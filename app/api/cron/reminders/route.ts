import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNowInKolkata, computeNextDueDate, formatToKolkataDateString } from "@/lib/dates";
import { calculateLoanDetails } from "@/lib/calculations";
import {
  sendOwnerReminder,
  sendBorrowerReminder,
  sendOwnerDailyDigest,
  sendOverdueEmiDigestToOwner,
  DigestItem,
  OverdueEmiItem,
} from "@/lib/email";
import { syncOverdueInstallments } from "@/lib/installments";
import Decimal from "decimal.js";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Vercel Cron Authorization header
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, enforce Bearer check
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const today = getNowInKolkata();
    const todayStr = formatToKolkataDateString(today);

    // 0. Auto-transition any past-due PENDING installments to OVERDUE
    await syncOverdueInstallments();

    // 0.1 Check overdue EMI installments for 2-day self-reminders to owner
    const overdueInstallments = await prisma.emiInstallment.findMany({
      where: { status: "OVERDUE" },
      include: {
        loan: {
          include: { borrower: true },
        },
      },
    });

    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const emiOverdueToSend: OverdueEmiItem[] = [];
    const emiOverdueIdsToUpdate: string[] = [];

    for (const inst of overdueInstallments) {
      const lastSentTime = inst.lastReminderAt ? new Date(inst.lastReminderAt).getTime() : 0;
      const isDueForReminder =
        !inst.lastReminderAt || today.getTime() - lastSentTime >= twoDaysMs - 60000;

      if (isDueForReminder) {
        const daysOverdue = Math.max(
          1,
          Math.round((today.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        );
        emiOverdueToSend.push({
          installmentId: inst.id,
          borrowerName: inst.loan.borrower.name,
          installmentNo: inst.installmentNo,
          amount: inst.amount.toString(),
          dueDate: inst.dueDate,
          daysOverdue,
          loanId: inst.loanId,
        });
        emiOverdueIdsToUpdate.push(inst.id);
      }
    }

    if (emiOverdueToSend.length > 0) {
      await sendOverdueEmiDigestToOwner(emiOverdueToSend);
      await prisma.emiInstallment.updateMany({
        where: { id: { in: emiOverdueIdsToUpdate } },
        data: { lastReminderAt: today },
      });
      for (const item of emiOverdueToSend) {
        await prisma.reminderLog
          .upsert({
            where: {
              loanId_dueDate_trigger_recipient: {
                loanId: item.loanId,
                dueDate: new Date(item.dueDate),
                trigger: "OVERDUE",
                recipient: "OWNER",
              },
            },
            update: { sentAt: today },
            create: {
              loanId: item.loanId,
              dueDate: new Date(item.dueDate),
              trigger: "OVERDUE",
              recipient: "OWNER",
              sentAt: today,
            },
          })
          .catch(() => {});
      }
    }

    // 2. Fetch all ACTIVE loans with borrower, payments, and existing reminderLogs
    const activeLoans = await prisma.loan.findMany({
      where: { status: "ACTIVE" },
      include: {
        borrower: true,
        payments: true,
        reminderLogs: true,
      },
    });

    let remindersSent = 0;
    const digestItems: DigestItem[] = [];

    for (const loan of activeLoans) {
      const calculations = calculateLoanDetails(loan, loan.payments);
      if (calculations.isAutoClosed) {
        // Auto-close if balance is cleared
        await prisma.loan.update({
          where: { id: loan.id },
          data: { status: "CLOSED" },
        });
        continue;
      }

      // Check cycle payment coverage
      // Calculate amount due per monthly cycle
      let monthlyCycleDue = new Decimal(0);
      let isCurrentCyclePaid = false;

      if (loan.type === "INTEREST_ONLY") {
        monthlyCycleDue = new Decimal(calculations.monthlyInterestDue || 0);
        // If interest due is 0 (e.g. principal cleared), skip
        if (monthlyCycleDue.lessThanOrEqualTo(0)) continue;
      } else if (loan.type === "FLEXIBLE") {
        // Flexible debt: monthly reminder reminds of current pending balance
        monthlyCycleDue = new Decimal(calculations.remainingAmount || 0);
        if (monthlyCycleDue.lessThanOrEqualTo(0)) continue;
      } else {
        monthlyCycleDue = new Decimal(loan.monthlyAmount || 0);
        if (monthlyCycleDue.lessThanOrEqualTo(0)) continue;
      }

      // Compute tentative next due date
      const tentativeDue = computeNextDueDate(loan.startDate, loan.dueDay, today, false);

      // Check if candidate due date cycle is already paid:
      // A due month counts as paid when payments recorded for that cycle cover the amount due.
      // We check payments recorded in the current month cycle:
      const cycleDueDate = tentativeDue.dueDate;
      const cycleDueDateStr = tentativeDue.dueDateString;

      // Filter payments made up to current cycle due date or within current month
      const totalPaidDec = new Decimal(calculations.totalPaid || 0);
      const totalPayableDec = new Decimal(calculations.totalPayable || 0);

      // For EMI/INTEREST_FREE: remaining amount <= 0 means fully paid
      if (calculations.isAutoClosed) {
        continue;
      }

      const nextDue = tentativeDue;
      const daysUntilDue = nextDue.daysUntilDue;
      const dueDateObj = nextDue.dueDate;

      let dueAmountStr = monthlyCycleDue.toFixed(2);
      const outstandingBal =
        loan.type === "INTEREST_ONLY"
          ? calculations.outstandingPrincipal || "0.00"
          : calculations.remainingAmount || "0.00";

      // 3. Check trigger conditions:
      // Condition A: BEFORE trigger (daysUntilDue > 0 and daysUntilDue in remindDaysBefore)
      const shouldTriggerBefore =
        daysUntilDue > 0 &&
        loan.remindDaysBefore.includes(daysUntilDue);

      // Condition B: ON_DAY trigger (daysUntilDue === 0 and remindOnDueDay is true)
      const shouldTriggerOnDay = daysUntilDue === 0 && loan.remindOnDueDay;

      // Condition C: OVERDUE (daysUntilDue < 0)
      const isOverdue = daysUntilDue < 0;

      // Process BEFORE Reminder
      if (shouldTriggerBefore) {
        // Owner BEFORE check
        const ownerLog = await prisma.reminderLog.findUnique({
          where: {
            loanId_dueDate_trigger_recipient: {
              loanId: loan.id,
              dueDate: dueDateObj,
              trigger: "BEFORE",
              recipient: "OWNER",
            },
          },
        });

        if (!ownerLog) {
          const sent = await sendOwnerReminder({
            borrowerName: loan.borrower.name,
            loanType: loan.type,
            amountDue: dueAmountStr,
            dueDate: dueDateObj,
            outstandingBalance: outstandingBal,
            loanId: loan.id,
            triggerType: "BEFORE",
            daysLeft: daysUntilDue,
          });

          if (sent) {
            await prisma.reminderLog.create({
              data: {
                loanId: loan.id,
                dueDate: dueDateObj,
                trigger: "BEFORE",
                recipient: "OWNER",
              },
            });
            remindersSent++;
            digestItems.push({
              borrowerName: loan.borrower.name,
              loanType: loan.type,
              amountDue: dueAmountStr,
              dueDate: dueDateObj,
              outstandingBalance: outstandingBal,
              statusText: `Due in ${daysUntilDue} day(s)`,
              loanId: loan.id,
            });
          }
        }

        // Borrower BEFORE check
        if (loan.remindBorrower && loan.borrower.email) {
          const borrowerLog = await prisma.reminderLog.findUnique({
            where: {
              loanId_dueDate_trigger_recipient: {
                loanId: loan.id,
                dueDate: dueDateObj,
                trigger: "BEFORE",
                recipient: "BORROWER",
              },
            },
          });

          if (!borrowerLog) {
            const sent = await sendBorrowerReminder({
              borrowerName: loan.borrower.name,
              borrowerEmail: loan.borrower.email,
              amountDue: dueAmountStr,
              dueDate: dueDateObj,
              triggerType: "BEFORE",
              daysLeft: daysUntilDue,
            });

            if (sent) {
              await prisma.reminderLog.create({
                data: {
                  loanId: loan.id,
                  dueDate: dueDateObj,
                  trigger: "BEFORE",
                  recipient: "BORROWER",
                },
              });
              remindersSent++;
            }
          }
        }
      }

      // Process ON_DAY Reminder
      if (shouldTriggerOnDay) {
        // Owner ON_DAY check
        const ownerLog = await prisma.reminderLog.findUnique({
          where: {
            loanId_dueDate_trigger_recipient: {
              loanId: loan.id,
              dueDate: dueDateObj,
              trigger: "ON_DAY",
              recipient: "OWNER",
            },
          },
        });

        if (!ownerLog) {
          const sent = await sendOwnerReminder({
            borrowerName: loan.borrower.name,
            loanType: loan.type,
            amountDue: dueAmountStr,
            dueDate: dueDateObj,
            outstandingBalance: outstandingBal,
            loanId: loan.id,
            triggerType: "ON_DAY",
            daysLeft: 0,
          });

          if (sent) {
            await prisma.reminderLog.create({
              data: {
                loanId: loan.id,
                dueDate: dueDateObj,
                trigger: "ON_DAY",
                recipient: "OWNER",
              },
            });
            remindersSent++;
            digestItems.push({
              borrowerName: loan.borrower.name,
              loanType: loan.type,
              amountDue: dueAmountStr,
              dueDate: dueDateObj,
              outstandingBalance: outstandingBal,
              statusText: "DUE TODAY",
              loanId: loan.id,
            });
          }
        }

        // Borrower ON_DAY check
        if (loan.remindBorrower && loan.borrower.email) {
          const borrowerLog = await prisma.reminderLog.findUnique({
            where: {
              loanId_dueDate_trigger_recipient: {
                loanId: loan.id,
                dueDate: dueDateObj,
                trigger: "ON_DAY",
                recipient: "BORROWER",
              },
            },
          });

          if (!borrowerLog) {
            const sent = await sendBorrowerReminder({
              borrowerName: loan.borrower.name,
              borrowerEmail: loan.borrower.email,
              amountDue: dueAmountStr,
              dueDate: dueDateObj,
              triggerType: "ON_DAY",
            });

            if (sent) {
              await prisma.reminderLog.create({
                data: {
                  loanId: loan.id,
                  dueDate: dueDateObj,
                  trigger: "ON_DAY",
                  recipient: "BORROWER",
                },
              });
              remindersSent++;
            }
          }
        }
      }

      // Process DAILY OVERDUE reminder to owner only
      if (isOverdue) {
        const daysOverdue = Math.abs(daysUntilDue);
        // Overdue reminders to owner: send daily and include in digest
        await sendOwnerReminder({
          borrowerName: loan.borrower.name,
          loanType: loan.type,
          amountDue: dueAmountStr,
          dueDate: dueDateObj,
          outstandingBalance: outstandingBal,
          loanId: loan.id,
          triggerType: "OVERDUE",
          daysLeft: -daysOverdue,
        });
        remindersSent++;

        digestItems.push({
          borrowerName: loan.borrower.name,
          loanType: loan.type,
          amountDue: dueAmountStr,
          dueDate: dueDateObj,
          outstandingBalance: outstandingBal,
          statusText: `OVERDUE by ${daysOverdue}d`,
          loanId: loan.id,
        });
      }
    }

    // 4. If multiple reminders fired today, send combined daily digest to owner
    if (digestItems.length > 1) {
      await sendOwnerDailyDigest(digestItems);
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      activeLoansChecked: activeLoans.length,
      digestCount: digestItems.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("Cron reminders error:", error);
    return NextResponse.json(
      { error: error.message || "Cron processing failed" },
      { status: 500 }
    );
  }
}

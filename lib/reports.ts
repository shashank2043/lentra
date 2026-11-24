import { prisma } from "./prisma";
import { calculateLoanDetails } from "./calculations";
import { getNowInKolkata, formatToKolkataDateString } from "./dates";
import { formatReadableDate } from "./format";
import { syncOverdueInstallments, calculateLoanDueStatus } from "./installments";
import {
  sendOwnerConsolidatedReport,
  sendBorrowerReminder,
  ConsolidatedReportData,
  BorrowerReportGroup,
  LoanReportItem,
} from "./email";
import Decimal from "decimal.js";

interface ReportOptions {
  markReminders?: boolean;
  appUrl?: string;
}

export async function generateAndSendConsolidatedReport(options: ReportOptions = {}) {
  const { markReminders = true, appUrl } = options;
  const today = getNowInKolkata();
  const todayStr = formatToKolkataDateString(today);
  const ownerEmail = (process.env.OWNER_EMAIL || process.env.GMAIL_USER || "").toLowerCase();

  // 1. Sync any past-due installments to OVERDUE
  await syncOverdueInstallments();

  // 2. Query all ACTIVE loans
  const activeLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE" },
    include: {
      borrower: true,
      payments: true,
      installments: {
        orderBy: { installmentNo: "asc" },
      },
    },
    orderBy: [{ borrower: { name: "asc" } }, { createdAt: "asc" }],
  });

  const borrowerMap = new Map<string, {
    borrowerId: string;
    borrowerName: string;
    borrowerPhone?: string | null;
    borrowerEmail?: string | null;
    totalPrincipal: Decimal;
    totalPaid: Decimal;
    totalOwed: Decimal;
    totalDueNow: Decimal;
    totalDueNextMonth: Decimal;
    totalOverdue: Decimal;
    status: "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "NORMAL";
    loans: LoanReportItem[];
  }>();

  let globalLentOut = new Decimal(0);
  let globalCollected = new Decimal(0);
  let globalOutstandingOwed = new Decimal(0);
  let globalOverdueAmount = new Decimal(0);
  let globalDueTodayAmount = new Decimal(0);
  let globalDueNextMonth = new Decimal(0);
  let globalOverdueCount = 0;
  let globalDueTodayCount = 0;

  const overdueInstallmentIdsToUpdate: string[] = [];
  const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
  const nextMonthEnd = new Date(today.getTime() + thirtyOneDaysMs);

  for (const loan of activeLoans) {
    const calc = calculateLoanDetails(loan, loan.payments);

    // Auto-close loan if balance is fully cleared
    if (calc.isAutoClosed) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { status: "CLOSED" },
      });
      continue;
    }

    const principalDec = new Decimal(loan.principalAmount || 0);
    const paidDec = new Decimal(calc.totalPaid || 0);
    const owedDec = new Decimal(
      loan.type === "INTEREST_ONLY"
        ? calc.outstandingPrincipal || 0
        : calc.remainingAmount || 0
    );

    // Monthly cycle amount due
    let monthlyCycleDueDec = new Decimal(0);
    if (loan.type === "INTEREST_ONLY") {
      monthlyCycleDueDec = new Decimal(calc.monthlyInterestDue || 0);
    } else if (loan.type === "FLEXIBLE") {
      monthlyCycleDueDec = owedDec;
    } else {
      monthlyCycleDueDec = new Decimal(loan.monthlyAmount || 0);
    }

    // Compute authoritative next due date & status
    const dueStatus = calculateLoanDueStatus(loan, calc, today);
    const daysUntilDue = dueStatus.daysUntilDue;
    const dueDateObj = dueStatus.dueDate || today;

    // Check overdue installments for EMI loans
    const overdueInsts = loan.installments.filter((inst) => inst.status === "OVERDUE");
    const overdueInstallmentItems = overdueInsts.map((inst) => {
      const daysOverdue = Math.max(
        1,
        Math.round((today.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      overdueInstallmentIdsToUpdate.push(inst.id);
      return {
        installmentNo: inst.installmentNo,
        amount: inst.amount.toString(),
        dueDate: inst.dueDate,
        daysOverdue,
      };
    });

    // Determine status of this loan
    let statusType: "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "NORMAL" = "NORMAL";
    let statusText = `Next due in ${daysUntilDue}d`;

    const isLoanOverdue = dueStatus.isOverdue;
    const isDueToday = !isLoanOverdue && daysUntilDue === 0;
    const isDueSoon = !isLoanOverdue && daysUntilDue > 0 && loan.remindDaysBefore.includes(daysUntilDue);

    // Calculate Overdue and Next Month Due (installments only)
    let loanOverdueAmount = new Decimal(0);
    let loanNextMonthInstallments = new Decimal(0);

    if (overdueInstallmentItems.length > 0) {
      for (const inst of overdueInstallmentItems) {
        loanOverdueAmount = loanOverdueAmount.plus(inst.amount);
      }
    } else if (isLoanOverdue) {
      loanOverdueAmount = monthlyCycleDueDec;
    }

    if (loan.type === "EMI" || loan.type === "INTEREST_FREE") {
      const upcomingInsts = loan.installments.filter((inst) => {
        if (inst.status !== "PENDING") return false;
        const dTime = new Date(inst.dueDate).getTime();
        return dTime >= today.getTime() - 24 * 60 * 60 * 1000 && dTime <= nextMonthEnd.getTime();
      });

      if (upcomingInsts.length > 0) {
        for (const inst of upcomingInsts) {
          loanNextMonthInstallments = loanNextMonthInstallments.plus(inst.amount);
        }
      } else if (daysUntilDue >= 0 && daysUntilDue <= 31 && loan.monthlyAmount) {
        loanNextMonthInstallments = new Decimal(loan.monthlyAmount);
      }
    } else if (loan.type === "INTEREST_ONLY") {
      if (daysUntilDue >= 0 && daysUntilDue <= 31) {
        loanNextMonthInstallments = monthlyCycleDueDec;
      }
    }

    if (isLoanOverdue) {
      statusType = "OVERDUE";
      const delayDays = daysUntilDue < 0 ? Math.abs(daysUntilDue) : (overdueInstallmentItems[0]?.daysOverdue || 1);
      statusText = `OVERDUE by ${delayDays}d`;
      globalOverdueCount++;
      globalOverdueAmount = globalOverdueAmount.plus(loanOverdueAmount);
    } else if (isDueToday) {
      statusType = "DUE_TODAY";
      statusText = "DUE TODAY";
      globalDueTodayCount++;
      globalDueTodayAmount = globalDueTodayAmount.plus(monthlyCycleDueDec);
    } else if (isDueSoon) {
      statusType = "DUE_SOON";
      statusText = `Due in ${daysUntilDue}d`;
    }

    globalDueNextMonth = globalDueNextMonth.plus(loanNextMonthInstallments);

    // Borrower reminders handling (sent ONLY to borrower email, NEVER to owner email)
    if (
      markReminders &&
      loan.remindBorrower &&
      loan.borrower.email &&
      loan.borrower.email.toLowerCase() !== ownerEmail
    ) {
      if (isDueSoon || isDueToday) {
        const trigger = isDueToday ? "ON_DAY" : "BEFORE";
        const borrowerLog = await prisma.reminderLog.findUnique({
          where: {
            loanId_dueDate_trigger_recipient: {
              loanId: loan.id,
              dueDate: dueDateObj,
              trigger,
              recipient: "BORROWER",
            },
          },
        });

        if (!borrowerLog) {
          const sent = await sendBorrowerReminder({
            borrowerName: loan.borrower.name,
            borrowerEmail: loan.borrower.email,
            amountDue: monthlyCycleDueDec.toFixed(2),
            dueDate: dueDateObj,
            triggerType: trigger,
            daysLeft: isDueToday ? 0 : daysUntilDue,
          });

          if (sent) {
            await prisma.reminderLog.create({
              data: {
                loanId: loan.id,
                dueDate: dueDateObj,
                trigger,
                recipient: "BORROWER",
              },
            }).catch(() => {});
          }
        }
      }
    }

    // Record ReminderLog for audit trail to prevent duplicate cron logging
    if (markReminders) {
      const trigger = isLoanOverdue ? "OVERDUE" : isDueToday ? "ON_DAY" : isDueSoon ? "BEFORE" : null;
      if (trigger) {
        await prisma.reminderLog
          .upsert({
            where: {
              loanId_dueDate_trigger_recipient: {
                loanId: loan.id,
                dueDate: dueDateObj,
                trigger,
                recipient: "OWNER",
              },
            },
            update: { sentAt: today },
            create: {
              loanId: loan.id,
              dueDate: dueDateObj,
              trigger,
              recipient: "OWNER",
              sentAt: today,
            },
          })
          .catch(() => {});
      }
    }

    // Add to borrower map
    const bId = loan.borrowerId;
    if (!borrowerMap.has(bId)) {
      borrowerMap.set(bId, {
        borrowerId: bId,
        borrowerName: loan.borrower.name,
        borrowerPhone: loan.borrower.phone,
        borrowerEmail: loan.borrower.email,
        totalPrincipal: new Decimal(0),
        totalPaid: new Decimal(0),
        totalOwed: new Decimal(0),
        totalDueNow: new Decimal(0),
        totalDueNextMonth: new Decimal(0),
        totalOverdue: new Decimal(0),
        status: "NORMAL",
        loans: [],
      });
    }

    const bData = borrowerMap.get(bId)!;
    bData.totalPrincipal = bData.totalPrincipal.plus(principalDec);
    bData.totalPaid = bData.totalPaid.plus(paidDec);
    bData.totalOwed = bData.totalOwed.plus(owedDec);
    bData.totalDueNextMonth = bData.totalDueNextMonth.plus(loanNextMonthInstallments);
    bData.totalOverdue = bData.totalOverdue.plus(loanOverdueAmount);

    if (isLoanOverdue) {
      bData.status = "OVERDUE";
      bData.totalDueNow = bData.totalDueNow.plus(monthlyCycleDueDec);
    } else if (isDueToday && bData.status !== "OVERDUE") {
      bData.status = "DUE_TODAY";
      bData.totalDueNow = bData.totalDueNow.plus(monthlyCycleDueDec);
    } else if (isDueSoon && bData.status !== "OVERDUE" && bData.status !== "DUE_TODAY") {
      bData.status = "DUE_SOON";
    }

    bData.loans.push({
      loanId: loan.id,
      loanType: loan.type,
      principalAmount: principalDec.toFixed(2),
      totalPaid: paidDec.toFixed(2),
      remainingAmount: owedDec.toFixed(2),
      monthlyCycleDue: monthlyCycleDueDec.toFixed(2),
      dueDate: dueDateObj,
      dueDateFormatted: dueStatus.nextDueDate,
      daysUntilDue,
      statusText,
      statusType,
      overdueInstallments: overdueInstallmentItems.length > 0 ? overdueInstallmentItems : undefined,
    });

    globalLentOut = globalLentOut.plus(principalDec);
    globalCollected = globalCollected.plus(paidDec);
    globalOutstandingOwed = globalOutstandingOwed.plus(owedDec);
  }

  // Update lastReminderAt for overdue installments
  if (markReminders && overdueInstallmentIdsToUpdate.length > 0) {
    await prisma.emiInstallment.updateMany({
      where: { id: { in: overdueInstallmentIdsToUpdate } },
      data: { lastReminderAt: today },
    });
  }

  // Convert borrower map to sorted array
  const statusPriority = { OVERDUE: 0, DUE_TODAY: 1, DUE_SOON: 2, NORMAL: 3 };
  const borrowerList: BorrowerReportGroup[] = Array.from(borrowerMap.values())
    .map((b) => ({
      borrowerId: b.borrowerId,
      borrowerName: b.borrowerName,
      borrowerPhone: b.borrowerPhone,
      borrowerEmail: b.borrowerEmail,
      totalPrincipal: b.totalPrincipal.toFixed(2),
      totalPaid: b.totalPaid.toFixed(2),
      totalOwed: b.totalOwed.toFixed(2),
      totalDueNow: b.totalDueNow.toFixed(2),
      totalDueNextMonth: b.totalDueNextMonth.toFixed(2),
      totalOverdue: b.totalOverdue.toFixed(2),
      status: b.status,
      loans: b.loans,
    }))
    .sort((a, b) => {
      // 1. Overdue first, then Due Today, then Due Soon, then Normal
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      // 2. Total overdue descending
      const overdueDiff = new Decimal(b.totalOverdue).minus(new Decimal(a.totalOverdue)).toNumber();
      if (overdueDiff !== 0) return overdueDiff;
      // 3. Next month due descending
      const nextMonthDiff = new Decimal(b.totalDueNextMonth).minus(new Decimal(a.totalDueNextMonth)).toNumber();
      if (nextMonthDiff !== 0) return nextMonthDiff;
      // 4. Total owed descending
      return new Decimal(b.totalOwed).minus(new Decimal(a.totalOwed)).toNumber();
    });

  const totalActiveLoans = Array.from(borrowerMap.values()).reduce(
    (sum, b) => sum + b.loans.length,
    0
  );

  const reportData: ConsolidatedReportData = {
    reportDate: formatReadableDate(today),
    totalBorrowers: borrowerList.length,
    totalActiveLoans,
    totalLentOut: globalLentOut.toFixed(2),
    totalCollected: globalCollected.toFixed(2),
    totalOutstandingOwed: globalOutstandingOwed.toFixed(2),
    totalOverdueAmount: globalOverdueAmount.toFixed(2),
    totalDueNextMonth: globalDueNextMonth.toFixed(2),
    totalDueTodayAmount: globalDueTodayAmount.toFixed(2),
    overdueCount: globalOverdueCount,
    dueTodayCount: globalDueTodayCount,
    borrowers: borrowerList,
    appUrl,
  };

  // SEND THE SINGLE CONSOLIDATED EMAIL TO OWNER
  let emailSent = false;
  if (borrowerList.length > 0) {
    emailSent = await sendOwnerConsolidatedReport(reportData);
  }

  return {
    success: true,
    emailSent,
    reportData,
  };
}

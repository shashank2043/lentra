import { prisma } from "./prisma";
import {
  getNowInKolkata,
  getClampedDueDate,
  parseKolkataDate,
  formatToKolkataDateString,
  getCalendarDayDifference,
  computeNextDueDate,
} from "./dates";
import Decimal from "decimal.js";

/**
 * Automatically transitions any PENDING installments whose due date is in the past (before today in IST) to OVERDUE.
 * Also generates in-app notifications for newly overdue items.
 */
export async function syncOverdueInstallments(): Promise<{ transitionedCount: number }> {
  const today = getNowInKolkata();
  const todayStr = formatToKolkataDateString(today);
  const todayStart = parseKolkataDate(todayStr);

  // Find all PENDING installments with dueDate < todayStart
  const pastPending = await prisma.emiInstallment.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: todayStart },
    },
    select: {
      id: true,
      amount: true,
      installmentNo: true,
      dueDate: true,
      loan: {
        select: {
          borrowerId: true,
          borrower: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (pastPending.length === 0) {
    return { transitionedCount: 0 };
  }

  // Update them to OVERDUE
  const ids = pastPending.map((p) => p.id);
  await prisma.emiInstallment.updateMany({
    where: { id: { in: ids } },
    data: { status: "OVERDUE" },
  });

  // Create InAppNotifications for these overdue installments
  for (const item of pastPending) {
    const formattedAmt = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(item.amount));

    await prisma.inAppNotification.create({
      data: {
        title: `Overdue: ${item.loan.borrower.name}`,
        message: `EMI #${item.installmentNo} (${formattedAmt}) was due on ${formatToKolkataDateString(item.dueDate)} and is now overdue.`,
        type: "OVERDUE",
        link: `/dues?borrowerId=${item.loan.borrowerId}`,
      },
    });
  }

  return { transitionedCount: pastPending.length };
}

/**
 * Generates the full installment schedule for an EMI loan.
 * If remainingMonths < totalMonths, the already paid installments (1 to totalMonths - remainingMonths)
 * are created as PAID and linked to historical payments.
 */
export async function generateLoanSchedule(params: {
  loanId: string;
  startDate: Date | string;
  dueDay: number;
  monthlyAmount: Decimal.Value;
  totalMonths: number;
  remainingMonths?: number;
}) {
  const { loanId, dueDay, totalMonths, monthlyAmount } = params;
  const remMonths = params.remainingMonths !== undefined ? params.remainingMonths : totalMonths;
  const paidCount = Math.max(0, totalMonths - remMonths);

  const startD = typeof params.startDate === "string" ? new Date(params.startDate) : params.startDate;
  const startYear = startD.getUTCFullYear();
  const startMonth = startD.getUTCMonth();

  const today = getNowInKolkata();
  const todayStr = formatToKolkataDateString(today);
  const todayStart = parseKolkataDate(todayStr);

  const amountDec = new Decimal(monthlyAmount);

  for (let i = 1; i <= totalMonths; i++) {
    let dueYear = startYear;
    let dueMonth = startMonth + i;
    while (dueMonth >= 12) {
      dueMonth -= 12;
      dueYear += 1;
    }

    const dueDate = getClampedDueDate(dueYear, dueMonth + 1, dueDay);

    if (i <= paidCount) {
      // Historical paid installment: create Payment record and mark as PAID
      const payment = await prisma.payment.create({
        data: {
          loanId,
          amount: amountDec.toFixed(2),
          paidOn: dueDate,
          kind: "INSTALLMENT",
          note: `Pre-existing installment #${i} of ${totalMonths}`,
        },
      });

      await prisma.emiInstallment.create({
        data: {
          loanId,
          installmentNo: i,
          dueDate,
          amount: amountDec.toFixed(2),
          status: "PAID",
          paidAt: dueDate,
          paymentId: payment.id,
          notes: `Installment #${i} of ${totalMonths}`,
        },
      });
    } else {
      // Remaining installment: check if already overdue or pending
      const isPast = dueDate < todayStart;
      await prisma.emiInstallment.create({
        data: {
          loanId,
          installmentNo: i,
          dueDate,
          amount: amountDec.toFixed(2),
          status: isPast ? "OVERDUE" : "PENDING",
          notes: `Installment #${i} of ${totalMonths}`,
        },
      });
    }
  }
}

/**
 * Marks 1 specific EMI installment as PAID.
 * Automatically creates the linked Payment record and auto-closes the loan if all installments are settled.
 */
export async function markInstallmentAsPaid(
  installmentId: string,
  options?: { paidOn?: Date | string; note?: string }
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.emiInstallment.findUnique({
      where: { id: installmentId },
      select: {
        id: true,
        loanId: true,
        installmentNo: true,
        amount: true,
        dueDate: true,
        status: true,
      },
    });

    if (!installment) {
      throw new Error("Installment not found");
    }

    if (installment.status === "PAID") {
      return installment;
    }

    const paidDate = options?.paidOn
      ? typeof options.paidOn === "string"
        ? new Date(options.paidOn)
        : options.paidOn
      : getNowInKolkata();

    // Create Payment record
    const payment = await tx.payment.create({
      data: {
        loanId: installment.loanId,
        amount: installment.amount,
        paidOn: paidDate,
        kind: "INSTALLMENT",
        note: options?.note || `Payment for EMI #${installment.installmentNo} (Due ${formatToKolkataDateString(installment.dueDate)})`,
      },
    });

    // Update Installment to PAID
    const updated = await tx.emiInstallment.update({
      where: { id: installmentId },
      data: {
        status: "PAID",
        paidAt: paidDate,
        paymentId: payment.id,
      },
      include: {
        loan: { include: { borrower: true } },
        payment: true,
      },
    });

    // Check if all installments for this loan are now PAID
    const remainingUnpaid = await tx.emiInstallment.count({
      where: {
        loanId: installment.loanId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
    });

    if (remainingUnpaid === 0) {
      await tx.loan.update({
        where: { id: installment.loanId },
        data: { status: "CLOSED" },
      });
    }

    return updated;
  });
}

export interface BulkSettleItemInput {
  id: string;
  paidOn?: Date | string;
  note?: string;
}

/**
 * Marks multiple installments as PAID in a single atomic transaction.
 * Supports different or identical paidOn dates and notes per installment.
 */
export async function markMultipleInstallmentsAsPaid(items: BulkSettleItemInput[]) {
  if (!items || items.length === 0) {
    return { count: 0, installments: [] };
  }

  return prisma.$transaction(async (tx) => {
    const updatedInstallments = [];
    const loanIdsToCheck = new Set<string>();

    for (const item of items) {
      const installment = await tx.emiInstallment.findUnique({
        where: { id: item.id },
        select: {
          id: true,
          loanId: true,
          installmentNo: true,
          amount: true,
          dueDate: true,
          status: true,
        },
      });

      if (!installment || installment.status === "PAID") {
        continue;
      }

      const paidDate = item.paidOn
        ? typeof item.paidOn === "string"
          ? new Date(item.paidOn)
          : item.paidOn
        : getNowInKolkata();

      // Create Payment record
      const payment = await tx.payment.create({
        data: {
          loanId: installment.loanId,
          amount: installment.amount,
          paidOn: paidDate,
          kind: "INSTALLMENT",
          note:
            item.note ||
            `Payment for EMI #${installment.installmentNo} (Due ${formatToKolkataDateString(
              installment.dueDate
            )})`,
        },
      });

      // Update Installment to PAID
      const updated = await tx.emiInstallment.update({
        where: { id: item.id },
        data: {
          status: "PAID",
          paidAt: paidDate,
          paymentId: payment.id,
        },
        include: {
          loan: { include: { borrower: true } },
          payment: true,
        },
      });

      updatedInstallments.push(updated);
      loanIdsToCheck.add(installment.loanId);
    }

    // Check if affected loans are now fully paid off and should be CLOSED
    for (const loanId of loanIdsToCheck) {
      const remainingUnpaid = await tx.emiInstallment.count({
        where: {
          loanId,
          status: { in: ["PENDING", "OVERDUE"] },
        },
      });

      if (remainingUnpaid === 0) {
        await tx.loan.update({
          where: { id: loanId },
          data: { status: "CLOSED" },
        });
      }
    }

    return {
      count: updatedInstallments.length,
      installments: updatedInstallments,
    };
  });
}

/**
 * Manually updates status of 1 EMI installment (e.g. to OVERDUE or back to PENDING).
 */
export async function updateInstallmentStatus(
  installmentId: string,
  status: "PENDING" | "OVERDUE"
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.emiInstallment.findUnique({
      where: { id: installmentId },
      select: {
        id: true,
        loanId: true,
        status: true,
        paymentId: true,
      },
    });

    if (!installment) {
      throw new Error("Installment not found");
    }

    // If reverting from PAID, remove the linked payment
    if (installment.status === "PAID" && installment.paymentId) {
      await tx.payment.delete({
        where: { id: installment.paymentId },
      });
    }

    // If status transitions back to PENDING or OVERDUE and loan was CLOSED, reopen loan
    await tx.loan.update({
      where: { id: installment.loanId },
      data: { status: "ACTIVE" },
    });

    return tx.emiInstallment.update({
      where: { id: installmentId },
      data: {
        status,
        paidAt: null,
        paymentId: null,
      },
      include: {
        loan: { include: { borrower: true } },
      },
    });
  });
}

export interface LoanDueStatus {
  dueDate: Date | null;
  nextDueDate: string; // YYYY-MM-DD or ""
  isOverdue: boolean;
  daysUntilDue: number;
}

/**
 * Calculates the authoritative due and overdue status for a loan across all loan types.
 * Synchronizes with EMI installment schedules and payment history to ensure Dashboard
 * and Due Management remain in 100% agreement.
 */
export function calculateLoanDueStatus(
  loan: {
    type: string;
    status: string;
    startDate: Date | string;
    dueDay: number;
    installments?: Array<{
      id?: string;
      installmentNo?: number;
      amount?: any;
      dueDate: Date | string;
      status: string;
    }>;
  },
  calculations?: {
    isAutoClosed?: boolean;
    monthsInterestPaid?: number;
  },
  today: Date = getNowInKolkata()
): LoanDueStatus {
  const todayStr = formatToKolkataDateString(today);
  const [todayYear, todayMonth] = todayStr.split("-").map(Number);

  // 1. Closed or auto-closed loans
  if (loan.status === "CLOSED" || calculations?.isAutoClosed) {
    return {
      dueDate: null,
      nextDueDate: "",
      isOverdue: false,
      daysUntilDue: 999,
    };
  }

  // 2. Loans with installments (EMI, INTEREST_FREE)
  if (loan.installments && loan.installments.length > 0) {
    const overdue = loan.installments.filter((inst) => inst.status === "OVERDUE");
    if (overdue.length > 0) {
      overdue.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      const earliest = overdue[0];
      const dueDateStr = formatToKolkataDateString(earliest.dueDate);
      const days = getCalendarDayDifference(dueDateStr, todayStr);
      return {
        dueDate: parseKolkataDate(dueDateStr),
        nextDueDate: dueDateStr,
        isOverdue: true,
        daysUntilDue: Math.min(-1, days),
      };
    }

    const pending = loan.installments.filter((inst) => inst.status === "PENDING");
    if (pending.length > 0) {
      pending.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      const earliest = pending[0];
      const dueDateStr = formatToKolkataDateString(earliest.dueDate);
      const days = getCalendarDayDifference(dueDateStr, todayStr);
      return {
        dueDate: parseKolkataDate(dueDateStr),
        nextDueDate: dueDateStr,
        isOverdue: days < 0,
        daysUntilDue: days,
      };
    }

    // All installments paid
    return {
      dueDate: null,
      nextDueDate: "",
      isOverdue: false,
      daysUntilDue: 999,
    };
  }

  // 3. FLEXIBLE loans: No fixed schedules or overdue penalties
  if (loan.type === "FLEXIBLE") {
    let candidate = getClampedDueDate(todayYear, todayMonth, loan.dueDay);
    if (todayStr > formatToKolkataDateString(candidate)) {
      const nextM = todayMonth === 12 ? 1 : todayMonth + 1;
      const nextY = todayMonth === 12 ? todayYear + 1 : todayYear;
      candidate = getClampedDueDate(nextY, nextM, loan.dueDay);
    }
    const candidateStr = formatToKolkataDateString(candidate);
    const days = Math.max(0, getCalendarDayDifference(candidateStr, todayStr));
    return {
      dueDate: candidate,
      nextDueDate: candidateStr,
      isOverdue: false,
      daysUntilDue: days,
    };
  }

  // 4. INTEREST_ONLY loans
  if (loan.type === "INTEREST_ONLY") {
    const paidCycles = Math.floor(calculations?.monthsInterestPaid || 0);
    const startD = typeof loan.startDate === "string" ? new Date(loan.startDate) : loan.startDate;
    const startStr = formatToKolkataDateString(startD);
    const [startYear, startMonth] = startStr.split("-").map(Number);

    const firstDueThisMonth = getClampedDueDate(startYear, startMonth, loan.dueDay);
    let cycle0Year = startYear;
    let cycle0Month = startMonth;

    if (startStr > formatToKolkataDateString(firstDueThisMonth)) {
      if (cycle0Month === 12) {
        cycle0Year += 1;
        cycle0Month = 1;
      } else {
        cycle0Month += 1;
      }
    }

    let targetMonth = cycle0Month + paidCycles;
    let targetYear = cycle0Year;
    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear += 1;
    }

    const candidate = getClampedDueDate(targetYear, targetMonth, loan.dueDay);
    const candidateStr = formatToKolkataDateString(candidate);
    const days = getCalendarDayDifference(candidateStr, todayStr);
    return {
      dueDate: candidate,
      nextDueDate: candidateStr,
      isOverdue: days < 0,
      daysUntilDue: days,
    };
  }

  // Fallback for EMI / other loans without installments loaded
  const nextDue = computeNextDueDate(loan.startDate, loan.dueDay, today);
  return {
    dueDate: nextDue.dueDate,
    nextDueDate: nextDue.dueDateString,
    isOverdue: nextDue.isOverdue && loan.status === "ACTIVE",
    daysUntilDue: nextDue.daysUntilDue,
  };
}

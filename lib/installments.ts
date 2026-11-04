import { prisma } from "./prisma";
import { getNowInKolkata, getClampedDueDate, parseKolkataDate, formatToKolkataDateString } from "./dates";
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
    include: {
      loan: {
        include: { borrower: true },
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
  const installment = await prisma.emiInstallment.findUnique({
    where: { id: installmentId },
    include: { loan: true },
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
  const payment = await prisma.payment.create({
    data: {
      loanId: installment.loanId,
      amount: installment.amount,
      paidOn: paidDate,
      kind: "INSTALLMENT",
      note: options?.note || `Payment for EMI #${installment.installmentNo} (Due ${formatToKolkataDateString(installment.dueDate)})`,
    },
  });

  // Update Installment to PAID
  const updated = await prisma.emiInstallment.update({
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
  const remainingUnpaid = await prisma.emiInstallment.count({
    where: {
      loanId: installment.loanId,
      status: { in: ["PENDING", "OVERDUE"] },
    },
  });

  if (remainingUnpaid === 0) {
    await prisma.loan.update({
      where: { id: installment.loanId },
      data: { status: "CLOSED" },
    });
  }

  return updated;
}

/**
 * Manually updates status of 1 EMI installment (e.g. to OVERDUE or back to PENDING).
 */
export async function updateInstallmentStatus(
  installmentId: string,
  status: "PENDING" | "OVERDUE"
) {
  const installment = await prisma.emiInstallment.findUnique({
    where: { id: installmentId },
  });

  if (!installment) {
    throw new Error("Installment not found");
  }

  // If reverting from PAID, remove the linked payment
  if (installment.status === "PAID" && installment.paymentId) {
    await prisma.payment.delete({
      where: { id: installment.paymentId },
    });
  }

  // If status transitions back to PENDING or OVERDUE and loan was CLOSED, reopen loan
  await prisma.loan.update({
    where: { id: installment.loanId },
    data: { status: "ACTIVE" },
  });

  return prisma.emiInstallment.update({
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
}

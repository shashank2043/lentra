import { prisma } from "../lib/prisma";
import { getNowInKolkata, getClampedDueDate, parseKolkataDate, formatToKolkataDateString } from "../lib/dates";

export async function populateInstallmentsForLoans() {
  const today = getNowInKolkata();
  const todayStr = formatToKolkataDateString(today);
  const todayStart = parseKolkataDate(todayStr);

  const emiLoans = await prisma.loan.findMany({
    where: {
      type: "EMI",
      totalMonths: { not: null },
      monthlyAmount: { not: null },
    },
    include: {
      payments: {
        where: { kind: "INSTALLMENT" },
        orderBy: { paidOn: "asc" },
      },
      installments: true,
    },
  });

  console.log(`Checking ${emiLoans.length} EMI loans for installments...`);

  for (const loan of emiLoans) {
    if (loan.installments.length > 0) {
      console.log(`Loan ${loan.id} already has ${loan.installments.length} installments. Skipping.`);
      continue;
    }

    const totalMonths = loan.totalMonths!;
    const monthlyAmount = loan.monthlyAmount!;
    const startDate = new Date(loan.startDate);
    const startYear = startDate.getUTCFullYear();
    const startMonth = startDate.getUTCMonth(); // 0-indexed

    const payments = loan.payments;
    const installmentsToCreate = [];

    for (let i = 1; i <= totalMonths; i++) {
      // Calculate due date for installment #i (i months after start)
      let dueYear = startYear;
      let dueMonth = startMonth + i;
      while (dueMonth >= 12) {
        dueMonth -= 12;
        dueYear += 1;
      }

      const dueDate = getClampedDueDate(dueYear, dueMonth + 1, loan.dueDay);

      const isPaid = i <= payments.length;
      const payment = isPaid ? payments[i - 1] : null;

      let status: "PENDING" | "PAID" | "OVERDUE" = "PENDING";
      let paidAt: Date | null = null;
      let paymentId: string | null = null;

      if (isPaid && payment) {
        status = "PAID";
        paidAt = payment.paidOn;
        paymentId = payment.id;
      } else {
        // Unpaid installment: check if past due
        if (dueDate < todayStart) {
          status = "OVERDUE";
        } else {
          status = "PENDING";
        }
      }

      installmentsToCreate.push({
        loanId: loan.id,
        installmentNo: i,
        dueDate,
        amount: monthlyAmount,
        status,
        paidAt,
        paymentId,
        notes: `Installment #${i} of ${totalMonths}`,
      });
    }

    // Insert installments
    for (const inst of installmentsToCreate) {
      await prisma.emiInstallment.create({
        data: inst,
      });
    }

    console.log(`   ✓ Created ${installmentsToCreate.length} installments for Loan ${loan.id} (${payments.length} paid)`);
  }

  console.log("Installment population complete! ✅");
}

if (require.main === module) {
  populateInstallmentsForLoans()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

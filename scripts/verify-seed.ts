import { prisma } from "../lib/prisma";
import { calculateLoanDetails } from "../lib/calculations";

async function verify() {
  const borrowers = await prisma.borrower.findMany();
  const loans = await prisma.loan.findMany({
    include: { borrower: true, payments: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Borrowers count: ${borrowers.length}`);
  console.log(`Loans count: ${loans.length}`);
  const allDueDay5 = loans.every((l) => l.dueDay === 5);
  console.log(`All loans have dueDay === 5: ${allDueDay5}`);

  console.log("\n--- Verification Summary Table ---");
  for (const l of loans) {
    const calc = calculateLoanDetails(
      {
        type: l.type,
        principalAmount: l.principalAmount,
        monthlyAmount: l.monthlyAmount,
        totalMonths: l.totalMonths,
        status: l.status,
      },
      l.payments.map((p) => ({ amount: p.amount, kind: p.kind }))
    );
    console.log(
      `${l.borrower.name.padEnd(10)} | Due Day: ${l.dueDay}th | Monthly: ₹${Number(l.monthlyAmount).toFixed(2).padStart(8)} | Remaining: ₹${Number(calc.remainingAmount).toFixed(2).padStart(9)} | Months Left: ${calc.monthsRemaining} | Payments Made: ${l.payments.length}`
    );
  }
}

verify().finally(() => prisma.$disconnect());

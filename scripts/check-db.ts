import { prisma } from "../lib/prisma";

async function check() {
  const borrowers = await prisma.borrower.findMany({ select: { id: true, name: true } });
  const loans = await prisma.loan.findMany({
    select: { id: true, type: true, dueDay: true, principalAmount: true, monthlyAmount: true, totalMonths: true, status: true },
  });
  console.log(`Borrowers in DB: ${borrowers.length}`);
  for (const b of borrowers) {
    console.log(` - ${b.name} (${b.id})`);
  }
  console.log(`Loans in DB: ${loans.length}`);
  for (const l of loans) {
    console.log(` - Loan ${l.id} (${l.type}): Principal ₹${l.principalAmount}, Monthly ₹${l.monthlyAmount}, TotalMonths ${l.totalMonths}, DueDay ${l.dueDay}`);
  }
}

check().finally(() => prisma.$disconnect());

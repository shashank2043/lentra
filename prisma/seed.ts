import { PrismaClient, LoanType, LoanStatus, PaymentKind } from "@prisma/client";

const prisma = new PrismaClient();

interface LoanDataSpec {
  borrowerName: string;
  startDateStr: string; // YYYY-MM-DD
  dueDay: number;
  principalAmount: string;
  monthlyAmount: string;
  totalMonths: number;
  remainingMonths: number;
  expectedRemaining: string;
}

const loanData: LoanDataSpec[] = [
  // 1. Adhitya - 08/10/2026 - Total: 25885, Remaining: 29373.84, Monthly: 2447.82, Months: 12
  {
    borrowerName: "Adhitya",
    startDateStr: "2026-10-08",
    dueDay: 5,
    principalAmount: "25885.00",
    monthlyAmount: "2447.82",
    totalMonths: 12,
    remainingMonths: 12,
    expectedRemaining: "29373.84",
  },
  // 2. Shivamani - 08/10/2026 - Total: 1129, Remaining: 1283.64, Monthly: 106.97, Months: 12
  {
    borrowerName: "Shivamani",
    startDateStr: "2026-10-08",
    dueDay: 5,
    principalAmount: "1129.00",
    monthlyAmount: "106.97",
    totalMonths: 12,
    remainingMonths: 12,
    expectedRemaining: "1283.64",
  },
  // 3. Adhitya - 20/05/2026 - Total: 4141, Remaining: 2726.78, Monthly: 389.54, Months: 7
  {
    borrowerName: "Adhitya",
    startDateStr: "2026-05-20",
    dueDay: 5,
    principalAmount: "4141.00",
    monthlyAmount: "389.54",
    totalMonths: 12,
    remainingMonths: 7,
    expectedRemaining: "2726.78",
  },
  // 4. Adhitya - 25/04/2026 - Total: 20708, Remaining: 11645.28, Monthly: 1940.88, Months: 6
  {
    borrowerName: "Adhitya",
    startDateStr: "2026-04-25",
    dueDay: 5,
    principalAmount: "20708.00",
    monthlyAmount: "1940.88",
    totalMonths: 12,
    remainingMonths: 6,
    expectedRemaining: "11645.28",
  },
  // 5. Vishnu - 05/04/2026 - Total: 15841, Remaining: 9027.9, Monthly: 1504.65, Months: 6
  {
    borrowerName: "Vishnu",
    startDateStr: "2026-04-05",
    dueDay: 5,
    principalAmount: "15841.00",
    monthlyAmount: "1504.65",
    totalMonths: 12,
    remainingMonths: 6,
    expectedRemaining: "9027.90",
  },
  // 6. Shivamani - 22/03/2026 - Total: 11389, Remaining: 5350, Monthly: 1070, Months: 5
  {
    borrowerName: "Shivamani",
    startDateStr: "2026-03-22",
    dueDay: 5,
    principalAmount: "11389.00",
    monthlyAmount: "1070.00",
    totalMonths: 12,
    remainingMonths: 5,
    expectedRemaining: "5350.00",
  },
  // 7. Adhitya - 07/02/2026 - Total: 20708, Remaining: 7865.84, Monthly: 1966.46, Months: 4
  {
    borrowerName: "Adhitya",
    startDateStr: "2026-02-07",
    dueDay: 5,
    principalAmount: "20708.00",
    monthlyAmount: "1966.46",
    totalMonths: 12,
    remainingMonths: 4,
    expectedRemaining: "7865.84",
  },
  // 8. Adhitya - 07/12/2025 - Total: 5177, Remaining: 984.04, Monthly: 492.02, Months: 2
  {
    borrowerName: "Adhitya",
    startDateStr: "2025-12-07",
    dueDay: 5,
    principalAmount: "5177.00",
    monthlyAmount: "492.02",
    totalMonths: 12,
    remainingMonths: 2,
    expectedRemaining: "984.04",
  },
  // 9. Adhitya - 06/12/2025 - Total: 2070, Remaining: 393.72, Monthly: 196.86, Months: 2
  {
    borrowerName: "Adhitya",
    startDateStr: "2025-12-06",
    dueDay: 5,
    principalAmount: "2070.00",
    monthlyAmount: "196.86",
    totalMonths: 12,
    remainingMonths: 2,
    expectedRemaining: "393.72",
  },
  // 10. Trilok - 02/12/2025 - Total: 4471, Remaining: 852.72, Monthly: 426.36, Months: 2
  {
    borrowerName: "Trilok",
    startDateStr: "2025-12-02",
    dueDay: 5,
    principalAmount: "4471.00",
    monthlyAmount: "426.36",
    totalMonths: 12,
    remainingMonths: 2,
    expectedRemaining: "852.72",
  },
  // 11. Adhitya - 02/12/2025 - Total: 10354, Remaining: 1974.72, Monthly: 987.36, Months: 2
  {
    borrowerName: "Adhitya",
    startDateStr: "2025-12-02",
    dueDay: 5,
    principalAmount: "10354.00",
    monthlyAmount: "987.36",
    totalMonths: 12,
    remainingMonths: 2,
    expectedRemaining: "1974.72",
  },
  // 12. Adhitya - 27/10/2025 - Total: 6247, Remaining: 595.88, Monthly: 595.88, Months: 1
  {
    borrowerName: "Adhitya",
    startDateStr: "2025-10-27",
    dueDay: 5,
    principalAmount: "6247.00",
    monthlyAmount: "595.88",
    totalMonths: 12,
    remainingMonths: 1,
    expectedRemaining: "595.88",
  },
];

async function main() {
  console.log("1. Deleting all existing records in database...");
  await prisma.reminderLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.borrower.deleteMany();
  console.log("   ✓ Database completely cleared.");

  console.log("2. Creating unique borrowers...");
  const uniqueNames = ["Adhitya", "Shivamani", "Vishnu", "Trilok"];
  const borrowerMap = new Map<string, string>();

  for (const name of uniqueNames) {
    const b = await prisma.borrower.create({
      data: {
        name,
        notes: `Borrower ${name}`,
      },
    });
    borrowerMap.set(name, b.id);
    console.log(`   ✓ Created borrower: ${name} (${b.id})`);
  }

  console.log("3. Inserting EMI loans with due date 5th of every month...");
  for (let i = 0; i < loanData.length; i++) {
    const spec = loanData[i];
    const borrowerId = borrowerMap.get(spec.borrowerName);
    if (!borrowerId) throw new Error(`Borrower not found: ${spec.borrowerName}`);

    const startDate = new Date(`${spec.startDateStr}T00:00:00Z`);

    // Create the EMI loan with dueDay = 5
    const loan = await prisma.loan.create({
      data: {
        borrowerId,
        type: LoanType.EMI,
        principalAmount: spec.principalAmount,
        startDate,
        dueDay: 5, // Due date is fifth of every month
        monthlyAmount: spec.monthlyAmount,
        totalMonths: spec.totalMonths,
        status: LoanStatus.ACTIVE,
        remindDaysBefore: [1, 3],
        remindOnDueDay: true,
        remindBorrower: false,
        notes: `EMI Loan #${i + 1} - Disbursed ${spec.startDateStr}. Due on 5th of every month. ${spec.remainingMonths} months remaining of ₹${spec.monthlyAmount}`,
      },
    });

    // Record past installments (paidCount = totalMonths - remainingMonths)
    const paidCount = spec.totalMonths - spec.remainingMonths;
    const paymentsToCreate = [];

    const [startYear, startMonth, startDay] = spec.startDateStr.split("-").map(Number);

    for (let m = 1; m <= paidCount; m++) {
      // Payment date on the 5th of each subsequent month
      const payDate = new Date(Date.UTC(startYear, startMonth - 1 + m, 5, 12, 0, 0));
      paymentsToCreate.push({
        loanId: loan.id,
        paidOn: payDate,
        amount: spec.monthlyAmount,
        kind: PaymentKind.INSTALLMENT,
        note: `Installment #${m} of ${spec.totalMonths} (Due 5th)`,
      });
    }

    if (paymentsToCreate.length > 0) {
      await prisma.payment.createMany({
        data: paymentsToCreate,
      });
    }

    console.log(
      `   ✓ [${i + 1}/12] ${spec.borrowerName}: Principal ₹${spec.principalAmount}, ` +
      `Due day: 5th, ${paidCount} paid, ${spec.remainingMonths} months left, Remaining: ₹${spec.expectedRemaining}`
    );
  }

  console.log("\nALL LOANS SEEDED WITH DUE DAY 5TH SUCCESSFULLY! ✅");
}

main()
  .catch((e) => {
    console.error("Error during reset and seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import assert from "node:assert";
import { calculateLoanDetails } from "./calculations";
import { LoanType, LoanStatus, PaymentKind, InterestMode } from "@prisma/client";

function runTests() {
  console.log("Running calculation engine tests...\n");

  // 1. EMI Loan Test
  {
    console.log("1. EMI Loan Calculations");
    const loan = {
      type: LoanType.EMI,
      principalAmount: "50000.00",
      monthlyAmount: "5000.00",
      totalMonths: 12,
      status: LoanStatus.ACTIVE,
    };

    // No payments
    const res1 = calculateLoanDetails(loan, []);
    assert.strictEqual(res1.totalPaid, "0.00");
    assert.strictEqual(res1.totalPayable, "60000.00");
    assert.strictEqual(res1.remainingAmount, "60000.00");
    assert.strictEqual(res1.monthsRemaining, 12);
    assert.strictEqual(res1.isAutoClosed, false);
    assert.strictEqual(res1.computedStatus, LoanStatus.ACTIVE);

    // Partial payments (3 installments of 5,000 = 15,000)
    const res2 = calculateLoanDetails(loan, [
      { amount: "5000.00", kind: PaymentKind.INSTALLMENT },
      { amount: "5000.00", kind: PaymentKind.INSTALLMENT },
      { amount: "5000.00", kind: PaymentKind.INSTALLMENT },
    ]);
    assert.strictEqual(res2.totalPaid, "15000.00");
    assert.strictEqual(res2.remainingAmount, "45000.00");
    assert.strictEqual(res2.monthsRemaining, 9);
    assert.strictEqual(res2.isAutoClosed, false);

    // Full payments (60,000 total)
    const res3 = calculateLoanDetails(loan, [
      { amount: "15000.00", kind: PaymentKind.INSTALLMENT },
      { amount: "45000.00", kind: PaymentKind.INSTALLMENT },
    ]);
    assert.strictEqual(res3.totalPaid, "60000.00");
    assert.strictEqual(res3.remainingAmount, "0.00");
    assert.strictEqual(res3.monthsRemaining, 0);
    assert.strictEqual(res3.isAutoClosed, true);
    assert.strictEqual(res3.computedStatus, LoanStatus.CLOSED);

    // Overpayment (65,000 total)
    const res4 = calculateLoanDetails(loan, [
      { amount: "65000.00", kind: PaymentKind.INSTALLMENT },
    ]);
    assert.strictEqual(res4.totalPaid, "65000.00");
    assert.strictEqual(res4.remainingAmount, "0.00");
    assert.strictEqual(res4.monthsRemaining, 0);
    assert.strictEqual(res4.isAutoClosed, true);
    console.log("   ✓ EMI tests passed");
  }

  // 2. INTEREST_FREE Loan Test
  {
    console.log("2. INTEREST_FREE Loan Calculations");
    const matchingLoan = {
      type: LoanType.INTEREST_FREE,
      principalAmount: "120000.00",
      monthlyAmount: "10000.00",
      totalMonths: 12,
      status: LoanStatus.ACTIVE,
    };
    const res1 = calculateLoanDetails(matchingLoan, []);
    assert.strictEqual(res1.isMismatchWarning, false);
    assert.strictEqual(res1.totalPayable, "120000.00");

    const mismatchLoan = {
      type: LoanType.INTEREST_FREE,
      principalAmount: "120000.00",
      monthlyAmount: "11000.00",
      totalMonths: 10, // 110,000 != 120,000
      status: LoanStatus.ACTIVE,
    };
    const res2 = calculateLoanDetails(mismatchLoan, []);
    assert.strictEqual(res2.isMismatchWarning, true);
    console.log("   ✓ Interest-free tests passed");
  }

  // 3. INTEREST_ONLY Loan Test (FIXED and PERCENT)
  {
    console.log("3. INTEREST_ONLY Loan Calculations");
    // FIXED mode
    const fixedLoan = {
      type: LoanType.INTEREST_ONLY,
      principalAmount: "100000.00",
      interestMode: InterestMode.FIXED,
      interestValue: "2000.00",
      status: LoanStatus.ACTIVE,
    };

    const resFixed1 = calculateLoanDetails(fixedLoan, [
      { amount: "2000.00", kind: PaymentKind.INTEREST },
      { amount: "2000.00", kind: PaymentKind.INTEREST },
      { amount: "20000.00", kind: PaymentKind.PRINCIPAL },
    ]);
    assert.strictEqual(resFixed1.totalPaid, "24000.00");
    assert.strictEqual(resFixed1.totalInterestPaid, "4000.00");
    assert.strictEqual(resFixed1.totalPrincipalPaid, "20000.00");
    assert.strictEqual(resFixed1.outstandingPrincipal, "80000.00");
    assert.strictEqual(resFixed1.monthlyInterestDue, "2000.00");
    assert.strictEqual(resFixed1.monthsInterestPaid, 2);
    assert.strictEqual(resFixed1.isAutoClosed, false);

    // PERCENT mode
    const percentLoan = {
      type: LoanType.INTEREST_ONLY,
      principalAmount: "200000.00",
      interestMode: InterestMode.PERCENT,
      interestValue: "2.5", // 2.5% per month
      status: LoanStatus.ACTIVE,
    };
    // No payments: 2.5% of 200,000 = 5,000 monthly interest
    const resPct1 = calculateLoanDetails(percentLoan, []);
    assert.strictEqual(resPct1.outstandingPrincipal, "200000.00");
    assert.strictEqual(resPct1.monthlyInterestDue, "5000.00");
    assert.strictEqual(resPct1.monthsInterestPaid, 0);

    // Pay 50,000 principal: outstanding becomes 150,000, new monthly interest = 3,750
    const resPct2 = calculateLoanDetails(percentLoan, [
      { amount: "50000.00", kind: PaymentKind.PRINCIPAL },
      { amount: "7500.00", kind: PaymentKind.INTEREST },
    ]);
    assert.strictEqual(resPct2.outstandingPrincipal, "150000.00");
    assert.strictEqual(resPct2.monthlyInterestDue, "3750.00");
    assert.strictEqual(resPct2.monthsInterestPaid, 2); // 7500 / 3750 = 2

    // Pay remaining principal (150,000) -> Auto close
    const resPct3 = calculateLoanDetails(percentLoan, [
      { amount: "50000.00", kind: PaymentKind.PRINCIPAL },
      { amount: "150000.00", kind: PaymentKind.PRINCIPAL },
    ]);
    assert.strictEqual(resPct3.outstandingPrincipal, "0.00");
    assert.strictEqual(resPct3.isAutoClosed, true);
    assert.strictEqual(resPct3.computedStatus, LoanStatus.CLOSED);
    console.log("   ✓ Interest-only tests passed");
  }

  // 4. FLEXIBLE Debt Test
  {
    console.log("4. FLEXIBLE Loan (No fixed monthly amount, partial repayments)");
    const flexLoan = {
      type: LoanType.FLEXIBLE,
      principalAmount: "40000.00",
      status: LoanStatus.ACTIVE,
    };

    // No payments
    const res1 = calculateLoanDetails(flexLoan, []);
    assert.strictEqual(res1.totalPaid, "0.00");
    assert.strictEqual(res1.remainingAmount, "40000.00");
    assert.strictEqual(res1.isAutoClosed, false);
    assert.strictEqual(res1.computedStatus, LoanStatus.ACTIVE);

    // Partial payment 1: 12,500
    const res2 = calculateLoanDetails(flexLoan, [
      { amount: "12500.00", kind: PaymentKind.PRINCIPAL },
    ]);
    assert.strictEqual(res2.totalPaid, "12500.00");
    assert.strictEqual(res2.remainingAmount, "27500.00");
    assert.strictEqual(res2.isAutoClosed, false);

    // Partial payment 2: 15,000
    const res3 = calculateLoanDetails(flexLoan, [
      { amount: "12500.00", kind: PaymentKind.PRINCIPAL },
      { amount: "15000.00", kind: PaymentKind.INSTALLMENT },
    ]);
    assert.strictEqual(res3.totalPaid, "27500.00");
    assert.strictEqual(res3.remainingAmount, "12500.00");
    assert.strictEqual(res3.isAutoClosed, false);

    // Final payment: 12,500 -> Auto closes
    const res4 = calculateLoanDetails(flexLoan, [
      { amount: "12500.00", kind: PaymentKind.PRINCIPAL },
      { amount: "15000.00", kind: PaymentKind.INSTALLMENT },
      { amount: "12500.00", kind: PaymentKind.PRINCIPAL },
    ]);
    assert.strictEqual(res4.totalPaid, "40000.00");
    assert.strictEqual(res4.remainingAmount, "0.00");
    assert.strictEqual(res4.isAutoClosed, true);
    assert.strictEqual(res4.computedStatus, LoanStatus.CLOSED);

    // Overpayment: 45,000 total
    const res5 = calculateLoanDetails(flexLoan, [
      { amount: "45000.00", kind: PaymentKind.PRINCIPAL },
    ]);
    assert.strictEqual(res5.totalPaid, "45000.00");
    assert.strictEqual(res5.remainingAmount, "0.00");
    assert.strictEqual(res5.isAutoClosed, true);
    assert.strictEqual(res5.computedStatus, LoanStatus.CLOSED);

    console.log("   ✓ Flexible loan tests passed");
  }

  console.log("\nALL CALCULATION TESTS PASSED SUCCESSFULLY! ✅");
}

runTests();

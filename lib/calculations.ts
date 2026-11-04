import Decimal from "decimal.js";
import { LoanType, LoanStatus, PaymentKind, InterestMode } from "@prisma/client";

// Configure Decimal precision and rounding
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface LoanData {
  type: LoanType;
  principalAmount: Decimal.Value;
  monthlyAmount?: Decimal.Value | null;
  totalMonths?: number | null;
  interestMode?: InterestMode | null;
  interestValue?: Decimal.Value | null;
  status: LoanStatus;
}

export interface PaymentData {
  amount: Decimal.Value;
  kind: PaymentKind;
}

export interface LoanCalculations {
  totalPaid: string;
  isAutoClosed: boolean;
  computedStatus: LoanStatus;

  // EMI / INTEREST_FREE fields
  totalPayable?: string;
  remainingAmount?: string;
  monthsRemaining?: number;
  isMismatchWarning?: boolean; // monthlyAmount * totalMonths != principalAmount

  // INTEREST_ONLY fields
  outstandingPrincipal?: string;
  monthlyInterestDue?: string;
  totalInterestPaid?: string;
  totalPrincipalPaid?: string;
  monthsInterestPaid?: number; // total interest paid divided by monthly interest due
}

/**
 * Pure calculation engine for loans using Decimal.js to prevent floating point inaccuracy.
 */
export function calculateLoanDetails(
  loan: LoanData,
  payments: PaymentData[] = []
): LoanCalculations {
  const principal = new Decimal(loan.principalAmount || 0);

  // Sum total payments
  let totalPaidDec = new Decimal(0);
  let principalPaidDec = new Decimal(0);
  let interestPaidDec = new Decimal(0);

  for (const p of payments) {
    const amt = new Decimal(p.amount || 0);
    totalPaidDec = totalPaidDec.plus(amt);

    if (p.kind === PaymentKind.PRINCIPAL) {
      principalPaidDec = principalPaidDec.plus(amt);
    } else if (p.kind === PaymentKind.INTEREST) {
      interestPaidDec = interestPaidDec.plus(amt);
    }
  }

  if (loan.type === LoanType.EMI || loan.type === LoanType.INTEREST_FREE) {
    const monthlyAmt = new Decimal(loan.monthlyAmount || 0);
    const months = loan.totalMonths || 0;
    const totalPayableDec = monthlyAmt.times(months);

    const remainingDec = totalPayableDec.minus(totalPaidDec);
    const effectiveRemaining = remainingDec.isNegative() ? new Decimal(0) : remainingDec;

    let monthsRem = 0;
    if (monthlyAmt.greaterThan(0) && effectiveRemaining.greaterThan(0)) {
      monthsRem = Math.ceil(effectiveRemaining.dividedBy(monthlyAmt).toNumber());
    }

    const isAutoClosed = remainingDec.lessThanOrEqualTo(0);
    const computedStatus = isAutoClosed ? LoanStatus.CLOSED : loan.status;

    let isMismatchWarning = false;
    if (loan.type === LoanType.INTEREST_FREE) {
      // Check if monthlyAmount * totalMonths == principalAmount
      if (!totalPayableDec.equals(principal)) {
        isMismatchWarning = true;
      }
    }

    return {
      totalPaid: totalPaidDec.toFixed(2),
      totalPayable: totalPayableDec.toFixed(2),
      remainingAmount: effectiveRemaining.toFixed(2),
      monthsRemaining: monthsRem,
      isAutoClosed,
      computedStatus,
      isMismatchWarning,
    };
  }

  if (loan.type === LoanType.INTEREST_ONLY) {
    // outstandingPrincipal = principalAmount - sum of PRINCIPAL payments
    const outstandingDec = principal.minus(principalPaidDec);
    const effectiveOutstanding = outstandingDec.isNegative() ? new Decimal(0) : outstandingDec;

    // monthlyInterestDue = interestValue if FIXED, else outstandingPrincipal x interestValue / 100
    let monthlyInterestDec = new Decimal(0);
    const interestVal = new Decimal(loan.interestValue || 0);

    if (loan.interestMode === InterestMode.FIXED) {
      monthlyInterestDec = interestVal;
    } else if (loan.interestMode === InterestMode.PERCENT) {
      monthlyInterestDec = effectiveOutstanding.times(interestVal).dividedBy(100);
    }

    // Months of interest paid so far: interestPaidDec / monthlyInterestDec
    let monthsInterestPaid = 0;
    if (monthlyInterestDec.greaterThan(0)) {
      monthsInterestPaid = Number(interestPaidDec.dividedBy(monthlyInterestDec).toFixed(2));
    }

    const isAutoClosed = outstandingDec.lessThanOrEqualTo(0);
    const computedStatus = isAutoClosed ? LoanStatus.CLOSED : loan.status;

    return {
      totalPaid: totalPaidDec.toFixed(2),
      outstandingPrincipal: effectiveOutstanding.toFixed(2),
      monthlyInterestDue: monthlyInterestDec.toFixed(2),
      totalInterestPaid: interestPaidDec.toFixed(2),
      totalPrincipalPaid: principalPaidDec.toFixed(2),
      monthsInterestPaid,
      isAutoClosed,
      computedStatus,
    };
  }

  if (loan.type === LoanType.FLEXIBLE) {
    // Flexible debt: No fixed monthly amount, repaid via partial or full payments anytime
    const remainingDec = principal.minus(totalPaidDec);
    const effectiveRemaining = remainingDec.isNegative() ? new Decimal(0) : remainingDec;
    const isAutoClosed = remainingDec.lessThanOrEqualTo(0);
    const computedStatus = isAutoClosed ? LoanStatus.CLOSED : loan.status;

    return {
      totalPaid: totalPaidDec.toFixed(2),
      remainingAmount: effectiveRemaining.toFixed(2),
      isAutoClosed,
      computedStatus,
    };
  }

  // Fallback
  return {
    totalPaid: totalPaidDec.toFixed(2),
    isAutoClosed: false,
    computedStatus: loan.status,
  };
}

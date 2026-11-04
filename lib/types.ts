import { LoanType, LoanStatus, InterestMode, PaymentKind, ReminderTrigger, ReminderRecipient } from "@prisma/client";

export type { LoanType, LoanStatus, InterestMode, PaymentKind, ReminderTrigger, ReminderRecipient };

export interface LoanCalculationResult {
  // Common
  totalPaid: string; // Decimal string
  isAutoClosed: boolean;
  status: LoanStatus;

  // EMI / INTEREST_FREE
  totalPayable?: string;
  remainingAmount?: string;
  monthsRemaining?: number;
  isMismatchWarning?: boolean; // When monthlyAmount * totalMonths != principalAmount for INTEREST_FREE

  // INTEREST_ONLY
  outstandingPrincipal?: string;
  monthlyInterestDue?: string;
  totalInterestPaid?: string;
  monthsInterestPaid?: number; // integer or rounded decimal of cycles covered
}

export interface DueDateInfo {
  dueDate: Date;
  dueDateString: string; // YYYY-MM-DD
  isOverdue: boolean;
  daysUntilDue: number;
  formattedDue: string;
}

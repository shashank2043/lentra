import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLoanDetails } from "@/lib/calculations";
import { computeNextDueDate } from "@/lib/dates";
import { sendOwnerReminder, sendBorrowerReminder } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        borrower: true,
        payments: true,
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const calculations = calculateLoanDetails(loan, loan.payments);
    const nextDue = computeNextDueDate(loan.startDate, loan.dueDay);

    // Amount due based on loan type
    let amountDue = "0";
    if (loan.type === "INTEREST_ONLY") {
      amountDue = calculations.monthlyInterestDue || "0";
    } else if (loan.type === "FLEXIBLE") {
      amountDue = calculations.remainingAmount || "0";
    } else {
      amountDue = loan.monthlyAmount ? String(loan.monthlyAmount) : "0";
    }

    const outstandingBalance =
      loan.type === "INTEREST_ONLY"
        ? calculations.outstandingPrincipal || "0"
        : calculations.remainingAmount || "0";

    const origin = request.nextUrl.origin;

    // Send owner reminder
    const ownerSuccess = await sendOwnerReminder({
      borrowerName: loan.borrower.name,
      loanType: loan.type,
      amountDue,
      dueDate: nextDue.dueDate,
      outstandingBalance,
      loanId: loan.id,
      triggerType: nextDue.isOverdue ? "OVERDUE" : "ON_DAY",
      daysLeft: nextDue.daysUntilDue,
      appUrl: origin,
    });

    let borrowerSuccess = false;
    if (loan.remindBorrower && loan.borrower.email) {
      borrowerSuccess = await sendBorrowerReminder({
        borrowerName: loan.borrower.name,
        borrowerEmail: loan.borrower.email,
        amountDue,
        dueDate: nextDue.dueDate,
        triggerType: "ON_DAY",
      });
    }

    if (!ownerSuccess) {
      return NextResponse.json(
        {
          error:
            "Could not send email. Please check your GMAIL_USER, GMAIL_APP_PASSWORD, and OWNER_EMAIL configuration in Settings.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test reminder sent successfully to owner${
        borrowerSuccess ? " and borrower (" + loan.borrower.email + ")" : ""
      }!`,
    });
  } catch (error: any) {
    console.error("Error triggering test reminder:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger test reminder" },
      { status: 500 }
    );
  }
}

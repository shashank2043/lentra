import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLoanDetails } from "@/lib/calculations";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const loanId = payment.loanId;
    await prisma.payment.delete({
      where: { id },
    });

    // Check if loan was CLOSED but now remaining balance > 0
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { payments: true },
    });

    if (loan && loan.status === "CLOSED") {
      const calculations = calculateLoanDetails(loan, loan.payments);
      if (!calculations.isAutoClosed) {
        await prisma.loan.update({
          where: { id: loanId },
          data: { status: "ACTIVE" },
        });
      }
    }

    return NextResponse.json({ success: true, message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });
  }
}

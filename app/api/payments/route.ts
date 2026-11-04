import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paymentCreateSchema } from "@/lib/validations";
import { calculateLoanDetails } from "@/lib/calculations";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = paymentCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { loanId, paidOn, amount, kind, note } = parsed.data;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { payments: true },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        loanId,
        paidOn: new Date(paidOn),
        amount: new Prisma.Decimal(amount),
        kind: kind as any,
        note: note || null,
      },
    });

    // Check auto-close logic
    const updatedPayments = [...loan.payments, payment];
    const calculations = calculateLoanDetails(loan, updatedPayments);

    let loanClosedNow = false;
    if (calculations.isAutoClosed && loan.status === "ACTIVE") {
      await prisma.loan.update({
        where: { id: loanId },
        data: { status: "CLOSED" },
      });
      loanClosedNow = true;
    }

    return NextResponse.json(
      {
        payment,
        calculations,
        loanClosedNow,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error recording payment:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}

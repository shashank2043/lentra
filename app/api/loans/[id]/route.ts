import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loanUpdateSchema } from "@/lib/validations";
import { calculateLoanDetails } from "@/lib/calculations";
import { computeNextDueDate } from "@/lib/dates";
import { Prisma } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        borrower: true,
        installments: {
          orderBy: { installmentNo: "asc" },
          include: { payment: true },
        },
        payments: {
          orderBy: { paidOn: "desc" },
        },
        reminderLogs: {
          orderBy: { sentAt: "desc" },
          take: 20,
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const calculations = calculateLoanDetails(loan, loan.payments);
    const nextDue = computeNextDueDate(loan.startDate, loan.dueDay);

    return NextResponse.json({
      ...loan,
      calculations,
      nextDueDate: nextDue.dueDateString,
      isOverdue: nextDue.isOverdue && loan.status === "ACTIVE",
      daysUntilDue: nextDue.daysUntilDue,
    });
  } catch (error) {
    console.error("Error fetching loan details:", error);
    return NextResponse.json({ error: "Failed to fetch loan details" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Prevent any attempt to change principalAmount or startDate
    if ("principalAmount" in body || "startDate" in body) {
      return NextResponse.json(
        { error: "principalAmount and startDate are immutable and cannot be modified." },
        { status: 400 }
      );
    }

    const parsed = loanUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check existing loan and borrower
    const existingLoan = await prisma.loan.findUnique({
      where: { id },
      include: { borrower: true },
    });

    if (!existingLoan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    if (data.remindBorrower && !existingLoan.borrower.email) {
      return NextResponse.json(
        { error: "Cannot enable borrower reminders because this borrower does not have an email." },
        { status: 400 }
      );
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        dueDay: data.dueDay,
        monthlyAmount: data.monthlyAmount ? new Prisma.Decimal(data.monthlyAmount) : null,
        totalMonths: data.totalMonths ?? null,
        interestMode: (data.interestMode as any) ?? null,
        interestValue: data.interestValue ? new Prisma.Decimal(data.interestValue) : null,
        remindDaysBefore: data.remindDaysBefore,
        remindOnDueDay: data.remindOnDueDay,
        remindBorrower: data.remindBorrower,
        status: (data.status as any) || existingLoan.status,
        notes: data.notes || null,
      },
      include: { borrower: true, payments: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating loan:", error);
    return NextResponse.json({ error: "Failed to update loan" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status } = body;
    if (status !== "ACTIVE" && status !== "CLOSED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error toggling loan status:", error);
    return NextResponse.json({ error: "Failed to change loan status" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.loan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Loan deleted successfully" });
  } catch (error) {
    console.error("Error deleting loan:", error);
    return NextResponse.json({ error: "Failed to delete loan" }, { status: 500 });
  }
}

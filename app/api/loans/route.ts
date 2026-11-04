import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loanCreateSchema } from "@/lib/validations";
import { calculateLoanDetails } from "@/lib/calculations";
import { computeNextDueDate } from "@/lib/dates";
import { generateLoanSchedule } from "@/lib/installments";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const borrowerId = searchParams.get("borrowerId");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Prisma.LoanWhereInput = {};

    if (borrowerId) where.borrowerId = borrowerId;
    if (type) where.type = type as any;
    if (status) where.status = status as any;
    if (search) {
      where.borrower = {
        name: { contains: search, mode: "insensitive" },
      };
    }

    const loans = await prisma.loan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        borrower: {
          select: { id: true, name: true, phone: true, email: true },
        },
        payments: {
          orderBy: { paidOn: "desc" },
        },
      },
    });

    const loansWithCalculations = loans.map((loan) => {
      const calculations = calculateLoanDetails(loan, loan.payments);
      const nextDue = computeNextDueDate(loan.startDate, loan.dueDay);

      return {
        ...loan,
        calculations,
        nextDueDate: nextDue.dueDateString,
        isOverdue: nextDue.isOverdue && loan.status === "ACTIVE",
        daysUntilDue: nextDue.daysUntilDue,
      };
    });

    return NextResponse.json(loansWithCalculations);
  } catch (error) {
    console.error("Error fetching loans:", error);
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loanCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check borrower existence
    const borrower = await prisma.borrower.findUnique({
      where: { id: data.borrowerId },
    });

    if (!borrower) {
      return NextResponse.json({ error: "Borrower not found" }, { status: 404 });
    }

    // If remindBorrower is true, borrower must have an email
    if (data.remindBorrower && !borrower.email) {
      return NextResponse.json(
        { error: "Cannot enable borrower reminder: borrower does not have an email address." },
        { status: 400 }
      );
    }

    const newLoan = await prisma.loan.create({
      data: {
        borrowerId: data.borrowerId,
        type: data.type as any,
        principalAmount: new Prisma.Decimal(data.principalAmount),
        startDate: new Date(data.startDate),
        dueDay: data.dueDay,
        monthlyAmount: data.monthlyAmount ? new Prisma.Decimal(data.monthlyAmount) : null,
        totalMonths: data.totalMonths ?? null,
        interestMode: (data.interestMode as any) ?? null,
        interestValue: data.interestValue ? new Prisma.Decimal(data.interestValue) : null,
        remindDaysBefore: data.remindDaysBefore,
        remindOnDueDay: data.remindOnDueDay,
        remindBorrower: data.remindBorrower,
        notes: data.notes || null,
        status: "ACTIVE",
      },
      include: {
        borrower: true,
      },
    });

    // Auto-generate EMI installment schedule if loan is EMI
    if (newLoan.type === "EMI" && newLoan.totalMonths && newLoan.monthlyAmount) {
      await generateLoanSchedule({
        loanId: newLoan.id,
        startDate: newLoan.startDate,
        dueDay: newLoan.dueDay,
        monthlyAmount: newLoan.monthlyAmount,
        totalMonths: newLoan.totalMonths,
        remainingMonths: data.remainingMonths,
      });
    }

    return NextResponse.json(newLoan, { status: 201 });
  } catch (error) {
    console.error("Error creating loan:", error);
    return NextResponse.json({ error: "Failed to create loan" }, { status: 500 });
  }
}

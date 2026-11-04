import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { borrowerSchema } from "@/lib/validations";

export async function GET() {
  try {
    const borrowers = await prisma.borrower.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        loans: {
          select: {
            id: true,
            status: true,
            type: true,
            principalAmount: true,
          },
        },
      },
    });

    const formatted = borrowers.map((b) => ({
      ...b,
      totalLoans: b.loans.length,
      activeLoans: b.loans.filter((l) => l.status === "ACTIVE").length,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching borrowers:", error);
    return NextResponse.json({ error: "Failed to fetch borrowers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = borrowerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, phone, email, notes } = parsed.data;

    const borrower = await prisma.borrower.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(borrower, { status: 201 });
  } catch (error) {
    console.error("Error creating borrower:", error);
    return NextResponse.json({ error: "Failed to create borrower" }, { status: 500 });
  }
}

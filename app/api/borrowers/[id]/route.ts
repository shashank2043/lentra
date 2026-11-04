import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { borrowerSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = borrowerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, phone, email, notes } = parsed.data;

    const updated = await prisma.borrower.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating borrower:", error);
    return NextResponse.json({ error: "Failed to update borrower" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if the borrower has any associated loans
    const existingLoansCount = await prisma.loan.count({
      where: { borrowerId: id },
    });

    if (existingLoansCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete borrower who has existing loans. Please close or delete all associated loans first.",
        },
        { status: 400 }
      );
    }

    await prisma.borrower.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Borrower deleted successfully" });
  } catch (error) {
    console.error("Error deleting borrower:", error);
    return NextResponse.json({ error: "Failed to delete borrower" }, { status: 500 });
  }
}

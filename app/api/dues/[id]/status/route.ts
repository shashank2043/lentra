import { NextRequest, NextResponse } from "next/server";
import { updateInstallmentStatus } from "@/lib/installments";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const status = body.status;

    if (status !== "OVERDUE" && status !== "PENDING") {
      return NextResponse.json(
        { error: "Invalid status. Must be 'OVERDUE' or 'PENDING'." },
        { status: 400 }
      );
    }

    const updated = await updateInstallmentStatus(id, status);

    return NextResponse.json({
      success: true,
      message: `EMI #${updated.installmentNo} marked as ${status}`,
      installment: updated,
    });
  } catch (error: any) {
    console.error("Error updating installment status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update installment status" },
      { status: 500 }
    );
  }
}

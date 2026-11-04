import { NextRequest, NextResponse } from "next/server";
import { markInstallmentAsPaid } from "@/lib/installments";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const updated = await markInstallmentAsPaid(id, {
      paidOn: body.paidOn,
      note: body.note,
    });

    return NextResponse.json({
      success: true,
      message: `EMI #${updated.installmentNo} marked as PAID`,
      installment: updated,
    });
  } catch (error: any) {
    console.error("Error marking installment as paid:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark installment as paid" },
      { status: 500 }
    );
  }
}

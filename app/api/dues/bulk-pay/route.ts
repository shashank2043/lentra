import { NextRequest, NextResponse } from "next/server";
import { markMultipleInstallmentsAsPaid } from "@/lib/installments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: 'items' array of dues is required." },
        { status: 400 }
      );
    }

    const result = await markMultipleInstallmentsAsPaid(items);

    return NextResponse.json({
      success: true,
      message: `Successfully marked ${result.count} due(s) as PAID`,
      count: result.count,
      installments: result.installments,
    });
  } catch (error: any) {
    console.error("Error bulk settling dues:", error);
    return NextResponse.json(
      { error: error.message || "Failed to settle dues" },
      { status: 500 }
    );
  }
}

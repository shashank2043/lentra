import { NextResponse } from "next/server";
import { sendTestEmailToOwner } from "@/lib/email";

export async function POST() {
  try {
    const result = await sendTestEmailToOwner();
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Test email route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger test email" },
      { status: 500 }
    );
  }
}

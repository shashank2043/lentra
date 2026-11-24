import { NextRequest, NextResponse } from "next/server";
import { generateAndSendConsolidatedReport } from "@/lib/reports";

export async function POST(request: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const result = await generateAndSendConsolidatedReport({
      markReminders: false, // On-demand test from UI does not consume reminder log intervals
      appUrl,
    });

    if (!result.emailSent) {
      return NextResponse.json(
        {
          error:
            "Could not send email. Please check your GMAIL_USER, GMAIL_APP_PASSWORD, and OWNER_EMAIL in .env or Settings.",
        },
        { status: 500 }
      );
    }

    const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;

    return NextResponse.json({
      success: true,
      message: `Single summary report sent successfully to ${ownerEmail}! Contains ${result.reportData.totalBorrowers} borrower(s) and ₹${result.reportData.totalOutstandingOwed} total owed.`,
      reportData: result.reportData,
    });
  } catch (error: any) {
    console.error("Error sending summary report:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send summary report" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

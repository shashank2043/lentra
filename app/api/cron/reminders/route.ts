import { NextRequest, NextResponse } from "next/server";
import { generateAndSendConsolidatedReport } from "@/lib/reports";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Vercel Cron Authorization header
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, enforce Bearer check
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // 2. Execute consolidated report generator and send SINGLE email to Owner
    const result = await generateAndSendConsolidatedReport({
      markReminders: true,
      appUrl,
    });

    return NextResponse.json({
      success: true,
      emailSent: result.emailSent,
      totalBorrowers: result.reportData.totalBorrowers,
      totalActiveLoans: result.reportData.totalActiveLoans,
      totalOutstandingOwed: result.reportData.totalOutstandingOwed,
      totalOverdueAmount: result.reportData.totalOverdueAmount,
      totalDueTodayAmount: result.reportData.totalDueTodayAmount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("Cron reminders error:", error);
    return NextResponse.json(
      { error: error.message || "Cron processing failed" },
      { status: 500 }
    );
  }
}

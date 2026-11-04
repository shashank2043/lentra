import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNowInKolkata, formatToKolkataDateString, parseKolkataDate } from "@/lib/dates";

export async function GET() {
  try {
    const today = getNowInKolkata();
    const todayStr = formatToKolkataDateString(today);
    const todayStart = parseKolkataDate(todayStr);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    // 1. Fetch persistent notifications
    const persistent = await prisma.inAppNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const unreadPersistentCount = await prisma.inAppNotification.count({
      where: { isRead: false },
    });

    // 2. Also count active live alerts (overdue EMIs and dues due today)
    const overdueCount = await prisma.emiInstallment.count({
      where: { status: "OVERDUE" },
    });

    const dueTodayCount = await prisma.emiInstallment.count({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: todayStart, lte: todayEnd },
      },
    });

    return NextResponse.json({
      notifications: persistent,
      unreadCount: unreadPersistentCount + overdueCount + dueTodayCount,
      overdueCount,
      dueTodayCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.markAllAsRead) {
      await prisma.inAppNotification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (body.id) {
      await prisma.inAppNotification.update({
        where: { id: body.id },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json({ error: "Missing id or markAllAsRead flag" }, { status: 400 });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

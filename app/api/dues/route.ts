import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOverdueInstallments } from "@/lib/installments";
import { getNowInKolkata, formatToKolkataDateString, parseKolkataDate } from "@/lib/dates";
import Decimal from "decimal.js";

export async function GET(request: NextRequest) {
  try {
    // 1. Automatically auto-transition past-due PENDING installments to OVERDUE
    await syncOverdueInstallments();

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "ALL"; // ALL | OVERDUE | DUE_TODAY | UPCOMING | PENDING | PAID
    const borrowerId = searchParams.get("borrowerId");

    const today = getNowInKolkata();
    const todayStr = formatToKolkataDateString(today);
    const todayStart = parseKolkataDate(todayStr);

    // End of today
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    // 30 days from now
    const thirtyDaysFuture = new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Start of current month in IST
    const [curYear, curMonth] = todayStr.split("-").map(Number);
    const monthStart = parseKolkataDate(`${curYear}-${String(curMonth).padStart(2, "0")}-01`);

    // Fetch all installments with loan and borrower to compute stats and results
    const whereClause: any = {};
    if (borrowerId) {
      whereClause.loan = { borrowerId };
    }

    if (statusParam === "OVERDUE") {
      whereClause.status = "OVERDUE";
    } else if (statusParam === "DUE_TODAY") {
      whereClause.status = { in: ["PENDING", "OVERDUE"] };
      whereClause.dueDate = {
        gte: todayStart,
        lte: todayEnd,
      };
    } else if (statusParam === "UPCOMING") {
      whereClause.status = "PENDING";
      whereClause.dueDate = {
        gt: todayEnd,
        lte: thirtyDaysFuture,
      };
    } else if (statusParam === "PENDING") {
      whereClause.status = "PENDING";
    } else if (statusParam === "PAID") {
      whereClause.status = "PAID";
    }

    const installments = await prisma.emiInstallment.findMany({
      where: whereClause,
      include: {
        loan: {
          include: {
            borrower: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        },
        payment: true,
      },
      orderBy: [
        { dueDate: "asc" },
        { installmentNo: "asc" },
      ],
    });

    // Compute global summary KPIs across all active EMI loans (or filtered by borrower)
    const baseFilter: any = borrowerId ? { loan: { borrowerId } } : {};

    const allItems = await prisma.emiInstallment.findMany({
      where: baseFilter,
      select: {
        id: true,
        amount: true,
        status: true,
        dueDate: true,
        paidAt: true,
      },
    });

    let overdueCount = 0;
    let overdueAmount = new Decimal(0);
    let dueTodayCount = 0;
    let dueTodayAmount = new Decimal(0);
    let upcomingCount = 0;
    let upcomingAmount = new Decimal(0);
    let paidThisMonthCount = 0;
    let paidThisMonthAmount = new Decimal(0);

    for (const item of allItems) {
      const amt = new Decimal(item.amount);
      const isDueToday = item.dueDate >= todayStart && item.dueDate <= todayEnd;

      if (item.status === "OVERDUE") {
        overdueCount++;
        overdueAmount = overdueAmount.plus(amt);
      }

      if (isDueToday && item.status !== "PAID") {
        dueTodayCount++;
        dueTodayAmount = dueTodayAmount.plus(amt);
      }

      if (item.status === "PENDING" && item.dueDate > todayEnd && item.dueDate <= thirtyDaysFuture) {
        upcomingCount++;
        upcomingAmount = upcomingAmount.plus(amt);
      }

      if (item.status === "PAID" && item.paidAt && item.paidAt >= monthStart) {
        paidThisMonthCount++;
        paidThisMonthAmount = paidThisMonthAmount.plus(amt);
      }
    }

    // Enhance response items with relative day info
    const enrichedInstallments = installments.map((inst) => {
      const dueStr = formatToKolkataDateString(inst.dueDate);
      const isToday = inst.dueDate >= todayStart && inst.dueDate <= todayEnd;
      const isPast = inst.dueDate < todayStart;
      const daysDiff = Math.round(
        Math.abs(inst.dueDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...inst,
        dueDateFormatted: dueStr,
        isDueToday: isToday,
        isPastDue: isPast,
        daysDifference: daysDiff,
      };
    });

    return NextResponse.json({
      installments: enrichedInstallments,
      stats: {
        overdueCount,
        overdueAmount: overdueAmount.toFixed(2),
        dueTodayCount,
        dueTodayAmount: dueTodayAmount.toFixed(2),
        upcomingCount,
        upcomingAmount: upcomingAmount.toFixed(2),
        paidThisMonthCount,
        paidThisMonthAmount: paidThisMonthAmount.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error fetching dues:", error);
    return NextResponse.json({ error: "Failed to fetch dues" }, { status: 500 });
  }
}

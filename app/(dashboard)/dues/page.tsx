"use client";

import React, { useState, useEffect, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarClock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ArrowRight,
  RefreshCw,
  CreditCard,
  X,
  FileText,
  User,
  RotateCcw,
  CheckSquare,
  Square,
  MinusSquare,
  Sliders,
  Layers,
  Sparkles,
  Check,
} from "lucide-react";
import { formatINR, formatReadableDate } from "@/lib/format";

interface InstallmentItem {
  id: string;
  installmentNo: number;
  dueDate: string;
  dueDateFormatted: string;
  amount: string;
  status: "PENDING" | "PAID" | "OVERDUE";
  paidAt: string | null;
  paymentId: string | null;
  notes: string | null;
  isDueToday: boolean;
  isPastDue: boolean;
  daysDifference: number;
  loan: {
    id: string;
    type: string;
    dueDay: number;
    totalMonths: number | null;
    borrowerId: string;
    borrower: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    };
  };
}

interface DuesStats {
  overdueCount: number;
  overdueAmount: string;
  dueTodayCount: number;
  dueTodayAmount: string;
  upcomingCount: number;
  upcomingAmount: string;
  paidThisMonthCount: number;
  paidThisMonthAmount: string;
}

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function DuesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading dues...</div>}>
      <DuesContent />
    </Suspense>
  );
}

function DuesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStatus = searchParams.get("status") || "ALL";
  const initialBorrowerId = searchParams.get("borrowerId") || "";

  const [statusTab, setStatusTab] = useState<string>(initialStatus);
  const [borrowerFilter, setBorrowerFilter] = useState<string>(initialBorrowerId);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [installments, setInstallments] = useState<InstallmentItem[]>([]);
  const [stats, setStats] = useState<DuesStats | null>(null);
  const [borrowers, setBorrowers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Toast notifications for instant feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (toast: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Payment confirmation dialog state
  const [payModalItem, setPayModalItem] = useState<InstallmentItem | null>(null);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payNote, setPayNote] = useState<string>("");

  const fetchDues = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        if (installments.length === 0) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
      }
      const params = new URLSearchParams();
      if (statusTab !== "ALL") params.set("status", statusTab);
      if (borrowerFilter) params.set("borrowerId", borrowerFilter);

      const res = await fetch(`/api/dues?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInstallments(data.installments || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to fetch dues:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchBorrowers = async () => {
    try {
      const res = await fetch("/api/borrowers");
      if (res.ok) {
        const data = await res.json();
        setBorrowers(data.map((b: any) => ({ id: b.id, name: b.name })));
      }
    } catch (err) {
      console.error("Failed to fetch borrowers:", err);
    }
  };

  useEffect(() => {
    fetchBorrowers();
  }, []);

  useEffect(() => {
    fetchDues();
  }, [statusTab, borrowerFilter]);

  // Optimistic Mark Paid: updates UI instantly in 0ms, saves in background, reverts on error
  const performMarkPaid = (
    item: InstallmentItem,
    customPaidDate?: string,
    customNote?: string
  ) => {
    // 1. Snapshot previous state for rollback
    const prevInstallments = [...installments];
    const prevStats = stats ? { ...stats } : null;

    // 2. Dismiss modal immediately
    setPayModalItem(null);
    setPayNote("");

    const effectivePaidDate = customPaidDate || new Date().toISOString().split("T")[0];
    const effectiveNote =
      customNote !== undefined
        ? customNote
        : (item.notes || `EMI #${item.installmentNo} for ${item.loan.borrower.name}`);
    const itemAmt = parseFloat(item.amount) || 0;

    // 3. Optimistic local update of installments
    setInstallments((prev) =>
      prev.map((inst) =>
        inst.id === item.id
          ? {
              ...inst,
              status: "PAID" as const,
              paidAt: effectivePaidDate,
              notes: effectiveNote,
              isPastDue: false,
              isDueToday: false,
            }
          : inst
      )
    );

    // 4. Optimistic update of stats KPI cards
    if (stats) {
      const updatedStats = { ...stats };
      if (item.status === "OVERDUE") {
        updatedStats.overdueCount = Math.max(0, updatedStats.overdueCount - 1);
        updatedStats.overdueAmount = Math.max(0, parseFloat(updatedStats.overdueAmount) - itemAmt).toFixed(2);
      }
      if (item.isDueToday && item.status !== "PAID") {
        updatedStats.dueTodayCount = Math.max(0, updatedStats.dueTodayCount - 1);
        updatedStats.dueTodayAmount = Math.max(0, parseFloat(updatedStats.dueTodayAmount) - itemAmt).toFixed(2);
      }
      if (item.status === "PENDING" && !item.isDueToday && !item.isPastDue) {
        updatedStats.upcomingCount = Math.max(0, updatedStats.upcomingCount - 1);
        updatedStats.upcomingAmount = Math.max(0, parseFloat(updatedStats.upcomingAmount) - itemAmt).toFixed(2);
      }
      updatedStats.paidThisMonthCount += 1;
      updatedStats.paidThisMonthAmount = (parseFloat(updatedStats.paidThisMonthAmount) + itemAmt).toFixed(2);
      setStats(updatedStats);
    }

    // 5. Instant Toast with Undo option
    showToast({
      type: "success",
      message: `EMI #${item.installmentNo} for ${item.loan.borrower.name} marked as PAID.`,
      action: {
        label: "Undo",
        onClick: () => handleStatusChangeOptimistic(item.id, "PENDING", prevInstallments, prevStats),
      },
    });

    // 6. Save in background
    fetch(`/api/dues/${item.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paidOn: effectivePaidDate,
        note: effectiveNote,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to save payment to database");
        }
        const data = await res.json();
        if (data.installment?.paymentId) {
          setInstallments((curr) =>
            curr.map((inst) =>
              inst.id === item.id ? { ...inst, paymentId: data.installment.paymentId } : inst
            )
          );
        }
        // Silently sync server stats/fields without screen flash
        fetchDues({ silent: true });
      })
      .catch((err: any) => {
        console.error("Background payment save failed:", err);
        // REVERT THE STATE!
        setInstallments(prevInstallments);
        if (prevStats) setStats(prevStats);
        showToast({
          type: "error",
          message: `Failed to save payment for EMI #${item.installmentNo}. Reverted.`,
        });
      });
  };

  // Optimistic Status Change: Overdue <-> Pending <-> Undo Paid
  const handleStatusChangeOptimistic = (
    installmentId: string,
    newStatus: "OVERDUE" | "PENDING",
    rollbackInstallments?: InstallmentItem[],
    rollbackStats?: DuesStats | null
  ) => {
    const target = installments.find((inst) => inst.id === installmentId);
    const prevInstallments = rollbackInstallments || [...installments];
    const prevStats = rollbackStats !== undefined ? rollbackStats : (stats ? { ...stats } : null);

    const itemAmt = target ? parseFloat(target.amount) || 0 : 0;
    const oldStatus = target ? target.status : "PAID";

    // Optimistic UI update
    setInstallments((prev) =>
      prev.map((inst) =>
        inst.id === installmentId
          ? {
              ...inst,
              status: newStatus,
              paidAt: null,
              paymentId: null,
            }
          : inst
      )
    );

    if (stats) {
      const updatedStats = { ...stats };
      if (oldStatus === "PAID") {
        updatedStats.paidThisMonthCount = Math.max(0, updatedStats.paidThisMonthCount - 1);
        updatedStats.paidThisMonthAmount = Math.max(0, parseFloat(updatedStats.paidThisMonthAmount) - itemAmt).toFixed(2);
        if (target?.isPastDue || newStatus === "OVERDUE") {
          updatedStats.overdueCount += 1;
          updatedStats.overdueAmount = (parseFloat(updatedStats.overdueAmount) + itemAmt).toFixed(2);
        } else if (target?.isDueToday) {
          updatedStats.dueTodayCount += 1;
          updatedStats.dueTodayAmount = (parseFloat(updatedStats.dueTodayAmount) + itemAmt).toFixed(2);
        } else {
          updatedStats.upcomingCount += 1;
          updatedStats.upcomingAmount = (parseFloat(updatedStats.upcomingAmount) + itemAmt).toFixed(2);
        }
      } else if (oldStatus === "PENDING" && newStatus === "OVERDUE") {
        if (!target?.isDueToday) {
          updatedStats.upcomingCount = Math.max(0, updatedStats.upcomingCount - 1);
          updatedStats.upcomingAmount = Math.max(0, parseFloat(updatedStats.upcomingAmount) - itemAmt).toFixed(2);
        }
        updatedStats.overdueCount += 1;
        updatedStats.overdueAmount = (parseFloat(updatedStats.overdueAmount) + itemAmt).toFixed(2);
      } else if (oldStatus === "OVERDUE" && newStatus === "PENDING") {
        updatedStats.overdueCount = Math.max(0, updatedStats.overdueCount - 1);
        updatedStats.overdueAmount = Math.max(0, parseFloat(updatedStats.overdueAmount) - itemAmt).toFixed(2);
        if (target?.isDueToday) {
          updatedStats.dueTodayCount += 1;
          updatedStats.dueTodayAmount = (parseFloat(updatedStats.dueTodayAmount) + itemAmt).toFixed(2);
        } else {
          updatedStats.upcomingCount += 1;
          updatedStats.upcomingAmount = (parseFloat(updatedStats.upcomingAmount) + itemAmt).toFixed(2);
        }
      }
      setStats(updatedStats);
    }

    showToast({
      type: "info",
      message: target
        ? `EMI #${target.installmentNo} updated to ${newStatus}.`
        : `Status updated to ${newStatus}.`,
    });

    fetch(`/api/dues/${installmentId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to update status in database");
        }
        fetchDues({ silent: true });
      })
      .catch((err) => {
        console.error("Status update failed:", err);
        setInstallments(prevInstallments);
        if (prevStats) setStats(prevStats);
        showToast({
          type: "error",
          message: `Failed to update status. Changes reverted.`,
        });
      });
  };

  // Filter list by search query
  const filteredInstallments = installments.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.loan.borrower.name.toLowerCase().includes(q) ||
      `emi ${item.installmentNo}`.includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  });

  // Bulk selection & settlement state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"SAME" | "INDIVIDUAL">("SAME");
  const [bulkCommonDate, setBulkCommonDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [bulkCommonNote, setBulkCommonNote] = useState<string>("Settlement via UPI");
  const [bulkItemConfigs, setBulkItemConfigs] = useState<
    Record<string, { paidOn: string; note: string }>
  >({});
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Selected items & totals
  const selectedItems = installments.filter((item) => selectedIds.includes(item.id));
  const totalSelectedAmount = selectedItems.reduce(
    (sum, item) => sum + (parseFloat(item.amount) || 0),
    0
  );

  const selectableInstallments = filteredInstallments.filter((item) => item.status !== "PAID");
  const isAllSelected =
    selectableInstallments.length > 0 &&
    selectableInstallments.every((item) => selectedIds.includes(item.id));
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableInstallments.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectOverdueOnly = () => {
    const overdueIds = filteredInstallments
      .filter((item) => item.status === "OVERDUE")
      .map((item) => item.id);
    setSelectedIds(overdueIds);
  };

  const selectDueTodayOnly = () => {
    const todayIds = filteredInstallments
      .filter((item) => item.isDueToday && item.status !== "PAID")
      .map((item) => item.id);
    setSelectedIds(todayIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleOpenBulkModal = () => {
    if (selectedIds.length === 0) return;
    const todayIso = new Date().toISOString().split("T")[0];
    const initialConfigs: Record<string, { paidOn: string; note: string }> = {};

    for (const item of selectedItems) {
      initialConfigs[item.id] = {
        paidOn: todayIso,
        note: `EMI #${item.installmentNo} for ${item.loan.borrower.name}`,
      };
    }

    setBulkItemConfigs(initialConfigs);
    setBulkCommonDate(todayIso);
    setBulkCommonNote("Settlement via UPI");
    setBulkMode("SAME");
    setIsBulkModalOpen(true);
  };

  const handleSwitchToIndividual = () => {
    setBulkItemConfigs((prev) => {
      const next = { ...prev };
      for (const item of selectedItems) {
        next[item.id] = {
          paidOn: next[item.id]?.paidOn || bulkCommonDate,
          note:
            next[item.id]?.note ||
            bulkCommonNote ||
            `EMI #${item.installmentNo} for ${item.loan.borrower.name}`,
        };
      }
      return next;
    });
    setBulkMode("INDIVIDUAL");
  };

  const updateIndividualItemConfig = (
    id: string,
    field: "paidOn" | "note",
    value: string
  ) => {
    setBulkItemConfigs((prev) => ({
      ...prev,
      [id]: {
        paidOn: prev[id]?.paidOn || bulkCommonDate,
        note: prev[id]?.note !== undefined ? prev[id].note : "",
        [field]: value,
      },
    }));
  };

  const handleRemoveFromBulkSelection = (id: string) => {
    setSelectedIds((prev) => {
      const remaining = prev.filter((item) => item !== id);
      if (remaining.length === 0) {
        setIsBulkModalOpen(false);
      }
      return remaining;
    });
  };

  const handleConfirmBulkSettle = async () => {
    if (selectedItems.length === 0) return;
    setBulkSubmitting(true);

    try {
      const payloadItems = selectedItems.map((item) => {
        if (bulkMode === "SAME") {
          return {
            id: item.id,
            paidOn: bulkCommonDate,
            note:
              bulkCommonNote.trim() ||
              `EMI #${item.installmentNo} for ${item.loan.borrower.name}`,
          };
        } else {
          const cfg = bulkItemConfigs[item.id];
          return {
            id: item.id,
            paidOn: cfg?.paidOn || bulkCommonDate,
            note:
              cfg?.note?.trim() ||
              `EMI #${item.installmentNo} for ${item.loan.borrower.name}`,
          };
        }
      });

      const res = await fetch("/api/dues/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to settle selected dues");
      }

      setIsBulkModalOpen(false);
      setSelectedIds([]);

      showToast({
        type: "success",
        message: `Successfully settled ${data.count} dues (${formatINR(totalSelectedAmount)})!`,
      });

      fetchDues();
    } catch (err: any) {
      showToast({
        type: "error",
        message: err.message || "Failed to settle dues. Please try again.",
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleQuickSettleAllSelected = async () => {
    if (selectedItems.length === 0) return;
    if (
      !confirm(
        `Mark ${selectedItems.length} selected dues (${formatINR(
          totalSelectedAmount
        )}) as PAID today?`
      )
    ) {
      return;
    }
    const todayIso = new Date().toISOString().split("T")[0];
    const payloadItems = selectedItems.map((item) => ({
      id: item.id,
      paidOn: todayIso,
      note: `EMI #${item.installmentNo} for ${item.loan.borrower.name}`,
    }));

    try {
      const res = await fetch("/api/dues/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to settle selected dues");
      }

      setSelectedIds([]);
      showToast({
        type: "success",
        message: `Successfully settled ${data.count} dues (${formatINR(totalSelectedAmount)})!`,
      });
      fetchDues();
    } catch (err: any) {
      showToast({
        type: "error",
        message: err.message || "Failed to settle selected dues",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center">
            <CalendarClock className="w-7 h-7 text-indigo-600 mr-2.5" />
            EMI Dues & Overdue Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track, mark payments, and manage individual monthly EMI dues across all borrowers.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => fetchDues()}
            disabled={loading || isRefreshing}
            className="inline-flex items-center px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${
                loading || isRefreshing ? "animate-spin text-indigo-600" : ""
              }`}
            />
            Refresh
          </button>
          <Link
            href="/loans/new"
            className="inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
          >
            New EMI Loan
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overdue Card */}
          <div
            onClick={() => setStatusTab("OVERDUE")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              statusTab === "OVERDUE"
                ? "bg-red-50/80 border-red-300 ring-2 ring-red-400 shadow-sm"
                : "bg-white border-red-200 hover:border-red-300 hover:bg-red-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-700 flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Overdue
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800">
                {stats.overdueCount} EMIs
              </span>
            </div>
            <div className="mt-2 text-xl font-bold text-red-600">
              {formatINR(stats.overdueAmount)}
            </div>
            <p className="text-[11px] text-red-500 mt-0.5">
              Email alert sent every 2 days
            </p>
          </div>

          {/* Due Today Card */}
          <div
            onClick={() => setStatusTab("DUE_TODAY")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              statusTab === "DUE_TODAY"
                ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400 shadow-sm"
                : "bg-white border-amber-200 hover:border-amber-300 hover:bg-amber-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1" /> Due Today
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-900">
                {stats.dueTodayCount} EMIs
              </span>
            </div>
            <div className="mt-2 text-xl font-bold text-amber-700">
              {formatINR(stats.dueTodayAmount)}
            </div>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Mark paid or mark overdue
            </p>
          </div>

          {/* Upcoming Card */}
          <div
            onClick={() => setStatusTab("UPCOMING")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              statusTab === "UPCOMING"
                ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-400 shadow-sm"
                : "bg-white border-blue-200 hover:border-blue-300 hover:bg-blue-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" /> Next 30 Days
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                {stats.upcomingCount} EMIs
              </span>
            </div>
            <div className="mt-2 text-xl font-bold text-blue-600">
              {formatINR(stats.upcomingAmount)}
            </div>
            <p className="text-[11px] text-blue-500 mt-0.5">
              Upcoming scheduled dues
            </p>
          </div>

          {/* Paid This Month Card */}
          <div
            onClick={() => setStatusTab("PAID")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              statusTab === "PAID"
                ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400 shadow-sm"
                : "bg-white border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Collected (Month)
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                {stats.paidThisMonthCount} EMIs
              </span>
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-600">
              {formatINR(stats.paidThisMonthAmount)}
            </div>
            <p className="text-[11px] text-emerald-500 mt-0.5">
              Settled in current month
            </p>
          </div>
        </div>
      )}

      {/* Controls: Filter Tabs, Search & Borrower Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-4">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 pb-3">
          {[
            { key: "ALL", label: "All Dues" },
            { key: "DUE_TODAY", label: "Due Today", count: stats?.dueTodayCount, badgeColor: "bg-amber-100 text-amber-800" },
            { key: "OVERDUE", label: "Overdue", count: stats?.overdueCount, badgeColor: "bg-red-100 text-red-800" },
            { key: "UPCOMING", label: "Upcoming (30d)", count: stats?.upcomingCount, badgeColor: "bg-blue-100 text-blue-800" },
            { key: "PAID", label: "Paid History" },
          ].map((tab) => {
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active ? "bg-white/20 text-white" : tab.badgeColor
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Borrower Dropdown */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by borrower name or EMI note..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="w-full sm:w-64">
            <select
              value={borrowerFilter}
              onChange={(e) => setBorrowerFilter(e.target.value)}
              aria-label="Filter dues by borrower"
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Borrowers</option>
              {borrowers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dues List / Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading && installments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
            Loading dues...
          </div>
        ) : filteredInstallments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-60" />
            <p className="font-semibold text-gray-800">No installments found</p>
            <p className="text-xs text-gray-500 mt-1">
              There are no installments matching the selected status or borrower filters.
            </p>
          </div>
        ) : (
          <div>
            {/* Selection Toolbar inside card header */}
            <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={selectableInstallments.length === 0}
                  className="inline-flex items-center space-x-1.5 font-semibold text-gray-700 hover:text-gray-900 disabled:opacity-40 cursor-pointer"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : isSomeSelected ? (
                    <MinusSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                  <span>Select All Unpaid ({selectableInstallments.length})</span>
                </button>

                {selectedIds.length > 0 && (
                  <span className="text-gray-500">
                    • <strong className="text-indigo-600 font-bold">{selectedIds.length}</strong> selected ({formatINR(totalSelectedAmount)})
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {stats && stats.overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={selectOverdueOnly}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    Select Overdue ({stats.overdueCount})
                  </button>
                )}
                {stats && stats.dueTodayCount > 0 && (
                  <button
                    type="button"
                    onClick={selectDueTodayOnly}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                  >
                    Select Due Today ({stats.dueTodayCount})
                  </button>
                )}
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-2 py-1 text-gray-500 hover:text-gray-800 text-[11px] font-medium underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredInstallments.map((item) => {
                const isOverdue = item.status === "OVERDUE";
                const isPaid = item.status === "PAID";
                const isDueToday = item.isDueToday && !isPaid;
                const isSelected = selectedIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-150 ${
                      isSelected
                        ? "bg-indigo-50/70 ring-2 ring-indigo-500/50"
                        : isPaid
                        ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                        : isOverdue
                        ? "bg-red-50/40 hover:bg-red-50/70"
                        : isDueToday
                        ? "bg-amber-50/40 hover:bg-amber-50/70"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Left: Checkbox, Borrower & Installment Info */}
                    <div className="flex items-start space-x-3">
                      {/* Checkbox for selecting due */}
                      {!isPaid ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectOne(item.id);
                          }}
                          className="mt-2.5 text-gray-400 hover:text-indigo-600 focus:outline-hidden cursor-pointer shrink-0"
                          title={isSelected ? "Deselect due" : "Select due to settle"}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                          )}
                        </button>
                      ) : (
                        <div className="w-5 mt-2.5 shrink-0" />
                      )}

                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-700"
                            : isOverdue
                            ? "bg-red-100 text-red-700"
                            : isDueToday
                            ? "bg-amber-100 text-amber-800"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                      {isPaid ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isOverdue ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <CalendarClock className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/loans/${item.loan.id}`}
                          className="font-bold text-gray-900 hover:text-indigo-600 transition-colors flex items-center"
                        >
                          {item.loan.borrower.name}
                        </Link>
                        <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-gray-100 text-gray-700">
                          EMI #{item.installmentNo}
                          {item.loan.totalMonths ? ` of ${item.loan.totalMonths}` : ""}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          Due: {item.dueDateFormatted}
                        </span>

                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">
                            {item.daysDifference} day(s) overdue
                          </span>
                        )}

                        {isDueToday && (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900">
                            Due Today
                          </span>
                        )}

                        {!item.isPastDue && !isDueToday && !isPaid && (
                          <span className="px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                            Due in {item.daysDifference} day(s)
                          </span>
                        )}

                        {isPaid && item.paidAt && (
                          <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Paid on {formatReadableDate(item.paidAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div
                        className={`text-lg sm:text-xl font-bold transition-colors ${
                          isPaid
                            ? "text-emerald-700"
                            : isOverdue
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {formatINR(item.amount)}
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        Monthly Installment
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      {!isPaid ? (
                        <>
                          {/* 1-Click Fast Mark Paid Button (Instant UI Update + Background Save) */}
                          <button
                            type="button"
                            onClick={() => {
                              const todayIso = new Date().toISOString().split("T")[0];
                              performMarkPaid(
                                item,
                                todayIso,
                                `EMI #${item.installmentNo} for ${item.loan.borrower.name}`
                              );
                            }}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs cursor-pointer"
                            title="Mark paid with today's date instantly"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark Paid
                          </button>

                          {/* Secondary button to open modal for custom date or note */}
                          <button
                            type="button"
                            onClick={() => {
                              setPayModalItem(item);
                              setPayDate(new Date().toISOString().split("T")[0]);
                              setPayNote(`EMI #${item.installmentNo} for ${item.loan.borrower.name}`);
                            }}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 cursor-pointer"
                            title="Mark paid with custom date or note..."
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {item.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChangeOptimistic(item.id, "OVERDUE")}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 active:scale-95 transition-all cursor-pointer"
                              title="Mark this 1 EMI as overdue"
                            >
                              Mark Overdue
                            </button>
                          )}

                          {item.status === "OVERDUE" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChangeOptimistic(item.id, "PENDING")}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
                              title="Revert back to pending"
                            >
                              Revert
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Settled
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `Revert EMI #${item.installmentNo} back to Pending? This will delete the recorded payment.`
                                )
                              ) {
                                handleStatusChangeOptimistic(item.id, "PENDING");
                              }
                            }}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all cursor-pointer"
                            title="Undo and revert back to Pending"
                          >
                            Undo Paid
                          </button>
                        </div>
                      )}

                      <Link
                        href={`/loans/${item.loan.id}`}
                        title="View loan detail"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Dialog Modal (for custom date / note) */}
      {payModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 p-6 space-y-5 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Payment</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Recording payment for {payModalItem.loan.borrower.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayModalItem(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Installment:</span>
                <span className="font-semibold text-gray-900">
                  EMI #{payModalItem.installmentNo}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Due Date:</span>
                <span className="font-semibold text-gray-900">
                  {payModalItem.dueDateFormatted}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-200">
                <span>Amount:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {formatINR(payModalItem.amount)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Optional Note
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Received via UPI / Cash"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPayModalItem(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!payModalItem) return;
                  performMarkPaid(payModalItem, payDate, payNote);
                }}
                className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg transition-all shadow-xs cursor-pointer"
              >
                Confirm & Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[94%] sm:w-full bg-gray-950 text-white rounded-2xl shadow-2xl p-4 border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-extrabold text-sm shrink-0">
              {selectedIds.length}
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Selected Dues to Settle
              </div>
              <div className="text-base font-bold text-white flex items-center gap-1.5">
                <span>{formatINR(totalSelectedAmount)}</span>
                <span className="text-xs font-normal text-gray-400">
                  ({selectedIds.length} due{selectedIds.length > 1 ? "s" : ""})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleOpenBulkModal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Settle Selected ({selectedIds.length})
            </button>
            <button
              type="button"
              onClick={handleQuickSettleAllSelected}
              className="hidden md:inline-flex items-center justify-center px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Quickly mark all as paid today with default notes"
            >
              Pay Today
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Deselect all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Settle Multiple Dues Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 my-8 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-100 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Sparkles className="w-5 h-5 text-indigo-600 mr-2" />
                  Settle Multiple Dues
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Settling {selectedItems.length} selected dues totaling{" "}
                  <strong className="text-emerald-700 font-bold">{formatINR(totalSelectedAmount)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
              <div className="flex p-1 bg-gray-200/80 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setBulkMode("SAME")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                    bulkMode === "SAME"
                      ? "bg-white text-indigo-950 shadow-xs ring-1 ring-black/5"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Same Options for All ({selectedItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToIndividual}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                    bulkMode === "INDIVIDUAL"
                      ? "bg-white text-indigo-950 shadow-xs ring-1 ring-black/5"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>Different Options per Due</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {bulkMode === "SAME" ? (
                /* Mode 1: SAME OPTIONS FOR ALL */
                <div className="space-y-5">
                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                    <p className="font-semibold text-indigo-950">Apply common payment options to all selected dues:</p>
                    <p className="text-indigo-700 mt-0.5">
                      The payment date and note specified below will be applied to all {selectedItems.length} dues.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Common Payment Date
                      </label>
                      <input
                        type="date"
                        value={bulkCommonDate}
                        onChange={(e) => setBulkCommonDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-700">
                          Common Payment Note
                        </label>
                        <span className="text-[11px] text-gray-400">Quick suggestions:</span>
                      </div>
                      <input
                        type="text"
                        value={bulkCommonNote}
                        onChange={(e) => setBulkCommonNote(e.target.value)}
                        placeholder="e.g. Received via UPI / Bank Transfer"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500"
                      />
                      {/* Suggestion tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {["Settlement via UPI", "Paid in Cash", "Bank Transfer", "Google Pay", "PhonePe"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setBulkCommonNote(tag)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Summary Preview Table */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 flex justify-between items-center">
                      <span>Dues to Settle ({selectedItems.length})</span>
                      <span>Total: {formatINR(totalSelectedAmount)}</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 text-xs">
                      {selectedItems.map((item) => (
                        <div key={item.id} className="p-3 flex items-center justify-between hover:bg-gray-50/50">
                          <div>
                            <span className="font-bold text-gray-900">{item.loan.borrower.name}</span>
                            <span className="ml-2 text-gray-500">EMI #{item.installmentNo}</span>
                            <div className="text-[11px] text-gray-400">Due: {item.dueDateFormatted}</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-emerald-700 text-sm">{formatINR(item.amount)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromBulkSelection(item.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded-sm cursor-pointer"
                              title="Remove from settlement"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Mode 2: DIFFERENT OPTIONS PER DUE */
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                    <p className="font-semibold text-amber-950">Customize each due individually:</p>
                    <p className="text-amber-800 mt-0.5">
                      You can set a different payment date and note for each installment.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {selectedItems.map((item) => {
                      const cfg = bulkItemConfigs[item.id] || {
                        paidOn: bulkCommonDate,
                        note: `EMI #${item.installmentNo} for ${item.loan.borrower.name}`,
                      };

                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-gray-50/80 border border-gray-200 rounded-xl space-y-3 hover:border-gray-300 transition-colors"
                        >
                          {/* Item Header */}
                          <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-gray-900 text-sm">
                                  {item.loan.borrower.name}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-gray-200 text-gray-700">
                                  EMI #{item.installmentNo}
                                </span>
                                {item.status === "OVERDUE" && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-100 text-red-700">
                                    Overdue
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                Due: {item.dueDateFormatted}
                              </span>
                            </div>

                            <div className="flex items-center space-x-3">
                              <span className="font-bold text-emerald-700 text-base">
                                {formatINR(item.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromBulkSelection(item.id)}
                                className="text-gray-400 hover:text-red-600 p-1 rounded-lg cursor-pointer"
                                title="Remove from settlement"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Individual Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                Payment Date
                              </label>
                              <input
                                type="date"
                                value={cfg.paidOn}
                                onChange={(e) =>
                                  updateIndividualItemConfig(item.id, "paidOn", e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                                Payment Note
                              </label>
                              <input
                                type="text"
                                value={cfg.note}
                                onChange={(e) =>
                                  updateIndividualItemConfig(item.id, "note", e.target.value)
                                }
                                placeholder="Note for this due..."
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-gray-600">
                Total to settle:{" "}
                <strong className="text-emerald-700 text-sm font-bold">
                  {formatINR(totalSelectedAmount)}
                </strong>{" "}
                ({selectedItems.length} dues)
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  disabled={bulkSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkSettle}
                  disabled={bulkSubmitting || selectedItems.length === 0}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center"
                >
                  {bulkSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Settling Dues...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Confirm & Settle {selectedItems.length} Dues
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Floating Toast Notification System */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-xl shadow-xl border flex items-center justify-between space-x-3 animate-in slide-in-from-bottom-3 duration-200 ${
                toast.type === "success"
                  ? "bg-gray-900 text-white border-emerald-500/40"
                  : toast.type === "error"
                  ? "bg-red-950 text-white border-red-800"
                  : "bg-gray-900 text-white border-gray-800"
              }`}
            >
              <div className="flex items-center space-x-2 text-xs sm:text-sm">
                {toast.type === "success" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                {toast.type === "error" && (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                {toast.type === "info" && (
                  <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                )}
                <span className="font-medium">{toast.message}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      removeToast(toast.id);
                    }}
                    className="text-xs font-bold text-emerald-400 hover:text-white underline underline-offset-2 px-1 py-0.5 cursor-pointer"
                  >
                    {toast.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

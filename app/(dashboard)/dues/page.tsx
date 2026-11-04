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
  const [isPending, startTransition] = useTransition();

  // Payment confirmation dialog state
  const [payModalItem, setPayModalItem] = useState<InstallmentItem | null>(null);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payNote, setPayNote] = useState<string>("");
  const [submittingPay, setSubmittingPay] = useState(false);

  // Status action state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchDues = async () => {
    try {
      setLoading(true);
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

  const handleMarkPaidConfirm = async () => {
    if (!payModalItem) return;
    try {
      setSubmittingPay(true);
      const res = await fetch(`/api/dues/${payModalItem.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidOn: payDate,
          note: payNote,
        }),
      });

      if (res.ok) {
        setPayModalItem(null);
        setPayNote("");
        fetchDues();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to mark as paid");
      }
    } catch (err) {
      console.error(err);
      alert("Error marking installment as paid");
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleStatusChange = async (installmentId: string, newStatus: "OVERDUE" | "PENDING") => {
    try {
      setActionLoadingId(installmentId);
      const res = await fetch(`/api/dues/${installmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchDues();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating status");
    } finally {
      setActionLoadingId(null);
    }
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
            onClick={fetchDues}
            disabled={loading}
            className="inline-flex items-center px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
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
                className={`inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
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
        {loading ? (
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
          <div className="divide-y divide-gray-200">
            {filteredInstallments.map((item) => {
              const isOverdue = item.status === "OVERDUE";
              const isPaid = item.status === "PAID";
              const isDueToday = item.isDueToday && !isPaid;

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isOverdue
                      ? "bg-red-50/40 hover:bg-red-50/70"
                      : isDueToday
                      ? "bg-amber-50/40 hover:bg-amber-50/70"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Left: Borrower & Installment Info */}
                  <div className="flex items-start space-x-3.5">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
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
                          <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
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
                        className={`text-lg sm:text-xl font-bold ${
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
                    <div className="flex items-center space-x-2">
                      {!isPaid ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPayModalItem(item);
                              setPayDate(new Date().toISOString().split("T")[0]);
                              setPayNote(`EMI #${item.installmentNo} for ${item.loan.borrower.name}`);
                            }}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark Paid
                          </button>

                          {item.status === "PENDING" && (
                            <button
                              type="button"
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleStatusChange(item.id, "OVERDUE")}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                              title="Mark this 1 EMI as overdue"
                            >
                              Mark Overdue
                            </button>
                          )}

                          {item.status === "OVERDUE" && (
                            <button
                              type="button"
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleStatusChange(item.id, "PENDING")}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                              title="Revert back to pending"
                            >
                              Revert
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoadingId === item.id}
                          onClick={() => {
                            if (
                              confirm(
                                `Revert EMI #${item.installmentNo} back to Pending? This will delete the recorded payment.`
                              )
                            ) {
                              handleStatusChange(item.id, "PENDING");
                            }
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Undo Paid
                        </button>
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
        )}
      </div>

      {/* Record Payment Dialog Modal */}
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
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkPaidConfirm}
                disabled={submittingPay}
                className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
              >
                {submittingPay ? "Saving..." : "Confirm & Mark as Paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

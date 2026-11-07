"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatINR, formatReadableDate, formatReadableDateTime } from "@/lib/format";
import { LoanTypeBadge, LoanStatusBadge } from "@/components/LoanBadge";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";
import {
  ArrowLeft,
  Lock,
  PlusCircle,
  Bell,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Wallet,
  TrendingUp,
  Clock,
  Send,
  X,
  Check,
  RotateCcw,
} from "lucide-react";

interface Payment {
  id: string;
  paidOn: string;
  amount: string;
  kind: "INSTALLMENT" | "INTEREST" | "PRINCIPAL";
  note?: string | null;
  createdAt: string;
}

interface ReminderLog {
  id: string;
  dueDate: string;
  trigger: "BEFORE" | "ON_DAY";
  recipient: "OWNER" | "BORROWER";
  sentAt: string;
}

interface LoanDetail {
  id: string;
  type: "EMI" | "INTEREST_FREE" | "INTEREST_ONLY" | "FLEXIBLE";
  principalAmount: string;
  startDate: string;
  dueDay: number;
  monthlyAmount?: string | null;
  totalMonths?: number | null;
  interestMode?: "FIXED" | "PERCENT" | null;
  interestValue?: string | null;
  status: "ACTIVE" | "CLOSED";
  remindDaysBefore: number[];
  remindOnDueDay: boolean;
  remindBorrower: boolean;
  notes?: string | null;
  borrower: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  installments?: {
    id: string;
    installmentNo: number;
    dueDate: string;
    amount: string;
    status: "PENDING" | "PAID" | "OVERDUE";
    paidAt?: string | null;
    paymentId?: string | null;
    notes?: string | null;
  }[];
  payments: Payment[];
  reminderLogs: ReminderLog[];
  calculations: {
    totalPaid: string;
    totalPayable?: string;
    remainingAmount?: string;
    monthsRemaining?: number;
    outstandingPrincipal?: string;
    monthlyInterestDue?: string;
    totalInterestPaid?: string;
    totalPrincipalPaid?: string;
    monthsInterestPaid?: number;
    isAutoClosed: boolean;
    isMismatchWarning?: boolean;
  };
  nextDueDate: string;
  isOverdue: boolean;
  daysUntilDue: number;
}

function LoanDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Dialogs
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Edit State (Everything EXCEPT principalAmount and startDate)
  const [editDueDay, setEditDueDay] = useState<number>(5);
  const [editMonthlyAmount, setEditMonthlyAmount] = useState<string>("");
  const [editTotalMonths, setEditTotalMonths] = useState<string>("");
  const [editInterestMode, setEditInterestMode] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [editInterestValue, setEditInterestValue] = useState<string>("");
  const [editRemindDaysBefore, setEditRemindDaysBefore] = useState<number[]>([]);
  const [editRemindOnDueDay, setEditRemindOnDueDay] = useState(true);
  const [editRemindBorrower, setEditRemindBorrower] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchLoan = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      const res = await fetch(`/api/loans/${id}`);
      if (!res.ok) throw new Error("Loan not found.");
      const data = await res.json();
      setLoan(data);

      // Prepopulate edit state
      setEditDueDay(data.dueDay);
      setEditMonthlyAmount(data.monthlyAmount ? String(data.monthlyAmount) : "");
      setEditTotalMonths(data.totalMonths ? String(data.totalMonths) : "");
      setEditInterestMode(data.interestMode || "PERCENT");
      setEditInterestValue(data.interestValue ? String(data.interestValue) : "");
      setEditRemindDaysBefore(data.remindDaysBefore || [3]);
      setEditRemindOnDueDay(data.remindOnDueDay ?? true);
      setEditRemindBorrower(data.remindBorrower ?? false);
      setEditNotes(data.notes || "");
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchLoan();
  }, [id]);

  // Toggle status: ACTIVE <-> CLOSED
  const handleToggleStatus = async () => {
    if (!loan) return;
    const newStatus = loan.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    const msg =
      newStatus === "CLOSED"
        ? "Close this loan? Reminders will be paused."
        : "Re-open this loan as ACTIVE?";

    if (confirm(msg)) {
      try {
        const res = await fetch(`/api/loans/${loan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Failed to change status.");
        setActionSuccess(`Loan status updated to ${newStatus}.`);
        fetchLoan();
      } catch (err: any) {
        setActionError(err.message);
      }
    }
  };

  // Send Test Reminder
  const handleSendTestReminder = async () => {
    if (!loan) return;
    setSendingReminder(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/loans/${loan.id}/test-reminder`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test reminder.");
      }
      setActionSuccess(data.message || "Test reminder sent successfully!");
      fetchLoan();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSendingReminder(false);
    }
  };

  // Delete Payment
  const handleDeletePayment = async (paymentId: string) => {
    if (confirm("Delete this payment record? This will adjust outstanding balance.")) {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete payment.");
        setActionSuccess("Payment deleted successfully.");
        fetchLoan();
      } catch (err: any) {
        setActionError(err.message);
      }
    }
  };

  // Delete Loan
  const handleDeleteLoan = async () => {
    if (confirm("Are you sure you want to delete this entire loan and its payment records?")) {
      try {
        const res = await fetch(`/api/loans/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete loan.");
        router.push("/loans");
      } catch (err: any) {
        setActionError(err.message);
      }
    }
  };

  // Optimistic Mark Installment as Paid (instant UI update + background save + rollback)
  const handleMarkInstallmentPaidOptimistic = (instId: string, installmentNo: number, amount: string) => {
    if (!loan) return;
    const prevLoan = { ...loan };

    const numAmt = parseFloat(amount) || 0;
    const todayIso = new Date().toISOString();

    setLoan((prev) => {
      if (!prev) return prev;
      const updatedInstallments = prev.installments?.map((inst) =>
        inst.id === instId
          ? { ...inst, status: "PAID" as const, paidAt: todayIso }
          : inst
      );
      const newTotalPaid = (parseFloat(prev.calculations.totalPaid || "0") + numAmt).toFixed(2);
      const newRemaining = Math.max(0, parseFloat(prev.calculations.remainingAmount || "0") - numAmt).toFixed(2);
      const newMonthsRemaining = Math.max(0, (prev.calculations.monthsRemaining || 1) - 1);

      return {
        ...prev,
        installments: updatedInstallments,
        calculations: {
          ...prev.calculations,
          totalPaid: newTotalPaid,
          remainingAmount: newRemaining,
          monthsRemaining: newMonthsRemaining,
        },
      };
    });

    setActionSuccess(`EMI #${installmentNo} marked as PAID.`);
    setActionError(null);

    fetch(`/api/dues/${instId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: `EMI #${installmentNo} paid` }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to mark as paid");
        }
        fetchLoan({ silent: true });
      })
      .catch((err) => {
        console.error("Mark paid error:", err);
        setLoan(prevLoan);
        setActionError(`Failed to save payment for EMI #${installmentNo}. Reverted.`);
      });
  };

  const handleInstallmentStatusOptimistic = (instId: string, installmentNo: number, newStatus: "OVERDUE" | "PENDING") => {
    if (!loan) return;
    const prevLoan = { ...loan };

    setLoan((prev) => {
      if (!prev) return prev;
      const updatedInstallments = prev.installments?.map((inst) =>
        inst.id === instId
          ? { ...inst, status: newStatus }
          : inst
      );
      return {
        ...prev,
        installments: updatedInstallments,
      };
    });

    setActionSuccess(`EMI #${installmentNo} marked as ${newStatus}.`);

    fetch(`/api/dues/${instId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to update status");
        }
        fetchLoan({ silent: true });
      })
      .catch((err) => {
        console.error("Status update error:", err);
        setLoan(prevLoan);
        setActionError(`Failed to update status for EMI #${installmentNo}. Reverted.`);
      });
  };

  // Save Edit (principalAmount and startDate are never included)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setActionError(null);

    try {
      const payload: any = {
        dueDay: editDueDay,
        remindDaysBefore: editRemindDaysBefore,
        remindOnDueDay: editRemindOnDueDay,
        remindBorrower: editRemindBorrower,
        notes: editNotes.trim() || undefined,
      };

      if (loan?.type === "EMI" || loan?.type === "INTEREST_FREE") {
        payload.monthlyAmount = editMonthlyAmount.trim();
        payload.totalMonths = parseInt(editTotalMonths, 10);
      } else if (loan?.type === "INTEREST_ONLY") {
        payload.interestMode = editInterestMode;
        payload.interestValue = editInterestValue.trim();
      }

      const res = await fetch(`/api/loans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update loan.");

      setIsEditDialogOpen(false);
      setActionSuccess("Loan settings updated successfully.");
      fetchLoan();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Loading loan details...</div>;
  }

  if (!loan) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Loan Not Found</h2>
        <Link href="/loans" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Back to Loans
        </Link>
      </div>
    );
  }

  const isInterestOnly = loan.type === "INTEREST_ONLY";
  const isFlexible = loan.type === "FLEXIBLE";
  const balance = isInterestOnly
    ? loan.calculations.outstandingPrincipal || "0.00"
    : loan.calculations.remainingAmount || "0.00";

  const suggestedAmount = isInterestOnly
    ? loan.calculations.monthlyInterestDue || "0"
    : isFlexible
    ? balance
    : loan.monthlyAmount || "0";

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/loans"
            className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">{loan.borrower.name}</h1>
              <LoanTypeBadge type={loan.type} />
              <LoanStatusBadge status={loan.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Started on {formatReadableDate(loan.startDate)} • Repayment due on the {loan.dueDay}th of each month
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPaymentDialogOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Payment</span>
          </button>

          <button
            type="button"
            onClick={handleSendTestReminder}
            disabled={sendingReminder}
            className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50"
            title="Send test email reminder to owner & borrower right now"
          >
            <Send className="w-3.5 h-3.5 text-indigo-600" />
            <span>{sendingReminder ? "Sending..." : "Send Test Reminder"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditDialogOpen(true)}
            className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center space-x-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={handleToggleStatus}
            className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold"
          >
            {loan.status === "ACTIVE" ? "Close Loan" : "Re-open Loan"}
          </button>

          <button
            type="button"
            onClick={handleDeleteLoan}
            className="p-2 border border-gray-300 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete loan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)}>✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)}>✕</button>
        </div>
      )}

      {/* Key Numbers Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Principal */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Principal</span>
            <span title="Immutable"><Lock className="w-3 h-3 text-amber-600" /></span>
          </div>
          <div className="text-lg font-bold text-gray-900">{formatINR(loan.principalAmount)}</div>
          <div className="text-[10px] text-amber-700 font-medium">Immutable</div>
        </div>

        {/* Monthly Amount / Due */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">
            {isInterestOnly
              ? "Monthly Interest"
              : isFlexible
              ? "Repayment Amount"
              : "Monthly Installment"}
          </div>
          <div className="text-lg font-bold text-gray-900">
            {isFlexible ? "Flexible" : formatINR(suggestedAmount)}
          </div>
          <div className="text-[10px] text-gray-500">
            {isInterestOnly
              ? loan.interestMode === "PERCENT"
                ? `${loan.interestValue}% / mo`
                : "Fixed"
              : isFlexible
              ? `Remind on ${loan.dueDay}th`
              : `Due on ${loan.dueDay}th`}
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Total Paid</div>
          <div className="text-lg font-bold text-emerald-700">
            {formatINR(loan.calculations.totalPaid)}
          </div>
          <div className="text-[10px] text-gray-500">
            {loan.payments.length} payment{loan.payments.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Outstanding / Remaining */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">
            {isInterestOnly ? "Principal Left" : "Total Remaining"}
          </div>
          <div className="text-lg font-bold text-indigo-700">{formatINR(balance)}</div>
          <div className="text-[10px] text-gray-500">
            {isInterestOnly ? "Pending capital" : "Total to clear"}
          </div>
        </div>

        {/* Months Remaining / Paid */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">
            {isInterestOnly
              ? "Interest Cycles"
              : isFlexible
              ? "Repayment Type"
              : "Months Left"}
          </div>
          <div className="text-lg font-bold text-gray-900">
            {isInterestOnly
              ? `${loan.calculations.monthsInterestPaid || 0} mos paid`
              : isFlexible
              ? "Open Debt"
              : `${loan.calculations.monthsRemaining || 0} of ${loan.totalMonths}`}
          </div>
          <div className="text-[10px] text-gray-500">
            {isInterestOnly
              ? `₹${loan.calculations.totalInterestPaid || 0} earned`
              : isFlexible
              ? "Partial payments anytime"
              : "Installment cycle"}
          </div>
        </div>

        {/* Next Due Date */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Next Due Date</div>
          <div className="text-base font-bold text-gray-900">
            {loan.status === "ACTIVE" ? formatReadableDate(loan.nextDueDate) : "Closed"}
          </div>
          <div className="text-[10px]">
            {loan.status !== "ACTIVE" ? (
              <span className="text-gray-400">No pending dues</span>
            ) : loan.daysUntilDue < 0 ? (
              <span className="text-red-600 font-bold">{Math.abs(loan.daysUntilDue)}d Overdue</span>
            ) : loan.daysUntilDue === 0 ? (
              <span className="text-amber-600 font-bold">Due Today</span>
            ) : (
              <span className="text-gray-500">in {loan.daysUntilDue} days</span>
            )}
          </div>
        </div>
      </div>

      {/* EMI Installments Schedule Table (if EMI loan) */}
      {loan.type === "EMI" && loan.installments && loan.installments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-base">EMI Installment Schedule</h2>
              <p className="text-xs text-gray-500">
                Monthly repayment installments, due dates, and payment statuses.
              </p>
            </div>
            <Link
              href={`/dues?borrowerId=${loan.borrower.id}`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Open Dues Page &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Installment</th>
                  <th className="px-6 py-3">Due Date</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loan.installments.map((inst) => {
                  const isPaid = inst.status === "PAID";
                  const isOverdue = inst.status === "OVERDUE";
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-gray-900">
                        EMI #{inst.installmentNo}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {formatReadableDate(inst.dueDate)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-gray-900 text-sm">
                        {formatINR(inst.amount)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : isOverdue
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {inst.status}
                          {isPaid && inst.paidAt ? ` (${formatReadableDate(inst.paidAt)})` : ""}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {!isPaid ? (
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleMarkInstallmentPaidOptimistic(inst.id, inst.installmentNo, inst.amount)}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
                            >
                              Mark Paid
                            </button>
                            {inst.status === "PENDING" && (
                              <button
                                type="button"
                                onClick={() => handleInstallmentStatusOptimistic(inst.id, inst.installmentNo, "OVERDUE")}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 active:scale-95 transition-all cursor-pointer"
                              >
                                Mark Overdue
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-600 font-semibold text-xs">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">Payment History</h2>
            <p className="text-xs text-gray-500">
              Complete ledger of installments, interest payments, and principal returns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPaymentDialogOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center space-x-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Payment</span>
          </button>
        </div>

        {loan.payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No payments recorded yet for this loan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Paid Date</th>
                  <th className="px-6 py-3">Kind</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loan.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900">
                      {formatReadableDate(p.paidOn)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                          p.kind === "PRINCIPAL"
                            ? "bg-purple-100 text-purple-800"
                            : p.kind === "INTEREST"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {p.kind}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold text-gray-900 text-sm">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {p.note || "-"}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(p.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded"
                        title="Delete payment entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reminder Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">Reminder Dispatch Logs</h2>
          <p className="text-xs text-gray-500">
            Automated reminders sent for this loan to prevent duplicate messages.
          </p>
        </div>

        {loan.reminderLogs.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-xs">
            No reminder logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-2.5">Due Date</th>
                  <th className="px-6 py-2.5">Trigger</th>
                  <th className="px-6 py-2.5">Recipient</th>
                  <th className="px-6 py-2.5">Sent Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loan.reminderLogs.map((log) => (
                  <tr key={log.id} className="text-gray-600">
                    <td className="px-6 py-2.5 font-medium">{formatReadableDate(log.dueDate)}</td>
                    <td className="px-6 py-2.5">
                      <span className="font-semibold text-gray-700">{log.trigger}</span>
                    </td>
                    <td className="px-6 py-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.recipient === "OWNER"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {log.recipient}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-gray-500">
                      {formatReadableDateTime(log.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        loanId={loan.id}
        borrowerName={loan.borrower.name}
        loanType={loan.type}
        suggestedAmount={suggestedAmount}
        onSuccess={() => {
          setActionSuccess("Payment successfully recorded!");
          fetchLoan();
        }}
      />

      {/* Edit Loan Dialog (Principal and StartDate cannot be modified) */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Edit Loan Settings</h3>
              <button
                type="button"
                onClick={() => setIsEditDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {/* Due Day */}
              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Due Day of Month (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={editDueDay}
                  onChange={(e) => setEditDueDay(parseInt(e.target.value, 10) || 1)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Conditional: EMI / Interest Free */}
              {(loan.type === "EMI" || loan.type === "INTEREST_FREE") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 uppercase mb-1">
                      Monthly Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editMonthlyAmount}
                      onChange={(e) => setEditMonthlyAmount(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 uppercase mb-1">
                      Total Months
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editTotalMonths}
                      onChange={(e) => setEditTotalMonths(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: Interest Only */}
              {loan.type === "INTEREST_ONLY" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 uppercase mb-1">
                      Interest Mode
                    </label>
                    <select
                      value={editInterestMode}
                      onChange={(e) => setEditInterestMode(e.target.value as any)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="PERCENT">Percent (%)</option>
                      <option value="FIXED">Fixed (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 uppercase mb-1">
                      Interest Value
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editInterestValue}
                      onChange={(e) => setEditInterestValue(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Reminder Settings */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editRemindOnDueDay}
                    onChange={(e) => setEditRemindOnDueDay(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-gray-800 font-medium">Remind on due day</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    disabled={!loan.borrower.email}
                    checked={editRemindBorrower}
                    onChange={(e) => setEditRemindBorrower(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded disabled:opacity-50"
                  />
                  <span className="text-gray-800 font-medium">
                    Email reminders to borrower ({loan.borrower.email || "No email"})
                  </span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoanDetailPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400 text-sm">Loading loan details...</div>}>
      <LoanDetailContent />
    </Suspense>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatReadableDate } from "@/lib/format";
import { LoanTypeBadge, LoanStatusBadge } from "@/components/LoanBadge";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  PlusCircle,
  ChevronRight,
  ArrowUpRight,
  CreditCard,
  RefreshCw,
} from "lucide-react";

interface LoanItem {
  id: string;
  type: string;
  principalAmount: string;
  startDate: string;
  dueDay: number;
  monthlyAmount?: string | null;
  status: string;
  borrower: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  calculations: {
    totalPaid: string;
    remainingAmount?: string;
    outstandingPrincipal?: string;
    monthlyInterestDue?: string;
    totalInterestPaid?: string;
    monthsRemaining?: number;
    monthsInterestPaid?: number;
    isAutoClosed: boolean;
  };
  nextDueDate: string;
  isOverdue: boolean;
  daysUntilDue: number;
}

export default function DashboardPage() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected loan for recording payment
  const [paymentLoan, setPaymentLoan] = useState<LoanItem | null>(null);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/loans");
      if (!res.ok) throw new Error("Failed to load loans.");
      const data = await res.json();
      setLoans(data);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  // Compute Summary Metrics
  const activeLoans = loans.filter((l) => l.status === "ACTIVE");

  // 1. Total Lent Out: sum of principal of all loans
  const totalLentOut = loans.reduce(
    (sum, l) => sum + parseFloat(l.principalAmount || "0"),
    0
  );

  // 2. Total Outstanding: sum of remaining/outstanding of active loans
  const totalOutstanding = activeLoans.reduce((sum, l) => {
    if (l.type === "INTEREST_ONLY") {
      return sum + parseFloat(l.calculations.outstandingPrincipal || "0");
    }
    return sum + parseFloat(l.calculations.remainingAmount || "0");
  }, 0);

  // 3. Total Interest Earned across all loans
  const totalInterestEarned = loans.reduce((sum, l) => {
    return sum + parseFloat(l.calculations.totalInterestPaid || "0");
  }, 0);

  // 4. Overdue Loans (daysUntilDue < 0)
  const overdueLoans = activeLoans
    .filter((l) => l.isOverdue || l.daysUntilDue < 0)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  // 5. Upcoming Dues in next 7 days (daysUntilDue >= 0 && daysUntilDue <= 7)
  const duesNext7Days = activeLoans.filter(
    (l) => l.daysUntilDue >= 0 && l.daysUntilDue <= 7
  );
  const duesNext7DaysAmount = duesNext7Days.reduce((sum, l) => {
    const amt =
      l.type === "INTEREST_ONLY"
        ? parseFloat(l.calculations.monthlyInterestDue || "0")
        : l.type === "FLEXIBLE"
        ? parseFloat(l.calculations.remainingAmount || "0")
        : parseFloat(l.monthlyAmount || "0");
    return sum + amt;
  }, 0);

  // Upcoming dues list (due in next 30 days)
  const upcomingDues = activeLoans
    .filter((l) => l.daysUntilDue >= 0)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your active loans, dues, and cash flow.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchLoans}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/dues"
            className="inline-flex items-center px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs"
          >
            Manage Dues
          </Link>
          <Link
            href="/loans/new"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            New Loan
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Lent Out */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Lent Out</span>
            <Wallet className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatINR(totalLentOut, false)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Across {loans.length} total loan{loans.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatINR(totalOutstanding, false)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {activeLoans.length} active loan{activeLoans.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Interest Earned */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Interest Earned</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700">
            {formatINR(totalInterestEarned, false)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total interest realized</div>
        </div>

        {/* Dues in next 7 days */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Next 7 Days</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">
            {formatINR(duesNext7DaysAmount, false)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {duesNext7Days.length} payment{duesNext7Days.length !== 1 ? "s" : ""} coming up
          </div>
        </div>

        {/* Overdue Count */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className={`text-xl font-bold ${overdueLoans.length > 0 ? "text-red-600" : "text-gray-900"}`}>
            {overdueLoans.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {overdueLoans.length === 0 ? "All loans on schedule" : "Requires attention"}
          </div>
        </div>
      </div>

      {/* Main Grid: Overdue & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Overdue Dues Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/40">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-gray-900 text-base">Overdue Loans</h2>
              <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {overdueLoans.length}
              </span>
            </div>
            <Link
              href="/dues?status=OVERDUE"
              className="text-xs font-semibold text-red-700 hover:text-red-900"
            >
              Manage in Dues &rarr;
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {overdueLoans.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CheckCircle className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm">No overdue loans right now!</p>
              </div>
            ) : (
              overdueLoans.map((loan) => {
                const dueAmount =
                  loan.type === "INTEREST_ONLY"
                    ? loan.calculations.monthlyInterestDue || "0"
                    : loan.type === "FLEXIBLE"
                    ? loan.calculations.remainingAmount || "0"
                    : loan.monthlyAmount || "0";

                return (
                  <div
                    key={loan.id}
                    className="p-4 sm:px-6 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/loans/${loan.id}`}
                          className="font-semibold text-gray-900 hover:text-indigo-600 text-base transition-colors"
                        >
                          {loan.borrower.name}
                        </Link>
                        <LoanTypeBadge type={loan.type} />
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                        <span>Due: {formatReadableDate(loan.nextDueDate)}</span>
                        <span className="text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded">
                          {Math.abs(loan.daysUntilDue)} day{Math.abs(loan.daysUntilDue) !== 1 ? "s" : ""} overdue
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {formatINR(dueAmount)}
                        </div>
                        <div className="text-[11px] text-gray-400">Due Amount</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPaymentLoan(loan)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition-colors"
                      >
                        Record Payment
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Dues Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900 text-base">Upcoming Dues</h2>
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {upcomingDues.length}
              </span>
            </div>
            <Link
              href="/loans"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center"
            >
              View all loans <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {upcomingDues.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p className="text-sm">No upcoming dues found.</p>
              </div>
            ) : (
              upcomingDues.slice(0, 5).map((loan) => {
                const dueAmount =
                  loan.type === "INTEREST_ONLY"
                    ? loan.calculations.monthlyInterestDue || "0"
                    : loan.type === "FLEXIBLE"
                    ? loan.calculations.remainingAmount || "0"
                    : loan.monthlyAmount || "0";

                return (
                  <div
                    key={loan.id}
                    className="p-4 sm:px-6 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/loans/${loan.id}`}
                          className="font-semibold text-gray-900 hover:text-indigo-600 text-base transition-colors"
                        >
                          {loan.borrower.name}
                        </Link>
                        <LoanTypeBadge type={loan.type} />
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                        <span>Due: {formatReadableDate(loan.nextDueDate)}</span>
                        <span
                          className={`px-2 py-0.5 rounded font-medium ${
                            loan.daysUntilDue === 0
                              ? "bg-amber-100 text-amber-800 font-bold"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {loan.daysUntilDue === 0
                            ? "DUE TODAY"
                            : `in ${loan.daysUntilDue} day${loan.daysUntilDue !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {formatINR(dueAmount)}
                        </div>
                        <div className="text-[11px] text-gray-400">Amount Due</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPaymentLoan(loan)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors"
                      >
                        Record Payment
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Dialog */}
      {paymentLoan && (
        <RecordPaymentDialog
          isOpen={Boolean(paymentLoan)}
          onClose={() => setPaymentLoan(null)}
          loanId={paymentLoan.id}
          borrowerName={paymentLoan.borrower.name}
          loanType={paymentLoan.type}
          suggestedAmount={
            paymentLoan.type === "INTEREST_ONLY"
              ? paymentLoan.calculations.monthlyInterestDue || "0"
              : paymentLoan.type === "FLEXIBLE"
              ? paymentLoan.calculations.remainingAmount || "0"
              : paymentLoan.monthlyAmount || "0"
          }
          onSuccess={() => {
            fetchLoans();
          }}
        />
      )}
    </div>
  );
}

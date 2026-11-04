"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatINR, formatReadableDate } from "@/lib/format";
import { LoanTypeBadge, LoanStatusBadge } from "@/components/LoanBadge";
import {
  BadgePercent,
  PlusCircle,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

interface Loan {
  id: string;
  type: string;
  principalAmount: string;
  startDate: string;
  dueDay: number;
  monthlyAmount?: string | null;
  status: string;
  notes?: string | null;
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
    isAutoClosed: boolean;
  };
  nextDueDate: string;
  isOverdue: boolean;
  daysUntilDue: number;
}

interface BorrowerOption {
  id: string;
  name: string;
}

function LoansListContent() {
  const searchParams = useSearchParams();
  const initialBorrower = searchParams.get("borrowerId") || "";

  const [loans, setLoans] = useState<Loan[]>([]);
  const [borrowers, setBorrowers] = useState<BorrowerOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterBorrower, setFilterBorrower] = useState(initialBorrower);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [loansRes, borrowersRes] = await Promise.all([
        fetch("/api/loans"),
        fetch("/api/borrowers"),
      ]);

      if (loansRes.ok) {
        const loansData = await loansRes.json();
        setLoans(loansData);
      }
      if (borrowersRes.ok) {
        const borrowersData = await borrowersRes.json();
        setBorrowers(borrowersData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetFilters = () => {
    setSearch("");
    setFilterBorrower("");
    setFilterType("");
    setFilterStatus("");
  };

  const filteredLoans = loans.filter((l) => {
    if (filterBorrower && l.borrower.id !== filterBorrower) return false;
    if (filterType && l.type !== filterType) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchBorrower = l.borrower.name.toLowerCase().includes(q);
      const matchNotes = l.notes?.toLowerCase().includes(q);
      if (!matchBorrower && !matchNotes) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            All Loans
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track, filter, and review all active and closed lending records.
          </p>
        </div>
        <Link
          href="/loans/new"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          New Loan
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by borrower or notes..."
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Borrower Filter */}
          <div>
            <select
              value={filterBorrower}
              onChange={(e) => setFilterBorrower(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Borrowers</option>
              {borrowers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Loan Types</option>
              <option value="EMI">EMI</option>
              <option value="INTEREST_FREE">Interest Free</option>
              <option value="INTEREST_ONLY">Interest Only</option>
              <option value="FLEXIBLE">Flexible Debt</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex space-x-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>

            {(search || filterBorrower || filterType || filterStatus) && (
              <button
                type="button"
                onClick={resetFilters}
                className="p-2 border border-gray-300 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg shrink-0"
                title="Reset filters"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loans List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Loading loans...
        </div>
      ) : filteredLoans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <BadgePercent className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No loans found</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
            {search || filterBorrower || filterType || filterStatus
              ? "No loans match your current filter settings."
              : "No loans have been recorded yet."}
          </p>
          <div className="mt-4">
            <Link
              href="/loans/new"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Loan
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLoans.map((loan) => {
            const isInterestOnly = loan.type === "INTEREST_ONLY";
            const balance = isInterestOnly
              ? loan.calculations.outstandingPrincipal || "0"
              : loan.calculations.remainingAmount || "0";

            const nextDueAmount = isInterestOnly
              ? loan.calculations.monthlyInterestDue || "0"
              : loan.monthlyAmount || "0";

            return (
              <Link
                key={loan.id}
                href={`/loans/${loan.id}`}
                className="block bg-white rounded-xl border border-gray-200 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all p-5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Left: Borrower & Type */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-gray-900 hover:text-indigo-600">
                        {loan.borrower.name}
                      </span>
                      <LoanTypeBadge type={loan.type} />
                      <LoanStatusBadge status={loan.status} />
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Started: {formatReadableDate(loan.startDate)}</span>
                      <span>Due day: {loan.dueDay}th of month</span>
                    </div>
                  </div>

                  {/* Right: Key Figures & Next Due */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-center gap-4 text-left md:text-right">
                    <div>
                      <div className="text-xs text-gray-400">Principal</div>
                      <div className="text-sm font-bold text-gray-900">
                        {formatINR(loan.principalAmount)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-400">
                        {isInterestOnly ? "Outstanding" : "Remaining"}
                      </div>
                      <div className="text-sm font-bold text-indigo-700">
                        {formatINR(balance)}
                      </div>
                    </div>

                    {loan.status === "ACTIVE" && (
                      <div>
                        <div className="text-xs text-gray-400">Next Due</div>
                        <div className="text-sm font-semibold text-gray-800">
                          {formatReadableDate(loan.nextDueDate)}
                        </div>
                        <div className="text-[11px]">
                          {loan.daysUntilDue < 0 ? (
                            <span className="text-red-600 font-semibold">
                              {Math.abs(loan.daysUntilDue)}d Overdue
                            </span>
                          ) : loan.daysUntilDue === 0 ? (
                            <span className="text-amber-600 font-bold">Due Today</span>
                          ) : (
                            <span className="text-gray-500">in {loan.daysUntilDue}d</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="hidden md:flex items-center pl-2 text-gray-400">
                      <ArrowRight className="w-5 h-5 text-gray-300" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LoansListPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400 text-sm">Loading loans...</div>}>
      <LoansListContent />
    </Suspense>
  );
}

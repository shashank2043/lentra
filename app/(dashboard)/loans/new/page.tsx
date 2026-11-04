"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BorrowerDialog } from "@/components/BorrowerDialog";
import { formatINR } from "@/lib/format";
import { formatToKolkataDateString } from "@/lib/dates";
import {
  PlusCircle,
  AlertCircle,
  HelpCircle,
  Calendar,
  Lock,
  Bell,
  Check,
  ChevronDown,
  Info,
} from "lucide-react";

interface Borrower {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

function NewLoanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBorrowerId = searchParams.get("borrowerId");

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loadingBorrowers, setLoadingBorrowers] = useState(true);
  const [isBorrowerDialogOpen, setIsBorrowerDialogOpen] = useState(false);

  // Form Fields
  const [borrowerId, setBorrowerId] = useState(preselectedBorrowerId || "");
  const [type, setType] = useState<"EMI" | "INTEREST_FREE" | "INTEREST_ONLY" | "FLEXIBLE">("EMI");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [startDate, setStartDate] = useState(formatToKolkataDateString(new Date()));
  const [dueDay, setDueDay] = useState<number>(5);

  // EMI / INTEREST_FREE
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [totalMonths, setTotalMonths] = useState<string>("12");
  const [remainingMonths, setRemainingMonths] = useState<string>("");

  // INTEREST_ONLY
  const [interestMode, setInterestMode] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [interestValue, setInterestValue] = useState("");

  // Reminder Settings
  const [remindDaysBefore, setRemindDaysBefore] = useState<number[]>([3]);
  const [customDayInput, setCustomDayInput] = useState("");
  const [remindOnDueDay, setRemindOnDueDay] = useState(true);
  const [remindBorrower, setRemindBorrower] = useState(false);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBorrowers = async () => {
    try {
      setLoadingBorrowers(true);
      const res = await fetch("/api/borrowers");
      if (res.ok) {
        const data = await res.json();
        setBorrowers(data);
        if (!borrowerId && data.length > 0) {
          setBorrowerId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBorrowers(false);
    }
  };

  useEffect(() => {
    fetchBorrowers();
  }, []);

  const selectedBorrower = borrowers.find((b) => b.id === borrowerId);
  const hasBorrowerEmail = Boolean(selectedBorrower?.email);

  // Ensure remindBorrower is turned off if borrower has no email
  useEffect(() => {
    if (!hasBorrowerEmail && remindBorrower) {
      setRemindBorrower(false);
    }
  }, [borrowerId, hasBorrowerEmail, remindBorrower]);

  // Chip toggle helper for remindDaysBefore
  const toggleRemindDay = (day: number) => {
    if (remindDaysBefore.includes(day)) {
      setRemindDaysBefore(remindDaysBefore.filter((d) => d !== day));
    } else {
      setRemindDaysBefore([...remindDaysBefore, day].sort((a, b) => a - b));
    }
  };

  const handleAddCustomDay = () => {
    const day = parseInt(customDayInput, 10);
    if (!isNaN(day) && day >= 1 && day <= 30 && !remindDaysBefore.includes(day)) {
      setRemindDaysBefore([...remindDaysBefore, day].sort((a, b) => a - b));
      setCustomDayInput("");
    }
  };

  // Live Calculations Preview
  const principalNum = parseFloat(principalAmount) || 0;
  const monthlyNum = parseFloat(monthlyAmount) || 0;
  const monthsNum = parseInt(totalMonths, 10) || 0;
  const totalPayableNum = monthlyNum * monthsNum;
  const isInterestFreeMismatch =
    type === "INTEREST_FREE" &&
    principalNum > 0 &&
    monthlyNum > 0 &&
    monthsNum > 0 &&
    Math.abs(totalPayableNum - principalNum) > 0.01;

  let interestOnlyDuePreview = 0;
  if (type === "INTEREST_ONLY") {
    const val = parseFloat(interestValue) || 0;
    if (interestMode === "FIXED") {
      interestOnlyDuePreview = val;
    } else {
      interestOnlyDuePreview = (principalNum * val) / 100;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!borrowerId) {
      setError("Please select a borrower. If none exist, add one first.");
      return;
    }

    if (principalNum <= 0) {
      setError("Principal amount must be greater than 0.");
      return;
    }

    if (dueDay < 1 || dueDay > 31) {
      setError("Due day must be between 1 and 31.");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        borrowerId,
        type,
        principalAmount: principalAmount.trim(),
        startDate,
        dueDay,
        remindDaysBefore,
        remindOnDueDay,
        remindBorrower: hasBorrowerEmail ? remindBorrower : false,
        notes: notes.trim() || undefined,
      };

      if (type === "EMI" || type === "INTEREST_FREE") {
        if (monthlyNum <= 0) throw new Error("Monthly payment must be greater than 0.");
        if (monthsNum <= 0) throw new Error("Total months must be at least 1.");
        payload.monthlyAmount = monthlyAmount.trim();
        payload.totalMonths = monthsNum;
        const rem = parseInt(remainingMonths, 10);
        if (!isNaN(rem) && rem > 0 && rem <= monthsNum) {
          payload.remainingMonths = rem;
        }
      }

      if (type === "INTEREST_ONLY") {
        if (!interestValue || parseFloat(interestValue) <= 0) {
          throw new Error("Interest value must be greater than 0.");
        }
        payload.interestMode = interestMode;
        payload.interestValue = interestValue.trim();
      }

      if (type === "FLEXIBLE") {
        payload.monthlyAmount = undefined;
        payload.totalMonths = undefined;
        payload.interestMode = null;
        payload.interestValue = undefined;
      }

      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create loan.");
      }

      router.push(`/loans/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create loan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Create New Loan
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure loan terms, repayment schedule, and automatic email reminder triggers.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Borrower Selection */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
            1. Borrower Information
          </h2>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Select Borrower <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsBorrowerDialogOpen(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                Add New Borrower
              </button>
            </div>

            {loadingBorrowers ? (
              <div className="py-2 text-xs text-gray-400">Loading borrowers...</div>
            ) : borrowers.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                No borrowers found in the system. Please add a borrower first before creating a loan.
              </div>
            ) : (
              <select
                required
                value={borrowerId}
                onChange={(e) => setBorrowerId(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.phone ? `(${b.phone})` : ""} {b.email ? `• ${b.email}` : "• (No Email)"}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Loan Type & Principal */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-5">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
            2. Loan Structure & Schedule
          </h2>

          {/* Loan Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Loan Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: "EMI",
                  title: "EMI Loan",
                  desc: "Fixed monthly payment for fixed months",
                },
                {
                  id: "INTEREST_FREE",
                  title: "Interest Free",
                  desc: "Zero interest, monthly installment on date",
                },
                {
                  id: "INTEREST_ONLY",
                  title: "Interest Only",
                  desc: "Monthly interest only; principal repaid later",
                },
                {
                  id: "FLEXIBLE",
                  title: "Flexible / Open",
                  desc: "No fixed monthly amount. Pay partial amounts anytime",
                },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setType(t.id as any)}
                  className={`p-3.5 text-left rounded-xl border transition-all ${
                    type === t.id
                      ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600 shadow-xs"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="font-bold text-sm text-gray-900">{t.title}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-relaxed">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Principal Amount & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center space-x-1.5 mb-1">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Principal Amount (₹) <span className="text-red-500">*</span>
                </label>
                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                  <Lock className="w-2.5 h-2.5 mr-0.5" /> Immutable
                </span>
              </div>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-semibold">
                  ₹
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  placeholder="50000"
                  className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Principal amount cannot be edited once created.
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-1.5 mb-1">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                  <Lock className="w-2.5 h-2.5 mr-0.5" /> Immutable
                </span>
              </div>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Date money was given to borrower.
              </p>
            </div>
          </div>

          {/* Due Day */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Due Day of Month (1 - 31) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="31"
              required
              value={dueDay}
              onChange={(e) => setDueDay(parseInt(e.target.value, 10) || 1)}
              className="block w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              For months with fewer days (e.g. Feb 28/29, Apr 30), the due date automatically adjusts to the last calendar day.
            </p>
          </div>

          {/* Conditional Fields: EMI / INTEREST_FREE */}
          {(type === "EMI" || type === "INTEREST_FREE") && (
            <div className="pt-3 border-t border-gray-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Monthly Payment Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-semibold">
                      ₹
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(e.target.value)}
                      placeholder="5000"
                      className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Total Months (Tenure) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={totalMonths}
                    onChange={(e) => setTotalMonths(e.target.value)}
                    placeholder="12"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Full loan duration in months</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Due / Remaining Months
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={monthsNum || 120}
                    value={remainingMonths}
                    onChange={(e) => setRemainingMonths(e.target.value)}
                    placeholder={totalMonths || "12"}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Remaining to pay (defaults to total)
                  </p>
                </div>
              </div>

              {/* Helper Preview Card */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
                <span className="text-gray-600">
                  Total Payable: <strong>{formatINR(totalPayableNum)}</strong> ({monthsNum} installments of {formatINR(monthlyNum)})
                  {remainingMonths && parseInt(remainingMonths, 10) < monthsNum && (
                    <span className="ml-2 text-indigo-700 font-semibold">
                      • Remaining Due: {formatINR(monthlyNum * parseInt(remainingMonths, 10))} ({remainingMonths} months)
                    </span>
                  )}
                </span>
                {isInterestFreeMismatch && (
                  <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                    Warning: Total payable ({formatINR(totalPayableNum)}) differs from Principal ({formatINR(principalNum)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Conditional Fields: INTEREST_ONLY */}
          {type === "INTEREST_ONLY" && (
            <div className="pt-3 border-t border-gray-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Interest Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={interestMode}
                    onChange={(e) => setInterestMode(e.target.value as any)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="PERCENT">Percentage per Month (% of balance)</option>
                    <option value="FIXED">Fixed Amount per Month (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    {interestMode === "PERCENT"
                      ? "Monthly Interest Rate (%)"
                      : "Fixed Monthly Interest (₹)"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={interestValue}
                    onChange={(e) => setInterestValue(e.target.value)}
                    placeholder={interestMode === "PERCENT" ? "2.0" : "2000"}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Interest calculation note */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                <span>
                  Expected Monthly Interest: <strong>{formatINR(interestOnlyDuePreview)}</strong>
                </span>
                <span className="text-indigo-600">
                  Principal repaid separately over time.
                </span>
              </div>
            </div>
          )}

          {/* Conditional Fields: FLEXIBLE */}
          {type === "FLEXIBLE" && (
            <div className="pt-3 border-t border-gray-100">
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-900">
                <div className="font-bold flex items-center space-x-1.5 text-amber-800">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>Flexible Debt Repayment</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  No fixed monthly installment required. On the <strong>{dueDay}th</strong> of every month, you will receive an automated email reminder showing the current pending balance. The borrower can repay any partial amount whenever they choose, and the loan will automatically close when the balance reaches zero.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Reminder Settings */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-5">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">
              3. Automatic Reminder Settings
            </h2>
          </div>

          {/* Chips for days before */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Send Reminder Days Before Due Date
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {[1, 2, 3, 5, 7].map((day) => {
                const isSelected = remindDaysBefore.includes(day);
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleRemindDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {day} day{day !== 1 ? "s" : ""} before
                  </button>
                );
              })}

              {/* Custom days in selection */}
              {remindDaysBefore
                .filter((d) => ![1, 2, 3, 5, 7].includes(d))
                .map((day) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleRemindDay(day)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  >
                    <Check className="w-3 h-3 inline mr-1" />
                    {day} days before
                  </button>
                ))}

              {/* Add custom day */}
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={customDayInput}
                  onChange={(e) => setCustomDayInput(e.target.value)}
                  placeholder="Custom"
                  className="w-20 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomDay}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                >
                  + Add
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Email alerts are triggered automatically by the daily morning cron.
            </p>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-3 pt-2">
            {/* Remind on due day */}
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={remindOnDueDay}
                onChange={(e) => setRemindOnDueDay(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-800">
                Send reminder on the due day itself
              </span>
            </label>

            {/* Remind borrower */}
            <div className="space-y-1">
              <label
                className={`flex items-center space-x-3 ${
                  hasBorrowerEmail ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!hasBorrowerEmail}
                  checked={remindBorrower}
                  onChange={(e) => setRemindBorrower(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-sm font-medium text-gray-800">
                  Also send a polite email reminder to the borrower
                </span>
              </label>

              {!hasBorrowerEmail && (
                <p className="text-xs text-amber-700 pl-7 flex items-center">
                  <Info className="w-3.5 h-3.5 mr-1 shrink-0" />
                  Disabled because this borrower has no email address configured.
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Loan Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Collateral, guarantor, agreed terms, purpose..."
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md flex items-center space-x-2 disabled:opacity-50"
          >
            {loading ? <span>Creating Loan...</span> : <span>Create & Track Loan</span>}
          </button>
        </div>
      </form>

      {/* Quick Add Borrower Modal */}
      <BorrowerDialog
        isOpen={isBorrowerDialogOpen}
        onClose={() => setIsBorrowerDialogOpen(false)}
        onSuccess={(newB) => {
          fetchBorrowers();
          if (newB.id) setBorrowerId(newB.id);
        }}
      />
    </div>
  );
}

export default function NewLoanPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400 text-sm">Loading loan form...</div>}>
      <NewLoanContent />
    </Suspense>
  );
}

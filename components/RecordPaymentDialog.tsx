"use client";

import React, { useState } from "react";
import { formatINR } from "@/lib/format";
import { formatToKolkataDateString } from "@/lib/dates";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

interface RecordPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  borrowerName: string;
  loanType: string;
  suggestedAmount?: string | number;
  onSuccess: () => void;
}

export function RecordPaymentDialog({
  isOpen,
  onClose,
  loanId,
  borrowerName,
  loanType,
  suggestedAmount,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [paidOn, setPaidOn] = useState<string>(formatToKolkataDateString(new Date()));
  const [amount, setAmount] = useState<string>(
    suggestedAmount ? String(suggestedAmount) : ""
  );
  const [kind, setKind] = useState<"INSTALLMENT" | "INTEREST" | "PRINCIPAL">(
    loanType === "INTEREST_ONLY" ? "INTEREST" : "INSTALLMENT"
  );
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid payment amount greater than 0.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId,
          paidOn,
          amount: amount.trim(),
          kind,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Record Payment</h3>
            <p className="text-xs text-gray-500">
              {borrowerName} • <span className="font-medium text-gray-700">{loanType.replace("_", " ")}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Payment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-semibold">
                ₹
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
              />
            </div>
          </div>

          {/* Payment Kind */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Payment Kind <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["INSTALLMENT", "INTEREST", "PRINCIPAL"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                    kind === k
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            {kind === "PRINCIPAL" && loanType === "INTEREST_ONLY" && (
              <p className="text-[11px] text-indigo-600 mt-1">
                Returning principal reduces future monthly interest dues.
              </p>
            )}
            {loanType === "FLEXIBLE" && (
              <p className="text-[11px] text-amber-700 mt-1">
                Flexible debt: Enter any partial repayment amount. It immediately reduces the total balance.
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Payment Date (IST) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. UPI Ref: 123456, cash received"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Recording...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Save Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

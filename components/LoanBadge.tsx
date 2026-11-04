import React from "react";

export function LoanTypeBadge({ type }: { type: string }) {
  let label = type.replace("_", " ");
  let color = "bg-blue-50 text-blue-700 border-blue-200";

  if (type === "INTEREST_FREE") {
    label = "Interest Free";
    color = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (type === "INTEREST_ONLY") {
    label = "Interest Only";
    color = "bg-purple-50 text-purple-700 border-purple-200";
  } else if (type === "FLEXIBLE") {
    label = "Flexible Debt";
    color = "bg-amber-50 text-amber-800 border-amber-200";
  } else if (type === "EMI") {
    label = "EMI";
    color = "bg-blue-50 text-blue-700 border-blue-200";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}
    >
      {label}
    </span>
  );
}

export function LoanStatusBadge({ status }: { status: string }) {
  const isClosed = status === "CLOSED";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        isClosed
          ? "bg-gray-100 text-gray-700 border-gray-300"
          : "bg-green-50 text-green-700 border-green-300"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          isClosed ? "bg-gray-400" : "bg-green-500"
        }`}
      />
      {status}
    </span>
  );
}

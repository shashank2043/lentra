import Decimal from "decimal.js";

/**
 * Formats a number or Decimal string into Indian Rupees (INR)
 * E.g., 100000 -> ₹1,00,000.00
 */
export function formatINR(
  amount: number | string | Decimal | null | undefined,
  includeDecimals: boolean = true
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "₹0.00";
  }

  const num = typeof amount === "number" ? amount : new Decimal(amount).toNumber();

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(num);
}

/**
 * Formats a date into a clean readable string in Asia/Kolkata timezone.
 * E.g. "05 Nov 2026"
 */
export function formatReadableDate(
  date: Date | string | null | undefined
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Formats a date into date with time for reminder logs / payments
 * E.g. "05 Nov 2026, 08:30 AM"
 */
export function formatReadableDateTime(
  date: Date | string | null | undefined
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

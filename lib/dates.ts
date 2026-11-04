/**
 * Date and timezone utilities for Money Lending Tracker.
 * All calendar and date calculations are anchored to the Asia/Kolkata (IST, UTC+05:30) timezone.
 */

const TIMEZONE = "Asia/Kolkata";

/**
 * Returns the current date in Asia/Kolkata as a Date object at 00:00:00 IST.
 */
export function getNowInKolkata(): Date {
  const now = new Date();
  const istString = now.toLocaleString("en-US", { timeZone: TIMEZONE });
  return new Date(istString);
}

/**
 * Formats a Date or ISO string into YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function formatToKolkataDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // en-CA outputs YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Parses YYYY-MM-DD string into a Date at UTC midnight representing that calendar date.
 */
export function parseKolkataDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

/**
 * Returns the number of days in a given year and month (1-based month).
 * Handles leap years automatically.
 */
export function getDaysInMonth(year: number, month: number): number {
  // Month is 1-based, day 0 of month+1 gives last day of month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Computes the exact calendar due date for a specific year and month,
 * clamping dueDay to the last day of the month if the month has fewer days.
 * E.g., dueDay=31 in April (30 days) -> April 30.
 * dueDay=31 in February 2024 (leap year, 29 days) -> Feb 29.
 * dueDay=31 in February 2025 (28 days) -> Feb 28.
 */
export function getClampedDueDate(year: number, month: number, dueDay: number): Date {
  const maxDays = getDaysInMonth(year, month);
  const actualDay = Math.min(Math.max(1, dueDay), maxDays);
  return new Date(Date.UTC(year, month - 1, actualDay, 0, 0, 0));
}

/**
 * Returns difference in whole calendar days (date2 - date1) using YYYY-MM-DD strings.
 */
export function getCalendarDayDifference(
  targetDate: Date | string,
  baseDate: Date | string
): number {
  const targetStr = typeof targetDate === "string" ? targetDate : formatToKolkataDateString(targetDate);
  const baseStr = typeof baseDate === "string" ? baseDate : formatToKolkataDateString(baseDate);

  const t1 = parseKolkataDate(targetStr).getTime();
  const t2 = parseKolkataDate(baseStr).getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((t1 - t2) / MS_PER_DAY);
}

export interface NextDueDateResult {
  dueDate: Date;
  dueDateString: string; // YYYY-MM-DD
  isOverdue: boolean;
  daysUntilDue: number; // positive = future, 0 = today, negative = past
  cycleYear: number;
  cycleMonth: number; // 1-12
}

/**
 * Computes the active or next due date for a loan based on:
 * - startDate
 * - dueDay (1-31)
 * - payments covering recent cycles
 * - today in Asia/Kolkata
 */
export function computeNextDueDate(
  startDate: Date | string,
  dueDay: number,
  today: Date = getNowInKolkata(),
  isPaidForCurrentCycle: boolean = false
): NextDueDateResult {
  const todayStr = formatToKolkataDateString(today);
  const [todayYear, todayMonth] = todayStr.split("-").map(Number);

  const startD = typeof startDate === "string" ? new Date(startDate) : startDate;
  const startStr = formatToKolkataDateString(startD);
  const [startYear, startMonth, startDay] = startStr.split("-").map(Number);

  // First potential due date
  let candidateYear = todayYear;
  let candidateMonth = todayMonth;

  // Determine starting due date
  // If startDate is in future or this month after dueDay:
  const firstDueThisMonth = getClampedDueDate(startYear, startMonth, dueDay);
  if (startStr > formatToKolkataDateString(firstDueThisMonth)) {
    // Started after dueDay in startMonth -> first due is next month
    if (candidateYear < startYear || (candidateYear === startYear && candidateMonth <= startMonth)) {
      candidateYear = startMonth === 12 ? startYear + 1 : startYear;
      candidateMonth = startMonth === 12 ? 1 : startMonth + 1;
    }
  } else {
    if (candidateYear < startYear || (candidateYear === startYear && candidateMonth < startMonth)) {
      candidateYear = startYear;
      candidateMonth = startMonth;
    }
  }

  let candidateDue = getClampedDueDate(candidateYear, candidateMonth, dueDay);
  let candidateDueStr = formatToKolkataDateString(candidateDue);

  // If already paid for this current candidate cycle, advance to next month
  if (isPaidForCurrentCycle) {
    if (candidateMonth === 12) {
      candidateYear += 1;
      candidateMonth = 1;
    } else {
      candidateMonth += 1;
    }
    candidateDue = getClampedDueDate(candidateYear, candidateMonth, dueDay);
    candidateDueStr = formatToKolkataDateString(candidateDue);
  }

  const daysUntilDue = getCalendarDayDifference(candidateDueStr, todayStr);
  const isOverdue = daysUntilDue < 0 && !isPaidForCurrentCycle;

  return {
    dueDate: candidateDue,
    dueDateString: candidateDueStr,
    isOverdue,
    daysUntilDue,
    cycleYear: candidateYear,
    cycleMonth: candidateMonth,
  };
}

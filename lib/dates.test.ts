import assert from "node:assert";
import {
  getDaysInMonth,
  getClampedDueDate,
  formatToKolkataDateString,
  getCalendarDayDifference,
  computeNextDueDate,
} from "./dates";

function runDateTests() {
  console.log("Running date & calendar edge case tests...\n");

  // 1. Days in month and Leap Year
  {
    console.log("1. Leap Year & Short Months");
    assert.strictEqual(getDaysInMonth(2024, 2), 29); // 2024 is leap year
    assert.strictEqual(getDaysInMonth(2025, 2), 28); // 2025 non-leap
    assert.strictEqual(getDaysInMonth(2026, 4), 30); // April has 30 days
    assert.strictEqual(getDaysInMonth(2026, 5), 31); // May has 31 days
    console.log("   ✓ Month days verified");
  }

  // 2. Clamped due date (Day 31 in short months)
  {
    console.log("2. Clamping due day 31");
    // April (30 days) -> April 30
    const aprDue = getClampedDueDate(2026, 4, 31);
    assert.strictEqual(formatToKolkataDateString(aprDue), "2026-04-30");

    // Feb 2024 (leap, 29 days) -> Feb 29
    const feb2024Due = getClampedDueDate(2024, 2, 31);
    assert.strictEqual(formatToKolkataDateString(feb2024Due), "2024-02-29");

    // Feb 2025 (non-leap, 28 days) -> Feb 28
    const feb2025Due = getClampedDueDate(2025, 2, 31);
    assert.strictEqual(formatToKolkataDateString(feb2025Due), "2025-02-28");

    // Jan (31 days) -> Jan 31
    const janDue = getClampedDueDate(2026, 1, 31);
    assert.strictEqual(formatToKolkataDateString(janDue), "2026-01-31");
    console.log("   ✓ Due day clamping verified");
  }

  // 3. Calendar day difference
  {
    console.log("3. Calendar day difference");
    const diff1 = getCalendarDayDifference("2026-11-10", "2026-11-05");
    assert.strictEqual(diff1, 5);

    const diff2 = getCalendarDayDifference("2026-11-05", "2026-11-05");
    assert.strictEqual(diff2, 0);

    const diff3 = getCalendarDayDifference("2026-11-01", "2026-11-05");
    assert.strictEqual(diff3, -4);
    console.log("   ✓ Calendar day differences verified");
  }

  // 4. Compute next due date logic
  {
    console.log("4. computeNextDueDate");
    // Loan started on 2026-01-10, dueDay = 15
    // Today is 2026-01-12. Not yet paid for Jan cycle -> next due is Jan 15 (in 3 days)
    const todayJan12 = new Date(Date.UTC(2026, 0, 12));
    const next1 = computeNextDueDate("2026-01-10", 15, todayJan12, false);
    assert.strictEqual(next1.dueDateString, "2026-01-15");
    assert.strictEqual(next1.daysUntilDue, 3);
    assert.strictEqual(next1.isOverdue, false);

    // If already paid for Jan cycle -> next due is Feb 15
    const nextPaid = computeNextDueDate("2026-01-10", 15, todayJan12, true);
    assert.strictEqual(nextPaid.dueDateString, "2026-02-15");

    // Overdue case: Today is 2026-01-20, not paid for Jan cycle
    const todayJan20 = new Date(Date.UTC(2026, 0, 20));
    const nextOverdue = computeNextDueDate("2026-01-10", 15, todayJan20, false);
    assert.strictEqual(nextOverdue.dueDateString, "2026-01-15");
    assert.strictEqual(nextOverdue.daysUntilDue, -5);
    assert.strictEqual(nextOverdue.isOverdue, true);

    // Mid-month start after due day:
    // Loan started 2026-01-25, dueDay = 5
    // First due date must be 2026-02-05
    const nextMid = computeNextDueDate("2026-01-25", 5, todayJan12, false);
    assert.strictEqual(nextMid.dueDateString, "2026-02-05");
    console.log("   ✓ Next due date calculations verified");
  }

  console.log("\nALL DATE TESTS PASSED SUCCESSFULLY! ✅");
}

runDateTests();

import nodemailer from "nodemailer";
import { formatINR, formatReadableDate } from "./format";

interface TransporterConfig {
  user?: string;
  pass?: string;
}

function getTransporter(config?: TransporterConfig) {
  const user = config?.user || process.env.GMAIL_USER;
  const pass = config?.pass || process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for port 465
    auth: {
      user,
      pass,
    },
  });
}

export interface OwnerReminderData {
  borrowerName: string;
  loanType: string;
  amountDue: string | number;
  dueDate: string | Date;
  outstandingBalance: string | number;
  loanId: string;
  triggerType: "BEFORE" | "ON_DAY" | "OVERDUE";
  daysLeft?: number;
  appUrl?: string;
}

export interface BorrowerReminderData {
  borrowerName: string;
  borrowerEmail: string;
  amountDue: string | number;
  dueDate: string | Date;
  triggerType: "BEFORE" | "ON_DAY";
  daysLeft?: number;
}

export interface DigestItem {
  borrowerName: string;
  loanType: string;
  amountDue: string | number;
  dueDate: string | Date;
  outstandingBalance: string | number;
  statusText: string;
  loanId: string;
}

export async function sendTestEmailToOwner(): Promise<{ success: boolean; message: string }> {
  const transporter = getTransporter();
  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;

  if (!transporter) {
    return {
      success: false,
      message: "GMAIL_USER or GMAIL_APP_PASSWORD is not set in environment variables.",
    };
  }

  if (!ownerEmail) {
    return {
      success: false,
      message: "OWNER_EMAIL is not set in environment variables.",
    };
  }

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: `"Money Lending Tracker" <${process.env.GMAIL_USER}>`,
      to: ownerEmail,
      subject: "✅ Test Email: Money Lending Tracker",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Gmail SMTP Verification Successful</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.5;">
            Your Money Lending Tracker email notifications are configured properly and working as expected.
          </p>
          <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #10b981;">
            <p style="margin: 0; color: #334155; font-size: 14px;"><strong>From:</strong> ${process.env.GMAIL_USER}</p>
            <p style="margin: 4px 0 0; color: #334155; font-size: 14px;"><strong>To:</strong> ${ownerEmail}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
            Sent automatically by Money Lending Tracker.
          </p>
        </div>
      `,
    });
    return { success: true, message: `Test email successfully sent to ${ownerEmail}` };
  } catch (error: any) {
    console.error("Failed to send test email:", error);
    return { success: false, message: error.message || "Failed to send email." };
  }
}

export async function sendOwnerReminder(data: OwnerReminderData): Promise<boolean> {
  const transporter = getTransporter();
  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;
  if (!transporter || !ownerEmail) return false;

  const appBase = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://lentra.vercel.app";
  const loanUrl = `${appBase}/loans/${data.loanId}`;

  let subjectTag = "Due Soon";
  let alertColor = "#3b82f6";
  let triggerNotice = `Payment due in ${data.daysLeft} day(s)`;

  if (data.triggerType === "ON_DAY") {
    subjectTag = "DUE TODAY";
    alertColor = "#f59e0b";
    triggerNotice = "Payment is due today";
  } else if (data.triggerType === "OVERDUE") {
    subjectTag = "OVERDUE";
    alertColor = "#ef4444";
    triggerNotice = `Payment is overdue by ${Math.abs(data.daysLeft || 1)} day(s)`;
  }

  const subject = `[${subjectTag}] ${data.borrowerName} - ${formatINR(data.amountDue)} due ${formatReadableDate(data.dueDate)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${alertColor}; background-color: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
          ${data.triggerType} REMINDER
        </span>
        <span style="font-size: 13px; color: #64748b;">${formatReadableDate(new Date())}</span>
      </div>

      <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px;">
        ${data.borrowerName} — ${triggerNotice}
      </h2>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
        Loan Type: <strong>${data.loanType.replace("_", " ")}</strong>
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b;">Amount Due:</td>
          <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: right; font-size: 16px;">
            ${formatINR(data.amountDue)}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b;">Due Date:</td>
          <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: right;">
            ${formatReadableDate(data.dueDate)}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #64748b;">Outstanding Loan Balance:</td>
          <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: right;">
            ${formatINR(data.outstandingBalance)}
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${loanUrl}" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; display: inline-block;">
          View Loan & Record Payment
        </a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Money Lending Tracker" <${process.env.GMAIL_USER}>`,
      to: ownerEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Error sending owner reminder:", err);
    return false;
  }
}

export async function sendBorrowerReminder(data: BorrowerReminderData): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter || !data.borrowerEmail) return false;

  let timePhrase = `on ${formatReadableDate(data.dueDate)}`;
  if (data.triggerType === "ON_DAY") {
    timePhrase = "today";
  } else if (data.daysLeft !== undefined) {
    timePhrase = `in ${data.daysLeft} days (${formatReadableDate(data.dueDate)})`;
  }

  const subject = `Gentle reminder: Upcoming payment due ${timePhrase}`;

  // Polite and short, no internal numbers (principal, interest rates)
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <p style="color: #1e293b; font-size: 15px; margin-top: 0;">
        Dear ${data.borrowerName},
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        This is a polite reminder that your payment of <strong>${formatINR(data.amountDue)}</strong> is due <strong>${timePhrase}</strong>.
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Please make the payment at your earliest convenience or feel free to reach out if you have any questions.
      </p>
      <p style="color: #64748b; font-size: 14px; margin-top: 24px; margin-bottom: 0;">
        Thank you!
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Money Lending" <${process.env.GMAIL_USER}>`,
      to: data.borrowerEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Error sending borrower reminder:", err);
    return false;
  }
}

export async function sendOwnerDailyDigest(items: DigestItem[]): Promise<boolean> {
  if (items.length === 0) return true;
  const transporter = getTransporter();
  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;
  if (!transporter || !ownerEmail) return false;

  const appBase = process.env.NEXT_PUBLIC_APP_URL || "https://lentra.vercel.app";
  const subject = `📋 Daily Lending Digest: ${items.length} loan payment(s) pending or due`;

  const rows = items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 8px; font-weight: 600; color: #0f172a;">
          <a href="${appBase}/loans/${item.loanId}" style="color: #0f172a; text-decoration: underline;">
            ${item.borrowerName}
          </a>
          <br/>
          <span style="font-size: 12px; color: #64748b;">${item.loanType.replace("_", " ")}</span>
        </td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #0f172a;">
          ${formatINR(item.amountDue)}
        </td>
        <td style="padding: 10px 8px; text-align: center; color: #475569; font-size: 13px;">
          ${formatReadableDate(item.dueDate)}
        </td>
        <td style="padding: 10px 8px; text-align: right; font-size: 12px;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background-color: #fef3c7; color: #92400e; font-weight: 500;">
            ${item.statusText}
          </span>
        </td>
      </tr>
    `
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Daily Loan Payments Digest</h2>
      <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
        Here are the active reminders for today (${formatReadableDate(new Date())}):
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
            <th style="padding: 8px; color: #475569;">Borrower</th>
            <th style="padding: 8px; text-align: right; color: #475569;">Due Amount</th>
            <th style="padding: 8px; text-align: center; color: #475569;">Due Date</th>
            <th style="padding: 8px; text-align: right; color: #475569;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="text-align: center;">
        <a href="${appBase}" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; display: inline-block;">
          Open Dashboard
        </a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Money Lending Tracker" <${process.env.GMAIL_USER}>`,
      to: ownerEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Error sending daily digest:", err);
    return false;
  }
}

export interface OverdueEmiItem {
  installmentId: string;
  borrowerName: string;
  installmentNo: number;
  amount: string | number;
  dueDate: string | Date;
  daysOverdue: number;
  loanId: string;
}

export interface LoanReportItem {
  loanId: string;
  loanType: string;
  principalAmount: string | number;
  totalPaid: string | number;
  remainingAmount: string | number;
  monthlyCycleDue: string | number;
  dueDate: string | Date;
  dueDateFormatted?: string;
  daysUntilDue: number;
  statusText: string;
  statusType: "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "NORMAL";
  overdueInstallments?: {
    installmentNo: number;
    amount: string | number;
    dueDate: string | Date;
    daysOverdue: number;
  }[];
}

export interface BorrowerReportGroup {
  borrowerId: string;
  borrowerName: string;
  borrowerPhone?: string | null;
  borrowerEmail?: string | null;
  totalPrincipal: string | number;
  totalPaid: string | number;
  totalOwed: string | number;
  totalDueNow?: string | number;
  status: "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "NORMAL";
  loans: LoanReportItem[];
}

export interface ConsolidatedReportData {
  reportDate?: string;
  totalBorrowers: number;
  totalActiveLoans: number;
  totalLentOut: string | number;
  totalCollected: string | number;
  totalOutstandingOwed: string | number;
  totalOverdueAmount: string | number;
  totalDueTodayAmount: string | number;
  overdueCount: number;
  dueTodayCount: number;
  borrowers: BorrowerReportGroup[];
  appUrl?: string;
}

/**
 * Sends a single consolidated daily email report to the Owner.
 * Summarizes every person and how much they owe, along with all active loan details.
 * Prevents multiple individual emails from cluttering the owner's inbox.
 */
export async function sendOwnerConsolidatedReport(data: ConsolidatedReportData): Promise<boolean> {
  const transporter = getTransporter();
  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;

  if (!transporter || !ownerEmail) {
    console.error("sendOwnerConsolidatedReport: Missing transporter or OWNER_EMAIL.");
    return false;
  }

  const appBase = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://lentra.vercel.app";
  const dateFormatted = data.reportDate || formatReadableDate(new Date());

  // Subject line logic
  const overdueNum = Number(data.totalOverdueAmount) || 0;
  const dueTodayNum = Number(data.totalDueTodayAmount) || 0;

  let subject = `📋 Lending Summary: ${formatINR(data.totalOutstandingOwed)} Total Owed (${data.totalBorrowers} Persons) • ${dateFormatted}`;
  if (overdueNum > 0) {
    subject = `⚠️ Lending Report: ${formatINR(data.totalOutstandingOwed)} Total Owed (${formatINR(data.totalOverdueAmount)} Overdue) • ${dateFormatted}`;
  } else if (dueTodayNum > 0) {
    subject = `🔔 Lending Report: ${formatINR(data.totalOutstandingOwed)} Total Owed (Dues Today: ${formatINR(data.totalDueTodayAmount)}) • ${dateFormatted}`;
  }

  // Generate Person-by-Person Summary rows
  const summaryRowsHtml = data.borrowers
    .map((b) => {
      let statusBadge = `<span style="background-color: #ecfdf5; color: #065f46; padding: 3px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Active</span>`;
      if (b.status === "OVERDUE") {
        statusBadge = `<span style="background-color: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px;">OVERDUE</span>`;
      } else if (b.status === "DUE_TODAY") {
        statusBadge = `<span style="background-color: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px;">DUE TODAY</span>`;
      } else if (b.status === "DUE_SOON") {
        statusBadge = `<span style="background-color: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Due Soon</span>`;
      }

      const rowBg = b.status === "OVERDUE" ? "background-color: #fffaf0;" : "";

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${rowBg}">
          <td style="padding: 12px 10px; font-weight: 700; color: #0f172a; font-size: 14px;">
            ${b.borrowerName}
            <div style="font-size: 11px; font-weight: normal; color: #64748b; margin-top: 2px;">
              ${b.loans.length} active loan${b.loans.length > 1 ? "s" : ""}${b.borrowerPhone ? ` • ${b.borrowerPhone}` : ""}
            </div>
          </td>
          <td style="padding: 12px 10px; text-align: right; color: #475569; font-size: 13px;">
            ${formatINR(b.totalPrincipal)}
          </td>
          <td style="padding: 12px 10px; text-align: right; color: #059669; font-size: 13px; font-weight: 600;">
            ${formatINR(b.totalPaid)}
          </td>
          <td style="padding: 12px 10px; text-align: right; font-weight: 800; color: #0f172a; font-size: 15px; background-color: #f8fafc;">
            ${formatINR(b.totalOwed)}
          </td>
          <td style="padding: 12px 10px; text-align: center;">
            ${statusBadge}
          </td>
        </tr>
      `;
    })
    .join("");

  // Detailed loan sections by person
  const detailedBorrowerSectionsHtml = data.borrowers
    .map((b) => {
      const loanRows = b.loans
        .map((loan) => {
          let dueBadge = `<span style="color: #64748b; font-size: 12px;">${loan.statusText}</span>`;
          if (loan.statusType === "OVERDUE") {
            dueBadge = `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">${loan.statusText}</span>`;
          } else if (loan.statusType === "DUE_TODAY") {
            dueBadge = `<span style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">DUE TODAY</span>`;
          } else if (loan.statusType === "DUE_SOON") {
            dueBadge = `<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px;">${loan.statusText}</span>`;
          }

          let overdueInstallmentsHtml = "";
          if (loan.overdueInstallments && loan.overdueInstallments.length > 0) {
            overdueInstallmentsHtml = `
              <div style="margin-top: 6px; padding: 6px 8px; background-color: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px; font-size: 11px; color: #991b1b;">
                <strong>⚠️ Overdue Installments:</strong>
                ${loan.overdueInstallments
                  .map(
                    (inst) =>
                      `<div>• EMI #${inst.installmentNo}: ${formatINR(inst.amount)} (due ${formatReadableDate(inst.dueDate)}, ${inst.daysOverdue}d overdue)</div>`
                  )
                  .join("")}
              </div>
            `;
          }

          return `
            <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
              <td style="padding: 10px 8px; color: #1e293b; font-weight: 600;">
                <span style="display: inline-block; padding: 2px 6px; background-color: #e2e8f0; border-radius: 4px; font-size: 10px; font-weight: 700; color: #334155; margin-right: 4px;">
                  ${loan.loanType.replace("_", " ")}
                </span>
                <br/>
                <a href="${appBase}/loans/${loan.loanId}" style="color: #2563eb; text-decoration: none; font-size: 12px; font-weight: 500;">
                  View Loan Details &rarr;
                </a>
                ${overdueInstallmentsHtml}
              </td>
              <td style="padding: 10px 8px; text-align: right; color: #475569;">
                ${formatINR(loan.principalAmount)}
              </td>
              <td style="padding: 10px 8px; text-align: right; color: #059669; font-weight: 500;">
                ${formatINR(loan.totalPaid)}
              </td>
              <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #0f172a; background-color: #fafafa;">
                ${formatINR(loan.remainingAmount)}
              </td>
              <td style="padding: 10px 8px; text-align: right; color: #1e293b;">
                ${Number(loan.monthlyCycleDue) > 0 ? formatINR(loan.monthlyCycleDue) : "—"}
                <div style="font-size: 11px; color: #64748b;">
                  Due: ${loan.dueDateFormatted || formatReadableDate(loan.dueDate)}
                </div>
              </td>
              <td style="padding: 10px 8px; text-align: center;">
                ${dueBadge}
              </td>
            </tr>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
          <div style="padding: 12px 16px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 16px; font-weight: 700; color: #0f172a;">${b.borrowerName}</span>
              ${b.borrowerPhone ? `<span style="font-size: 12px; color: #64748b; margin-left: 8px;">(${b.borrowerPhone})</span>` : ""}
            </div>
            <div style="text-align: right;">
              <span style="font-size: 12px; color: #64748b; margin-right: 6px;">Total Owed:</span>
              <span style="font-size: 16px; font-weight: 800; color: #0f172a;">${formatINR(b.totalOwed)}</span>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #fafbfc; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                <th style="padding: 8px; font-weight: 600;">Loan Type</th>
                <th style="padding: 8px; text-align: right; font-weight: 600;">Lent</th>
                <th style="padding: 8px; text-align: right; font-weight: 600;">Paid</th>
                <th style="padding: 8px; text-align: right; font-weight: 600; background-color: #f1f5f9; color: #0f172a;">Balance Owed</th>
                <th style="padding: 8px; text-align: right; font-weight: 600;">Cycle Due</th>
                <th style="padding: 8px; text-align: center; font-weight: 600;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${loanRows}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lending Summary & Dues Report</title>
    </head>
    <body style="margin: 0; padding: 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Top App Header -->
        <div style="background-color: #0f172a; padding: 24px 24px 20px 24px; color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; background-color: #334155; color: #94a3b8; padding: 4px 10px; border-radius: 9999px;">
              MONEY LENDING TRACKER • DAILY SUMMARY
            </span>
            <span style="font-size: 13px; color: #94a3b8;">${dateFormatted}</span>
          </div>
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #ffffff;">
            Lending Summary & Dues Report
          </h1>
          <p style="margin: 0; font-size: 14px; color: #cbd5e1;">
            Single consolidated update of all active borrowers, balances owed, and today's dues.
          </p>
        </div>

        <!-- 4-Card Overview KPI Bar -->
        <div style="padding: 20px 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 8px;">
            <tr>
              <td style="width: 50%; padding: 14px 16px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                  Total Outstanding Owed
                </div>
                <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px;">
                  ${formatINR(data.totalOutstandingOwed)}
                </div>
                <div style="font-size: 12px; color: #059669; margin-top: 4px;">
                  Across ${data.totalBorrowers} borrower${data.totalBorrowers > 1 ? "s" : ""}
                </div>
              </td>
              <td style="width: 50%; padding: 14px 16px; background-color: ${overdueNum > 0 ? "#fef2f2" : "#ffffff"}; border: 1px solid ${overdueNum > 0 ? "#fecaca" : "#e2e8f0"}; border-radius: 8px; vertical-align: top;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: ${overdueNum > 0 ? "#991b1b" : "#64748b"}; letter-spacing: 0.5px;">
                  Overdue Amount
                </div>
                <div style="font-size: 24px; font-weight: 800; color: ${overdueNum > 0 ? "#dc2626" : "#0f172a"}; margin-top: 4px;">
                  ${formatINR(data.totalOverdueAmount)}
                </div>
                <div style="font-size: 12px; color: ${overdueNum > 0 ? "#991b1b" : "#64748b"}; margin-top: 4px;">
                  ${overdueNum > 0 ? `${data.overdueCount} item(s) overdue` : "All dues up to date"}
                </div>
              </td>
            </tr>
            <tr>
              <td style="width: 50%; padding: 14px 16px; background-color: ${dueTodayNum > 0 ? "#fffbeb" : "#ffffff"}; border: 1px solid ${dueTodayNum > 0 ? "#fde68a" : "#e2e8f0"}; border-radius: 8px; vertical-align: top;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: ${dueTodayNum > 0 ? "#92400e" : "#64748b"}; letter-spacing: 0.5px;">
                  Due Today
                </div>
                <div style="font-size: 20px; font-weight: 800; color: ${dueTodayNum > 0 ? "#d97706" : "#0f172a"}; margin-top: 4px;">
                  ${formatINR(data.totalDueTodayAmount)}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                  ${data.dueTodayCount > 0 ? `${data.dueTodayCount} payment(s) due today` : "None due today"}
                </div>
              </td>
              <td style="width: 50%; padding: 14px 16px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                  Total Repaid / Collected
                </div>
                <div style="font-size: 20px; font-weight: 800; color: #059669; margin-top: 4px;">
                  ${formatINR(data.totalCollected)}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                  Lent out: ${formatINR(data.totalLentOut)}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 24px;">

          <!-- SECTION 1: SUMMARY BY PERSON (HOW MUCH EACH PERSON OWES) -->
          <div style="margin-bottom: 28px;">
            <div style="margin-bottom: 12px;">
              <h2 style="margin: 0; font-size: 17px; font-weight: 700; color: #0f172a;">
                👤 Summary by Person — How Much Each Person Owes
              </h2>
              <p style="margin: 3px 0 0 0; font-size: 13px; color: #64748b;">
                High-level balance for each borrower currently holding active loans.
              </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f1f5f9; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">
                  <th style="padding: 10px; font-weight: 700;">Borrower</th>
                  <th style="padding: 10px; text-align: right; font-weight: 600;">Total Lent</th>
                  <th style="padding: 10px; text-align: right; font-weight: 600;">Total Paid</th>
                  <th style="padding: 10px; text-align: right; font-weight: 700; background-color: #e2e8f0; color: #0f172a;">Total Owed</th>
                  <th style="padding: 10px; text-align: center; font-weight: 600;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${summaryRowsHtml}
                <!-- Total Row -->
                <tr style="background-color: #f8fafc; border-top: 2px solid #0f172a; font-size: 14px;">
                  <td style="padding: 12px 10px; font-weight: 800; color: #0f172a;">
                    TOTAL (${data.totalBorrowers} Persons)
                  </td>
                  <td style="padding: 12px 10px; text-align: right; font-weight: 700; color: #475569;">
                    ${formatINR(data.totalLentOut)}
                  </td>
                  <td style="padding: 12px 10px; text-align: right; font-weight: 700; color: #059669;">
                    ${formatINR(data.totalCollected)}
                  </td>
                  <td style="padding: 12px 10px; text-align: right; font-weight: 800; color: #0f172a; font-size: 16px; background-color: #e2e8f0;">
                    ${formatINR(data.totalOutstandingOwed)}
                  </td>
                  <td style="padding: 12px 10px; text-align: center; font-weight: 600; color: #64748b; font-size: 12px;">
                    ${data.totalActiveLoans} Active Loans
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECTION 2: COMPLETE DETAILS BY PERSON -->
          <div>
            <div style="margin-bottom: 12px;">
              <h2 style="margin: 0; font-size: 17px; font-weight: 700; color: #0f172a;">
                📋 Complete Details by Person & Loan
              </h2>
              <p style="margin: 3px 0 0 0; font-size: 13px; color: #64748b;">
                Detailed breakdown of every active loan, monthly cycle dues, and next repayment dates.
              </p>
            </div>

            ${detailedBorrowerSectionsHtml}
          </div>

          <!-- Call to Action Button -->
          <div style="text-align: center; margin: 32px 0 16px 0;">
            <a href="${appBase}" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              Open Lending Tracker Dashboard &rarr;
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
          This is your single daily summary email sent by <strong>Money Lending Tracker</strong>.<br/>
          Individual emails have been consolidated to prevent inbox clutter.
        </div>

      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Money Lending Tracker" <${process.env.GMAIL_USER}>`,
      to: ownerEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Error sending owner consolidated report:", err);
    return false;
  }
}

/**
 * Sends a high-priority 2-day reminder to the Owner for overdue EMI installments.
 */
export async function sendOverdueEmiDigestToOwner(items: OverdueEmiItem[]): Promise<boolean> {
  const transporter = getTransporter();
  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;

  if (!transporter || !ownerEmail || items.length === 0) {
    return false;
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const subject = `⚠️ [Overdue Alert] ${items.length} EMI Installment(s) Pending (2-Day Reminder)`;

  const rows = items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #fee2e2;">
        <td style="padding: 10px 8px; font-weight: 600; color: #1e293b;">
          ${item.borrowerName} <span style="font-size: 11px; font-weight: normal; color: #64748b;">(EMI #${item.installmentNo})</span>
        </td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #dc2626;">
          ${formatINR(item.amount)}
        </td>
        <td style="padding: 10px 8px; text-align: center; color: #475569;">
          ${formatReadableDate(item.dueDate)}
        </td>
        <td style="padding: 10px 8px; text-align: right;">
          <span style="background-color: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">
            ${item.daysOverdue}d overdue
          </span>
        </td>
      </tr>
    `
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; border-radius: 8px; background-color: #ffffff;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <h2 style="color: #991b1b; margin: 0; font-size: 20px;">
          🚨 Overdue EMI Payments Alert
        </h2>
      </div>
      <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
        You have <strong>${items.length} overdue EMI payment(s)</strong> awaiting collection. A self-reminder is automatically sent every 2 days until these dues are resolved.
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #fef2f2; border-bottom: 2px solid #fee2e2; text-align: left;">
            <th style="padding: 8px; color: #991b1b;">Borrower</th>
            <th style="padding: 8px; text-align: right; color: #991b1b;">Amount Due</th>
            <th style="padding: 8px; text-align: center; color: #991b1b;">Due Date</th>
            <th style="padding: 8px; text-align: right; color: #991b1b;">Delay</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 20px;">
        <a href="${appBase}/dues?status=OVERDUE" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
          Open Dues Management Page
        </a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Money Lending Tracker" <${process.env.GMAIL_USER}>`,
      to: ownerEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Error sending overdue EMI digest:", err);
    return false;
  }
}

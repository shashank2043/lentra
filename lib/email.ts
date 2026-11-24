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
  totalDueNextMonth: string | number; // Upcoming installments due in the next 30 days
  totalOverdue: string | number; // Total amount currently past due
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
  totalOverdueAmount: string | number; // Overdue dues across all loans
  totalDueNextMonth: string | number; // Installments/cycle dues for next 30 days
  totalDueTodayAmount: string | number;
  overdueCount: number;
  dueTodayCount: number;
  borrowers: BorrowerReportGroup[];
  appUrl?: string;
}

/**
 * Sends a single consolidated daily email report to the Owner.
 * Fully optimized and responsive for mobile devices (iOS/Android/Gmail/Outlook).
 * Clearly displays Total Overdue and Total Due for Next Month (Installments Only).
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

  const overdueNum = Number(data.totalOverdueAmount) || 0;
  const nextMonthNum = Number(data.totalDueNextMonth) || 0;

  // Clear, high-priority subject line
  let subject = `📋 Lending Report: ${formatINR(data.totalDueNextMonth)} Due Next Month (Installments) • ${dateFormatted}`;
  if (overdueNum > 0) {
    subject = `🚨 [Overdue: ${formatINR(data.totalOverdueAmount)}] Lending Report • ${formatINR(data.totalDueNextMonth)} Due Next Month • ${dateFormatted}`;
  }

  // Generate Mobile-Friendly Borrower Cards (No rigid 5-column tables!)
  const borrowerCardsHtml = data.borrowers
    .map((b) => {
      let statusBadge = `<span style="background-color: #ecfdf5; color: #065f46; padding: 2px 7px; border-radius: 9999px; font-weight: 700; font-size: 11px;">ACTIVE</span>`;
      if (b.status === "OVERDUE") {
        statusBadge = `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 7px; border-radius: 9999px; font-weight: 700; font-size: 11px;">🚨 OVERDUE</span>`;
      } else if (b.status === "DUE_TODAY") {
        statusBadge = `<span style="background-color: #fef3c7; color: #92400e; padding: 2px 7px; border-radius: 9999px; font-weight: 700; font-size: 11px;">⚠️ DUE TODAY</span>`;
      } else if (b.status === "DUE_SOON") {
        statusBadge = `<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 7px; border-radius: 9999px; font-weight: 600; font-size: 11px;">📅 Due Soon</span>`;
      }

      const bOverdue = Number(b.totalOverdue) || 0;
      const bNextMonth = Number(b.totalDueNextMonth) || 0;

      return `
        <!-- Borrower Card -->
        <div style="background-color: #ffffff; border: 1px solid ${b.status === "OVERDUE" ? "#fca5a5" : "#e2e8f0"}; border-radius: 10px; margin-bottom: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <!-- Card Header -->
          <div style="padding: 12px 14px; background-color: ${b.status === "OVERDUE" ? "#fff5f5" : "#f8fafc"}; border-bottom: 1px solid ${b.status === "OVERDUE" ? "#fee2e2" : "#f1f5f9"};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align: middle;">
                  <span style="font-size: 15px; font-weight: 700; color: #0f172a;">${b.borrowerName}</span>
                  <span style="font-size: 11px; color: #64748b; margin-left: 4px;">(${b.loans.length} loan${b.loans.length > 1 ? "s" : ""}${b.borrowerPhone ? ` • ${b.borrowerPhone}` : ""})</span>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                  ${statusBadge}
                </td>
              </tr>
            </table>
          </div>

          <!-- Key Financial Highlights Grid (3 Columns, mobile friendly) -->
          <div style="padding: 10px 14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width: 33%; padding: 6px 4px; vertical-align: top; border-right: 1px solid #f1f5f9;">
                  <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600;">Total Owed</div>
                  <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                    ${formatINR(b.totalOwed)}
                  </div>
                </td>
                <td style="width: 34%; padding: 6px 8px; vertical-align: top; border-right: 1px solid #f1f5f9;">
                  <div style="font-size: 10px; text-transform: uppercase; color: #1e40af; font-weight: 700;">Due Next Month</div>
                  <div style="font-size: 15px; font-weight: 800; color: #2563eb; margin-top: 2px;">
                    ${bNextMonth > 0 ? formatINR(b.totalDueNextMonth) : "—"}
                  </div>
                </td>
                <td style="width: 33%; padding: 6px 4px; vertical-align: top; text-align: right;">
                  <div style="font-size: 10px; text-transform: uppercase; color: ${bOverdue > 0 ? "#991b1b" : "#64748b"}; font-weight: 700;">Overdue</div>
                  <div style="font-size: 15px; font-weight: 800; color: ${bOverdue > 0 ? "#dc2626" : "#059669"}; margin-top: 2px;">
                    ${bOverdue > 0 ? formatINR(b.totalOverdue) : "None"}
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Footer Lent vs Paid -->
          <div style="padding: 8px 14px; background-color: #fafbfc; border-top: 1px solid #f8fafc; font-size: 11px; color: #64748b;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>Total Lent: <strong>${formatINR(b.totalPrincipal)}</strong></td>
                <td style="text-align: right; color: #059669;">Total Paid: <strong>${formatINR(b.totalPaid)}</strong></td>
              </tr>
            </table>
          </div>
        </div>
      `;
    })
    .join("");

  // Detailed Mobile-Friendly Loan Cards
  const detailedBorrowerSectionsHtml = data.borrowers
    .map((b) => {
      const loanCards = b.loans
        .map((loan) => {
          let dueBadge = `<span style="font-size: 11px; color: #64748b;">${loan.statusText}</span>`;
          if (loan.statusType === "OVERDUE") {
            dueBadge = `<span style="background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">${loan.statusText}</span>`;
          } else if (loan.statusType === "DUE_TODAY") {
            dueBadge = `<span style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">DUE TODAY</span>`;
          } else if (loan.statusType === "DUE_SOON") {
            dueBadge = `<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px;">${loan.statusText}</span>`;
          }

          let overdueInstallmentsHtml = "";
          if (loan.overdueInstallments && loan.overdueInstallments.length > 0) {
            overdueInstallmentsHtml = `
              <div style="margin-top: 8px; padding: 8px 10px; background-color: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px; font-size: 11px; color: #991b1b;">
                <strong>🚨 Overdue Installment(s):</strong>
                ${loan.overdueInstallments
                  .map(
                    (inst) =>
                      `<div style="margin-top: 2px;">• EMI #${inst.installmentNo}: <strong>${formatINR(inst.amount)}</strong> (due ${formatReadableDate(inst.dueDate)}, ${inst.daysOverdue}d overdue)</div>`
                  )
                  .join("")}
              </div>
            `;
          }

          return `
            <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; background-color: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 2px 6px; background-color: #0f172a; border-radius: 4px; font-size: 10px; font-weight: 700; color: #ffffff;">
                      ${loan.loanType.replace("_", " ")}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    ${dueBadge}
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; margin-bottom: 6px;">
                <tr>
                  <td style="padding: 3px 0; color: #64748b;">Next Due (Installment):</td>
                  <td style="padding: 3px 0; text-align: right; font-weight: 700; color: #1e40af;">
                    ${Number(loan.monthlyCycleDue) > 0 ? formatINR(loan.monthlyCycleDue) : "—"}
                    <span style="font-size: 10px; color: #64748b; font-weight: normal;"> (${loan.dueDateFormatted || formatReadableDate(loan.dueDate)})</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b;">Remaining Loan Balance:</td>
                  <td style="padding: 3px 0; text-align: right; font-weight: 700; color: #0f172a;">
                    ${formatINR(loan.remainingAmount)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #64748b;">Principal / Repaid:</td>
                  <td style="padding: 3px 0; text-align: right; color: #475569;">
                    ${formatINR(loan.principalAmount)} / <span style="color: #059669; font-weight: 600;">${formatINR(loan.totalPaid)}</span>
                  </td>
                </tr>
              </table>

              ${overdueInstallmentsHtml}

              <div style="text-align: right; margin-top: 8px; padding-top: 6px; border-top: 1px solid #f1f5f9;">
                <a href="${appBase}/loans/${loan.loanId}" style="color: #2563eb; font-size: 11px; font-weight: 600; text-decoration: none;">
                  View Loan & Record Payment &rarr;
                </a>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #fafbfc;">
          <div style="padding: 10px 14px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <strong style="font-size: 14px; color: #0f172a;">${b.borrowerName}</strong>
                </td>
                <td style="text-align: right; font-size: 12px; color: #475569;">
                  Total Owed: <strong style="color: #0f172a;">${formatINR(b.totalOwed)}</strong>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding: 10px;">
            ${loanCards}
          </div>
        </div>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Daily Lending Report</title>
      <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        
        @media only screen and (max-width: 600px) {
          .email-wrapper { width: 100% !important; padding: 0 !important; }
          .email-container { width: 100% !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
          .mobile-p-16 { padding: 16px !important; }
          .mobile-p-12 { padding: 12px !important; }
          .mobile-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; }
          .mobile-mb-8 { margin-bottom: 8px !important; }
          .font-18-m { font-size: 17px !important; }
          .font-20-m { font-size: 19px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 12px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      
      <!-- Email Centering Wrapper -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-wrapper" style="background-color: #f1f5f9;">
        <tr>
          <td align="center">
            
            <!-- Main Content Container -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
              
              <!-- Header -->
              <tr>
                <td style="background-color: #0f172a; padding: 20px 20px 18px 20px; color: #ffffff;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; background-color: #334155; color: #cbd5e1; padding: 3px 8px; border-radius: 9999px;">
                          DAILY LENDING SUMMARY
                        </span>
                      </td>
                      <td style="text-align: right; font-size: 12px; color: #94a3b8;">
                        ${dateFormatted}
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin: 10px 0 4px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">
                    Daily Lending Report
                  </h1>
                  <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                    Overdue balances & upcoming monthly installments across all borrowers.
                  </p>
                </td>
              </tr>

              <!-- PRIMARY HIGHLIGHT: Overdue vs Next Month Due (Stacked for 100% Mobile Clarity) -->
              <tr>
                <td style="padding: 16px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  
                  <!-- OVERDUE CALLOUT CARD -->
                  <div style="background-color: ${overdueNum > 0 ? "#fef2f2" : "#ecfdf5"}; border: 1.5px solid ${overdueNum > 0 ? "#fca5a5" : "#a7f3d0"}; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${overdueNum > 0 ? "#991b1b" : "#065f46"}; letter-spacing: 0.5px;">
                            ${overdueNum > 0 ? "🚨 TOTAL OVERDUE (PAST DUE)" : "✅ TOTAL OVERDUE"}
                          </div>
                          <div style="font-size: 24px; font-weight: 900; color: ${overdueNum > 0 ? "#dc2626" : "#059669"}; margin-top: 2px;">
                            ${formatINR(data.totalOverdueAmount)}
                          </div>
                          <div style="font-size: 12px; color: ${overdueNum > 0 ? "#991b1b" : "#047857"}; margin-top: 2px;">
                            ${overdueNum > 0 ? `${data.overdueCount} installment(s) currently past due` : "All borrower payments are up to date"}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- NEXT MONTH DUE (INSTALLMENTS ONLY) CARD -->
                  <div style="background-color: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e40af; letter-spacing: 0.5px;">
                            📅 TOTAL DUE NEXT MONTH (INSTALLMENTS ONLY)
                          </div>
                          <div style="font-size: 24px; font-weight: 900; color: #1d4ed8; margin-top: 2px;">
                            ${formatINR(data.totalDueNextMonth)}
                          </div>
                          <div style="font-size: 12px; color: #2563eb; margin-top: 2px;">
                            Monthly installments & cycle dues coming in next 30 days
                          </div>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- OVERALL TOTAL BALANCE OWED & ACTIVE BORROWERS -->
                  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 50%; vertical-align: top; border-right: 1px solid #f1f5f9; padding-right: 8px;">
                          <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b;">
                            Total Remaining Balance
                          </div>
                          <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                            ${formatINR(data.totalOutstandingOwed)}
                          </div>
                          <div style="font-size: 11px; color: #64748b;">
                            Overall lifetime balance
                          </div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 12px;">
                          <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b;">
                            Active Borrowers
                          </div>
                          <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                            ${data.totalBorrowers} Persons
                          </div>
                          <div style="font-size: 11px; color: #64748b;">
                            ${data.totalActiveLoans} active loans
                          </div>
                        </td>
                      </tr>
                    </table>
                  </div>

                </td>
              </tr>

              <!-- SECTION 1: SUMMARY BY PERSON (MOBILE-FIRST CARDS) -->
              <tr>
                <td style="padding: 18px 16px 8px 16px;">
                  <div style="margin-bottom: 12px;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">
                      👤 Summary by Person — What Each Person Owes
                    </h2>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">
                      Overdue amount, next month's installment, and total balance per person.
                    </p>
                  </div>

                  ${borrowerCardsHtml}

                  <!-- Grand Totals Summary Box -->
                  <div style="background-color: #0f172a; color: #ffffff; border-radius: 10px; padding: 14px; margin-top: 8px; margin-bottom: 24px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 8px;">
                      GRAND TOTALS SUMMARY
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px;">
                      <tr>
                        <td style="padding: 3px 0; color: #cbd5e1;">Total Overdue (Past Due):</td>
                        <td style="padding: 3px 0; text-align: right; font-weight: 800; color: ${overdueNum > 0 ? "#f87171" : "#34d399"};">
                          ${formatINR(data.totalOverdueAmount)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; color: #cbd5e1;">Due Next Month (Installments):</td>
                        <td style="padding: 3px 0; text-align: right; font-weight: 800; color: #60a5fa;">
                          ${formatINR(data.totalDueNextMonth)}
                        </td>
                      </tr>
                      <tr style="border-top: 1px solid #334155;">
                        <td style="padding: 6px 0 0 0; font-weight: 700; color: #ffffff;">Total Balance Owed:</td>
                        <td style="padding: 6px 0 0 0; text-align: right; font-weight: 900; font-size: 16px; color: #ffffff;">
                          ${formatINR(data.totalOutstandingOwed)}
                        </td>
                      </tr>
                    </table>
                  </div>

                </td>
              </tr>

              <!-- SECTION 2: COMPLETE DETAILS BY PERSON & LOAN -->
              <tr>
                <td style="padding: 0 16px 20px 16px;">
                  <div style="margin-bottom: 12px;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">
                      📋 All Loan Details by Person
                    </h2>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">
                      Itemized loan cards with next repayment dates and installment numbers.
                    </p>
                  </div>

                  ${detailedBorrowerSectionsHtml}

                  <!-- Mobile Friendly Large CTA Button -->
                  <div style="text-align: center; margin: 24px 0 8px 0;">
                    <a href="${appBase}" style="display: block; width: 100%; box-sizing: border-box; background-color: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 700; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      Open Lending Tracker Dashboard &rarr;
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 16px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
                  Automated single daily summary sent by <strong>Money Lending Tracker</strong>.<br/>
                  Optimized for mobile & desktop viewing.
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>

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

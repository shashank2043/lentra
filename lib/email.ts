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

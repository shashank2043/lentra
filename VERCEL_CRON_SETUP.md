# Vercel Cron Job Setup Guide

This guide walks you through configuring, securing, and monitoring automated reminders in **Money Lending Tracker** using **Vercel Cron**.

---

## 1. Overview & How It Works

Money Lending Tracker uses Vercel Cron to trigger daily background jobs:

- **Schedule**: `0 3 * * *` (Daily at **03:00 UTC** / **08:30 AM IST**).
- **Endpoint**: `/api/cron/reminders` (HTTP GET).
- **Security**: Protected with `Authorization: Bearer <CRON_SECRET>`. Vercel Cron automatically attaches this header to incoming requests.
- **Deduplication**: Uses the `ReminderLog` table and `lastReminderAt` timestamp to ensure the same reminder is never sent more than once per cycle.

### What Happens During Each Run:
1. **Auto-Overdue Sync**: Any `PENDING` installment whose due date has passed (prior to today in IST) is automatically moved to `OVERDUE`.
2. **2-Day Overdue Self-Reminders**: Any overdue installment that hasn't been reminded within the past 48 hours triggers an alert email to `OWNER_EMAIL`.
3. **Due Today & Upcoming Reminders**: Loans due today or matching reminder window settings (e.g. 1, 3, 5 days before) are collected.
4. **Owner Daily Digest**: Combines all active alerts for the day into one clean, formatted morning digest email.
5. **Borrower Reminders**: If enabled for a specific loan and the borrower has an email address, a polite payment reminder is sent to them.

---

## 2. Configuration Files

### `vercel.json`
Located in the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 3 * * *"
    }
  ]
}
```

> **Schedule Breakdown (`0 3 * * *`)**:
> - `0` = Minute 0
> - `3` = Hour 3 (03:00 UTC = 08:30 AM IST)
> - `*` = Every day of month
> - `*` = Every month
> - `*` = Every day of week

### `middleware.ts`
The cron endpoint `/api/cron/*` is explicitly excluded from the admin session cookie check so Vercel can trigger it without needing a login session.

### `app/api/cron/reminders/route.ts`
Validates the authorization header:

```typescript
const authHeader = request.headers.get("Authorization");
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
}
```

---

## 3. Step-by-Step Vercel Dashboard Setup

### Step 1: Set `CRON_SECRET` in Vercel
1. Log in to [vercel.com](https://vercel.com) and select your **Money Lending Tracker** project.
2. Go to **Settings** &rarr; **Environment Variables**.
3. Add a new variable:
   - **Key**: `CRON_SECRET`
   - **Value**: A secure random string (e.g. generate via `openssl rand -hex 24` or use any random alphanumeric string).
   - **Environments**: Check **Production**, **Preview**, and **Development**.
4. Click **Save**.

### Step 2: Ensure All Required Environment Variables Are Configured
Verify that the following variables are also set in your Vercel project:

| Variable | Description | Example / Note |
|---|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler URL (IPv4) | Port 6543 with `?pgbouncer=true` |
| `DIRECT_URL` | Supabase Session Pooler URL | Port 5432 session connection |
| `ADMIN_PASSWORD` | Master password to log in | Secure password of your choice |
| `AUTH_SECRET` | 32+ character JWT signing key | `openssl rand -hex 32` |
| `GMAIL_USER` | Gmail address sending reminders | `yourname@gmail.com` |
| `GMAIL_APP_PASSWORD` | 16-character Google App Password | Generated from Google Account security |
| `OWNER_EMAIL` | Email receiving reminders & digests | `yourname@gmail.com` |
| `CRON_SECRET` | Secret token verifying Vercel Cron | Random secret key |
| `NEXT_PUBLIC_APP_URL` | Your live deployment URL | `https://your-project.vercel.app` |

### Step 3: Deploy to Vercel
Push your latest changes to your GitHub/GitLab repository connected to Vercel:

```bash
git add .
git commit -m "Configure Vercel Cron and reminders"
git push origin main
```

When Vercel builds your deployment, it will detect `vercel.json` and register the cron job automatically.

---

## 4. Monitoring and Testing in Vercel Dashboard

1. Navigate to **Deployments** in your Vercel dashboard.
2. Click on your active **Production Deployment**.
3. Click the **Cron Jobs** tab (or **Settings &rarr; Cron Jobs**).
4. You will see:
   - **Endpoint**: `/api/cron/reminders`
   - **Schedule**: `0 3 * * *`
   - **Status**: Active
   - **Next Expected Run**: Timestamp in UTC / your local time
5. **Manual Trigger**: Click the **Run** button on the row to test the cron job immediately without waiting for 08:30 AM.
6. **Execution Logs**: Click **View Logs** to see the output:
   - Total active loans checked
   - Overdue installments transitioned
   - Number of reminder emails sent

---

## 5. Testing the Cron Endpoint Locally or via cURL

### Using cURL
```bash
# Test against your live Vercel deployment:
curl -X GET "https://your-project.vercel.app/api/cron/reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_VALUE"
```

### Using PowerShell (Windows)
```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_CRON_SECRET_VALUE"
}
Invoke-RestMethod -Uri "https://your-project.vercel.app/api/cron/reminders" -Method Get -Headers $headers
```

### Expected JSON Response
```json
{
  "success": true,
  "remindersSent": 2,
  "activeLoansChecked": 14,
  "digestCount": 1,
  "timestamp": "2026-11-05T03:00:01.234Z"
}
```

---

## 6. Vercel Plan Limits & Troubleshooting

### Vercel Plan Frequency Limits
- **Hobby (Free) Plan**: Supports cron jobs with a frequency of **at most once per day** (`0 3 * * *` fits within this rule).
- **Pro Plan**: Supports cron frequency up to **once per minute**.

### Common Troubleshooting Tips
1. **`{ "error": "Unauthorized cron request" }` (401)**:
   - Verify that `CRON_SECRET` in Vercel Environment Variables exactly matches the token sent in the `Authorization: Bearer <token>` header.
2. **Cron Not Running**:
   - Ensure the deployment is on your **Production** branch (Vercel Cron only triggers production deployments).
   - Check **Settings &rarr; Cron Jobs** in Vercel to confirm the job is registered.
3. **Emails Not Delivering**:
   - Visit `/settings` inside the app and click **Send Test Email** to verify that your `GMAIL_USER` and `GMAIL_APP_PASSWORD` are working properly.

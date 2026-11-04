# Money Lending Tracker

A private, single-user **Money Lending Tracker** built with Next.js (App Router, React 19, TypeScript, Tailwind CSS), Prisma ORM, and PostgreSQL. Designed for personal lending management where only the lender logs in, with automated email reminders via Gmail SMTP and Vercel Cron.

---

## Features

- **Single-Admin Authentication**:
  - Protected with a single master password (`ADMIN_PASSWORD`).
  - Constant-time password verification via `crypto.timingSafeEqual` and SHA-256 to prevent timing attacks.
  - 30-day signed, httpOnly, secure session cookie using `jose`.
  - Next.js Edge middleware guarding all application routes while allowing Vercel Cron endpoints with bearer tokens.

- **Four Loan & Debt Types with Exact Decimal Math**:
  - **EMI Loan**: Fixed monthly installments across fixed months. Real-time computation of total payable, payments received, remaining balance, and months remaining. Auto-closes when balance reaches zero.
  - **Interest-Free Loan**: Fixed monthly installments with no interest. Flags automatic warnings if total monthly installments do not equal the principal amount.
  - **Interest-Only Loan**: Principal repayment is flexible. Supports either a monthly percentage or a fixed monthly amount. Automatically updates monthly interest due as principal is returned in parts. Auto-closes when principal is fully paid.
  - **Flexible Debt (Open / Informal Hand Loan)**: No fixed monthly installment required. Borrowers can make partial repayments anytime. Dispatches automated monthly reminders to the owner on the chosen due day showing the current pending balance, and auto-closes when the remaining balance reaches zero.
  - Pure calculation engine (`lib/calculations.ts`) using `decimal.js` to eliminate any floating-point arithmetic errors.

- **Automated Email Reminders & Vercel Cron**:
  - Daily Vercel Cron running at `03:00 UTC` (08:30 AM IST).
  - Configurable reminder chips (e.g. 1, 2, 3, 5, 7 days before due date) and due day reminder.
  - Separate emails: comprehensive email with direct dashboard links for the owner, and polite, short due notices for the borrower (without exposing rates or principal).
  - Combined daily digest email for the owner when multiple reminders fire on the same day.
  - Dedicated daily overdue email notice for unpaid dues.
  - Strict deduplication using `ReminderLog` with unique constraints on `[loanId, dueDate, trigger, recipient]`.

- **Calendar & Timezone Precision**:
  - All date arithmetic is anchored to the `Asia/Kolkata` (IST, UTC+05:30) timezone.
  - Edge cases handled: due days on 29, 30, and 31 dynamically clamped to the last day of shorter months (e.g., February 28/29, April 30), leap years, and loans started mid-month.

- **Mobile-First Responsive Interface**:
  - Built with clean aesthetics, quick action dialogs, responsive cards, and a dedicated mobile thumb-navigation bar for seamless on-the-go phone usage.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack) & React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database & ORM**: PostgreSQL (Neon / Supabase) with Prisma ORM
- **Decimal Math**: `decimal.js`
- **Validation**: `zod`
- **Email Delivery**: `nodemailer` with Gmail SMTP (`smtp.gmail.com:465`)
- **Hosting & Cron**: Vercel & Vercel Cron

---

## Project Structure

```text
lentra/
├── prisma/
│   ├── schema.prisma             # PostgreSQL schema with Decimal precision & enums
│   └── seed.ts                   # Seeds 3 borrowers and 3 distinct loan types
├── lib/
│   ├── auth.ts                   # Jose JWT auth, crypto.timingSafeEqual, cookie management
│   ├── calculations.ts           # Pure Decimal-safe loan arithmetic
│   ├── calculations.test.ts      # Automated unit test suite for calculation engine
│   ├── dates.ts                  # Asia/Kolkata date handling, clamped due dates & calendar math
│   ├── dates.test.ts             # Unit tests for leap years & short month calendar cases
│   ├── email.ts                  # Nodemailer Gmail transporter & HTML email templates
│   ├── format.ts                 # Currency formatter (Intl en-IN) and date formatting
│   ├── prisma.ts                 # Global PrismaClient singleton
│   ├── types.ts                  # Shared TypeScript interfaces
│   └── validations.ts            # Zod schemas for all forms and mutations
├── components/
│   ├── BorrowerDialog.tsx        # Add and edit borrower modal
│   ├── LoanBadge.tsx             # Badges for loan types and status
│   ├── Navbar.tsx                # Desktop header & mobile bottom thumb-navigation
│   └── RecordPaymentDialog.tsx   # Quick payment modal
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx        # Master password admin login
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Protected dashboard shell with Navbar
│   │   ├── page.tsx              # Dashboard with summary cards & dues lists
│   │   ├── borrowers/page.tsx    # Borrower directory, search & loan counts
│   │   ├── loans/
│   │   │   ├── page.tsx          # Filterable loans table & search
│   │   │   ├── new/page.tsx      # Add loan form with conditional fields & reminder chips
│   │   │   └── [id]/page.tsx     # Loan details, payments table & test reminder action
│   │   └── settings/page.tsx     # SMTP configuration & test email button
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts    # Verify password & set 30-day session
│       │   └── logout/route.ts   # Clear session cookie
│       ├── cron/
│       │   └── reminders/route.ts# Vercel Cron endpoint with deduplication
│       ├── borrowers/route.ts    # List & create borrowers
│       ├── borrowers/[id]/route.ts # Edit & delete borrower (blocks if loans exist)
│       ├── loans/route.ts        # List & create loans
│       ├── loans/[id]/route.ts   # Loan details, update (immutable principal), status toggle
│       ├── loans/[id]/test-reminder/route.ts # Send test reminder for loan
│       ├── payments/route.ts     # Record payment & handle auto-closing
│       ├── payments/[id]/route.ts# Delete payment
│       └── test-email/route.ts   # Send test email to owner
├── middleware.ts                 # Route protection middleware
├── vercel.json                   # Daily cron schedule (03:00 UTC)
├── .env.example                  # Documented environment variable template
└── README.md
```

---

## Local Setup & Development

### 1. Clone & Install Dependencies

```bash
git clone <repo-url> lentra
cd lentra
npm install
```

### 2. Configure Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in the required variables:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Pooled Postgres connection URL | `postgresql://user:pass@pooler.neon.tech/neondb?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Direct unpooled connection URL | `postgresql://user:pass@ep-sample.neon.tech/neondb?sslmode=require` |
| `ADMIN_PASSWORD` | Single master password for admin login | `MySecureAdminPassword123!` |
| `AUTH_SECRET` | 32+ character secret for JWT signing | `openssl rand -base64 32` |
| `GMAIL_USER` | Your Gmail address | `youremail@gmail.com` |
| `GMAIL_APP_PASSWORD`| 16-character Gmail App Password | `abcdefghijklmnop` |
| `OWNER_EMAIL` | Destination email for reminder alerts | `youremail@gmail.com` |
| `CRON_SECRET` | Secret token to authenticate cron triggers | `openssl rand -hex 24` |
| `NEXT_PUBLIC_APP_URL` | Base URL used in email action buttons | `http://localhost:3000` |

### 3. Generate Prisma Client & Push Schema

```bash
# Push schema to your PostgreSQL database
npx prisma db push

# Generate the Prisma Client
npx prisma generate
```

### 4. Seed Sample Data

Run the seed script to populate 3 sample borrowers and 3 distinct loan types:

```bash
npx prisma db seed
```

### 5. Run Unit Tests

Verify the financial calculation engine and date clamping logic:

```bash
npx tsx lib/calculations.test.ts
npx tsx lib/dates.test.ts
```

### 6. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and log in with your `ADMIN_PASSWORD`.

---

## How to Create a Gmail App Password

Standard Gmail passwords cannot be used directly with SMTP. You must create a Google App Password:

1. Visit your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned **ON**.
3. Under *2-Step Verification*, click on **App passwords** (or search "App passwords" in the top search bar).
4. Enter an App Name (e.g. `Money Lending Tracker`) and click **Create**.
5. Copy the 16-character code and paste it into your `GMAIL_APP_PASSWORD` environment variable **without spaces**.
6. Visit `/settings` inside the app and click **Send Test Email** to verify your setup.

---

## Deploying to Vercel

### 1. Push to GitHub
Commit and push your repository to GitHub.

### 2. Import Project into Vercel
1. Log in to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Select your GitHub repository.
3. In **Environment Variables**, add all keys from `.env.example`:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `ADMIN_PASSWORD`
   - `AUTH_SECRET`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `OWNER_EMAIL`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel deployment URL, e.g. `https://your-app.vercel.app`)
4. Click **Deploy**.

### 3. Apply Migrations in Production
From your local terminal with your production database credentials in `.env`:
```bash
npx prisma db push
```

### 4. Vercel Cron Configuration Note
> [!IMPORTANT]
> **Vercel Hobby Plan Cron Limitations**:
> On the Vercel Hobby plan, cron jobs run **at most once per day**.
> The configured cron job in `vercel.json` runs daily at **`03:00 UTC` (08:30 AM IST)**:
> ```json
> {
>   "crons": [
>     {
>       "path": "/api/cron/reminders",
>       "schedule": "0 3 * * *"
>     }
>   ]
> }
> ```
> Vercel automatically passes the header `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is defined in your Vercel project settings. You can also manually trigger the cron endpoint anytime:
> ```bash
> curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/reminders
> ```

---

## Security & Architectural Guarantees

1. **Immutable Loan Principals**:
   - The initial principal amount is locked permanently upon creation.
   - Both the frontend UI and the backend API (`PUT /api/loans/[id]`) explicitly reject any mutation containing `principalAmount` or `startDate`.
2. **Borrower Deletion Guard**:
   - Borrowers cannot be deleted if they have associated loans (`totalLoans > 0`).
3. **No Duplicate Reminders**:
   - The `ReminderLog` table enforces a compound unique constraint `@@unique([loanId, dueDate, trigger, recipient])`, ensuring that even if the cron job runs multiple times in a day, an identical reminder is never dispatched twice.
4. **No Borrower Access**:
   - Single-admin design with no public or borrower-facing portals.

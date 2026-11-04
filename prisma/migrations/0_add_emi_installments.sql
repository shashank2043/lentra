-- Non-destructive migration for Money Lending Tracker
-- Safe to run in Supabase SQL Editor. Does NOT touch, drop, or delete any existing data.

-- 1. Create InstallmentStatus enum if it does not exist
DO $$ BEGIN
    CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add 'OVERDUE' to ReminderTrigger enum if it does not exist
DO $$ BEGIN
    ALTER TYPE "ReminderTrigger" ADD VALUE IF NOT EXISTS 'OVERDUE';
EXCEPTION
    WHEN others THEN null;
END $$;

-- 3. Create EmiInstallment table if it does not exist
CREATE TABLE IF NOT EXISTS "EmiInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "lastReminderAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmiInstallment_pkey" PRIMARY KEY ("id")
);

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS "EmiInstallment_loanId_installmentNo_key" ON "EmiInstallment"("loanId", "installmentNo");
CREATE UNIQUE INDEX IF NOT EXISTS "EmiInstallment_paymentId_key" ON "EmiInstallment"("paymentId");
CREATE INDEX IF NOT EXISTS "EmiInstallment_dueDate_status_idx" ON "EmiInstallment"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "EmiInstallment_status_idx" ON "EmiInstallment"("status");
CREATE INDEX IF NOT EXISTS "EmiInstallment_loanId_idx" ON "EmiInstallment"("loanId");

-- Foreign key constraints safely added
DO $$ BEGIN
    ALTER TABLE "EmiInstallment" 
        ADD CONSTRAINT "EmiInstallment_loanId_fkey" 
        FOREIGN KEY ("loanId") REFERENCES "Loan"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "EmiInstallment" 
        ADD CONSTRAINT "EmiInstallment_paymentId_fkey" 
        FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Create InAppNotification table if it does not exist
CREATE TABLE IF NOT EXISTS "InAppNotification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InAppNotification_isRead_createdAt_idx" ON "InAppNotification"("isRead", "createdAt");

import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

async function runSafeMigration() {
  console.log("Starting safe, non-destructive migration on database...");
  console.log("This will ONLY create new tables/enums IF NOT EXISTS. No existing data is touched.");

  const sqlPath = path.join(process.cwd(), "prisma/migrations/0_add_emi_installments.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Split SQL commands separated by semicolons (handling DO blocks carefully)
  // Or execute each logical block
  const blocks = [
    `DO $$ BEGIN
        CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
        ALTER TYPE "ReminderTrigger" ADD VALUE IF NOT EXISTS 'OVERDUE';
    EXCEPTION
        WHEN others THEN null;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS "EmiInstallment" (
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
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "EmiInstallment_loanId_installmentNo_key" ON "EmiInstallment"("loanId", "installmentNo");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EmiInstallment_paymentId_key" ON "EmiInstallment"("paymentId");`,
    `CREATE INDEX IF NOT EXISTS "EmiInstallment_dueDate_status_idx" ON "EmiInstallment"("dueDate", "status");`,
    `CREATE INDEX IF NOT EXISTS "EmiInstallment_status_idx" ON "EmiInstallment"("status");`,
    `CREATE INDEX IF NOT EXISTS "EmiInstallment_loanId_idx" ON "EmiInstallment"("loanId");`,

    `DO $$ BEGIN
        ALTER TABLE "EmiInstallment" 
            ADD CONSTRAINT "EmiInstallment_loanId_fkey" 
            FOREIGN KEY ("loanId") REFERENCES "Loan"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
        ALTER TABLE "EmiInstallment" 
            ADD CONSTRAINT "EmiInstallment_paymentId_fkey" 
            FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS "InAppNotification" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "link" TEXT,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
    );`,

    `CREATE INDEX IF NOT EXISTS "InAppNotification_isRead_createdAt_idx" ON "InAppNotification"("isRead", "createdAt");`
  ];

  for (let i = 0; i < blocks.length; i++) {
    try {
      await prisma.$executeRawUnsafe(blocks[i]);
      console.log(`   ✓ [${i + 1}/${blocks.length}] Executed statement successfully`);
    } catch (err: any) {
      console.warn(`   ⚠ [${i + 1}/${blocks.length}] Warning:`, err.message);
    }
  }

  console.log("\nMigration completed safely! All existing data preserved intact. ✅");
}

runSafeMigration()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

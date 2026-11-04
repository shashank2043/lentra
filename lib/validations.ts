import { z } from "zod";

export const borrowerSchema = z.object({
  name: z.string().trim().min(1, "Borrower name is required").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type BorrowerInput = z.infer<typeof borrowerSchema>;

export const loanCreateSchema = z
  .object({
    borrowerId: z.string().min(1, "Please select a borrower"),
    type: z.enum(["EMI", "INTEREST_FREE", "INTEREST_ONLY", "FLEXIBLE"]),
    principalAmount: z
      .union([z.string(), z.number()])
      .refine((val) => Number(val) > 0, "Principal amount must be greater than 0")
      .transform((val) => String(val)),
    startDate: z.string().min(1, "Start date is required"),
    dueDay: z
      .union([z.string(), z.number()])
      .transform(Number)
      .refine((val) => Number.isInteger(val) && val >= 1 && val <= 31, {
        message: "Due day must be between 1 and 31",
      }),
    monthlyAmount: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? String(val) : undefined)),
    totalMonths: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? Number(val) : undefined)),
    remainingMonths: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? Number(val) : undefined)),
    interestMode: z.enum(["FIXED", "PERCENT"]).optional().nullable(),
    interestValue: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? String(val) : undefined)),
    remindDaysBefore: z
      .array(z.number().int().min(1).max(30))
      .default([3]),
    remindOnDueDay: z.boolean().default(true),
    remindBorrower: z.boolean().default(false),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "EMI" || data.type === "INTEREST_FREE") {
      if (!data.monthlyAmount || Number(data.monthlyAmount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["monthlyAmount"],
          message: "Monthly amount is required and must be greater than 0",
        });
      }
      if (!data.totalMonths || data.totalMonths <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalMonths"],
          message: "Total months is required and must be at least 1",
        });
      }
    }

    if (data.type === "INTEREST_ONLY") {
      if (!data.interestMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interestMode"],
          message: "Interest mode (Fixed or Percent) is required",
        });
      }
      if (!data.interestValue || Number(data.interestValue) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interestValue"],
          message: "Interest value is required and must be greater than 0",
        });
      }
    }
  });

export type LoanCreateInput = z.infer<typeof loanCreateSchema>;

// Updating a loan: principalAmount and startDate are explicitly omitted and IMMUTABLE
export const loanUpdateSchema = z
  .object({
    dueDay: z
      .union([z.string(), z.number()])
      .transform(Number)
      .refine((val) => Number.isInteger(val) && val >= 1 && val <= 31, {
        message: "Due day must be between 1 and 31",
      }),
    monthlyAmount: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? String(val) : undefined)),
    totalMonths: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? Number(val) : undefined)),
    remainingMonths: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? Number(val) : undefined)),
    interestMode: z.enum(["FIXED", "PERCENT"]).optional().nullable(),
    interestValue: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .transform((val) => (val !== undefined && val !== null && val !== "" ? String(val) : undefined)),
    remindDaysBefore: z
      .array(z.number().int().min(1).max(30))
      .default([3]),
    remindOnDueDay: z.boolean().default(true),
    remindBorrower: z.boolean().default(false),
    status: z.enum(["ACTIVE", "CLOSED"]).optional(),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  });

export type LoanUpdateInput = z.infer<typeof loanUpdateSchema>;

export const paymentCreateSchema = z.object({
  loanId: z.string().min(1, "Loan ID is required"),
  paidOn: z.string().min(1, "Payment date is required"),
  amount: z
    .union([z.string(), z.number()])
    .refine((val) => Number(val) > 0, "Amount must be greater than 0")
    .transform((val) => String(val)),
  kind: z.enum(["INSTALLMENT", "INTEREST", "PRINCIPAL"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

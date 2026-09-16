import { z } from "zod";

/**
 * The customer-visible metadata projection and the immutable action use the
 * same command identity.  Keep its wire shape in the domain so every
 * financial boundary validates the same fields before it can act.
 */
export const persistedRefundCommandSchema = z.object({
  approvalCaseId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  reason: z.string().min(1),
  idempotencyKey: z.string().min(1),
  fingerprint: z.string().min(1),
});

export type PersistedRefundCommand = z.infer<
  typeof persistedRefundCommandSchema
>;

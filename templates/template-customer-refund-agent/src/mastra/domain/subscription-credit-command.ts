import { z } from "zod";

/** Immutable, approved instruction to place one month of credit on a
 * customer's billing balance. It deliberately names the subscription and
 * customer: a credit is never represented as a refund of an old invoice. */
export const persistedSubscriptionCreditCommandSchema = z.object({
  approvalCaseId: z.string().min(1),
  customerId: z.string().min(1),
  subscriptionId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  reason: z.string().min(1),
  idempotencyKey: z.string().min(1),
  fingerprint: z.string().min(1),
});

/** The post-retention audit projection keeps identity only, never the amount
 * or customer association required to execute a credit. */
export const retainedSubscriptionCreditCommandReferenceSchema = z.object({
  fingerprint: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});

export type PersistedSubscriptionCreditCommand = z.infer<
  typeof persistedSubscriptionCreditCommandSchema
>;

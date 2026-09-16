import { z } from "zod";
import { persistedRefundCommandSchema } from "./refund-command.ts";
import {
  persistedSubscriptionCreditCommandSchema,
  retainedSubscriptionCreditCommandReferenceSchema,
} from "./subscription-credit-command.ts";

export const caseSourceSchema = z.enum([
  "mock-email",
  "chat",
  "intercom-conversation",
]);
export type CaseSource = z.infer<typeof caseSourceSchema>;

export const caseStatusSchema = z.enum([
  "new",
  "processing",
  "waiting_approval",
  "resolved",
  "escalated",
  "failed",
]);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const messageAuthorSchema = z.enum(["customer", "agent", "internal"]);

export const caseMessageSchema = z.object({
  id: z.string(),
  author: messageAuthorSchema,
  authorName: z.string().optional(),
  body: z.string(),
  createdAt: z.string(),
});
export type CaseMessage = z.infer<typeof caseMessageSchema>;

export const customerRefSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
});

export const triageResultSchema = z.object({
  intent: z.enum([
    "refund_request",
    "duplicate_charge",
    "order_status",
    "cancellation",
    "damaged_item",
    "account_issue",
    "service_problem",
    "other",
  ]),
  urgency: z.enum(["low", "normal", "high", "critical"]),
  sentiment: z.enum(["positive", "neutral", "negative", "angry"]),
  requiresHumanReview: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  accountIssueSubtype: z
    .enum(["informational_credit_status", "account_change", "unknown"])
    .optional(),
});
export type TriageResult = z.infer<typeof triageResultSchema>;

export const policyMatchSchema = z.object({
  title: z.string(),
  text: z.string(),
  source: z.string(),
  score: z.number(),
  version: z.string().optional(),
  documentHash: z.string().optional(),
  generationId: z.string().optional(),
  effectiveAt: z.string().optional(),
  indexedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  providerKind: z.string().optional(),
  providerAccountId: z.string().optional(),
});
export type PolicyMatch = z.infer<typeof policyMatchSchema>;

export const orderLookupSchema = z.object({
  found: z.boolean(),
  order: z
    .object({
      orderId: z.string(),
      customerEmail: z.email(),
      product: z.string(),
      amount: z.number(),
      currency: z.string(),
      status: z.enum([
        "fulfilled",
        "shipped",
        "processing",
        "cancelled",
        "refunded",
      ]),
      chargeCount: z.number(),
      placedAt: z.string(),
    })
    .optional(),
});
export type OrderLookup = z.infer<typeof orderLookupSchema>;

export const subscriptionLookupSchema = z.object({
  found: z.boolean(),
  subscription: z
    .object({
      subscriptionId: z.string(),
      customerId: z.string().optional(),
      customerEmail: z.email(),
      plan: z.string(),
      recurringInterval: z.enum(["month", "year"]).optional(),
      recurringIntervalCount: z.number().int().positive().optional(),
      quantity: z.number().int().positive().optional(),
      amount: z.number(),
      currency: z.string(),
      status: z.enum(["active", "cancelled", "past_due"]),
      renewsAt: z.string(),
      cancelAtPeriodEnd: z.literal(true).optional(),
      cancelsAt: z.string().optional(),
      /** The paid invoice is the only subscription refund target. */
      refundOrderId: z.string().optional(),
    })
    .optional(),
});
export type SubscriptionLookup = z.infer<typeof subscriptionLookupSchema>;

export const refundHistorySchema = z.object({
  refunds: z.array(
    z.object({
      refundId: z.string(),
      orderId: z.string(),
      amount: z.number(),
      currency: z.string(),
      reason: z.string(),
      issuedAt: z.string(),
    }),
  ),
});
export type RefundHistory = z.infer<typeof refundHistorySchema>;

export const draftResolutionSchema = z.object({
  draftResponse: z.string().describe("The grounded, customer-facing reply."),
  citedSources: z
    .array(z.string())
    .describe("Titles/sources of policy documents actually used."),
  selectedPolicyExcerpts: z
    .array(
      z.object({
        source: z.string(),
        excerpt: z.string().min(1).max(600),
      }),
    )
    .max(3)
    .default([])
    .describe(
      "Exact, relevant excerpts from cited policy documents. These are rendered as policy guidance, never as a completed account effect.",
    ),
  recommendRefund: z.boolean(),
  /** Explicit action selection for new financial resolutions. The legacy
   * refund fields remain readable while earlier turns complete. */
  resolutionAction: z
    .enum(["none", "refund", "subscription_credit"])
    .optional(),
  subscriptionCreditAmount: z.number().optional(),
  subscriptionCreditCurrency: z.string().optional(),
  subscriptionCreditReason: z.string().optional(),
  refundAmount: z.number().optional(),
  refundCurrency: z.string().optional(),
  refundReason: z.string().optional(),
  requiresEscalation: z.boolean(),
  escalationReason: z.string().optional(),
});
export type DraftResolution = z.infer<typeof draftResolutionSchema>;

export const approvalDecisionSchema = z.object({
  approved: z.boolean(),
  approverId: z.string(),
  note: z.string().optional(),
  serviceProblemConfirmed: z.literal(true).optional(),
});
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const caseFeedbackSchema = z.object({
  rating: z.enum(["up", "down"]),
  comment: z.string().optional(),
  submittedAt: z.string(),
  actorId: z.string().optional(),
  turnId: z.string().optional(),
  runId: z.string().optional(),
  traceId: z.string().optional(),
});
export type CaseFeedback = z.infer<typeof caseFeedbackSchema>;

export const refundResultSchema = z.object({
  refundId: z.string(),
  orderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["executed", "skipped", "pending", "failed"]),
  idempotencyKey: z.string(),
  executedAt: z.string(),
});
export type RefundResult = z.infer<typeof refundResultSchema>;
export const subscriptionCreditResultSchema = z.object({
  creditId: z.string(),
  customerId: z.string(),
  subscriptionId: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["executed", "skipped", "pending", "failed"]),
  idempotencyKey: z.string(),
  executedAt: z.string(),
});
export type SubscriptionCreditResult = z.infer<
  typeof subscriptionCreditResultSchema
>;

/** The binding is selected when a case is accepted and is immutable thereafter. */
export const providerBindingSchema = z.object({
  tenantId: z.string().min(1),
  providerKind: z.enum(["local", "intercom", "stripe"]),
  providerAccountId: z.string().min(1),
  externalConversationId: z.string().min(1),
});
export type PersistedProviderBinding = z.infer<typeof providerBindingSchema>;

export const caseProviderBindingsSchema = z.object({
  support: providerBindingSchema,
  commerce: providerBindingSchema,
  transactions: providerBindingSchema,
  knowledge: providerBindingSchema,
});
export type PersistedCaseProviderBindings = z.infer<
  typeof caseProviderBindingsSchema
>;

/** This is a reference only. It can never be used to execute a refund. */
export const retainedRefundCommandReferenceSchema = z.object({
  fingerprint: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});
export type RetainedRefundCommandReference = z.infer<
  typeof retainedRefundCommandReferenceSchema
>;

export const nativeApprovalSchema = z.object({
  runId: z.string().min(1),
  toolCallId: z.string().min(1),
  fingerprint: z.string().min(1),
  turnId: z.string().min(1),
});
export type NativeApproval = z.infer<typeof nativeApprovalSchema>;

export const subscriptionCancellationEffectSchema = z.object({
  subscriptionId: z.string().min(1),
  cancelAtPeriodEnd: z.literal(true),
  cancelsAt: z.string().min(1),
  idempotencyKey: z.string().min(1),
  replayed: z.boolean(),
});
export type PersistedSubscriptionCancellationEffect = z.infer<
  typeof subscriptionCancellationEffectSchema
>;

/**
 * Known metadata is checked at persistence and API boundaries. `catchall`
 * deliberately preserves integration-specific metadata without granting it
 * operational meaning.
 */
const knownCaseMetadataSchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    activeTurnId: z.string().min(1).optional(),
    providerBinding: providerBindingSchema.optional(),
    providerBindings: caseProviderBindingsSchema.optional(),
    refundCommand: z
      .union([
        persistedRefundCommandSchema,
        retainedRefundCommandReferenceSchema,
      ])
      .optional(),
    subscriptionCreditCommand: z
      .union([
        persistedSubscriptionCreditCommandSchema,
        retainedSubscriptionCreditCommandReferenceSchema,
      ])
      .optional(),
    nativeApproval: nativeApprovalSchema.optional(),
    cancellationEffect: subscriptionCancellationEffectSchema.optional(),
    refundEffects: z.record(z.string(), refundResultSchema).optional(),
    subscriptionCreditEffects: z
      .record(z.string(), subscriptionCreditResultSchema)
      .optional(),
    retentionRedactedAt: z.string().optional(),
  })
  .catchall(z.unknown());
export const caseMetadataSchema = knownCaseMetadataSchema.superRefine(
  (metadata, context) => {
    if (
      metadata.refundCommand &&
      !persistedRefundCommandSchema.safeParse(metadata.refundCommand).success &&
      metadata.retentionRedactedAt === undefined
    )
      context.addIssue({
        code: "custom",
        path: ["refundCommand"],
        message:
          "A partial refund command is valid only on a marked retention tombstone.",
      });
    if (
      metadata.subscriptionCreditCommand &&
      !persistedSubscriptionCreditCommandSchema.safeParse(
        metadata.subscriptionCreditCommand,
      ).success &&
      metadata.retentionRedactedAt === undefined
    )
      context.addIssue({
        code: "custom",
        path: ["subscriptionCreditCommand"],
        message:
          "A partial subscription-credit command is valid only on a marked retention tombstone.",
      });
  },
);
export type CaseMetadata = z.infer<typeof caseMetadataSchema>;

/** The API has its own deliberately minimal financial metadata view. */
export const staffCaseMetadataSchema = z.object({
  refundCommand: retainedRefundCommandReferenceSchema
    .pick({
      fingerprint: true,
    })
    .optional(),
  subscriptionCreditCommand: retainedSubscriptionCreditCommandReferenceSchema
    .pick({
      fingerprint: true,
    })
    .optional(),
});
export type StaffCaseMetadata = z.infer<typeof staffCaseMetadataSchema>;

export const supportCaseSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  source: caseSourceSchema,
  customer: customerRefSchema,
  subject: z.string(),
  messages: z.array(caseMessageSchema),
  status: caseStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  triage: triageResultSchema.optional(),
  policyMatches: z.array(policyMatchSchema).optional(),
  orderLookup: orderLookupSchema.optional(),
  subscriptionLookup: subscriptionLookupSchema.optional(),
  refundHistory: refundHistorySchema.optional(),
  draft: draftResolutionSchema.optional(),
  approval: approvalDecisionSchema.optional(),
  refundResult: refundResultSchema.optional(),
  subscriptionCreditResult: subscriptionCreditResultSchema.optional(),
  finalResponse: z.string().optional(),
  escalationReason: z.string().optional(),
  workflowRunId: z.string().optional(),
  /** Root trace id for the resolve-support-case workflow run, used to pull token/tool observability data for monitoring. */
  traceId: z.string().optional(),
  agentUsage: z
    .object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      model: z.string().optional(),
    })
    .optional(),
  feedback: caseFeedbackSchema.optional(),
  metadata: caseMetadataSchema.default({}),
});
export type SupportCase = z.infer<typeof supportCaseSchema>;

/**
 * HTTP never exposes the operational metadata object. Staff receive only the
 * immutable command fingerprint; customer responses use the same schema with
 * its empty metadata form.
 */
export const publicSupportCaseSchema = supportCaseSchema.extend({
  metadata: staffCaseMetadataSchema,
});
export type PublicSupportCase = z.infer<typeof publicSupportCaseSchema>;

/** A customer may track an approved financial request, but never receive its
 * immutable command, internal note, provider handles, or arbitrary metadata. */
export const customerFinancialRequestSchema = z.object({
  caseId: z.string(),
  turnId: z.string(),
  type: z.enum(["refund", "subscription_credit"]),
  amount: z.number().positive(),
  currency: z.string().min(1),
  status: z.enum([
    "pending_approval",
    "rejected",
    "processing",
    "executed",
    "failed",
    "unknown",
  ]),
  requestedAt: z.string(),
});
export type CustomerFinancialRequest = z.infer<
  typeof customerFinancialRequestSchema
>;

/** Create the application-owned identifier before a normalized case is saved. */
export function generateCaseId(): string {
  return `case_${crypto.randomUUID().slice(0, 8)}`;
}

export function threadIdForCase(caseId: string, tenantId: string): string {
  return `tenant_${tenantId}_conversation_${caseId}`;
}
/** Memory is scoped to the authenticated owner, never to a model-provided
 * case identifier. Conversations remain separate threads under this resource. */
export function resourceIdForOwner(ownerId: string, tenantId: string): string {
  return `tenant_${tenantId}_owner_${ownerId}`;
}

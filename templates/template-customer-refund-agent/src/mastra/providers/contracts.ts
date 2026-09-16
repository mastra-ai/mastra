import {
  caseProviderBindingsSchema,
  providerBindingSchema,
  type PersistedCaseProviderBindings,
  type PersistedProviderBinding,
} from "../domain/support-case.ts";

/**
 * Provider-neutral boundaries used by workflows and tools.  A case stores the
 * binding that selected each port, so a later configuration change cannot
 * redirect an already accepted event or financial effect.
 */
export type ProviderBinding = PersistedProviderBinding;

/** A provider adapter calls this immediately before its irreversible mutation.
 * It lets a durable domain fence reject a stale operation after any provider
 * preflight GET, rather than treating that earlier read as the mutation edge. */
export type ProviderMutationFence = () => Promise<boolean>;

/** The adapter checked its mutation fence before sending a provider POST. */
export class ProviderEffectFenceRejectedError extends Error {
  constructor() {
    super("Provider mutation was superseded before the POST boundary.");
    this.name = "ProviderEffectFenceRejectedError";
  }
}

/** The persisted canonical support owner failed before any refund attempt or
 * provider request could be created. Callers may safely classify this as a
 * confirmed no-effect only when no earlier attempt exists. */
export class VerifiedRefundOwnerRejectedError extends Error {
  constructor() {
    super("Refund execution requires the current verified case owner.");
  }
}

/** A case persists each binding independently; local fixtures use the same
 * account by default, but that convenience never changes a saved case. */
export type CaseProviderBindings = PersistedCaseProviderBindings;

export interface Money {
  /** ISO 4217 code. Amounts are always integer minor units. */
  currency: string;
  minor: number;
}

export interface SupportChannelProvider {
  readonly kind: ProviderBinding["providerKind"];
  normalizeInbound(payload: unknown): Promise<{
    binding: ProviderBinding;
    externalId: string;
    source: "mock-email" | "chat" | "intercom-conversation";
    customer: { email: string; name?: string };
    subject: string;
    message: {
      id: string;
      author: "customer";
      authorName?: string;
      body: string;
      createdAt: string;
    };
    rawPayload: Record<string, unknown>;
  }>;
  deliver(
    binding: ProviderBinding,
    body: string,
    status: string,
    idempotencyKey?: string,
  ): Promise<DeliveryReceipt>;
  addInternalNote(
    binding: ProviderBinding,
    body: string,
    idempotencyKey: string,
    beforeMutation?: ProviderMutationFence,
  ): Promise<DeliveryReceipt>;
  updateStatus(
    binding: ProviderBinding,
    status: string,
    idempotencyKey: string,
    beforeMutation?: ProviderMutationFence,
  ): Promise<DeliveryReceipt>;
  /** Read-only provider state used to fence signed provider close events. */
  currentConversationState?(
    binding: ProviderBinding,
  ): Promise<{ id: string; state: "open" | "closed" }>;
  /** Provider-owned follow-up operations for a terminal case. The workflow
   * persists this normalized plan atomically with its canonical reply. */
  planFinalizationOutbox?(input: {
    status: "resolved" | "escalated";
    subject: string;
    escalationReason?: string;
  }): Array<{
    operation: "note" | "status" | "ticket";
    body: string;
    status: string;
  }>;
  /** Conversation remains canonical.  This is deliberately optional and is
   * called only by a configured structured-escalation intent. */
  convertToTicket?(
    binding: ProviderBinding,
    input: { title: string; description: string },
    idempotencyKey: string,
  ): Promise<DeliveryReceipt>;
}

export interface CommerceProvider {
  readonly kind: ProviderBinding["providerKind"];
  findOrder(
    binding: ProviderBinding,
    email: string,
    orderId?: string,
  ): Promise<CommerceOrder | undefined>;
  findSubscription(
    binding: ProviderBinding,
    email: string,
  ): Promise<CommerceSubscription | undefined>;
  refunds(binding: ProviderBinding, orderId: string): Promise<CommerceRefund[]>;
}

export interface TransactionalActionProvider {
  readonly kind: ProviderBinding["providerKind"];
  quoteRefund(command: RefundCommand): Promise<RefundQuote>;
  issueRefund(
    command: RefundCommand,
    authorization?: import("./native-execution").NativeRefundExecutionAuthorization,
  ): Promise<RefundEffect>;
  quoteSubscriptionCredit(
    command: SubscriptionCreditCommand,
  ): Promise<SubscriptionCreditQuote>;
  issueSubscriptionCredit(
    command: SubscriptionCreditCommand,
    authorization?: import("./native-execution").NativeRefundExecutionAuthorization,
  ): Promise<SubscriptionCreditEffect>;
  retrieveSubscriptionCredit(
    command: SubscriptionCreditCommand,
  ): Promise<SubscriptionCreditEffect | undefined>;
  scheduleSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
  ): Promise<SubscriptionCancellationEffect>;
  retrieveSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
  ): Promise<SubscriptionCancellationEffect | undefined>;
}

export interface KnowledgeProvider {
  readonly kind: ProviderBinding["providerKind"];
  search(
    binding: ProviderBinding,
    query: string,
    topK: number,
  ): Promise<KnowledgeEvidence[]>;
  listChanged(
    binding: ProviderBinding,
    since?: string,
  ): Promise<KnowledgeDocumentRef[]>;
  fetchDocument(
    binding: ProviderBinding,
    source: string,
  ): Promise<KnowledgeEvidence | undefined>;
}

export interface CommerceOrder {
  orderId: string;
  customerEmail: string;
  product: string;
  amount: Money;
  status: "fulfilled" | "shipped" | "processing" | "cancelled" | "refunded";
  chargeCount: number;
  placedAt: string;
  /** Provider-owned references are retained for audit/reconciliation without
   * making Stripe concepts part of the workflow contract. */
  providerRefs?: ProviderRef[];
  providerStatus?: string;
}
export interface CommerceSubscription {
  subscriptionId: string;
  /** Stable provider customer identity required for customer balance effects. */
  customerId?: string;
  customerEmail: string;
  plan: string;
  /** Provider-normalized billing terms.  A plan nickname is presentation
   * data, never authority to issue a financial credit. */
  recurringInterval: "month" | "year";
  recurringIntervalCount: number;
  quantity: number;
  amount: Money;
  status: "active" | "cancelled" | "past_due";
  renewsAt: string;
  /** A period-end cancellation is a schedule, not an immediate termination. */
  cancelAtPeriodEnd?: true;
  cancelsAt?: string;
  providerRefs?: ProviderRef[];
  providerStatus?: string;
}
export interface CommerceRefund {
  refundId: string;
  orderId: string;
  amount: Money;
  reason: string;
  issuedAt: string;
  providerStatus?: string;
}
export interface ProviderRef {
  provider: "stripe";
  type: string;
  id: string;
  apiVersion: string;
  livemode: false;
}
export interface RefundCommand {
  /** Case whose persisted local approval authorizes this immutable command. */
  approvalCaseId: string;
  binding: ProviderBinding;
  orderId: string;
  amount: Money;
  reason: string;
  idempotencyKey: string;
  fingerprint: string;
}
export interface RefundEffect {
  refundId: string;
  orderId: string;
  amount: Money;
  idempotencyKey: string;
  executedAt: string;
  replayed: boolean;
  /** A provider accepting a refund request is not proof of settlement. */
  status?: "pending" | "succeeded" | "failed" | "unknown";
  /** Provider state is retained separately from the conservative local state. */
  providerStatus?: string;
  providerRefs?: ProviderRef[];
}
export interface RefundQuote {
  approvedAmount: Money;
  remainingAmount: Money;
  commandFingerprint: string;
}
/** A billing credit is a distinct financial action. It is available for a
 * future finalized invoice; this receipt never claims invoice application. */
export interface SubscriptionCreditCommand {
  approvalCaseId: string;
  binding: ProviderBinding;
  customerId: string;
  subscriptionId: string;
  amount: Money;
  reason: string;
  idempotencyKey: string;
  fingerprint: string;
}
export interface SubscriptionCreditQuote {
  approvedAmount: Money;
  commandFingerprint: string;
}
export interface SubscriptionCreditEffect {
  creditId: string;
  customerId: string;
  subscriptionId: string;
  amount: Money;
  idempotencyKey: string;
  executedAt: string;
  replayed: boolean;
  /** Created means balance credit exists. It is not proof of invoice use. */
  status?: "pending" | "succeeded" | "failed" | "unknown";
  providerStatus?: string;
  providerRefs?: ProviderRef[];
}
/** The only non-refund cancellation supported by Phase 006: a verified owner
 * explicitly asks to cancel at period end and explicitly declines a refund. */
export interface SubscriptionCancellationCommand {
  caseId: string;
  turnId: string;
  ownerId: string;
  binding: ProviderBinding;
  subscriptionId: string;
  cancellationMode: "period_end";
  sourceMessageId: string;
  sourceMessageHash: string;
  idempotencyKey: string;
  fingerprint: string;
}
export interface SubscriptionCancellationEffect {
  subscriptionId: string;
  cancelAtPeriodEnd: true;
  cancelsAt: string;
  idempotencyKey: string;
  replayed: boolean;
}
export interface DeliveryReceipt {
  receiptId: string;
  deliveredAt: string;
  /** Present only when the provider proved a message/part was created. */
  providerMessageId?: string;
}
export interface KnowledgeEvidence {
  title: string;
  text: string;
  source: string;
  score: number;
  version: string;
  /** Source-owned applicability boundary. It is never inferred at indexing. */
  effectiveAt?: string;
  /** Source-owned expiry boundary; absent means the source gave no expiry. */
  expiresAt?: string;
}
export interface KnowledgeDocumentRef {
  source: string;
  version: string;
  changedAt: string;
}

export interface ProviderRegistry {
  support(binding: ProviderBinding): SupportChannelProvider;
  commerce(binding: ProviderBinding): CommerceProvider;
  transactions(binding: ProviderBinding): TransactionalActionProvider;
  knowledge(binding: ProviderBinding): KnowledgeProvider;
}

export function sameBinding(
  left: ProviderBinding,
  right: ProviderBinding,
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.providerKind === right.providerKind &&
    left.providerAccountId === right.providerAccountId &&
    left.externalConversationId === right.externalConversationId
  );
}

/**
 * Read the immutable, independently selected ports saved with a case.  The
 * one-binding shape is only a legacy read path; every new accepted case is
 * normalized to the four-binding shape before it is stored.
 */
export function bindingsForCase(case_: {
  externalId: string;
  metadata: {
    providerBinding?: ProviderBinding;
    providerBindings?: CaseProviderBindings;
  };
}): CaseProviderBindings {
  if (case_.metadata.providerBindings !== undefined)
    return caseProviderBindingsSchema.parse(case_.metadata.providerBindings);
  const selected =
    case_.metadata.providerBinding !== undefined
      ? providerBindingSchema.parse(case_.metadata.providerBinding)
      : {
          tenantId: "local-demo",
          providerKind: "local" as const,
          providerAccountId: "local-demo",
          externalConversationId: case_.externalId,
        };
  return {
    support: selected,
    commerce: selected,
    transactions: selected,
    knowledge: selected,
  };
}

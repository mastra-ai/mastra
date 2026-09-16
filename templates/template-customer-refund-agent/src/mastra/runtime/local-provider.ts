import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { caseStore, isFinancialRetentionTombstone } from "../lib/case-store";
import { activeDispatchLeaseScope } from "../lib/dispatch-lease-scope";
import { activeTrustedCancellationScope } from "../providers/cancellation-execution";
import {
  refundFingerprint,
  structurallyEqual,
  subscriptionCreditFingerprint,
} from "../lib/money";
import { exceedsStandardRefundReviewLimit } from "../domain/refund-review-limit";
import { providerBindingSchema } from "../domain/support-case";
import {
  initializeLocalFixtures,
  resetLocalFixtures,
  seedLocalFixtures,
} from "./local-fixtures";
import type {
  CommerceOrder,
  CommerceProvider,
  CommerceRefund,
  CommerceSubscription,
  KnowledgeEvidence,
  KnowledgeProvider,
  ProviderBinding,
  ProviderRegistry,
  RefundCommand,
  RefundEffect,
  SubscriptionCreditCommand,
  SubscriptionCreditEffect,
  SubscriptionCancellationCommand,
  SubscriptionCancellationEffect,
  SupportChannelProvider,
  TransactionalActionProvider,
} from "../providers/contracts";
import {
  bindingsForCase,
  VerifiedRefundOwnerRejectedError,
} from "../providers/contracts";
import {
  hasNativeRefundExecutionAuthorization,
  type NativeRefundExecutionAuthorization,
} from "../providers/native-execution";
import { activePrincipalHasRole } from "../server/auth";
import { assertRefundPolicyEvidenceAtFirstEffect } from "../lib/refund-policy-evidence-persistence";
import { canonicalConversationOwner } from "../lib/case-store-cases";
import {
  defaultLocalBinding,
  LocalSupportProvider,
} from "./local-support-provider";

export {
  defaultLocalBinding,
  LocalSupportProvider,
} from "./local-support-provider";
const LOCAL = "local" as const;
const text = (value: unknown) => String(value ?? "");

/** Compare the persisted authorization command structurally. JSON text is not
 * an authority format: equivalent objects may have a different key order. */
function matchesPersistedRefundCommand(
  value: unknown,
  command: RefundCommand,
): boolean {
  if (!value || typeof value !== "object") return false;
  const stored = value as Partial<RefundCommand>;
  const binding = stored.binding;
  return (
    stored.approvalCaseId === command.approvalCaseId &&
    stored.orderId === command.orderId &&
    stored.reason === command.reason &&
    stored.idempotencyKey === command.idempotencyKey &&
    stored.fingerprint === command.fingerprint &&
    stored.amount?.currency === command.amount.currency &&
    stored.amount?.minor === command.amount.minor &&
    binding?.tenantId === command.binding.tenantId &&
    binding?.providerKind === command.binding.providerKind &&
    binding?.providerAccountId === command.binding.providerAccountId &&
    binding?.externalConversationId === command.binding.externalConversationId
  );
}
function matchesPersistedSubscriptionCreditCommand(
  value: unknown,
  command: SubscriptionCreditCommand,
): boolean {
  if (!value || typeof value !== "object") return false;
  const stored = value as Partial<SubscriptionCreditCommand>;
  const binding = stored.binding;
  return (
    stored.approvalCaseId === command.approvalCaseId &&
    stored.customerId === command.customerId &&
    stored.subscriptionId === command.subscriptionId &&
    stored.reason === command.reason &&
    stored.idempotencyKey === command.idempotencyKey &&
    stored.fingerprint === command.fingerprint &&
    stored.amount?.currency === command.amount.currency &&
    stored.amount?.minor === command.amount.minor &&
    binding?.tenantId === command.binding.tenantId &&
    binding?.providerKind === command.binding.providerKind &&
    binding?.providerAccountId === command.binding.providerAccountId &&
    binding?.externalConversationId === command.binding.externalConversationId
  );
}
export class LocalRuntime
  implements
    ProviderRegistry,
    CommerceProvider,
    TransactionalActionProvider,
    KnowledgeProvider
{
  readonly kind = LOCAL;
  private readonly client: Client;
  private ready?: Promise<void>;
  private readonly seeded = new Map<string, Promise<void>>();
  private readonly fixtureQueues = new Map<string, Promise<void>>();
  constructor(
    client: Client = caseStore.getClient(),
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.client = client;
  }
  private async ensured() {
    this.ready ??= this.init();
    await this.ready;
  }
  private async init() {
    await initializeLocalFixtures(this.client);
  }
  private assertLocalBinding(binding: ProviderBinding) {
    if (
      binding.providerKind !== LOCAL ||
      !binding.tenantId ||
      !binding.providerAccountId ||
      !binding.externalConversationId
    )
      throw new Error("Invalid local provider binding.");
  }
  support(binding: ProviderBinding): SupportChannelProvider {
    this.assertLocalBinding(binding);
    return new LocalSupportProvider(this.client, this.ensured());
  }
  commerce(binding: ProviderBinding): CommerceProvider {
    this.assertLocalBinding(binding);
    return this;
  }
  transactions(binding: ProviderBinding): TransactionalActionProvider {
    this.assertLocalBinding(binding);
    return this;
  }
  knowledge(binding: ProviderBinding): KnowledgeProvider {
    this.assertLocalBinding(binding);
    return this;
  }
  async seed(binding: ProviderBinding = defaultLocalBinding()) {
    this.assertLocalBinding(binding);
    const key = `${binding.tenantId}\u0000${binding.providerAccountId}`;
    await this.queueFixtureOperation(key, async () => {
      let seed = this.seeded.get(key);
      if (!seed) {
        seed = this.seedOnce(binding).catch((error) => {
          this.seeded.delete(key);
          throw error;
        });
        this.seeded.set(key, seed);
      }
      await seed;
    });
  }
  /** Seed/reset share an in-process binding queue.  This preserves the reset
   * transaction boundary and makes a seed queued after reset restore fixtures
   * instead of returning an obsolete successful memo. */
  private async queueFixtureOperation<T>(
    key: string,
    operation: () => Promise<T>,
  ) {
    const prior = this.fixtureQueues.get(key) ?? Promise.resolve();
    const next = prior.catch(() => undefined).then(operation);
    const settled = next.then(
      () => undefined,
      () => undefined,
    );
    this.fixtureQueues.set(key, settled);
    try {
      return await next;
    } finally {
      if (this.fixtureQueues.get(key) === settled)
        this.fixtureQueues.delete(key);
    }
  }
  private async seedOnce(binding: ProviderBinding) {
    await this.ensured();
    await seedLocalFixtures(this.client, binding);
  }
  /** Deletes only this fixture binding, leaving other tenant/account data untouched. */
  async reset(binding: ProviderBinding = defaultLocalBinding()) {
    this.assertLocalBinding(binding);
    const key = `${binding.tenantId}\u0000${binding.providerAccountId}`;
    await this.queueFixtureOperation(key, async () => {
      await this.ensured();
      await resetLocalFixtures(this.client, binding);
      // Only invalidate after a committed reset. A refused reset preserves
      // both durable history and the existing fixture memo.
      this.seeded.delete(key);
    });
  }
  private order(row: Record<string, unknown>): CommerceOrder {
    return {
      orderId: text(row.order_id),
      customerEmail: text(row.customer_email),
      product: text(row.product),
      amount: { minor: Number(row.amount_minor), currency: text(row.currency) },
      status: text(row.status) as CommerceOrder["status"],
      chargeCount: Number(row.charge_count),
      placedAt: text(row.placed_at),
    };
  }
  async findOrder(binding: ProviderBinding, email: string, orderId?: string) {
    await this.ensured();
    const where = orderId
      ? email
        ? "order_id = ? AND lower(customer_email) = lower(?)"
        : "order_id = ?"
      : "lower(customer_email) = lower(?)";
    const args = orderId
      ? email
        ? [binding.tenantId, binding.providerAccountId, orderId, email]
        : [binding.tenantId, binding.providerAccountId, orderId]
      : [binding.tenantId, binding.providerAccountId, email];
    const result = await this.client.execute({
      sql: `SELECT * FROM local_orders WHERE tenant_id = ? AND provider_account_id = ? AND ${where} ORDER BY placed_at DESC`,
      args,
    });
    if (result.rows.length > 1 && !orderId)
      throw new Error(
        "Ambiguous order lookup; an explicit order id is required.",
      );
    return result.rows[0]
      ? this.order(result.rows[0] as Record<string, unknown>)
      : undefined;
  }
  async findSubscription(binding: ProviderBinding, email: string) {
    await this.ensured();
    await this.client.execute({
      sql: "UPDATE local_subscriptions SET status = 'cancelled' WHERE tenant_id = ? AND provider_account_id = ? AND status = 'active' AND cancel_at_period_end = 1 AND cancels_at IS NOT NULL AND cancels_at <= ?",
      args: [
        binding.tenantId,
        binding.providerAccountId,
        this.clock().toISOString(),
      ],
    });
    const result = await this.client.execute({
      sql: "SELECT * FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ? AND lower(customer_email) = lower(?)",
      args: [binding.tenantId, binding.providerAccountId, email],
    });
    if (result.rows.length > 1)
      throw new Error("Ambiguous subscription lookup.");
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row
      ? {
          subscriptionId: text(row.subscription_id),
          customerId: `local:${binding.tenantId}:${text(row.customer_email).toLowerCase()}`,
          customerEmail: text(row.customer_email),
          plan: text(row.plan),
          recurringInterval: text(row.recurring_interval) as "month" | "year",
          recurringIntervalCount: Number(row.recurring_interval_count),
          quantity: Number(row.quantity),
          amount: {
            minor: Number(row.amount_minor),
            currency: text(row.currency),
          },
          status: text(row.status) as CommerceSubscription["status"],
          renewsAt: text(row.renews_at),
          ...(Number(row.cancel_at_period_end) === 1
            ? {
                cancelAtPeriodEnd: true as const,
                cancelsAt: text(row.cancels_at),
              }
            : {}),
        }
      : undefined;
  }
  async refunds(binding: ProviderBinding, orderId: string) {
    await this.ensured();
    const result = await this.client.execute({
      sql: "SELECT * FROM local_refunds WHERE tenant_id = ? AND provider_account_id = ? AND order_id = ? ORDER BY issued_at",
      args: [binding.tenantId, binding.providerAccountId, orderId],
    });
    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        refundId: text(r.refund_id),
        orderId: text(r.order_id),
        amount: { minor: Number(r.amount_minor), currency: text(r.currency) },
        reason: text(r.reason),
        issuedAt: text(r.issued_at),
      } satisfies CommerceRefund;
    });
  }
  async issueRefund(
    command: RefundCommand,
    authorization?: NativeRefundExecutionAuthorization,
  ): Promise<RefundEffect> {
    await this.ensured();
    if (
      !Number.isSafeInteger(command.amount.minor) ||
      command.amount.minor <= 0
    )
      throw new Error(
        "Refund amount must be a positive safe integer minor-unit value.",
      );
    if (!/^[A-Z]{3}$/.test(command.amount.currency))
      throw new Error("Refund currency must be an ISO 4217 uppercase code.");
    if (!command.orderId || !command.idempotencyKey || !command.reason)
      throw new Error(
        "Refund command requires order, reason, and idempotency key.",
      );
    const fingerprint = refundFingerprint(command);
    if (fingerprint !== command.fingerprint)
      throw new Error("Refund command fingerprint was tampered with.");
    const tx = await this.client.transaction("write");
    try {
      const approval = await tx.execute({
        sql: "SELECT data FROM support_cases WHERE id = ?",
        args: [command.approvalCaseId],
      });
      const approvedCase = approval.rows[0]
        ? (JSON.parse(String(approval.rows[0].data)) as {
            approval?: { approved?: boolean };
            customer?: { email?: string };
            draft?: { requiresEscalation?: boolean };
            metadata?: {
              ownerId?: string;
              providerBinding?: unknown;
              providerBindings?: { support?: unknown };
              refundCommand?: { fingerprint?: string };
              nativeApproval?: {
                runId?: string;
                toolCallId?: string;
                fingerprint?: string;
                turnId?: string;
              };
            };
          })
        : undefined;
      const action = await tx.execute({
        sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = ? AND fingerprint = ?",
        args: [command.approvalCaseId, "refund-command", fingerprint],
      });
      const approvedAction = action.rows[0]
        ? JSON.parse(String(action.rows[0].data))
        : undefined;
      const native = approvedCase?.metadata?.nativeApproval;
      if (
        !native?.runId ||
        !native.toolCallId ||
        !hasNativeRefundExecutionAuthorization(authorization, {
          nativeRunId: native.runId,
          nativeToolCallId: native.toolCallId,
          commandFingerprint: command.fingerprint,
          caseId: command.approvalCaseId,
        })
      )
        throw new Error(
          "Refund execution requires the approved native refund tool context.",
        );
      const decision = native?.turnId
        ? await tx.execute({
            sql: "SELECT command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved FROM support_decisions WHERE case_id = ? AND turn_id = ? AND command_fingerprint = ?",
            args: [command.approvalCaseId, native.turnId, command.fingerprint],
          })
        : undefined;
      const decisionRow = decision?.rows[0] as
        Record<string, unknown> | undefined;
      if (
        !approvedCase?.approval?.approved ||
        !matchesPersistedRefundCommand(approvedAction, command) ||
        !native?.runId ||
        !native.toolCallId ||
        native.fingerprint !== command.fingerprint ||
        !decisionRow ||
        Number(decisionRow.approved) !== 1 ||
        String(decisionRow.command_fingerprint) !== command.fingerprint ||
        String(decisionRow.native_run_id) !== native.runId ||
        String(decisionRow.native_tool_call_id) !== native.toolCallId ||
        !activePrincipalHasRole(
          String(decisionRow.principal_id),
          command.binding.tenantId,
          "approver",
        )
      )
        throw new Error(
          "Refund execution requires a current authorized native decision bound to the immutable command.",
        );
      if (
        authorization!.turnId !== native.turnId ||
        authorization!.caseId !== command.approvalCaseId ||
        approvedCase?.draft?.requiresEscalation ||
        exceedsStandardRefundReviewLimit(command.amount)
      )
        throw new Error(
          "Refund execution is not permitted by the current deterministic policy.",
        );
      const durableLease = await tx.execute({
        sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
        args: [
          authorization!.dispatchId,
          command.approvalCaseId,
          authorization!.turnId,
          authorization!.leaseToken,
          new Date().toISOString(),
        ],
      });
      if (!durableLease.rows[0])
        throw new Error(
          "Refund execution requires the current durable workflow dispatch lease.",
        );
      const replay = await tx.execute({
        sql: "SELECT fingerprint, effect FROM support_idempotency WHERE idempotency_key = ?",
        args: [command.idempotencyKey],
      });
      if (replay.rows[0]) {
        if (text(replay.rows[0].fingerprint) !== fingerprint)
          throw new Error(
            "Idempotency key was reused with a conflicting refund command.",
          );
        const effect = JSON.parse(text(replay.rows[0].effect)) as RefundEffect;
        if (isFinancialRetentionTombstone(effect))
          throw new Error(
            "A retained terminal financial tombstone blocks replay or a new provider effect.",
          );
        await tx.rollback();
        return { ...effect, replayed: true };
      }
      // This is deliberately below exact idempotency reconciliation and above
      // every provider-effect insert. A completed command can always be
      // projected once; a new effect cannot rely on evidence that expired or
      // was superseded while native approval was suspended.
      await assertRefundPolicyEvidenceAtFirstEffect(tx, command, native.turnId);
      const orderRows = await tx.execute({
        sql: "SELECT * FROM local_orders WHERE tenant_id = ? AND provider_account_id = ? AND order_id = ?",
        args: [
          command.binding.tenantId,
          command.binding.providerAccountId,
          command.orderId,
        ],
      });
      const order = orderRows.rows[0] as Record<string, unknown> | undefined;
      if (!order)
        throw new Error(
          `Cannot issue refund: order ${command.orderId} not found.`,
        );
      const email = approvedCase?.customer?.email;
      const persistedSupportBinding = providerBindingSchema.safeParse(
        approvedCase?.metadata?.providerBindings?.support ??
          approvedCase?.metadata?.providerBinding,
      );
      const verifiedOwner = persistedSupportBinding.success
        ? await canonicalConversationOwner(tx, {
            caseId: command.approvalCaseId,
            binding: persistedSupportBinding.data,
          })
        : undefined;
      if (
        !verifiedOwner ||
        approvedCase?.metadata?.ownerId !== verifiedOwner ||
        typeof email !== "string" ||
        email.length === 0 ||
        text(order.customer_email).toLowerCase() !== email.toLowerCase()
      )
        throw new VerifiedRefundOwnerRejectedError();
      if (text(order.currency) !== command.amount.currency)
        throw new Error("Refund currency does not match the original charge.");
      const prior = await tx.execute({
        sql: "SELECT COALESCE(SUM(amount_minor), 0) AS total FROM local_refunds WHERE tenant_id = ? AND provider_account_id = ? AND order_id = ?",
        args: [
          command.binding.tenantId,
          command.binding.providerAccountId,
          command.orderId,
        ],
      });
      if (
        Number(prior.rows[0]?.total ?? 0) + command.amount.minor >
        Number(order.amount_minor)
      )
        throw new Error("Refund exceeds the remaining balance.");
      const executedAt = new Date().toISOString();
      const effect: RefundEffect = {
        refundId: `REF-${crypto.randomUUID()}`,
        orderId: command.orderId,
        amount: command.amount,
        idempotencyKey: command.idempotencyKey,
        executedAt,
        replayed: false,
      };
      await tx.execute({
        sql: "INSERT INTO local_refunds VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          effect.refundId,
          command.binding.tenantId,
          command.binding.providerAccountId,
          command.orderId,
          command.amount.minor,
          command.amount.currency,
          command.reason,
          executedAt,
        ],
      });
      await tx.execute({
        sql: "INSERT INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
        args: [
          command.idempotencyKey,
          fingerprint,
          JSON.stringify(effect),
          executedAt,
        ],
      });
      await tx.commit();
      return effect;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async quoteSubscriptionCredit(command: SubscriptionCreditCommand) {
    await this.ensured();
    const fingerprint = subscriptionCreditFingerprint(command);
    if (fingerprint !== command.fingerprint)
      throw new Error(
        "Subscription credit command fingerprint was tampered with.",
      );
    const caseRow = await this.client.execute({
      sql: "SELECT data FROM support_cases WHERE id = ?",
      args: [command.approvalCaseId],
    });
    const customerEmail = caseRow.rows[0]
      ? (
          JSON.parse(String(caseRow.rows[0].data)) as {
            customer?: { email?: string };
          }
        ).customer?.email
      : undefined;
    const subscription = await this.findSubscription(
      command.binding,
      customerEmail ?? "",
    );
    if (
      !subscription ||
      subscription.subscriptionId !== command.subscriptionId ||
      subscription.customerId !== command.customerId ||
      subscription.status !== "active" ||
      subscription.cancelAtPeriodEnd ||
      subscription.recurringInterval !== "month" ||
      subscription.recurringIntervalCount !== 1 ||
      subscription.quantity !== 1 ||
      subscription.amount.currency !== command.amount.currency ||
      subscription.amount.minor !== command.amount.minor
    )
      throw new Error(
        "Subscription credit requires one verified active monthly subscription with its exact monthly charge.",
      );
    const prior = await this.client.execute({
      sql: "SELECT 1 FROM local_subscription_credits WHERE tenant_id = ? AND provider_account_id = ? AND customer_id = ? AND subscription_id = ? LIMIT 1",
      args: [
        command.binding.tenantId,
        command.binding.providerAccountId,
        command.customerId,
        command.subscriptionId,
      ],
    });
    if (prior.rows[0])
      throw new Error(
        "A prior subscription credit exists for this customer and subscription and requires specialist review.",
      );
    return {
      approvedAmount: command.amount,
      commandFingerprint: fingerprint,
    };
  }
  async issueSubscriptionCredit(
    command: SubscriptionCreditCommand,
    authorization?: NativeRefundExecutionAuthorization,
  ): Promise<SubscriptionCreditEffect> {
    await this.ensured();
    if (
      !Number.isSafeInteger(command.amount.minor) ||
      command.amount.minor <= 0 ||
      subscriptionCreditFingerprint(command) !== command.fingerprint
    )
      throw new Error(
        "Subscription credit command was invalid or tampered with.",
      );
    const tx = await this.client.transaction("write");
    try {
      const row = await tx.execute({
        sql: "SELECT data FROM support_cases WHERE id = ?",
        args: [command.approvalCaseId],
      });
      const supportCase = row.rows[0]
        ? (JSON.parse(String(row.rows[0].data)) as {
            approval?: {
              approved?: boolean;
              serviceProblemConfirmed?: true;
            };
            customer?: { email?: string };
            draft?: { requiresEscalation?: boolean };
            metadata?: {
              ownerId?: string;
              nativeApproval?: {
                runId?: string;
                toolCallId?: string;
                fingerprint?: string;
                turnId?: string;
              };
            };
          })
        : undefined;
      const native = supportCase?.metadata?.nativeApproval;
      const action = await tx.execute({
        sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = ? AND fingerprint = ?",
        args: [
          command.approvalCaseId,
          "subscription-credit-command",
          command.fingerprint,
        ],
      });
      const decision = native?.turnId
        ? await tx.execute({
            sql: "SELECT command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved FROM support_decisions WHERE case_id = ? AND turn_id = ? AND command_fingerprint = ?",
            args: [command.approvalCaseId, native.turnId, command.fingerprint],
          })
        : undefined;
      const decisionRow = decision?.rows[0] as
        Record<string, unknown> | undefined;
      if (
        !supportCase?.approval?.approved ||
        !native?.runId ||
        !native.toolCallId ||
        native.fingerprint !== command.fingerprint ||
        !hasNativeRefundExecutionAuthorization(authorization, {
          nativeRunId: native.runId,
          nativeToolCallId: native.toolCallId,
          commandFingerprint: command.fingerprint,
          caseId: command.approvalCaseId,
        }) ||
        !matchesPersistedSubscriptionCreditCommand(
          action.rows[0] ? JSON.parse(String(action.rows[0].data)) : undefined,
          command,
        ) ||
        !decisionRow ||
        Number(decisionRow.approved) !== 1 ||
        String(decisionRow.command_fingerprint) !== command.fingerprint ||
        String(decisionRow.native_run_id) !== native.runId ||
        String(decisionRow.native_tool_call_id) !== native.toolCallId ||
        !activePrincipalHasRole(
          String(decisionRow.principal_id),
          command.binding.tenantId,
          "approver",
        ) ||
        authorization?.turnId !== native.turnId ||
        supportCase.draft?.requiresEscalation
      )
        throw new Error(
          "Subscription credit requires the authorized native decision and immutable command.",
        );
      const lease = await tx.execute({
        sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
        args: [
          authorization!.dispatchId,
          command.approvalCaseId,
          authorization!.turnId,
          authorization!.leaseToken,
          new Date().toISOString(),
        ],
      });
      if (!lease.rows[0])
        throw new Error(
          "Subscription credit requires the current durable workflow dispatch lease.",
        );
      const replay = await tx.execute({
        sql: "SELECT fingerprint, effect FROM support_idempotency WHERE idempotency_key = ?",
        args: [command.idempotencyKey],
      });
      if (replay.rows[0]) {
        if (text(replay.rows[0].fingerprint) !== command.fingerprint)
          throw new Error(
            "Idempotency key was reused with a conflicting subscription credit command.",
          );
        const effect = JSON.parse(
          text(replay.rows[0].effect),
        ) as SubscriptionCreditEffect;
        if (isFinancialRetentionTombstone(effect))
          throw new Error(
            "A retained terminal financial tombstone blocks replay or a new provider effect.",
          );
        await tx.rollback();
        return { ...effect, replayed: true };
      }
      // The confirmation is required only to create a new effect. An existing
      // idempotent effect above remains recoverable after an application
      // upgrade, without manufacturing a new approval decision.
      if (!supportCase.approval?.serviceProblemConfirmed)
        throw new Error(
          "Subscription credit requires the approver to confirm the reported service problem.",
        );
      await assertRefundPolicyEvidenceAtFirstEffect(tx, command, native.turnId);
      const subscriptionRows = await tx.execute({
        sql: "SELECT * FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ? AND subscription_id = ?",
        args: [
          command.binding.tenantId,
          command.binding.providerAccountId,
          command.subscriptionId,
        ],
      });
      const subscription = subscriptionRows.rows[0] as
        Record<string, unknown> | undefined;
      const email = supportCase.customer?.email?.toLowerCase();
      if (
        !subscription ||
        !email ||
        text(subscription.customer_email).toLowerCase() !== email ||
        command.customerId !== `local:${command.binding.tenantId}:${email}` ||
        text(subscription.status) !== "active" ||
        Number(subscription.cancel_at_period_end) === 1 ||
        text(subscription.recurring_interval) !== "month" ||
        Number(subscription.recurring_interval_count) !== 1 ||
        Number(subscription.quantity) !== 1 ||
        text(subscription.currency) !== command.amount.currency ||
        Number(subscription.amount_minor) !== command.amount.minor
      )
        throw new Error(
          "Subscription credit requires an exact verified active monthly subscription.",
        );
      const priorCredit = await tx.execute({
        sql: "SELECT 1 FROM local_subscription_credits WHERE tenant_id = ? AND provider_account_id = ? AND customer_id = ? AND subscription_id = ? LIMIT 1",
        args: [
          command.binding.tenantId,
          command.binding.providerAccountId,
          command.customerId,
          command.subscriptionId,
        ],
      });
      if (priorCredit.rows[0])
        throw new Error(
          "A prior subscription credit exists for this customer and subscription and requires specialist review.",
        );
      const executedAt = new Date().toISOString();
      const effect: SubscriptionCreditEffect = {
        creditId: `CR-${crypto.randomUUID()}`,
        customerId: command.customerId,
        subscriptionId: command.subscriptionId,
        amount: command.amount,
        idempotencyKey: command.idempotencyKey,
        executedAt,
        replayed: false,
        status: "succeeded",
        providerStatus: "created",
      };
      await tx.execute({
        sql: "INSERT INTO local_subscription_credits VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          effect.creditId,
          command.binding.tenantId,
          command.binding.providerAccountId,
          effect.customerId,
          effect.subscriptionId,
          effect.amount.minor,
          effect.amount.currency,
          command.reason,
          executedAt,
        ],
      });
      await tx.execute({
        sql: "INSERT INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
        args: [
          command.idempotencyKey,
          command.fingerprint,
          JSON.stringify(effect),
          executedAt,
        ],
      });
      await tx.commit();
      return effect;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async retrieveSubscriptionCredit(command: SubscriptionCreditCommand) {
    const replay = await this.client.execute({
      sql: "SELECT fingerprint, effect FROM support_idempotency WHERE idempotency_key = ?",
      args: [command.idempotencyKey],
    });
    const row = replay.rows[0] as Record<string, unknown> | undefined;
    if (!row || text(row.fingerprint) !== command.fingerprint) return undefined;
    const effect = JSON.parse(text(row.effect)) as SubscriptionCreditEffect;
    return effect.creditId && effect.subscriptionId === command.subscriptionId
      ? { ...effect, replayed: true }
      : undefined;
  }
  async scheduleSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
  ): Promise<SubscriptionCancellationEffect> {
    await this.ensured();
    const supportCase = await caseStore.get(command.caseId);
    const owner = supportCase
      ? await caseStore.canonicalConversationOwner({
          caseId: command.caseId,
          binding: bindingsForCase(supportCase).support,
        })
      : undefined;
    if (
      !supportCase ||
      !owner ||
      supportCase.metadata.ownerId !== owner ||
      command.ownerId !== owner ||
      command.cancellationMode !== "period_end" ||
      !structurallyEqual(
        bindingsForCase(supportCase).transactions,
        command.binding,
      )
    )
      throw new Error("Cancellation requires the verified case owner.");
    const turn = await caseStore.turn(command.caseId, command.turnId);
    if (
      !turn?.message ||
      turn.message.id !== command.sourceMessageId ||
      createHash("sha256").update(turn.message.body).digest("hex") !==
        command.sourceMessageHash
    )
      throw new Error("Cancellation requires its immutable source message.");
    const trusted = activeTrustedCancellationScope();
    const lease = activeDispatchLeaseScope();
    const immutable = await caseStore.getAction(
      command.caseId,
      "subscription-cancellation-command",
      command.fingerprint,
    );
    if (
      !trusted ||
      !lease ||
      trusted.caseId !== command.caseId ||
      trusted.turnId !== command.turnId ||
      trusted.commandFingerprint !== command.fingerprint ||
      lease.caseId !== command.caseId ||
      lease.turnId !== trusted.turnId ||
      !(await caseStore.hasDispatchLease(lease)) ||
      !structurallyEqual(immutable, command)
    )
      throw new Error(
        "Cancellation requires the trusted current workflow command and lease.",
      );
    const existing = await caseStore.idempotency(command.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== command.fingerprint)
        throw new Error(
          "Idempotency key was reused with another cancellation.",
        );
      return {
        ...(existing.effect as SubscriptionCancellationEffect),
        replayed: true,
      };
    }
    const row = await this.client.execute({
      sql: "SELECT * FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ? AND subscription_id = ? AND lower(customer_email) = lower(?) AND status = 'active' AND cancel_at_period_end = 0",
      args: [
        command.binding.tenantId,
        command.binding.providerAccountId,
        command.subscriptionId,
        supportCase.customer.email,
      ],
    });
    const subscription = row.rows[0] as Record<string, unknown> | undefined;
    if (!subscription)
      throw new Error("Cancellation requires one owned active subscription.");
    const effect: SubscriptionCancellationEffect = {
      subscriptionId: command.subscriptionId,
      cancelAtPeriodEnd: true,
      cancelsAt: text(subscription.renews_at),
      idempotencyKey: command.idempotencyKey,
      replayed: false,
    };
    await this.client.execute({
      sql: "UPDATE local_subscriptions SET cancel_at_period_end = 1, cancels_at = renews_at WHERE tenant_id = ? AND provider_account_id = ? AND subscription_id = ? AND status = 'active' AND cancel_at_period_end = 0",
      args: [
        command.binding.tenantId,
        command.binding.providerAccountId,
        command.subscriptionId,
      ],
    });
    return effect;
  }
  async retrieveSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
  ) {
    await this.ensured();
    const supportCase = await caseStore.get(command.caseId);
    const owner = supportCase
      ? await caseStore.canonicalConversationOwner({
          caseId: command.caseId,
          binding: bindingsForCase(supportCase).support,
        })
      : undefined;
    const turn = await caseStore.turn(command.caseId, command.turnId);
    const immutable = await caseStore.getAction(
      command.caseId,
      "subscription-cancellation-command",
      command.fingerprint,
    );
    if (
      !supportCase ||
      !owner ||
      owner !== command.ownerId ||
      supportCase.metadata.ownerId !== command.ownerId ||
      !turn?.message ||
      turn.message.id !== command.sourceMessageId ||
      createHash("sha256").update(turn.message.body).digest("hex") !==
        command.sourceMessageHash ||
      !structurallyEqual(
        bindingsForCase(supportCase).transactions,
        command.binding,
      ) ||
      !structurallyEqual(immutable, command)
    )
      throw new Error("Cancellation recovery command is no longer authorized.");
    await this.findSubscription(command.binding, supportCase.customer.email);
    const row = await this.client.execute({
      sql: "SELECT renews_at, status, cancel_at_period_end, cancels_at FROM local_subscriptions WHERE tenant_id = ? AND provider_account_id = ? AND subscription_id = ?",
      args: [
        command.binding.tenantId,
        command.binding.providerAccountId,
        command.subscriptionId,
      ],
    });
    const subscription = row.rows[0] as Record<string, unknown> | undefined;
    if (!subscription || Number(subscription.cancel_at_period_end) !== 1)
      return undefined;
    return {
      subscriptionId: command.subscriptionId,
      cancelAtPeriodEnd: true as const,
      cancelsAt: text(subscription.cancels_at ?? subscription.renews_at),
      idempotencyKey: command.idempotencyKey,
      replayed: true,
    };
  }
  async quoteRefund(command: RefundCommand) {
    await this.ensured();
    if (
      !Number.isSafeInteger(command.amount.minor) ||
      command.amount.minor <= 0
    )
      throw new Error(
        "Refund amount must be a positive safe integer minor-unit value.",
      );
    const order = await this.findOrder(command.binding, "", command.orderId);
    if (!order)
      throw new Error(
        `Cannot quote refund: order ${command.orderId} not found.`,
      );
    if (order.amount.currency !== command.amount.currency)
      throw new Error("Refund currency does not match the original charge.");
    const prior = await this.refunds(command.binding, command.orderId);
    const refunded = prior.reduce(
      (total, refund) => total + refund.amount.minor,
      0,
    );
    const remaining = order.amount.minor - refunded;
    if (command.amount.minor > remaining)
      throw new Error("Refund exceeds the remaining balance.");
    return {
      approvedAmount: command.amount,
      remainingAmount: { currency: order.amount.currency, minor: remaining },
      commandFingerprint: refundFingerprint(command),
    };
  }
  async search(
    binding: ProviderBinding,
    query: string,
    topK: number,
  ): Promise<KnowledgeEvidence[]> {
    await this.ensured();
    const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
    const result = await this.client.execute({
      sql: "SELECT * FROM local_knowledge WHERE tenant_id = ? AND provider_account_id = ?",
      args: [binding.tenantId, binding.providerAccountId],
    });
    return result.rows
      .map((row) => {
        const value = row as Record<string, unknown>;
        const haystack =
          `${text(value.title)} ${text(value.text)}`.toLowerCase();
        return {
          title: text(value.title),
          text: text(value.text),
          source: text(value.source),
          version: text(value.version),
          effectiveAt: value.effective_at
            ? text(value.effective_at)
            : undefined,
          expiresAt: value.expires_at ? text(value.expires_at) : undefined,
          score:
            terms.filter((term) => haystack.includes(term)).length /
            Math.max(terms.length, 1),
        };
      })
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
  async listChanged(binding: ProviderBinding) {
    await this.ensured();
    const result = await this.client.execute({
      sql: "SELECT source, version, effective_at FROM local_knowledge WHERE tenant_id = ? AND provider_account_id = ?",
      args: [binding.tenantId, binding.providerAccountId],
    });
    return result.rows.map((row) => ({
      source: text(row.source),
      version: text(row.version),
      changedAt: text(row.effective_at),
    }));
  }
  async fetchDocument(binding: ProviderBinding, source: string) {
    await this.ensured();
    const result = await this.client.execute({
      sql: "SELECT * FROM local_knowledge WHERE tenant_id = ? AND provider_account_id = ? AND source = ?",
      args: [binding.tenantId, binding.providerAccountId, source],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row
      ? {
          title: text(row.title),
          text: text(row.text),
          source: text(row.source),
          version: text(row.version),
          effectiveAt: row.effective_at ? text(row.effective_at) : undefined,
          expiresAt: row.expires_at ? text(row.expires_at) : undefined,
          score: 1,
        }
      : undefined;
  }
}

export const localRuntime = new LocalRuntime();

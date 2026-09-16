import { caseStore } from "../../lib/case-store";
import { createHash } from "node:crypto";
import { activeDispatchLeaseScope } from "../../lib/dispatch-lease-scope";
import {
  hasNativeRefundExecutionAuthorization,
  type NativeRefundExecutionAuthorization,
} from "../native-execution";
import {
  bindingsForCase,
  type CommerceProvider,
  type KnowledgeProvider,
  type ProviderBinding,
  type ProviderRegistry,
  type RefundCommand,
  type SubscriptionCreditCommand,
  type SubscriptionCreditEffect,
  type SubscriptionCancellationCommand,
  type SubscriptionCancellationEffect,
  type SupportChannelProvider,
  type TransactionalActionProvider,
  VerifiedRefundOwnerRejectedError,
} from "../contracts";
import { activePrincipalHasRole } from "../../server/auth";
import { activeTrustedCancellationScope } from "../cancellation-execution";
import { assertRefundPolicyEvidenceAtFirstEffect } from "../../lib/refund-policy-evidence-persistence";
import { isRefundPolicyEvidenceError } from "../../lib/refund-policy-evidence";
import {
  legacyAmountToMoney,
  structurallyEqual,
  subscriptionCreditFingerprint,
} from "../../lib/money";
import { exceedsStandardRefundReviewLimit } from "../../domain/refund-review-limit";
import type { StripeSandboxConfig } from "./config";
import { StripeClient, StripeHttpError } from "./client";

const PROVIDER_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000;

function safeRefundFailureDiagnostic(
  error: unknown,
  stage: "preflight" | "post",
) {
  if (!(error instanceof StripeHttpError)) return { stage };
  return {
    stage,
    ...(error.status >= 100 && error.status <= 599
      ? { status: error.status }
      : {}),
    ambiguity: error.ambiguous,
    ...(error.diagnostic?.code ? { code: error.diagnostic.code } : {}),
    ...(error.diagnostic?.type ? { type: error.diagnostic.type } : {}),
    ...(error.diagnostic?.requestId
      ? { requestId: error.diagnostic.requestId }
      : {}),
  };
}

/** A retryable/possibly-replayed conflict cannot prove that Stripe made no
 * effect. Other non-ambiguous client refusals are terminal and never enter
 * unbounded receipt recovery. */
function isDefiniteCreditNoEffect(error: unknown) {
  return (
    error instanceof StripeHttpError &&
    !error.ambiguous &&
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 409, 429].includes(error.status)
  );
}

/** A failed final fence proves that this worker made no provider mutation.
 * Keep it distinct from an ambiguous transport failure so callers cannot
 * overwrite a newer worker's recovery claim as if a POST had happened. */
class StripeFirstEffectAuthorizationError extends Error {
  constructor() {
    super("Stripe first-effect authorization is no longer current.");
  }
}

class StripePrePostNoEffectError extends Error {
  constructor() {
    super("Stripe subscription credit was refused before the provider POST.");
  }
}

/** Stripe owns only the commerce and transactional ports. Support and
 * knowledge keep their independently persisted bindings. */
export class StripeProviderRegistry
  implements ProviderRegistry, CommerceProvider, TransactionalActionProvider
{
  readonly kind = "stripe" as const;
  private readonly client: StripeClient;
  constructor(
    private readonly config: StripeSandboxConfig,
    fetchImpl?: typeof fetch,
  ) {
    this.client = new StripeClient(config, fetchImpl);
  }
  private assert(binding: ProviderBinding) {
    if (
      binding.providerKind !== "stripe" ||
      binding.tenantId !== this.config.tenantId ||
      binding.providerAccountId !== this.config.accountId
    )
      throw new Error(
        "Stripe binding is not registered for this tenant/account.",
      );
  }
  commerce(binding: ProviderBinding): CommerceProvider {
    this.assert(binding);
    return this;
  }
  transactions(binding: ProviderBinding): TransactionalActionProvider {
    this.assert(binding);
    return this;
  }
  support(_binding: ProviderBinding): SupportChannelProvider {
    throw new Error("Stripe does not provide a support channel port.");
  }
  knowledge(_binding: ProviderBinding): KnowledgeProvider {
    throw new Error("Stripe does not provide a knowledge port.");
  }
  findOrder(binding: ProviderBinding, email: string, orderId?: string) {
    return this.client.findOrder(binding, email, orderId);
  }
  findSubscription(binding: ProviderBinding, email: string) {
    return this.client.findSubscription(binding, email);
  }
  refunds(binding: ProviderBinding, orderId: string) {
    return this.client.refunds(binding, orderId);
  }
  async quoteRefund(command: RefundCommand) {
    const supportCase = await caseStore.get(command.approvalCaseId);
    if (
      !supportCase ||
      bindingsForCase(supportCase).transactions.providerAccountId !==
        command.binding.providerAccountId ||
      bindingsForCase(supportCase).transactions.tenantId !==
        command.binding.tenantId
    )
      throw new Error(
        "Stripe quote requires the case's persisted transaction binding.",
      );
    return this.client.quoteRefund(command, supportCase.customer.email);
  }
  async quoteSubscriptionCredit(command: SubscriptionCreditCommand) {
    const supportCase = await caseStore.get(command.approvalCaseId);
    if (
      !supportCase ||
      !structurallyEqual(
        bindingsForCase(supportCase).transactions,
        command.binding,
      )
    )
      throw new Error(
        "Stripe subscription credit requires the case's persisted transaction binding.",
      );
    return this.client.quoteSubscriptionCredit(
      command,
      supportCase.customer.email,
    );
  }
  async issueSubscriptionCredit(
    command: SubscriptionCreditCommand,
    authorization?: NativeRefundExecutionAuthorization,
  ): Promise<SubscriptionCreditEffect> {
    this.assert(command.binding);
    if (
      !authorization ||
      !hasNativeRefundExecutionAuthorization(authorization, {
        nativeRunId: authorization.nativeRunId,
        nativeToolCallId: authorization.nativeToolCallId,
        commandFingerprint: command.fingerprint,
        caseId: command.approvalCaseId,
      }) ||
      !(await caseStore.hasDispatchLease({
        caseId: command.approvalCaseId,
        turnId: authorization.turnId,
        dispatchId: authorization.dispatchId,
        leaseToken: authorization.leaseToken,
      }))
    )
      throw new Error(
        "Stripe subscription credit requires the approved native tool context and current dispatch lease.",
      );
    const supportCase = await caseStore.get(command.approvalCaseId);
    const native = supportCase?.metadata.nativeApproval;
    const decision = await caseStore.approvalDecision(
      command.approvalCaseId,
      authorization.turnId,
    );
    const immutable = await caseStore.getAction(
      command.approvalCaseId,
      "subscription-credit-command",
      command.fingerprint,
    );
    const evidence = await caseStore.getAction(
      command.approvalCaseId,
      "refund-policy-evidence",
      command.fingerprint,
    );
    if (
      !supportCase?.approval?.approved ||
      !native ||
      native.runId !== authorization.nativeRunId ||
      native.toolCallId !== authorization.nativeToolCallId ||
      native.fingerprint !== command.fingerprint ||
      !decision?.approved ||
      decision.commandFingerprint !== command.fingerprint ||
      !activePrincipalHasRole(
        decision.principalId,
        command.binding.tenantId,
        "approver",
      ) ||
      subscriptionCreditFingerprint(command) !== command.fingerprint ||
      !structurallyEqual(immutable, command) ||
      !evidence ||
      supportCase.draft?.requiresEscalation
    )
      throw new Error(
        "Stripe subscription credit requires the durable authorized decision, immutable command, and policy evidence.",
      );
    const replay = await caseStore.idempotency(command.idempotencyKey);
    if (replay) {
      if (replay.fingerprint !== command.fingerprint)
        throw new Error(
          "Idempotency key was reused with another subscription credit.",
        );
      const effect = replay.effect as SubscriptionCreditEffect;
      if (
        effect.creditId &&
        effect.subscriptionId === command.subscriptionId &&
        effect.customerId === command.customerId
      )
        return { ...effect, replayed: true };
      throw new Error(
        "Subscription credit replay does not match the immutable command.",
      );
    }
    const attempt = await caseStore.prepareStripeSubscriptionCreditAttempt({
      caseId: command.approvalCaseId,
      binding: command.binding,
      customerId: command.customerId,
      subscriptionId: command.subscriptionId,
      fingerprint: command.fingerprint,
      idempotencyKey: command.idempotencyKey,
      dispatchId: authorization.dispatchId,
      leaseToken: authorization.leaseToken,
      turnId: authorization.turnId,
      command,
    });
    const recoverReceipt = async () => {
      const effect = attempt.creditId
        ? await this.client.retrieveSubscriptionCredit(
            command,
            supportCase.customer.email,
            attempt.creditId,
          )
        : await this.client.findSubscriptionCreditReceipt(
            command,
            supportCase.customer.email,
          );
      if (effect)
        await caseStore.updateStripeSubscriptionCreditAttempt(
          command.idempotencyKey,
          {
            status: "succeeded",
            creditId: effect.creditId,
            providerStatus: effect.providerStatus,
          },
        );
      return effect;
    };
    // A prior durable prepare means this native snapshot has already crossed
    // the financial boundary (or crashed immediately before it). Reconcile
    // its immutable receipt only; never turn a bounded Stripe key expiry into
    // a fresh POST.
    if (!attempt.inserted) {
      const persisted = await caseStore.stripeSubscriptionCreditAttempt(
        command.idempotencyKey,
      );
      if (persisted?.providerStatus === "prepost-no-effect") {
        await caseStore.finalizeStripeSubscriptionCreditNoEffectFailure({
          idempotencyKey: command.idempotencyKey,
          fingerprint: command.fingerprint,
          dispatch: {
            dispatchId: authorization.dispatchId,
            leaseToken: authorization.leaseToken,
            turnId: authorization.turnId,
          },
        });
        throw new StripePrePostNoEffectError();
      }
      const recovered = await recoverReceipt();
      if (recovered) return recovered;
      await caseStore.updateStripeSubscriptionCreditAttempt(
        command.idempotencyKey,
        { status: "unknown", providerStatus: "receipt-not-observed" },
      );
      throw new StripeHttpError(0, true);
    }
    let crossedPostBoundary = false;
    try {
      const effect = await this.client.createSubscriptionCredit(
        command,
        supportCase.customer.email,
        async () => {
          let authorized = false;
          try {
            authorized =
              await caseStore.authorizeStripeSubscriptionCreditFirstEffect({
                command,
                dispatch: {
                  caseId: command.approvalCaseId,
                  turnId: authorization.turnId,
                  dispatchId: authorization.dispatchId,
                  leaseToken: authorization.leaseToken,
                },
                validatePolicy: (tx) =>
                  assertRefundPolicyEvidenceAtFirstEffect(
                    tx,
                    command,
                    authorization.turnId,
                  ),
              });
          } catch (error) {
            if (isRefundPolicyEvidenceError(error)) throw error;
          }
          if (!authorized) throw new StripeFirstEffectAuthorizationError();
        },
        () => {
          crossedPostBoundary = true;
        },
      );
      await caseStore.updateStripeSubscriptionCreditAttempt(
        command.idempotencyKey,
        {
          status: "succeeded",
          creditId: effect.creditId,
          providerStatus: effect.providerStatus,
        },
      );
      return effect;
    } catch (error) {
      if (isRefundPolicyEvidenceError(error)) {
        // The policy fence failed before the provider boundary. Quarantine the
        // prepared command as a policy denial; it is not an uncertain Stripe
        // outcome and recovery must not infer that a remote POST may exist.
        await caseStore
          .updateStripeSubscriptionCreditAttempt(command.idempotencyKey, {
            status: "quarantined",
            providerStatus: "pre-dispatch-policy-denied",
          })
          .catch(() => undefined);
        throw error;
      }
      // Every client preflight and the durable final authorization run before
      // this exact marker. Their failures prove that this worker has not sent
      // a provider mutation, even though the recovery record was prepared
      // first. Once marked, retain the conservative receipt-only path: a
      // timeout, 5xx, or malformed response can follow a committed POST.
      if (!crossedPostBoundary || isDefiniteCreditNoEffect(error)) {
        if (!crossedPostBoundary)
          await caseStore
            .markStripeSubscriptionCreditPrePostNoEffect({
              idempotencyKey: command.idempotencyKey,
              fingerprint: command.fingerprint,
              dispatch: {
                dispatchId: authorization.dispatchId,
                leaseToken: authorization.leaseToken,
                turnId: authorization.turnId,
              },
            })
            .catch(() => undefined);
        await caseStore
          .finalizeStripeSubscriptionCreditNoEffectFailure({
            idempotencyKey: command.idempotencyKey,
            fingerprint: command.fingerprint,
            dispatch: {
              dispatchId: authorization.dispatchId,
              leaseToken: authorization.leaseToken,
              turnId: authorization.turnId,
            },
          })
          .catch(() => undefined);
        throw error;
      }
      // Any error after the durable pre-POST record is conservatively
      // uncertain. A malformed/timeout response can still follow a remote
      // effect, so recovery must inspect the provider ledger rather than POST.
      await caseStore
        .updateStripeSubscriptionCreditAttempt(command.idempotencyKey, {
          status: "unknown",
          providerStatus:
            error instanceof StripeHttpError ? "transport" : "uncertain",
        })
        .catch(() => undefined);
      throw error;
    }
  }
  async retrieveSubscriptionCredit(command: SubscriptionCreditCommand) {
    this.assert(command.binding);
    const supportCase = await caseStore.get(command.approvalCaseId);
    if (!supportCase) return undefined;
    const effect = await caseStore.idempotency(command.idempotencyKey);
    if (effect?.fingerprint === command.fingerprint) {
      const saved = effect.effect as SubscriptionCreditEffect;
      if (saved.creditId)
        return this.client.retrieveSubscriptionCredit(
          command,
          supportCase.customer.email,
          saved.creditId,
        );
    }
    const attempt = await caseStore.stripeSubscriptionCreditAttempt(
      command.idempotencyKey,
    );
    if (
      !attempt ||
      attempt.caseId !== command.approvalCaseId ||
      attempt.fingerprint !== command.fingerprint
    )
      return undefined;
    const recovered = attempt.creditId
      ? await this.client.retrieveSubscriptionCredit(
          command,
          supportCase.customer.email,
          attempt.creditId,
        )
      : await this.client.findSubscriptionCreditReceipt(
          command,
          supportCase.customer.email,
        );
    if (recovered)
      await caseStore.updateStripeSubscriptionCreditAttempt(
        command.idempotencyKey,
        {
          status: "succeeded",
          creditId: recovered.creditId,
          providerStatus: recovered.providerStatus,
        },
      );
    return recovered;
  }
  async scheduleSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
  ) {
    this.assert(command.binding);
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
    const replay = await caseStore.idempotency(command.idempotencyKey);
    if (replay) {
      if (replay.fingerprint !== command.fingerprint)
        throw new Error(
          "Idempotency key was reused with another cancellation.",
        );
      const effect = replay.effect as SubscriptionCancellationEffect;
      if (
        effect.subscriptionId !== command.subscriptionId ||
        effect.idempotencyKey !== command.idempotencyKey ||
        effect.cancelAtPeriodEnd !== true
      )
        throw new Error(
          "Cancellation replay does not match its immutable command.",
        );
      return { ...effect, replayed: true };
    }
    // The target/owner checks are preflight reads. Any failure here proves no
    // Stripe mutation was sent, while every failure after this call begins is
    // conservatively treated as potentially committed unless Stripe says it
    // was a non-ambiguous rejection.
    try {
      await this.client.prepareSubscriptionCancellationRequest(
        command,
        supportCase.customer.email,
      );
    } catch (error) {
      await caseStore.finalizeUnknownSubscriptionCancellation({
        idempotencyKey: command.idempotencyKey,
        fingerprint: command.fingerprint,
        status: "failed",
      });
      throw error;
    }
    try {
      return await this.client.createSubscriptionCancellation(
        command,
        async () => {
          if (
            !(await caseStore.authorizeSubscriptionCancellationFirstEffect({
              command,
              dispatch: lease,
            }))
          )
            throw new StripeFirstEffectAuthorizationError();
        },
      );
    } catch (error) {
      if (error instanceof StripeFirstEffectAuthorizationError) throw error;
      if (
        error instanceof StripeHttpError &&
        !error.ambiguous &&
        error.status >= 400 &&
        error.status < 500
      )
        await caseStore.finalizeUnknownSubscriptionCancellation({
          idempotencyKey: command.idempotencyKey,
          fingerprint: command.fingerprint,
          status: "failed",
        });
      throw error;
    }
  }
  async retrieveSubscriptionCancellation(
    command: SubscriptionCancellationCommand,
  ) {
    this.assert(command.binding);
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
      supportCase.metadata.ownerId !== command.ownerId ||
      owner !== command.ownerId ||
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
    return this.client.retrieveSubscriptionCancellation(
      command,
      supportCase.customer.email,
    );
  }
  async issueRefund(
    command: RefundCommand,
    authorization?: NativeRefundExecutionAuthorization,
  ) {
    this.assert(command.binding);
    if (
      !authorization ||
      !hasNativeRefundExecutionAuthorization(authorization, {
        nativeRunId: authorization?.nativeRunId ?? "",
        nativeToolCallId: authorization?.nativeToolCallId ?? "",
        commandFingerprint: command.fingerprint,
        caseId: command.approvalCaseId,
      }) ||
      authorization.caseId !== command.approvalCaseId
    )
      throw new Error(
        "Stripe refund requires the approved native refund tool context.",
      );
    if (
      !(await caseStore.hasDispatchLease({
        caseId: command.approvalCaseId,
        turnId: authorization.turnId,
        dispatchId: authorization.dispatchId,
        leaseToken: authorization.leaseToken,
      }))
    )
      throw new Error(
        "Stripe refund requires the current durable workflow dispatch lease.",
      );
    const supportCase = await caseStore.get(command.approvalCaseId);
    const decision = await caseStore.approvalDecision(
      command.approvalCaseId,
      authorization.turnId,
    );
    const immutable = await caseStore.getAction(
      command.approvalCaseId,
      "refund-command",
      command.fingerprint,
    );
    const policy = (await caseStore.getAction(
      command.approvalCaseId,
      "refund-policy-evidence",
      command.fingerprint,
    )) as
      | {
          turnId?: unknown;
          binding?: Partial<ProviderBinding>;
          citations?: unknown;
        }
      | undefined;
    const expected = {
      binding: command.binding,
      approvalCaseId: command.approvalCaseId,
      orderId: command.orderId,
      amount: command.amount,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      fingerprint: command.fingerprint,
    };
    if (
      !supportCase?.approval?.approved ||
      !decision?.approved ||
      decision.commandFingerprint !== command.fingerprint ||
      decision.nativeRunId !== authorization.nativeRunId ||
      decision.nativeToolCallId !== authorization.nativeToolCallId ||
      !activePrincipalHasRole(
        decision.principalId,
        command.binding.tenantId,
        "approver",
      ) ||
      !structurallyEqual(immutable, expected) ||
      policy?.turnId !== authorization.turnId ||
      policy.binding?.tenantId !== command.binding.tenantId ||
      !Array.isArray(policy.citations) ||
      policy.citations.length === 0
    )
      throw new Error(
        "Stripe refund requires the durable authorized decision, immutable command, and policy evidence.",
      );
    // The ingress-established canonical conversation binding is authority at
    // the first-effect boundary. Email is only a Stripe lookup input.
    const durableOwner = supportCase
      ? await caseStore.canonicalConversationOwner({
          caseId: command.approvalCaseId,
          binding: bindingsForCase(supportCase).support,
        })
      : undefined;
    if (
      !supportCase ||
      !durableOwner ||
      (supportCase.metadata as Record<string, unknown>).ownerId !== durableOwner
    )
      throw new VerifiedRefundOwnerRejectedError();
    if (
      supportCase.draft?.requiresEscalation ||
      exceedsStandardRefundReviewLimit(command.amount)
    )
      throw new Error(
        "Stripe refund is not permitted by the current deterministic policy.",
      );
    // Stripe must apply the same publication/hash/freshness checks as the
    // local provider before its first possible POST. Reconciliation of an
    // existing effect intentionally does not re-open an expired policy.
    const attempt = await caseStore.prepareStripeRefundAttempt({
      caseId: command.approvalCaseId,
      binding: command.binding,
      fingerprint: command.fingerprint,
      idempotencyKey: command.idempotencyKey,
      dispatchId: authorization.dispatchId,
      leaseToken: authorization.leaseToken,
      turnId: authorization.turnId,
      command: expected,
    });
    if (attempt.refundId) {
      const effect = await this.client.retrieveRefund(
        command.binding,
        attempt.refundId,
        command.orderId,
        command.idempotencyKey,
        {
          caseId: command.approvalCaseId,
          fingerprint: command.fingerprint,
          amountMinor: command.amount.minor,
          currency: command.amount.currency,
        },
      );
      await caseStore.updateStripeRefundAttempt(command.idempotencyKey, {
        status:
          effect.status === "failed"
            ? "failed"
            : effect.status === "succeeded"
              ? "succeeded"
              : "pending",
        refundId: effect.refundId,
        providerStatus: effect.providerStatus ?? effect.status,
        nextAttemptAt:
          effect.status === "succeeded"
            ? new Date(Date.now() + 5 * 60_000).toISOString()
            : undefined,
      });
      return this.authoritativeEffect(command.idempotencyKey, effect);
    }
    if (attempt.status !== "prepared" && attempt.status !== "unknown") {
      throw new Error(
        "Stripe refund attempt has no provider refund id and requires manual reconciliation.",
      );
    }
    if (
      Date.now() - Date.parse(attempt.createdAt) >
      PROVIDER_IDEMPOTENCY_WINDOW_MS
    ) {
      await caseStore.updateStripeRefundAttempt(command.idempotencyKey, {
        status: "quarantined",
        providerStatus: "idempotency-window-expired",
      });
      throw new Error(
        "Stripe refund attempt is past the provider idempotency window and is quarantined.",
      );
    }
    let request: Awaited<ReturnType<StripeClient["prepareRefundRequest"]>>;
    try {
      if (!supportCase || supportCase.customer.email.length === 0)
        throw new Error("Stripe refund requires the verified case owner.");
      request =
        attempt.stripeRequest ??
        (attempt.status === "prepared"
          ? await this.client.prepareRefundRequest(
              command,
              supportCase.customer.email,
            )
          : undefined);
      if (!request)
        throw new Error(
          "Stripe unknown attempt is missing its persisted request target.",
        );
      if (!attempt.stripeRequest)
        await caseStore.persistStripeRefundRequest(
          command.idempotencyKey,
          request,
        );
    } catch (error) {
      await caseStore.finalizeStripeRefundNoEffectFailure({
        idempotencyKey: command.idempotencyKey,
        fingerprint: command.fingerprint,
        diagnostic: safeRefundFailureDiagnostic(error, "preflight"),
      });
      throw error;
    }
    try {
      const effect = await this.client.createRefundForRequest(
        command,
        request,
        async () => {
          let authorized = false;
          try {
            authorized = await caseStore.authorizeStripeRefundFirstEffect({
              command,
              request,
              ownerId: durableOwner,
              dispatch: {
                caseId: command.approvalCaseId,
                turnId: authorization.turnId,
                dispatchId: authorization.dispatchId,
                leaseToken: authorization.leaseToken,
              },
              validatePolicy: (tx) =>
                assertRefundPolicyEvidenceAtFirstEffect(
                  tx,
                  command,
                  authorization.turnId,
                ),
            });
          } catch {
            // Policy or durable-read rejection occurs before the provider
            // boundary too. Treat it like a lost fence: this worker cannot
            // close an attempt a later worker may now own.
            authorized = false;
          }
          if (!authorized) throw new StripeFirstEffectAuthorizationError();
        },
      );
      await caseStore.updateStripeRefundAttempt(command.idempotencyKey, {
        status:
          effect.status === "failed"
            ? "failed"
            : effect.status === "succeeded"
              ? "succeeded"
              : "pending",
        refundId: effect.refundId,
        providerStatus: effect.providerStatus ?? effect.status,
      });
      return this.authoritativeEffect(command.idempotencyKey, effect);
    } catch (error) {
      // The durable prepared record retains the exact provider key. Recovery
      // may only reuse it inside Stripe's documented window; it never mints a
      // new POST after an unknown transport outcome.
      if (error instanceof StripeFirstEffectAuthorizationError)
        // A later worker may already own this command or reconciliation claim.
        // No POST happened, so do not transition its attempt on this worker's
        // behalf.
        throw error;
      if (error instanceof StripeHttpError && !error.ambiguous)
        await caseStore.finalizeStripeRefundNoEffectFailure({
          idempotencyKey: command.idempotencyKey,
          fingerprint: command.fingerprint,
          diagnostic: safeRefundFailureDiagnostic(error, "post"),
        });
      else
        await caseStore.updateStripeRefundAttempt(command.idempotencyKey, {
          status: "unknown",
          providerStatus: "unknown",
        });
      throw error;
    }
  }
  /** A webhook can settle the durable row between the Stripe POST receipt and
   * the native tool's projection. The row is authoritative in that race. */
  private async authoritativeEffect(
    idempotencyKey: string,
    effect: Awaited<ReturnType<StripeClient["createRefundForRequest"]>>,
  ) {
    const attempt = await caseStore.stripeRefundAttempt(idempotencyKey);
    if (
      attempt?.refundId === effect.refundId &&
      ["succeeded", "failed", "quarantined"].includes(attempt.status)
    )
      return {
        ...effect,
        status:
          attempt.status === "succeeded"
            ? ("succeeded" as const)
            : ("failed" as const),
        providerStatus: attempt.providerStatus ?? effect.providerStatus,
      };
    return effect;
  }
  async reconcileRefund(
    binding: ProviderBinding,
    input: { refundId: string; orderId: string; idempotencyKey: string },
  ) {
    this.assert(binding);
    const attempt = await caseStore.stripeRefundAttempt(input.idempotencyKey);
    const supportCase = attempt
      ? await caseStore.get(attempt.caseId)
      : undefined;
    const command = attempt?.command as
      | {
          fingerprint?: unknown;
          amount?: { currency?: unknown; minor?: unknown };
          approvalCaseId?: unknown;
          orderId?: unknown;
          idempotencyKey?: unknown;
        }
      | undefined;
    const immutable =
      attempt && supportCase
        ? await caseStore.getAction(
            attempt.caseId,
            "refund-command",
            attempt.fingerprint,
          )
        : undefined;
    if (
      !attempt ||
      !supportCase ||
      typeof command?.fingerprint !== "string" ||
      typeof command.amount?.minor !== "number" ||
      typeof command.amount.currency !== "string" ||
      command.approvalCaseId !== attempt.caseId ||
      command.idempotencyKey !== input.idempotencyKey ||
      command.orderId !== input.orderId ||
      attempt.fingerprint !== command.fingerprint ||
      !structurallyEqual(immutable, command)
    )
      throw new Error(
        "Stripe reconciliation has no matching immutable attempt.",
      );
    const effect = await this.client.retrieveRefund(
      binding,
      input.refundId,
      input.orderId,
      input.idempotencyKey,
      {
        caseId: attempt.caseId,
        fingerprint: command.fingerprint,
        amountMinor: command.amount.minor,
        currency: command.amount.currency,
      },
    );
    return effect;
  }
  /** Retry an uncertain POST solely with its persisted Stripe idempotency key.
   * It cannot mint a command, target a different order, or bypass current
   * owner and policy checks at the first possible provider effect. */
  async recoverUnknownRefund(
    binding: ProviderBinding,
    idempotencyKey: string,
    reconciliationLeaseToken: string,
  ) {
    this.assert(binding);
    const attempt = await caseStore.stripeRefundAttempt(idempotencyKey);
    const supportCase = attempt
      ? await caseStore.get(attempt.caseId)
      : undefined;
    const command = attempt?.command as RefundCommand | undefined;
    const immutable =
      attempt && supportCase
        ? await caseStore.getAction(
            attempt.caseId,
            "refund-command",
            attempt.fingerprint,
          )
        : undefined;
    if (
      !attempt ||
      !supportCase ||
      !command ||
      (attempt.status !== "prepared" && attempt.status !== "unknown") ||
      command.approvalCaseId !== attempt.caseId ||
      command.idempotencyKey !== attempt.idempotencyKey ||
      command.binding.tenantId !== binding.tenantId ||
      command.binding.providerAccountId !== binding.providerAccountId ||
      !structurallyEqual(immutable, command)
    )
      throw new Error(
        "Stripe recovery has no matching immutable unknown attempt.",
      );
    if (
      Date.now() - Date.parse(attempt.createdAt) >
      PROVIDER_IDEMPOTENCY_WINDOW_MS
    )
      throw new Error(
        "Stripe recovery is past the provider idempotency window.",
      );
    const durableOwner = await caseStore.canonicalConversationOwner({
      caseId: attempt.caseId,
      binding: bindingsForCase(supportCase).support,
    });
    if (
      !durableOwner ||
      (supportCase.metadata as Record<string, unknown>).ownerId !== durableOwner
    )
      throw new Error(
        "Stripe recovery requires the current verified case owner.",
      );
    if (
      supportCase.draft?.requiresEscalation ||
      command.amount.minor >
        legacyAmountToMoney(1000, command.amount.currency).minor
    )
      throw new Error(
        "Stripe recovery is not permitted by the current deterministic policy.",
      );
    const request = attempt.stripeRequest as
      { paymentIntentId?: unknown; providerRefs?: unknown } | undefined;
    if (
      !request ||
      typeof request.paymentIntentId !== "string" ||
      !Array.isArray(request.providerRefs)
    )
      throw new Error("Stripe recovery has no persisted request target.");
    const exactRequest = {
      paymentIntentId: request.paymentIntentId,
      providerRefs:
        request.providerRefs as import("../contracts").ProviderRef[],
    };
    return this.client.createRefundForRequest(
      command,
      exactRequest,
      async () => {
        let authorized = false;
        try {
          authorized = await caseStore.authorizeStripeRefundFirstEffect({
            command,
            request: exactRequest,
            ownerId: durableOwner,
            reconciliationLeaseToken,
            validatePolicy: (tx) =>
              assertRefundPolicyEvidenceAtFirstEffect(
                tx,
                command,
                attempt.turnId ?? "",
              ),
          });
        } catch {
          authorized = false;
        }
        if (!authorized) throw new StripeFirstEffectAuthorizationError();
      },
    );
  }
}

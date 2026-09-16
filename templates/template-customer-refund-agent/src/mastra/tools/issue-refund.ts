import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { caseStore } from "../lib/case-store";
import { activeDispatchLeaseScope } from "../lib/dispatch-lease-scope";
import {
  legacyAmountToMoney,
  moneyToLegacyAmount,
  refundFingerprint,
} from "../lib/money";
import { bindingsForPersistedCase } from "../runtime/provider-bindings";
import {
  ensureProviderFixtures,
  providerRegistry,
  resolveConfiguredBinding,
} from "../providers/registry";
import { withNativeRefundExecutionAuthorization } from "../providers/native-execution";
import { activePrincipalHasRole } from "../server/auth";
import { traceOperationalPort } from "../lib/operational-spans";
import { isRefundPolicyEvidenceError } from "../lib/refund-policy-evidence";
import { persistedRefundCommandSchema } from "../domain/refund-command";
import { VerifiedRefundOwnerRejectedError } from "../providers/contracts";

/**
 * An exception alone cannot prove a financial effect failed: a transport can
 * break after the provider commits. Only deterministic provider rejections
 * are financial failures; all other no-effect observations remain durable
 * uncertainty for recovery/staff review without raising a false refund alert.
 */
function isConfirmedRefundFailure(error: unknown) {
  return /\b(?:400|401|403|404|409|422)\b|permanent|rejected|invalid|not found|exceeds the remaining balance|currency does not match/i.test(
    String(error),
  );
}

export const refundExecutionInputSchema = z.object({
  caseId: z.string(),
  orderId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  reason: z.string(),
  idempotencyKey: z.string(),
  fingerprint: z.string(),
});

/**
 * The Phase-003 financial boundary: the native approved tool context, durable
 * decision, immutable command, and current approver role must all agree.
 */
export const issueRefundTool = createTool({
  id: "issue_refund",
  description: "Execute the already-approved persisted local refund command.",
  inputSchema: refundExecutionInputSchema,
  outputSchema: z.object({
    refundId: z.string(),
    orderId: z.string(),
    amount: z.number(),
    currency: z.string(),
    status: z.enum(["executed", "skipped", "pending", "failed"]),
    idempotencyKey: z.string(),
    executedAt: z.string(),
  }),
  requireApproval: true,
  execute: async (input, context) => {
    const supportCase = await caseStore.get(input.caseId);
    if (!supportCase?.approval?.approved)
      throw new Error(
        "A persisted approved local decision is required before issuing a refund.",
      );
    const lease = activeDispatchLeaseScope();
    if (
      !lease ||
      lease.caseId !== input.caseId ||
      !(await caseStore.hasDispatchLease(lease))
    )
      throw new Error(
        "Refund execution requires the current durable workflow dispatch lease.",
      );
    const decision = await caseStore.approvalDecision(
      input.caseId,
      supportCase.metadata.nativeApproval?.turnId,
    );
    const native = supportCase.metadata.nativeApproval;
    const decisionBinding = bindingsForPersistedCase(supportCase).transactions;
    if (
      !decision?.approved ||
      decision.commandFingerprint !== input.fingerprint ||
      decision.nativeRunId !== native?.runId ||
      decision.nativeToolCallId !== native?.toolCallId ||
      native?.fingerprint !== input.fingerprint ||
      !activePrincipalHasRole(
        decision.principalId,
        decisionBinding.tenantId,
        "approver",
      )
    )
      throw new Error(
        "Refund execution requires a current authorized decision bound to the native tool call.",
      );
    const stored = persistedRefundCommandSchema.safeParse(
      supportCase.metadata.refundCommand,
    );
    if (!stored.success)
      throw new Error("The persisted refund command is missing.");
    const command = stored.data;
    const bindings = bindingsForPersistedCase(supportCase);
    if (
      command.approvalCaseId !== input.caseId ||
      command.orderId !== input.orderId ||
      command.amount !== input.amount ||
      command.currency !== input.currency ||
      command.reason !== input.reason ||
      command.idempotencyKey !== input.idempotencyKey ||
      command.fingerprint !== input.fingerprint
    )
      throw new Error(
        "Refund execution must exactly match the persisted command.",
      );
    const amount = legacyAmountToMoney(command.amount, command.currency);
    const expected = refundFingerprint({
      binding: bindings.transactions,
      approvalCaseId: input.caseId,
      orderId: command.orderId,
      amount,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
    });
    if (expected !== command.fingerprint)
      throw new Error("The persisted refund command fingerprint is invalid.");
    const binding = resolveConfiguredBinding(bindings.transactions);
    await ensureProviderFixtures(binding);
    let effect;
    try {
      effect = await withNativeRefundExecutionAuthorization(
        context,
        native,
        command.fingerprint,
        (authorization) =>
          traceOperationalPort({
            mastra: context?.mastra,
            tracingContext: context?.tracingContext,
            kind: "provider",
            operation: "transactions.issue_refund",
            run: () =>
              providerRegistry(binding).transactions(binding).issueRefund(
                {
                  binding,
                  approvalCaseId: input.caseId,
                  orderId: command.orderId,
                  amount,
                  reason: command.reason,
                  idempotencyKey: command.idempotencyKey,
                  fingerprint: command.fingerprint,
                },
                authorization,
              ),
          }),
      );
    } catch (error) {
      // A transport error is not proof that the provider did not commit. The
      // local idempotency record is the durable fact used by recovery; do not
      // permanently report a financial failure when it already exists.
      const durable = await caseStore.idempotency(command.idempotencyKey);
      const attempt = await caseStore.stripeRefundAttempt(
        command.idempotencyKey,
      );
      if (!durable && attempt?.status !== "failed") {
        const policyEvidenceRejected = isRefundPolicyEvidenceError(error);
        // A prior uncertain attempt may already represent a remote Stripe
        // effect. Only this invocation's owner rejection with no attempt is
        // proven pre-effect; later drift must remain receipt-only recovery.
        const ownerRejected =
          error instanceof VerifiedRefundOwnerRejectedError && !attempt;
        const confirmed = ownerRejected || isConfirmedRefundFailure(error);
        await caseStore.saveAction(
          input.caseId,
          policyEvidenceRejected
            ? "refund-policy-evidence-rejected"
            : confirmed
              ? "refund-failure"
              : "refund-uncertain",
          command.fingerprint,
          {
            category: policyEvidenceRejected ? "policy" : "provider",
            classification: policyEvidenceRejected
              ? "requires-review"
              : ownerRejected
                ? "confirmed-no-effect"
                : confirmed
                  ? "confirmed-failed"
                  : "uncertain",
            ...(ownerRejected
              ? {
                  reason:
                    "The persisted canonical conversation owner no longer matches the case.",
                }
              : {}),
            failedAt: new Date().toISOString(),
          },
        );
      }
      throw error;
    }
    const result = {
      refundId: effect.refundId,
      orderId: effect.orderId,
      amount: moneyToLegacyAmount(effect.amount),
      currency: effect.amount.currency,
      status:
        effect.status === "failed"
          ? ("failed" as const)
          : effect.status === "pending" || effect.status === "unknown"
            ? ("pending" as const)
            : effect.replayed
              ? ("skipped" as const)
              : ("executed" as const),
      idempotencyKey: effect.idempotencyKey,
      executedAt: effect.executedAt,
    };
    // A direct terminal failure returned by Stripe has the same authoritative
    // ledger/case/outbox boundary as a signed late failure. Finalize it before
    // the native receipt is projected, then let the transaction below return
    // that durable failed projection without recreating an effect.
    if (effect.status === "failed")
      await caseStore.finalizeStripeRefundReconciliation({
        idempotencyKey: command.idempotencyKey,
        status: "failed",
        refundId: effect.refundId,
        providerStatus: effect.providerStatus ?? effect.status,
        effect,
      });
    // A webhook can terminalize the immutable Stripe attempt after the
    // provider returns but before this native tool writes its projection.
    // Read that ledger and the current case in one transaction with any new
    // success effect, so a stale receipt cannot recreate an issued/pending
    // projection or an executable replay record after late failure.
    const projected = await caseStore.projectRefundToolExecution({
      caseId: input.caseId,
      turnId: native.turnId!,
      fingerprint: command.fingerprint,
      idempotencyKey: command.idempotencyKey,
      result,
      ...(effect.status === "succeeded" ? { effect } : {}),
    });
    if (effect.status === "failed")
      await caseStore.saveAction(
        input.caseId,
        "refund-failure",
        command.fingerprint,
        {
          category: "provider",
          classification: "confirmed-failed",
          refundId: effect.refundId,
          observedAt: effect.executedAt,
        },
      );
    return projected;
  },
});

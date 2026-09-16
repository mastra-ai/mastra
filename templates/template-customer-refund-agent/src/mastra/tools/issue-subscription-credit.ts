import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { persistedSubscriptionCreditCommandSchema } from "../domain/subscription-credit-command";
import { caseStore } from "../lib/case-store";
import { activeDispatchLeaseScope } from "../lib/dispatch-lease-scope";
import {
  legacyAmountToMoney,
  moneyToLegacyAmount,
  subscriptionCreditFingerprint,
} from "../lib/money";
import { traceOperationalPort } from "../lib/operational-spans";
import { withNativeRefundExecutionAuthorization } from "../providers/native-execution";
import {
  ensureProviderFixtures,
  providerRegistry,
  resolveConfiguredBinding,
} from "../providers/registry";
import { bindingsForPersistedCase } from "../runtime/provider-bindings";
import { activePrincipalHasRole } from "../server/auth";

export const subscriptionCreditExecutionInputSchema = z.object({
  caseId: z.string(),
  customerId: z.string(),
  subscriptionId: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  reason: z.string(),
  idempotencyKey: z.string(),
  fingerprint: z.string(),
});

/** Native financial tool for a balance credit. The receipt means the credit
 * exists for future billing; it never says that an invoice is already paid. */
export const issueSubscriptionCreditTool = createTool({
  id: "issue_subscription_credit",
  description:
    "Create the already-approved one-month customer billing credit after human confirmation of the reported service problem.",
  inputSchema: subscriptionCreditExecutionInputSchema,
  outputSchema: z.object({
    creditId: z.string(),
    customerId: z.string(),
    subscriptionId: z.string(),
    amount: z.number(),
    currency: z.string(),
    status: z.enum(["executed", "skipped", "pending", "failed"]),
    idempotencyKey: z.string(),
    executedAt: z.string(),
  }),
  requireApproval: true,
  execute: async (input, context) => {
    const supportCase = await caseStore.get(input.caseId);
    const native = supportCase?.metadata.nativeApproval;
    const lease = activeDispatchLeaseScope();
    const decision = await caseStore.approvalDecision(
      input.caseId,
      native?.turnId,
    );
    if (
      !supportCase?.approval?.approved ||
      !native ||
      !lease ||
      lease.caseId !== input.caseId ||
      !(await caseStore.hasDispatchLease(lease)) ||
      !decision?.approved ||
      decision.commandFingerprint !== input.fingerprint ||
      decision.nativeRunId !== native.runId ||
      decision.nativeToolCallId !== native.toolCallId ||
      native.fingerprint !== input.fingerprint ||
      !activePrincipalHasRole(
        decision.principalId,
        bindingsForPersistedCase(supportCase).transactions.tenantId,
        "approver",
      )
    )
      throw new Error(
        "Subscription credit execution requires a current authorized decision bound to the native tool call.",
      );
    const parsed = persistedSubscriptionCreditCommandSchema.safeParse(
      supportCase.metadata.subscriptionCreditCommand,
    );
    if (!parsed.success)
      throw new Error("The persisted subscription credit command is missing.");
    const command = parsed.data;
    if (
      command.approvalCaseId !== input.caseId ||
      command.customerId !== input.customerId ||
      command.subscriptionId !== input.subscriptionId ||
      command.amount !== input.amount ||
      command.currency !== input.currency ||
      command.reason !== input.reason ||
      command.idempotencyKey !== input.idempotencyKey ||
      command.fingerprint !== input.fingerprint
    )
      throw new Error(
        "Subscription credit execution must exactly match the persisted command.",
      );
    const amount = legacyAmountToMoney(command.amount, command.currency);
    const binding = resolveConfiguredBinding(
      bindingsForPersistedCase(supportCase).transactions,
    );
    const expected = subscriptionCreditFingerprint({
      binding,
      approvalCaseId: command.approvalCaseId,
      customerId: command.customerId,
      subscriptionId: command.subscriptionId,
      amount,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
    });
    if (expected !== command.fingerprint)
      throw new Error(
        "The persisted subscription credit command fingerprint is invalid.",
      );
    await ensureProviderFixtures(binding);
    const effect = await withNativeRefundExecutionAuthorization(
      context,
      native,
      command.fingerprint,
      (authorization) =>
        traceOperationalPort({
          mastra: context?.mastra,
          tracingContext: context?.tracingContext,
          kind: "provider",
          operation: "transactions.issue_subscription_credit",
          run: () =>
            providerRegistry(binding)
              .transactions(binding)
              .issueSubscriptionCredit(
                {
                  binding,
                  approvalCaseId: command.approvalCaseId,
                  customerId: command.customerId,
                  subscriptionId: command.subscriptionId,
                  amount,
                  reason: command.reason,
                  idempotencyKey: command.idempotencyKey,
                  fingerprint: command.fingerprint,
                },
                authorization,
              ),
        }),
    );
    const result = {
      creditId: effect.creditId,
      customerId: effect.customerId,
      subscriptionId: effect.subscriptionId,
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
    return caseStore.projectSubscriptionCreditToolExecution({
      caseId: input.caseId,
      turnId: native.turnId,
      fingerprint: command.fingerprint,
      idempotencyKey: command.idempotencyKey,
      result,
      effect,
    });
  },
});

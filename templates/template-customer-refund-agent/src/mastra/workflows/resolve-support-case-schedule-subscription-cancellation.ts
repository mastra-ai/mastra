import { createStep } from "@mastra/core/workflows";
import { triageEscalationReason } from "../domain/resolution-decision";
import { caseStore } from "../lib/case-store";
import { withTrustedCancellationScope } from "../providers/cancellation-execution";
import { resolveConfiguredBinding } from "../providers/registry";
import { bindingsForPersistedCase } from "../runtime/provider-bindings";
import { cancellationFingerprint } from "../tools/schedule-subscription-cancellation";
import {
  cancellationAuthority,
  cancellationMessageHash,
} from "./staging-cancellation-authority";
import {
  getActiveCaseOrThrow,
  resolveSupportCaseInputSchema,
} from "./resolve-support-case-context";

export { explicitNoRefundCancellation } from "./staging-cancellation-authority";

export const scheduleCancellationStep = createStep({
  id: "schedule-subscription-cancellation",
  description:
    "Schedules only an explicit verified-owner no-refund cancellation at period end.",
  inputSchema: resolveSupportCaseInputSchema,
  outputSchema: resolveSupportCaseInputSchema,
  execute: async ({ inputData, mastra, requestContext, tracingContext }) => {
    const { supportCase, turn, ownerId } = await getActiveCaseOrThrow(
      inputData.caseId,
      inputData.turnId,
    );
    if (supportCase.triage?.intent !== "cancellation") return inputData;
    const subscription = supportCase.subscriptionLookup?.subscription;
    // Triage and the grounded writer decide whether this turn needs staff
    // review before any provider effect is considered. Finalization repeats
    // this decision for its response, but it is too late to use it as the
    // first effect fence: a cancellation POST must never precede escalation.
    const escalationReason =
      triageEscalationReason(supportCase.triage) ??
      supportCase.draft?.escalationReason;
    if (
      escalationReason ||
      supportCase.draft?.requiresEscalation ||
      !subscription ||
      subscription.status !== "active" ||
      !cancellationAuthority(supportCase, turn) ||
      supportCase.draft?.recommendRefund
    ) {
      await caseStore.update(supportCase.id, {
        status: "escalated",
        escalationReason:
          escalationReason ??
          "Cancellation requires an explicit no-refund request for one active owned subscription.",
      });
      return inputData;
    }
    if (!mastra)
      throw new Error(
        "The resolve workflow must run through a registered Mastra instance.",
      );
    const binding = resolveConfiguredBinding(
      bindingsForPersistedCase(supportCase).transactions,
    );
    const raw = {
      caseId: supportCase.id,
      turnId: inputData.turnId,
      ownerId,
      binding,
      subscriptionId: subscription.subscriptionId,
      cancellationMode: "period_end" as const,
      sourceMessageId: turn.message!.id,
      sourceMessageHash: cancellationMessageHash(turn.message!.body),
      idempotencyKey: `cancel:${supportCase.id}:${inputData.turnId}`,
    };
    const fingerprint = cancellationFingerprint(raw);
    const command = { ...raw, fingerprint };
    await caseStore.saveAction(
      supportCase.id,
      "subscription-cancellation-command",
      fingerprint,
      command,
    );
    await caseStore.bindTurnCommand(
      supportCase.id,
      inputData.turnId,
      fingerprint,
    );
    const tool = mastra.getTool("scheduleSubscriptionCancellationTool");
    if (!tool.execute)
      throw new Error("Registered cancellation tool has no execute function.");
    try {
      const effect = await withTrustedCancellationScope(
        {
          caseId: supportCase.id,
          turnId: inputData.turnId,
          commandFingerprint: fingerprint,
        },
        () =>
          tool.execute!(command, { mastra, requestContext, tracingContext }),
      );
      await caseStore.update(supportCase.id, {
        metadata: { ...supportCase.metadata, cancellationEffect: effect },
      });
    } catch (error) {
      await caseStore.saveAction(
        supportCase.id,
        "subscription-cancellation-failure",
        fingerprint,
        { message: String(error) },
      );
      await caseStore.update(supportCase.id, {
        status: "escalated",
        escalationReason:
          "Subscription cancellation requires additional review.",
      });
    }
    return inputData;
  },
});

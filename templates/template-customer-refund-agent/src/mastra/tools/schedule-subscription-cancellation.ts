import { createTool } from "@mastra/core/tools";
import { createHash } from "node:crypto";
import { z } from "zod";
import { subscriptionCancellationEffectSchema } from "../domain/support-case";
import { caseStore } from "../lib/case-store";
import { activeDispatchLeaseScope } from "../lib/dispatch-lease-scope";
import { bindingsForPersistedCase } from "../runtime/provider-bindings";
import { structurallyEqual } from "../lib/money";
import type { SubscriptionCancellationCommand } from "../providers/contracts";
import {
  providerRegistry,
  resolveConfiguredBinding,
} from "../providers/registry";
import { activeTrustedCancellationScope } from "../providers/cancellation-execution";

export const cancellationInputSchema = z.object({
  caseId: z.string(),
  subscriptionId: z.string(),
  idempotencyKey: z.string(),
  fingerprint: z.string(),
});

export function cancellationMessageHash(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

export function cancellationFingerprint(
  input: Omit<SubscriptionCancellationCommand, "fingerprint">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        caseId: input.caseId,
        turnId: input.turnId,
        ownerId: input.ownerId,
        binding: input.binding,
        subscriptionId: input.subscriptionId,
        cancellationMode: input.cancellationMode,
        sourceMessageId: input.sourceMessageId,
        sourceMessageHash: input.sourceMessageHash,
        idempotencyKey: input.idempotencyKey,
      }),
    )
    .digest("hex");
}

export function validPersistedCancellationCommand(
  value: unknown,
  supportCase: {
    id: string;
    externalId: string;
    metadata: Record<string, unknown>;
  },
  turn: { id: string; message?: { id: string; body: string } },
): value is SubscriptionCancellationCommand {
  if (!value || typeof value !== "object" || !turn.message) return false;
  const command = value as Partial<SubscriptionCancellationCommand>;
  const binding = bindingsForPersistedCase(supportCase).transactions;
  return (
    command.caseId === supportCase.id &&
    command.turnId === turn.id &&
    command.ownerId === supportCase.metadata.ownerId &&
    structurallyEqual(command.binding, binding) &&
    command.cancellationMode === "period_end" &&
    command.sourceMessageId === turn.message.id &&
    command.sourceMessageHash === cancellationMessageHash(turn.message.body) &&
    typeof command.subscriptionId === "string" &&
    typeof command.idempotencyKey === "string" &&
    typeof command.fingerprint === "string" &&
    command.fingerprint ===
      cancellationFingerprint(
        command as Omit<SubscriptionCancellationCommand, "fingerprint">,
      )
  );
}
export const scheduleSubscriptionCancellationTool = createTool({
  id: "schedule_subscription_cancellation",
  description:
    "Schedule an already-authorized, no-refund subscription cancellation at period end.",
  inputSchema: cancellationInputSchema,
  outputSchema: subscriptionCancellationEffectSchema,
  execute: async (input) => {
    const trusted = activeTrustedCancellationScope();
    const lease = activeDispatchLeaseScope();
    if (
      !trusted ||
      !lease ||
      trusted.caseId !== input.caseId ||
      trusted.commandFingerprint !== input.fingerprint ||
      lease.caseId !== input.caseId ||
      lease.turnId !== trusted.turnId ||
      !(await caseStore.hasDispatchLease(lease))
    )
      throw new Error(
        "Cancellation execution requires the trusted current workflow capability and lease.",
      );
    const supportCase = await caseStore.get(input.caseId);
    const turn = await caseStore.turn(input.caseId, trusted.turnId);
    const command = await caseStore.getAction(
      input.caseId,
      "subscription-cancellation-command",
      input.fingerprint,
    );
    if (
      !supportCase ||
      !turn ||
      !command ||
      !validPersistedCancellationCommand(command, supportCase, turn) ||
      command.fingerprint !== input.fingerprint ||
      command.subscriptionId !== input.subscriptionId ||
      command.idempotencyKey !== input.idempotencyKey
    )
      throw new Error("Cancellation command is not immutable and current.");
    const binding = resolveConfiguredBinding(command.binding);
    const attempt = await caseStore.prepareSubscriptionCancellationAttempt({
      caseId: input.caseId,
      turnId: trusted.turnId,
      binding,
      subscriptionId: input.subscriptionId,
      idempotencyKey: input.idempotencyKey,
      fingerprint: input.fingerprint,
      command,
    });
    if (attempt.status === "scheduled") {
      const effect = await caseStore.idempotency(input.idempotencyKey);
      if (!effect)
        throw new Error(
          "Scheduled cancellation is missing its durable effect.",
        );
      return effect.effect as import("../providers/contracts").SubscriptionCancellationEffect;
    }
    if (attempt.status !== "prepared")
      throw new Error(
        "Cancellation is awaiting read-only recovery and cannot be scheduled again.",
      );
    if (
      !(await caseStore.claimSubscriptionCancellationMutation({
        idempotencyKey: input.idempotencyKey,
        fingerprint: input.fingerprint,
      }))
    )
      throw new Error(
        "Cancellation is awaiting read-only recovery and cannot be scheduled again.",
      );
    try {
      const effect = await providerRegistry(binding)
        .transactions(binding)
        .scheduleSubscriptionCancellation({ ...command, binding });
      await caseStore.finalizeSubscriptionCancellationAttempt({
        idempotencyKey: input.idempotencyKey,
        fingerprint: input.fingerprint,
        status: "scheduled",
        cancelsAt: effect.cancelsAt,
        effect,
      });
      return effect;
    } catch (error) {
      await caseStore.finalizeSubscriptionCancellationAttempt({
        idempotencyKey: input.idempotencyKey,
        fingerprint: input.fingerprint,
        status: "unknown",
      });
      throw error;
    }
  },
});

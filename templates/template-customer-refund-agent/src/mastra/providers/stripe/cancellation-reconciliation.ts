import { caseStore, type CaseStore } from "../../lib/case-store";
import { providerRegistry, resolveConfiguredBinding } from "../registry";
import { validPersistedCancellationCommand } from "../../tools/schedule-subscription-cancellation";

const MAX_UNKNOWN_CANCELLATION_AGE_MS = 24 * 60 * 60 * 1_000;

/** Read-only recovery for a possibly-applied cancellation POST. It reuses the
 * persisted subscription/key and never calls the scheduling mutation. */
export async function reconcileUnknownSubscriptionCancellations(
  store: CaseStore = caseStore,
  limit = 10,
) {
  let recovered = 0;
  for (const attempt of await store.claimUnknownSubscriptionCancellationAttempts(
    limit,
  )) {
    const supportCase = await store.get(attempt.caseId);
    const turn = supportCase
      ? await store.turn(attempt.caseId, attempt.turnId)
      : undefined;
    if (
      !supportCase ||
      !turn ||
      !validPersistedCancellationCommand(attempt.command, supportCase, turn)
    ) {
      await store.finalizeUnknownSubscriptionCancellation({
        idempotencyKey: attempt.idempotencyKey,
        fingerprint: attempt.fingerprint,
        status: "quarantined",
        recoveryClaim: attempt.recoveryClaim,
      });
      continue;
    }
    const command = attempt.command;
    try {
      if (
        Date.now() - Date.parse(attempt.createdAt) >=
        MAX_UNKNOWN_CANCELLATION_AGE_MS
      ) {
        await store.finalizeUnknownSubscriptionCancellation({
          idempotencyKey: attempt.idempotencyKey,
          fingerprint: attempt.fingerprint,
          status: "quarantined",
          recoveryClaim: attempt.recoveryClaim,
        });
        continue;
      }
      const binding = resolveConfiguredBinding(command.binding);
      const effect = await providerRegistry(binding)
        .transactions(binding)
        .retrieveSubscriptionCancellation(command);
      if (!effect) {
        await store.rescheduleSubscriptionCancellationRecovery({
          idempotencyKey: attempt.idempotencyKey,
          fingerprint: attempt.fingerprint,
          recoveryClaim: attempt.recoveryClaim,
        });
        continue;
      }
      if (
        await store.finalizeUnknownSubscriptionCancellation({
          idempotencyKey: attempt.idempotencyKey,
          fingerprint: attempt.fingerprint,
          status: "scheduled",
          effect,
          recoveryClaim: attempt.recoveryClaim,
        })
      ) {
        recovered += 1;
      }
    } catch {
      // The next GET is durably delayed. This path never creates a replacement
      // mutation after a network-ambiguous POST.
      await store.rescheduleSubscriptionCancellationRecovery({
        idempotencyKey: attempt.idempotencyKey,
        fingerprint: attempt.fingerprint,
        recoveryClaim: attempt.recoveryClaim,
      });
    }
  }
  return recovered;
}

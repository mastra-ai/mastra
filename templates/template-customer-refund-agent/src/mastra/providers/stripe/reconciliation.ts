import { structurallyEqual } from "../../lib/money";
import { caseStore, type CaseStore } from "../../lib/case-store";
import { bindingsForCase } from "../contracts";
import { providerRegistry } from "../registry";
import { StripeProviderRegistry } from "./registry";

const PROVIDER_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const RETRY_DELAY_MS = 30_000;
const MAX_KNOWN_ID_UNCERTAIN_ATTEMPTS = 8;

/** Bounded restart/poll recovery. Each worker owns a short CAS lease and
 * releases it with a due time on every non-terminal outcome. Unknown POSTs
 * reuse the persisted Stripe request/key while that provider window is open. */
export async function reconcileStripeRefundAttempts(
  store: CaseStore = caseStore,
  limit = 10,
) {
  let reconciled = 0;
  for (const attempt of await store.claimableStripeRefundAttempts(limit)) {
    const retryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    try {
      const supportCase = await store.get(attempt.caseId);
      if (!supportCase) throw new Error("Stripe attempt case is missing.");
      const command = attempt.command as
        | {
            approvalCaseId?: unknown;
            orderId?: unknown;
            idempotencyKey?: unknown;
            fingerprint?: unknown;
          }
        | undefined;
      if (
        typeof command?.orderId !== "string" ||
        command.approvalCaseId !== attempt.caseId ||
        command.idempotencyKey !== attempt.idempotencyKey ||
        command.fingerprint !== attempt.fingerprint ||
        typeof attempt.turnId !== "string"
      ) {
        await store.rescheduleStripeRefundAttempt({
          idempotencyKey: attempt.idempotencyKey,
          reconcileLeaseToken: attempt.reconcileLeaseToken!,
          status: "quarantined",
          providerStatus: "invalid-immutable-command",
        });
        continue;
      }
      const immutable = await store.getAction(
        attempt.caseId,
        "refund-command",
        attempt.fingerprint,
      );
      if (!structurallyEqual(immutable, command)) {
        await store.rescheduleStripeRefundAttempt({
          idempotencyKey: attempt.idempotencyKey,
          reconcileLeaseToken: attempt.reconcileLeaseToken!,
          status: "quarantined",
          providerStatus: "immutable-command-mismatch",
        });
        continue;
      }
      const binding = bindingsForCase(supportCase).transactions;
      const registry = providerRegistry(binding);
      if (!(registry instanceof StripeProviderRegistry))
        throw new Error("Stripe attempt is not routed to Stripe.");
      if (!attempt.refundId) {
        if (
          Date.now() - Date.parse(attempt.createdAt) >
          PROVIDER_IDEMPOTENCY_WINDOW_MS
        ) {
          await store.rescheduleStripeRefundAttempt({
            idempotencyKey: attempt.idempotencyKey,
            reconcileLeaseToken: attempt.reconcileLeaseToken!,
            status: "quarantined",
            providerStatus: "idempotency-window-expired",
          });
          continue;
        }
        const effect = await registry.recoverUnknownRefund(
          binding,
          attempt.idempotencyKey,
          attempt.reconcileLeaseToken!,
        );
        if (effect.status === "pending" || effect.status === "unknown") {
          await store.rescheduleStripeRefundAttempt({
            idempotencyKey: attempt.idempotencyKey,
            reconcileLeaseToken: attempt.reconcileLeaseToken!,
            status: effect.status === "unknown" ? "unknown" : "pending",
            refundId: effect.refundId,
            providerStatus: effect.providerStatus ?? effect.status,
            nextAttemptAt: retryAt,
          });
          continue;
        }
        if (
          await store.finalizeStripeRefundReconciliation({
            idempotencyKey: attempt.idempotencyKey,
            status: effect.status === "succeeded" ? "succeeded" : "failed",
            refundId: effect.refundId,
            providerStatus: effect.providerStatus ?? effect.status ?? "unknown",
            effect,
            reconcileLeaseToken: attempt.reconcileLeaseToken,
          })
        )
          reconciled += 1;
        continue;
      }
      const effect = await registry.reconcileRefund(binding, {
        refundId: attempt.refundId,
        orderId: command.orderId,
        idempotencyKey: attempt.idempotencyKey,
      });
      if (effect.status === "pending" || effect.status === "unknown") {
        // `requires_action` and undocumented states are never a durable
        // customer-pending success. Bound retries for known Stripe IDs, then
        // atomically persist the originating turn's escalation exactly once.
        if (
          effect.status === "unknown" &&
          (attempt.reconcileAttempts + 1 >= MAX_KNOWN_ID_UNCERTAIN_ATTEMPTS ||
            Date.now() - Date.parse(attempt.createdAt) >=
              PROVIDER_IDEMPOTENCY_WINDOW_MS)
        ) {
          if (
            await store.finalizeStripeRefundReconciliation({
              idempotencyKey: attempt.idempotencyKey,
              status: "quarantined",
              refundId: effect.refundId,
              providerStatus:
                effect.providerStatus ?? "unknown-status-quarantined",
              effect,
              reconcileLeaseToken: attempt.reconcileLeaseToken,
            })
          )
            reconciled += 1;
          continue;
        }
        await store.rescheduleStripeRefundAttempt({
          idempotencyKey: attempt.idempotencyKey,
          reconcileLeaseToken: attempt.reconcileLeaseToken!,
          status: effect.status === "unknown" ? "unknown" : "pending",
          refundId: effect.refundId,
          providerStatus: effect.providerStatus ?? effect.status,
          nextAttemptAt: retryAt,
        });
        continue;
      }
      if (
        await store.finalizeStripeRefundReconciliation({
          idempotencyKey: attempt.idempotencyKey,
          status: effect.status === "succeeded" ? "succeeded" : "failed",
          refundId: effect.refundId,
          providerStatus: effect.providerStatus ?? effect.status ?? "unknown",
          effect,
          reconcileLeaseToken: attempt.reconcileLeaseToken,
        })
      )
        reconciled += 1;
    } catch {
      await store.rescheduleStripeRefundAttempt({
        idempotencyKey: attempt.idempotencyKey,
        reconcileLeaseToken: attempt.reconcileLeaseToken!,
        status:
          attempt.status === "succeeded"
            ? "succeeded"
            : attempt.refundId
              ? "pending"
              : "unknown",
        providerStatus: "reconciliation-error",
        nextAttemptAt: retryAt,
      });
    }
  }
  return reconciled;
}

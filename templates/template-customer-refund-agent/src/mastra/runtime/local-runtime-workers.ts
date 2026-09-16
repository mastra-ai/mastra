import { caseStore } from "../lib/case-store";
import { requireLocalDatabaseUrl } from "../lib/database-url";
import { defaultLocalBinding } from "./local-support-provider";
import { localRuntime } from "./local-provider";
import {
  recoverApprovedNativeDecisions,
  type NativeRecoveryMastra,
} from "./native-approval-recovery";
import { deliverOutbox } from "./outbox";
import { purgeExpiredWorkflowSnapshots } from "./workflow-snapshot-retention";
import { recoverLocalWorkflows } from "./workflow-recovery";
import {
  hasExplicitExternalMode,
  isLocalMode,
} from "../../../config/app-mode.mjs";

/**
 * Studio/start lifecycle hook. It seeds only the configured local fixture and
 * runs one bounded recovery sweep immediately, then keeps a non-blocking
 * worker alive for interrupted dispatch and delivery work.
 */
export function startLocalRuntimeWorkers(
  mastra: NativeRecoveryMastra,
  logger?: {
    warn(message: string, meta?: Record<string, unknown>): void;
    info?(message: string, meta?: Record<string, unknown>): void;
  },
  options?: {
    initialDelayMs?: number;
    intervalMs?: number;
    runSweep?: () => Promise<void>;
  },
) {
  let stopped = false;
  let running = false;
  let lastRetentionSweep = 0;
  const retentionInterval = Number(
    process.env.SUPPORT_RETENTION_SWEEP_MS ?? 86_400_000,
  );
  if (
    !Number.isInteger(retentionInterval) ||
    retentionInterval < 60_000 ||
    retentionInterval > 604_800_000
  )
    throw new Error(
      "SUPPORT_RETENTION_SWEEP_MS must be an integer from 60000 through 604800000.",
    );
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      // A legacy mixed-adapter installation (without APP_MODE) retains its
      // existing local commerce fixtures. An explicit external profile owns
      // its data and must never receive local fixture rows.
      if (!hasExplicitExternalMode()) {
        requireLocalDatabaseUrl();
        await localRuntime.seed(defaultLocalBinding());
      }
      // The synthetic Studio investigation belongs exclusively to the local
      // experience; legacy external support must not acquire a mock case.
      if (isLocalMode())
        await import("./studio-seed").then(
          ({ ensureStudioSupervisorDemoCase }) =>
            ensureStudioSupervisorDemoCase(),
        );
      await recoverApprovedNativeDecisions(mastra).catch((error) =>
        logger?.warn("Native approval recovery failed.", { error }),
      );
      await recoverLocalWorkflows(mastra);
      await import("../providers/stripe/reconciliation")
        .then(({ reconcileStripeRefundAttempts }) =>
          reconcileStripeRefundAttempts(caseStore),
        )
        .catch((error) =>
          logger?.warn("Stripe refund reconciliation failed.", { error }),
        );
      await import("../providers/stripe/cancellation-reconciliation")
        .then(({ reconcileUnknownSubscriptionCancellations }) =>
          reconcileUnknownSubscriptionCancellations(caseStore),
        )
        .catch((error) =>
          logger?.warn("Stripe cancellation reconciliation failed.", { error }),
        );
      await deliverOutbox(undefined, 10, caseStore, { mastra });
      await import("./intercom-close-recovery")
        .then(({ recoverIntercomCloseIntents }) =>
          recoverIntercomCloseIntents(caseStore),
        )
        .catch((error) =>
          logger?.warn("Intercom close recovery failed.", { error }),
        );
      if (Date.now() - lastRetentionSweep >= retentionInterval) {
        const caseRetention = await caseStore.enforceRetention();
        const storage = mastra.getStorage?.();
        await purgeExpiredWorkflowSnapshots(storage, caseRetention);
        const mastraRetention = await storage?.prune({
          maxBatches: 10,
          maxRows: 5_000,
        });
        logger?.info?.("Completed bounded DEC-015 retention sweep.", {
          caseRetention,
          mastraRetention,
        });
        lastRetentionSweep = Date.now();
      }
    } catch (error) {
      logger?.warn("Local runtime recovery sweep failed.", { error });
    } finally {
      running = false;
    }
  };
  // Let Mastra finish initializing its own LibSQL tables before this app-owned
  // client touches the same file. Starting both schema writers concurrently
  // produces SQLITE_BUSY on a pristine local database.
  let activeSweep: Promise<void> | undefined;
  const runSweep = options?.runSweep ?? sweep;
  const startSweep = () => {
    if (stopped || activeSweep) return activeSweep;
    activeSweep = Promise.resolve()
      .then(runSweep)
      .finally(() => {
        activeSweep = undefined;
      });
    return activeSweep;
  };
  const initial = setTimeout(
    () => void startSweep(),
    options?.initialDelayMs ?? 1_000,
  );
  const timer = setInterval(
    () => void startSweep(),
    options?.intervalMs ?? 5_000,
  );
  timer.unref();
  return async () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(timer);
    await activeSweep;
  };
}

import { agentThreadStreamRuntime } from '@mastra/core/agent/durable';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';

/**
 * Keeps an InngestAgent run's thread lease alive from the process executing its steps.
 *
 * The caller of `stream()` takes the thread lease when it registers the run, but the run itself executes in
 * Inngest steps, often in another process. If the caller exits, its lease renewal stops while the steps keep
 * running, the lease expires, and another `stream()` on the thread starts a second run beside the first (#29766).
 * So every model and tool step takes the lease back (under the caller's own owner, so a live caller keeps
 * renewing it too) and renews it while it runs.
 */

export interface RunThreadTarget {
  runId: string;
  agentId?: string;
  state?: {
    threadId?: string;
    resourceId?: string;
    memoryConfig?: { readOnly?: boolean };
  };
}

interface Hold {
  references: number;
  ready: Promise<void>;
  timer?: ReturnType<typeof setInterval>;
}

const holds = new Map<string, Hold>();

const POLL_INTERVAL_MS = 1_000;

/** Loop statuses whose run still executes, so a thread it holds is busy. */
const isExecuting = (status: string | undefined) => status === 'running';

export const INNGEST_AGENT_THREAD_BUSY_ERROR_ID = 'INNGEST_AGENT_THREAD_BUSY';

function resolveLeasePubSub(mastra: Mastra | undefined, agentId: string | undefined): PubSub | undefined {
  if (agentId) {
    try {
      // The caller registers the run on the agent's own pubsub, so the lease lives there.
      const pubsub = (
        mastra?.getAgentById(agentId) as { getPubSub?: () => PubSub | undefined } | undefined
      )?.getPubSub?.();
      if (pubsub) return pubsub;
    } catch {
      // Not registered on this Mastra: fall back to its pubsub.
    }
  }
  return mastra?.pubsub;
}

/** The status of an InngestAgent loop run, as last written to storage. */
export async function loadLoopRunStatus(
  mastra: Mastra | undefined,
  workflowName: string,
  runId: string,
): Promise<string | undefined> {
  const store = await mastra?.getStorage()?.getStore('workflows');
  const snapshot = await store?.loadWorkflowSnapshot({ workflowName, runId });
  return snapshot?.status;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

function threadBusyError(runId: string, threadId: string, ownerRunId: string | undefined) {
  return new MastraError({
    id: INNGEST_AGENT_THREAD_BUSY_ERROR_ID,
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Run ${runId} cannot execute on thread ${threadId}: run ${ownerRunId ?? '(unknown)'} is still executing on it.`,
    details: { runId, threadId, ownerRunId: ownerRunId ?? '' },
  });
}

async function takeLease(
  mastra: Mastra | undefined,
  pubsub: PubSub,
  target: RunThreadTarget & { state: { threadId: string } },
  loopWorkflowName: string,
): Promise<void> {
  const { runId } = target;
  const { threadId, resourceId } = target.state;
  // A run that just finished keeps the lease until its caller releases it, or until it expires when the caller
  // is gone; wait that out rather than failing the run that follows it. Only a run still executing is a conflict.
  const deadline = Date.now() + agentThreadStreamRuntime.threadLeaseTtlMs * 2;
  while (true) {
    let held: boolean;
    try {
      held = await agentThreadStreamRuntime.reclaimDurableThreadLease(pubsub, runId, threadId, resourceId);
    } catch (error) {
      // A backend that can't answer can't grant the lease to anyone else either; renewal keeps trying.
      mastra?.getLogger?.()?.warn?.(`[InngestAgent] Could not take the thread lease for run ${runId}: ${error}`);
      return;
    }
    if (held) return;
    const ownerRunId = await agentThreadStreamRuntime
      .getThreadLeaseOwnerRunId(pubsub, { threadId, resourceId })
      .catch(() => undefined);
    // Held for this run under another owner format (e.g. taken over from a parked run): it is ours already.
    if (ownerRunId === runId) return;
    const ownerStatus =
      ownerRunId === undefined
        ? undefined
        : await loadLoopRunStatus(mastra, loopWorkflowName, ownerRunId).catch(() => undefined);
    if (isExecuting(ownerStatus) || Date.now() >= deadline) throw threadBusyError(runId, threadId, ownerRunId);
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Take the run's thread lease back and renew it until the returned release is called. Throws when another run
 * still executing holds the thread. A no-op for runs without a thread, read-only runs (they never hold the
 * thread), and pubsubs without leases.
 */
export async function holdRunThreadLease(
  mastra: Mastra | undefined,
  target: RunThreadTarget,
  loopWorkflowName: string,
): Promise<() => void> {
  const threadId = target.state?.threadId;
  if (!threadId || target.state?.memoryConfig?.readOnly) return () => {};
  const pubsub = resolveLeasePubSub(mastra, target.agentId);
  if (!pubsub) return () => {};
  const { runId } = target;
  const resourceId = target.state?.resourceId;

  let hold = holds.get(runId);
  if (!hold) {
    const created: Hold = {
      references: 0,
      ready: takeLease(mastra, pubsub, { ...target, state: { ...target.state, threadId } }, loopWorkflowName).then(
        () => {
          if (holds.get(runId) !== created || created.references === 0) return;
          created.timer = setInterval(() => {
            void agentThreadStreamRuntime
              .renewDurableThreadLease(pubsub, runId, threadId, resourceId)
              .then(renewed =>
                renewed
                  ? true
                  : agentThreadStreamRuntime.reclaimDurableThreadLease(pubsub, runId, threadId, resourceId),
              )
              .then(kept => {
                if (kept || holds.get(runId) !== created) return;
                // Another run took the thread: stop speaking for it. The next step fails to take it back.
                clearInterval(created.timer);
                created.timer = undefined;
              })
              .catch(() => {});
          }, agentThreadStreamRuntime.threadLeaseTtlMs / 3);
          // Don't keep the process alive solely to renew a lease.
          (created.timer as { unref?: () => void }).unref?.();
        },
      ),
    };
    hold = created;
    holds.set(runId, hold);
  }
  const current = hold;
  current.references++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    current.references--;
    if (current.references > 0 || holds.get(runId) !== current) return;
    // The lease keeps its TTL from the last renewal, which covers the gap until the run's next step.
    if (current.timer) clearInterval(current.timer);
    holds.delete(runId);
  };
  try {
    await current.ready;
  } catch (error) {
    release();
    throw error;
  }
  return release;
}

/**
 * Wait until no other executing run holds the thread, so a new run never executes beside one whose caller
 * exited. A thread held by a suspended or finished run, or by a run with no stored state, doesn't wait: those
 * keep the existing behavior.
 */
export async function waitForThreadToFree(
  mastra: Mastra | undefined,
  pubsub: PubSub | undefined,
  target: { runId: string; threadId?: string; resourceId?: string; readOnly?: boolean },
  loopWorkflowName: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  const { runId, threadId, resourceId } = target;
  if (!threadId || target.readOnly || !pubsub) return;
  while (true) {
    const ownerRunId = await agentThreadStreamRuntime
      .getThreadLeaseOwnerRunId(pubsub, { threadId, resourceId })
      .catch(() => undefined);
    if (ownerRunId === undefined || ownerRunId === runId) return;
    const ownerStatus = await loadLoopRunStatus(mastra, loopWorkflowName, ownerRunId).catch(() => undefined);
    if (!isExecuting(ownerStatus)) return;
    await sleep(POLL_INTERVAL_MS, abortSignal);
  }
}

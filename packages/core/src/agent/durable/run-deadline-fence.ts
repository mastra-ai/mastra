import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage/domains/memory/base';
import type { RunFence } from '../../storage/run-fencing';
import { getExecutionClaim, supportsRunFencing } from './execution-fence';
import { getRunDeadline } from './run-deadline';
import type { DurableRunDeadline } from './run-deadline';
import { currentRunFenceScope, runInRunFenceScope } from './run-fence-scope';

async function resolveMemoryStore(
  mastra: Mastra | undefined,
  agentId: string,
  runId: string,
  requestContext: RequestContext | undefined,
): Promise<MemoryStorage | undefined> {
  try {
    const memory = await mastra?.getAgentById(agentId)?.getMemory({ requestContext });
    const store = await memory?.storage?.getStore('memory');
    return (await supportsRunFencing(store)) ? store : undefined;
  } catch (error) {
    mastra
      ?.getLogger?.()
      ?.warn?.(
        `[DurableAgent] Could not resolve the memory store for the deadline fence of run ${runId} (agent ${agentId}); writes only get the deadline check: ${error}`,
      );
    return undefined;
  }
}

const NO_FENCE = async () => {};

async function retireFence(store: MemoryStorage, fence: RunFence): Promise<void> {
  // Retention prunes only retired fences; a failed retire just keeps the row.
  await store.retireRunFence(fence).catch(() => false);
}

/**
 * Start a run's deadline for one execution session. Raises a memory run fence
 * when the agent's memory store supports fencing; otherwise steps only check
 * the deadline before writing. `expire()` raises a newer fence so writes still
 * in flight at the deadline are rejected by the store. `retire()` marks the
 * fence settled so `memory.runFences` retention can prune it; call it when the
 * session ends. Retiring does not change which writes the fence accepts.
 */
export async function armRunDeadline(args: {
  mastra: Mastra | undefined;
  agentId: string;
  runId: string;
  requestContext: RequestContext | undefined;
  expiresAt: number;
}): Promise<{ deadline: DurableRunDeadline; expire: () => Promise<void>; retire: () => Promise<void> }> {
  const { runId, expiresAt } = args;
  const store = await resolveMemoryStore(args.mastra, args.agentId, runId, args.requestContext);
  if (!store) return { deadline: { expiresAt }, expire: NO_FENCE, retire: NO_FENCE };

  // Claimed runs use small claim counters; claim-less runs order fences by time.
  // Sessions take odd generations and expiries even ones, so a session armed in
  // the same millisecond as an earlier session expired still outranks it.
  const fence: RunFence = { runId, generation: Date.now() * 2 + 1, ownerId: `deadline:${expiresAt}` };
  const logger = args.mastra?.getLogger?.();
  let raised: boolean;
  try {
    raised = await store.raiseRunFence(fence);
  } catch (error) {
    logger?.warn?.(
      `[DurableAgent] Failed to raise the deadline fence for run ${runId} (agent ${args.agentId}); writes only get the deadline check: ${error}`,
    );
    return { deadline: { expiresAt }, expire: NO_FENCE, retire: NO_FENCE };
  }
  if (!raised) {
    // A newer session already owns the fence; steps fall back to deadline checks.
    logger?.debug?.(
      `[DurableAgent] Deadline fence for run ${runId} (agent ${args.agentId}) not raised: a newer session owns it`,
    );
    return { deadline: { expiresAt }, expire: NO_FENCE, retire: NO_FENCE };
  }

  return {
    deadline: { expiresAt, fence: { generation: fence.generation, ownerId: fence.ownerId } },
    expire: async () => {
      const expired: RunFence = {
        runId,
        // Just above this session: a later session (a higher odd generation)
        // already outranks it, so a stale timer cannot fence that session out.
        generation: fence.generation + 1,
        ownerId: 'deadline:expired',
      };
      // On failure, writes are still refused by the deadline check.
      if (await store.raiseRunFence(expired).catch(() => false)) await retireFence(store, expired);
    },
    retire: () => retireFence(store, fence),
  };
}

/**
 * Run `fn` so its memory writes carry the run's deadline fence. Runs `fn`
 * directly for claimed runs (their execution fence covers them), inside an
 * existing fence scope, or when the run has no fenced deadline.
 */
export async function runInRunDeadlineScope<T>(
  args: {
    mastra: Mastra | undefined;
    agentId: string | undefined;
    runId: string | undefined;
    requestContext: RequestContext | undefined;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const { runId, agentId, requestContext } = args;
  if (!runId || !agentId || currentRunFenceScope() || getExecutionClaim(requestContext, runId)) return fn();
  const deadline = getRunDeadline(requestContext, runId);
  if (!deadline?.fence) return fn();
  const store = await resolveMemoryStore(args.mastra, agentId, runId, requestContext);
  if (!store) return fn();
  const fence: RunFence = { runId, ...deadline.fence };
  return runInRunFenceScope({ fenceFor: target => (target === store ? fence : undefined) }, fn);
}

type DeadlineScopedStep = { execute: (params: any) => Promise<any> };

/** Run a durable step inside its run's deadline scope. */
export function withRunDeadlineScope<TStep extends DeadlineScopedStep>(step: TStep): TStep {
  const execute = step.execute;
  return {
    ...step,
    execute: (params: any) => {
      // The iteration workflow's init data carries the durable run's ids.
      const initData = params.getInitData?.() as { runId?: string; agentId?: string } | undefined;
      return runInRunDeadlineScope(
        {
          mastra: params.mastra,
          agentId: initData?.agentId,
          runId: initData?.runId,
          requestContext: params.requestContext,
        },
        () => execute(params),
      );
    },
  };
}

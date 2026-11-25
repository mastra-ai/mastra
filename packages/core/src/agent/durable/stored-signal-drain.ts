import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { AgentSignalScope, AgentSignalsStorage } from '../../storage/domains/agent-signals/base';
import type { MessageList } from '../message-list';
import type { CreatedAgentSignal } from '../signals';
import { fromStoredSignalPayload } from '../stored-signal-payload';
import { getAgentSignalsStore } from '../stored-signals';
import { agentThreadStreamKey } from '../thread-stream-topic';
import { getExecutionClaim } from './execution-fence';
import type { DurableExecutionClaim } from './execution-fence';

/**
 * Workflow-state key of the signal ids a storage-backed run took into its
 * transcript since its last drain. The next drain deletes those rows: by then
 * the step that took them has saved its result, so they can't be lost.
 */
export const CONSUMED_SIGNAL_IDS_KEY = 'consumedSignalIds';

/** The consumed set in workflow state. A run started before the set existed has consumed nothing. */
export function readConsumedSignalIds(state: unknown): string[] {
  const ids = (state as { [CONSUMED_SIGNAL_IDS_KEY]?: unknown } | undefined)?.[CONSUMED_SIGNAL_IDS_KEY];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

type DurableRunInput = {
  agentId?: string;
  state?: { threadId?: string; resourceId?: string };
  messageListState?: { memoryInfo?: { threadId?: string; resourceId?: string } | null };
};

/**
 * The thread key of a durable run, from the values its thread lease uses: the
 * execution claim's thread when the run carries one, else the run input the
 * claim was built from.
 */
export function durableRunThreadKey(
  input: DurableRunInput | undefined,
  claim: Pick<DurableExecutionClaim, 'threadId' | 'resourceId'> | undefined,
): string | undefined {
  const memoryInfo = input?.messageListState?.memoryInfo;
  const threadId = claim?.threadId ?? input?.state?.threadId ?? memoryInfo?.threadId;
  if (!threadId) return undefined;
  const resourceId = claim?.threadId ? claim.resourceId : (input?.state?.resourceId ?? memoryInfo?.resourceId);
  return agentThreadStreamKey(resourceId, threadId);
}

/** The signals store of a durable run's agent, resolved through the host the step runs on. */
export function durableRunSignalsStore(
  mastra: Mastra | undefined,
  agentId: string | undefined,
): AgentSignalsStorage | undefined {
  if (!mastra || !agentId) return undefined;
  let agent: unknown;
  try {
    agent = mastra.getAgentById(agentId);
  } catch {
    return undefined;
  }
  return getAgentSignalsStore(agent);
}

/** Ids of the signals the run was started with. They reach the transcript as input, not through a drain. */
export function inputSignalIds(messageList: MessageList): string[] {
  return messageList.get.input
    .db()
    .filter(message => message.role === 'signal')
    .map(message => message.id);
}

export type StoredSignalQueue = { store: AgentSignalsStorage; threadKey: string };

/**
 * Where a durable run's pending signals are read from in this step: the store,
 * when the run is storage-backed and this process has no in-process drain for
 * it. A run whose signals the thread runtime here still queues keeps reading
 * them from there.
 */
export function storedSignalQueueForRun({
  mastra,
  agentId,
  input,
  claim,
  hasLocalDrain,
}: {
  mastra: Mastra | undefined;
  agentId: string | undefined;
  input: DurableRunInput | undefined;
  claim: Pick<DurableExecutionClaim, 'threadId' | 'resourceId'> | undefined;
  hasLocalDrain: boolean;
}): StoredSignalQueue | undefined {
  if (hasLocalDrain) return undefined;
  const store = durableRunSignalsStore(mastra, agentId ?? input?.agentId);
  const threadKey = store ? durableRunThreadKey(input, claim) : undefined;
  return store && threadKey ? { store, threadKey } : undefined;
}

/**
 * Close a storage-backed run that ended: delete what it consumed since its last
 * drain and leave the rest to the thread's next run. Safe to repeat. No-op for
 * runs whose signals are not stored.
 *
 * A failed close doesn't fail the run's ending: the run's untaken rows then
 * stay addressed to it, and the thread's next run takes them over at its first
 * model request.
 */
export async function closeStoredSignalRun({
  mastra,
  agentId,
  runId,
  input,
  claim,
  state,
}: {
  mastra: Mastra | undefined;
  agentId: string | undefined;
  runId: string;
  input: DurableRunInput | undefined;
  claim: Pick<DurableExecutionClaim, 'threadId' | 'resourceId'> | undefined;
  /** The run's latest saved workflow state. */
  state: unknown;
}): Promise<void> {
  const queue = storedSignalQueueForRun({ mastra, agentId, input, claim, hasLocalDrain: false });
  if (!queue) return;
  try {
    await queue.store.closeRun({ threadKey: queue.threadKey, runId, consumedIds: readConsumedSignalIds(state) });
  } catch (error) {
    mastra?.getLogger?.()?.warn?.('Could not close the stored signals of an ended run', { runId, error });
  }
}

export type StoredSignalDrain = {
  signals: CreatedAgentSignal[];
  /** Workflow state to save together with the transcript that holds `signals`. */
  state: { [CONSUMED_SIGNAL_IDS_KEY]: string[] };
};

/**
 * One drain of a storage-backed run: delete the rows its saved state lists as
 * consumed, then claim each scope in turn. Claimed rows stay in the store until
 * the next drain deletes them, so a step that fails before saving its result
 * gets the same rows again from its retry, and a step that saved it never
 * gets them again.
 */
export async function claimStoredSignals({
  queue: { store, threadKey },
  runId,
  consumed,
  claims,
}: {
  queue: StoredSignalQueue;
  runId: string;
  consumed: readonly string[];
  /** `leftovers` takes over the thread first; only the run's first model request passes it. */
  claims: Array<{ scope: AgentSignalScope; leftovers?: boolean }>;
}): Promise<StoredSignalDrain> {
  if (consumed.length) await store.delete({ ids: [...consumed] });
  // A seeded id (the run's own input signal) is already in the transcript.
  const skip = new Set(consumed);
  const signals: CreatedAgentSignal[] = [];
  const ids: string[] = [];
  for (const { scope, leftovers } of claims) {
    const rows =
      scope === 'pre-run'
        ? await store.claim({ threadKey, runId, scope, leftovers })
        : await store.claim({ threadKey, runId, scope });
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      skip.add(row.id);
      ids.push(row.id);
      signals.push(fromStoredSignalPayload(row.signal));
    }
  }
  return { signals, state: { [CONSUMED_SIGNAL_IDS_KEY]: ids } };
}

/**
 * The LLM step's reads: pre-run signals (with the thread takeover) for the
 * run's first request, pending ones for later requests. Returns `undefined`
 * when the run's signals are not read from the store here, or while the run is
 * aborted, so the saved consumed set stays as it is.
 */
export async function drainStoredSignalsForRequest({
  params,
  mastra,
  agentId,
  runId,
  state,
  requestContext,
  hasLocalDrain,
  preRun,
  pending,
  aborted,
}: {
  params: { getState(keys?: readonly string[]): Promise<unknown> };
  mastra: Mastra | undefined;
  agentId: string | undefined;
  runId: string;
  state: DurableRunInput['state'];
  requestContext: RequestContext | undefined;
  hasLocalDrain: boolean;
  preRun: boolean;
  pending: boolean;
  aborted: boolean;
}): Promise<StoredSignalDrain | undefined> {
  const queue = storedSignalQueueForRun({
    mastra,
    agentId,
    input: { state },
    claim: getExecutionClaim(requestContext, runId),
    hasLocalDrain,
  });
  if (!queue || aborted || (!preRun && !pending)) return undefined;
  return claimStoredSignals({
    queue,
    runId,
    consumed: readConsumedSignalIds(await params.getState([CONSUMED_SIGNAL_IDS_KEY])),
    claims: [
      ...(preRun ? [{ scope: 'pre-run' as const, leftovers: true }] : []),
      ...(pending ? [{ scope: 'pending' as const }] : []),
    ],
  });
}

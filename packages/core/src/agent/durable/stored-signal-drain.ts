import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { AgentSignalScope, AgentSignalsStorage } from '../../storage/domains/agent-signals/base';
import type { MessageList } from '../message-list';
import type { CreatedAgentSignal } from '../signals';
import { decodeStoredSignals } from '../stored-signal-payload';
import { agentThreadStreamKey } from '../thread-stream-topic';
import { getExecutionClaim } from './execution-fence';
import type { DurableExecutionClaim } from './execution-fence';
import { getRunRegistryEntry } from './run-registry';

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
  /** Set when the run was prepared to keep its signals in storage. */
  signalsStored?: boolean;
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

/**
 * The signals store of a durable run, on the host the step runs on. The run
 * carries the decision in its input, made once when it was prepared, so every
 * process that executes its steps agrees with the senders. A run without the
 * flag keeps its signals in the thread runtime's in-process queues.
 */
export function durableRunSignalsStore(
  mastra: Mastra | undefined,
  input: Pick<DurableRunInput, 'signalsStored'> | undefined,
): AgentSignalsStorage | undefined {
  return input?.signalsStored ? mastra?.getStorage()?.stores?.agentSignals : undefined;
}

/** Ids of the signals the run was started with. They reach the transcript as input, not through a drain. */
export function inputSignalIds(messageList: MessageList): string[] {
  return messageList.get.input
    .db()
    .filter(message => message.role === 'signal')
    .map(message => message.id);
}

const MAX_WARNED_MISSING_STORE_RUN_IDS = 1000;
const warnedMissingStoreRunIds = new Set<string>();

/**
 * A run prepared to store its signals, executing on a host whose storage has
 * no `agentSignals`: its drains read nothing here. Warned once per run.
 */
function warnMissingSignalsStore(mastra: Mastra | undefined, runId: string) {
  if (warnedMissingStoreRunIds.has(runId)) return;
  warnedMissingStoreRunIds.add(runId);
  if (warnedMissingStoreRunIds.size > MAX_WARNED_MISSING_STORE_RUN_IDS) {
    warnedMissingStoreRunIds.delete(warnedMissingStoreRunIds.values().next().value!);
  }
  mastra
    ?.getLogger?.()
    ?.warn?.(
      'This run keeps its signals in agent signals storage, which this process has none of: signals sent to it are not read here',
      { runId },
    );
}

export type StoredSignalQueue = { store: AgentSignalsStorage; threadKey: string; logger?: IMastraLogger };

/**
 * Where a durable run's pending signals are read from in this step: the store,
 * when the run is storage-backed and this process has no in-process drain for
 * it. A run whose signals the thread runtime here still queues keeps reading
 * them from there.
 */
export function storedSignalQueueForRun({
  mastra,
  runId,
  input,
  claim,
  hasLocalDrain,
}: {
  mastra: Mastra | undefined;
  runId: string;
  input: DurableRunInput | undefined;
  claim: Pick<DurableExecutionClaim, 'threadId' | 'resourceId'> | undefined;
  hasLocalDrain: boolean;
}): StoredSignalQueue | undefined {
  if (hasLocalDrain) return undefined;
  const store = durableRunSignalsStore(mastra, input);
  if (!store && input?.signalsStored) warnMissingSignalsStore(mastra, runId);
  const threadKey = store ? durableRunThreadKey(input, claim) : undefined;
  return store && threadKey ? { store, threadKey, logger: mastra?.getLogger?.() } : undefined;
}

/**
 * Close a storage-backed run that ended: delete what it consumed since its last
 * drain and leave the rest to the thread's next run. Safe to repeat. No-op for
 * runs whose signals are not stored.
 *
 * A failed close doesn't fail the run's ending: the run's untaken rows then
 * stay addressed to it, and the thread's next run takes them over at its first
 * model request. Returns nothing to wait for when the run's signals are not
 * stored, so other runs end exactly as before.
 */
export function closeStoredSignalRun({
  mastra,
  runId,
  input,
  claim,
  state,
  deadline,
}: {
  mastra: Mastra | undefined;
  runId: string;
  input: DurableRunInput | undefined;
  claim: Pick<DurableExecutionClaim, 'threadId' | 'resourceId'> | undefined;
  /** The run's latest saved workflow state, or a read of it. */
  state: unknown | (() => unknown);
  /** Set by the close of the run's total deadline. */
  deadline?: boolean;
}): Promise<void> | undefined {
  const queue = storedSignalQueueForRun({ mastra, runId, input, claim, hasLocalDrain: false });
  if (!queue) return undefined;
  // A step the deadline cut off took signals its saved state doesn't list, and the deadline saves them to memory.
  // Only the deadline's close knows that set, so when this process's deadline is going to close the run, the run's
  // other endings leave the close to it.
  if (!deadline && getRunRegistryEntry(runId, mastra)?.deadlineClosesStoredSignals) return undefined;
  return (async () => {
    try {
      const saved = typeof state === 'function' ? await state() : state;
      await queue.store.closeRun({ threadKey: queue.threadKey, runId, consumedIds: readConsumedSignalIds(saved) });
    } catch (error) {
      mastra?.getLogger?.()?.warn?.('Could not close the stored signals of an ended run', { runId, error });
    }
  })();
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
  queue: { store, threadKey, logger },
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
    // A row this release can't read stays claimed and unconsumed, so the run's close releases it for a release
    // that can.
    const decoded = decodeStoredSignals(
      rows.filter(row => !skip.has(row.id)),
      (id, error) =>
        logger?.warn?.('Skipped a stored agent signal this version cannot read', { runId, signalId: id, error }),
    );
    for (const { row, signal } of decoded) {
      skip.add(row.id);
      ids.push(row.id);
      signals.push(signal);
    }
  }
  return { signals, state: { [CONSUMED_SIGNAL_IDS_KEY]: ids } };
}

/**
 * The LLM step's reads: pre-run signals (with the thread takeover) for the
 * run's first request, pending ones for later requests. Returns `undefined`
 * when the run's signals are not read from the store here, while the run is
 * aborted, or when the store failed, so the saved consumed set stays as it is.
 * A failed read takes nothing, as the loop's other drain points do: the rows
 * come back at the next drain. Returns nothing to wait for when there is no
 * read to make.
 */
export function drainStoredSignalsForRequest({
  params,
  mastra,
  runId,
  input,
  requestContext,
  hasLocalDrain,
  preRun,
  pending,
  aborted,
}: {
  params: { getState(keys?: readonly string[]): Promise<unknown> };
  mastra: Mastra | undefined;
  runId: string;
  input: Pick<DurableRunInput, 'signalsStored' | 'state'>;
  requestContext: RequestContext | undefined;
  hasLocalDrain: boolean;
  preRun: boolean;
  pending: boolean;
  aborted: boolean;
}): Promise<StoredSignalDrain | undefined> | undefined {
  const queue = storedSignalQueueForRun({
    mastra,
    runId,
    input,
    claim: getExecutionClaim(requestContext, runId),
    hasLocalDrain,
  });
  if (!queue || aborted || (!preRun && !pending)) return undefined;
  return (async () => {
    try {
      return await claimStoredSignals({
        queue,
        runId,
        consumed: readConsumedSignalIds(await params.getState([CONSUMED_SIGNAL_IDS_KEY])),
        claims: [
          ...(preRun ? [{ scope: 'pre-run' as const, leftovers: true }] : []),
          ...(pending ? [{ scope: 'pending' as const }] : []),
        ],
      });
    } catch (error) {
      mastra?.getLogger?.()?.warn?.('Could not read the stored signals of a run for its model request', {
        runId,
        error,
      });
      return undefined;
    }
  })();
}

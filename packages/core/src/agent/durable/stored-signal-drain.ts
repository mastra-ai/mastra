import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { MessageList } from '../message-list';
import type { CreatedAgentSignal } from '../signals';
import { pendingSignalsStoreOf, storedRowsToSignals } from '../stored-signals';
import type { ThreadSignalsStore } from '../stored-signals';
import { getRunRegistryEntry } from './run-registry';
import type { DurableAgenticWorkflowInput } from './types';
import { resolveRunMemory } from './utils/resolve-runtime';

/**
 * Workflow-state key of the ids of every signal a storage-backed run took into
 * its transcript, saved in the same state write as that transcript. A claim
 * skips them, and the run's close deletes the ones that never reached memory.
 */
export const CONSUMED_SIGNAL_IDS_KEY = 'consumedSignalIds';

/** The consumed set in workflow state. A run started before the set existed has consumed nothing. */
export function readConsumedSignalIds(state: unknown): string[] {
  const ids = (state as { [CONSUMED_SIGNAL_IDS_KEY]?: unknown } | undefined)?.[CONSUMED_SIGNAL_IDS_KEY];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

/** Ids of the signals the run was started with. They reach the transcript as input, not through a drain. */
export function inputSignalIds(messageList: MessageList): string[] {
  return messageList.get.input
    .db()
    .filter(message => message.role === 'signal')
    .map(message => message.id);
}

type DurableRunInput = Partial<
  Pick<DurableAgenticWorkflowInput, 'agentId' | 'agentVersionId' | 'requestContextEntries' | 'signalsStored'>
> & {
  state?: { threadId?: string; resourceId?: string };
};

const MAX_REPORTED_RUN_PROBLEMS = 1000;
/** Run id and message of each problem already logged. */
const reportedRunProblems = new Set<string>();

/** Logs an error about a storage-backed run once per process for each message. */
function reportRunOnce(logger: IMastraLogger | undefined, runId: string, message: string, data: object) {
  const problem = `${runId}\u0000${message}`;
  if (reportedRunProblems.has(problem)) return;
  reportedRunProblems.add(problem);
  if (reportedRunProblems.size > MAX_REPORTED_RUN_PROBLEMS) {
    reportedRunProblems.delete(reportedRunProblems.values().next().value!);
  }
  logger?.error?.(message, { runId, ...data });
}

/**
 * Where a durable run's pending signals are read and settled in this process,
 * or `undefined` when the run keeps them in the thread runtime's queues. The
 * run carries the decision in its input, made once when it was prepared. The
 * store comes from the memory this process holds for the run or from the agent
 * and the request context entries the run carries, and is kept on the run's
 * registry entry once resolved. A resolution that fails or finds no store is
 * tried again at the next site. A run whose memory resolves here to no store,
 * or to a store without its thread, reads nothing here, and that is logged
 * once.
 */
export function durableRunSignalsStore({
  mastra,
  runId,
  input,
  requestContext,
}: {
  mastra: Mastra | undefined;
  runId: string;
  input: DurableRunInput | undefined;
  requestContext?: RequestContext;
}): Promise<ThreadSignalsStore | undefined> | undefined {
  if (!input?.signalsStored) return undefined;
  const entry = getRunRegistryEntry(runId, mastra);
  if (entry?.pendingSignalsStore) return Promise.resolve(entry.pendingSignalsStore);
  const logger = mastra?.getLogger?.();
  const { threadId, resourceId } = input.state ?? {};
  const { agentId } = input;
  return (async (): Promise<ThreadSignalsStore | undefined> => {
    if (!mastra || !threadId || !resourceId || !agentId) return undefined;
    const memory = await resolveRunMemory({ mastra, runId, input: { ...input, agentId }, requestContext });
    const store = await pendingSignalsStoreOf(memory);
    if (!store) {
      reportRunOnce(logger, runId, 'This run keeps its signals in memory storage that this process cannot resolve', {
        agentId,
        threadId,
      });
      return undefined;
    }
    if (!(await store.getThreadById({ threadId }))) {
      reportRunOnce(logger, runId, "This run's memory storage has no row for its thread: its signals are not read", {
        agentId,
        threadId,
      });
    }
    const resolved = { store, threadId, resourceId };
    if (entry) entry.pendingSignalsStore = resolved;
    return resolved;
  })().catch(error => {
    reportRunOnce(logger, runId, 'Could not resolve the memory storage that keeps the signals of this run', {
      agentId,
      threadId,
      error,
    });
    return undefined;
  });
}

/**
 * Close a storage-backed run that ended: the store deletes the rows it consumed
 * that never reached memory and gives its other claimed rows back to the
 * thread. Safe to repeat. Returns nothing to wait for when the run's signals
 * are not stored, so other runs end without waiting on it.
 *
 * A failed close doesn't fail the run's ending: the thread keeps the run as
 * its signal run until the thread's next run is prepared.
 */
export function closeStoredSignalRun({
  mastra,
  runId,
  input,
  requestContext,
  state,
  deadline,
}: {
  mastra: Mastra | undefined;
  runId: string;
  input: DurableRunInput | undefined;
  requestContext?: RequestContext;
  /** The run's latest saved workflow state, or a read of it. */
  state: unknown | (() => unknown);
  /** Set by the close of the run's total deadline. */
  deadline?: boolean;
}): Promise<void> | undefined {
  const resolving = durableRunSignalsStore({ mastra, runId, input, requestContext });
  if (!resolving) return undefined;
  // A step the deadline cut off took signals its saved state doesn't list, and the deadline saves them to memory.
  // Only the deadline's close knows that set, so when this process's deadline is going to close the run, the run's
  // other endings leave the close to it.
  if (!deadline && getRunRegistryEntry(runId, mastra)?.deadlineClosesStoredSignals) return undefined;
  return (async () => {
    try {
      const queue = await resolving;
      if (!queue) {
        // The thread keeps the run as its signal run until its next run is prepared.
        mastra
          ?.getLogger?.()
          ?.warn?.('Could not close the stored signals of an ended run: its memory storage could not be resolved', {
            runId,
            agentId: input?.agentId,
            threadId: input?.state?.threadId,
          });
        return;
      }
      const saved = typeof state === 'function' ? await state() : state;
      await queue.store.closeSignalRun({ threadId: queue.threadId, runId, consumedIds: readConsumedSignalIds(saved) });
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
 * One drain of a storage-backed run: claim the thread's pending rows and get
 * back every row the run claimed that its saved state doesn't list as
 * consumed. A step that fails before saving its result gets the same rows
 * again from its retry, and a step that saved it never gets them again.
 */
export async function claimStoredSignals({
  queue: { store, threadId },
  runId,
  consumed,
  logger,
}: {
  queue: ThreadSignalsStore;
  runId: string;
  consumed: readonly string[];
  logger?: IMastraLogger;
}): Promise<StoredSignalDrain> {
  const rows = await store.claimPendingSignals({ threadId, runId, consumedIds: [...consumed] });
  const signals = storedRowsToSignals(rows, (id, error) =>
    logger?.warn?.('Skipped a stored agent signal this version cannot read', { runId, signalId: id, error }),
  );
  const ids = new Set(consumed);
  for (const signal of signals) ids.add(signal.id);
  return { signals, state: { [CONSUMED_SIGNAL_IDS_KEY]: [...ids] } };
}

/**
 * The drain of a storage-backed run at one site: `undefined` when the run's
 * signals are not stored, `drain()` resolves `undefined` when the run is
 * aborted or the store failed, so the saved consumed set stays as it is. A
 * failed claim takes nothing, as the loop's other drain points do: the rows
 * come back at the next drain.
 */
export function storedSignalDrain({
  mastra,
  runId,
  input,
  requestContext,
  getState,
}: {
  mastra: Mastra | undefined;
  runId: string;
  input: DurableRunInput | undefined;
  requestContext?: RequestContext;
  getState: (keys: readonly string[]) => Promise<unknown>;
}): (() => Promise<StoredSignalDrain | undefined>) | undefined {
  const resolving = durableRunSignalsStore({ mastra, runId, input, requestContext });
  if (!resolving) return undefined;
  const logger = mastra?.getLogger?.();
  return async () => {
    try {
      const queue = await resolving;
      if (!queue) return undefined;
      return await claimStoredSignals({
        queue,
        runId,
        consumed: readConsumedSignalIds(await getState([CONSUMED_SIGNAL_IDS_KEY])),
        logger,
      });
    } catch (error) {
      logger?.warn?.('Could not read the stored signals of a run', { runId, error });
      return undefined;
    }
  };
}

import { TTLCache } from '@isaacs/ttlcache';
import { MastraError } from '../../../../error';
import type { Mastra } from '../../../../mastra';
import type { MastraMemory } from '../../../../memory/memory';
import type { RequestContext } from '../../../../request-context';
import { delay } from '../../../../utils';
import { createStoredMessageLoader, MemoryMessageRefs } from '../../../message-list/memory-message-refs';
import type { DehydratedMessageListState, StoredMessageLoader } from '../../../message-list/memory-message-refs';
import type { SerializedMessageListState } from '../../../message-list/state';
import { globalRunRegistry } from '../../run-registry';
import type { SerializableDurableState } from '../../types';
import { restoreRequestContext } from '../../utils/resolve-runtime';

type MessageListStateCarrier = { messageListState?: SerializedMessageListState };
type StoredMessageListStateCarrier = { messageListState?: DehydratedMessageListState };

/** The parts of a durable step's (or the loop predicate's) params these helpers use. */
type TranscriptParams = {
  state: unknown;
  getInitData(): unknown;
  mastra?: Mastra;
  requestContext?: RequestContext<any>;
  abortSignal?: AbortSignal;
};

type WritableTranscriptParams = TranscriptParams & { setState(state: unknown): Promise<void> };

/**
 * Where the serialized transcript (`messageListState`) lives between steps.
 *
 * The durable loop seeds it into workflow state once (`init-iteration-state`),
 * so every persisted snapshot carries a single copy in `value` instead of one
 * per step payload. Runs that never seeded it — those persisted before the
 * move, or workflows composing these steps without seeding — keep threading
 * it through step input/output unchanged.
 *
 * In workflow state, memory-recalled messages are kept as refs to their
 * memory rows (see {@link MemoryMessageRefs}): reads restore them, writes
 * re-create them. Step payloads always carry the full transcript.
 */
export async function readMessageListState(
  params: TranscriptParams,
  stepPayload: unknown,
): Promise<SerializedMessageListState> {
  // Every durable run carries the transcript in at least one of the two;
  // workflow state wins.
  const stored = (params.state as StoredMessageListStateCarrier | undefined)?.messageListState;
  if (stored === undefined) {
    return (stepPayload as MessageListStateCarrier).messageListState as SerializedMessageListState;
  }
  return hydrateMidRun(runTranscriptRefs(params), stored, params.abortSignal);
}

/**
 * Stores an updated transcript where this run keeps it. Returns the fields to
 * spread into the step output: nothing when it went to workflow state,
 * `{ messageListState }` when the run threads it through step payloads.
 */
export async function storeMessageListState(
  params: WritableTranscriptParams,
  messageListState: SerializedMessageListState,
): Promise<MessageListStateCarrier> {
  const workflowState = params.state as StoredMessageListStateCarrier | undefined;
  if (workflowState?.messageListState === undefined) {
    return { messageListState };
  }
  // The default engine replaces state wholesale on setState.
  await params.setState({ ...workflowState, messageListState: await dehydrate(params, messageListState) });
  return {};
}

/** Moves the run's initial transcript into workflow state. */
export async function seedMessageListState(
  params: WritableTranscriptParams,
  messageListState: SerializedMessageListState,
): Promise<void> {
  await params.setState({ ...(params.state as object), messageListState: await dehydrate(params, messageListState) });
}

/**
 * The transcript for code that reads and rewrites it in place across several
 * phases (the continuation predicate): restored once up front, then `write`
 * keeps the live copy and stores it back where it came from.
 */
export async function openMessageListState(
  params: TranscriptParams,
  stepPayload: MessageListStateCarrier,
): Promise<{ read(): SerializedMessageListState; write(next: SerializedMessageListState): void }> {
  const workflowState = params.state as StoredMessageListStateCarrier | undefined;
  if (workflowState?.messageListState === undefined) {
    return {
      read: () => stepPayload.messageListState as SerializedMessageListState,
      write: next => {
        stepPayload.messageListState = next;
      },
    };
  }
  const run = runTranscriptRefs(params);
  let current = await hydrateMidRun(run, workflowState.messageListState, params.abortSignal);
  return {
    read: () => current,
    write: next => {
      current = next;
      // The messages the run recalled were restored (or verified) on the way
      // in, so storing needs no further reads.
      workflowState.messageListState = run.refs.dehydrate(next);
    },
  };
}

let midRunLoadRetryDelaysMs: readonly number[] = [500, 2_000, 8_000];

/** Test hook: replaces the waits between mid-run load retries. Returns a restore function. */
export function __setMidRunLoadRetryDelaysForTests(delays: readonly number[]): () => void {
  const previous = midRunLoadRetryDelaysMs;
  midRunLoadRetryDelaysMs = delays;
  return () => {
    midRunLoadRetryDelaysMs = previous;
  };
}

/**
 * Restores refs inside a running step or the loop predicate. A step without
 * this process's loaded rows (another worker, an evicted cache entry) reads
 * them from memory storage after the iteration's tools already ran, so a
 * failure here would end the run with no way to retry it. Transient storage
 * errors are retried for about ten seconds first. Every caller reads before
 * doing any work, so a retry repeats nothing.
 */
async function hydrateMidRun(
  run: ReturnType<typeof runTranscriptRefs>,
  stored: DehydratedMessageListState,
  abortSignal: AbortSignal | undefined,
): Promise<SerializedMessageListState> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run.refs.hydrate(stored, run.load, run);
    } catch (error) {
      const wait = midRunLoadRetryDelaysMs[attempt];
      // A missing memory store won't appear on a retry.
      const permanent = error instanceof MastraError && error.id === 'AGENT_MEMORY_MESSAGE_REF_UNRESOLVABLE';
      if (wait === undefined || permanent || abortSignal?.aborted) throw error;
      run.logger?.warn('Could not load recalled messages from memory storage; retrying', {
        runId: run.runId,
        attempt: attempt + 1,
        error,
      });
      await delay(wait, abortSignal);
    }
  }
}

async function dehydrate(params: TranscriptParams, messageListState: SerializedMessageListState) {
  // Function or inherited memory can resolve to another store on resume, where refs would not
  // resolve, so only fixed memory gets refs. With no refs stored, `write` above has none to make.
  const { state } = (params.getInitData() ?? {}) as RunIdentity;
  if (!state?.fixedMemory) return messageListState;
  const run = runTranscriptRefs(params);
  await run.refs.verify(messageListState, run.load, run.logger);
  return run.refs.dehydrate(messageListState);
}

/**
 * Loads the recalled messages a persisted run stores as refs before it resumes
 * or recovers, dropping any this process verified earlier so the run picks up
 * edits or deletions made in memory meanwhile. Called before anything runs, so
 * a memory storage failure leaves the run as it was; the steps then restore the
 * transcript from the rows loaded here.
 */
export async function loadMessageListStateForResume(params: TranscriptParams): Promise<void> {
  releaseMessageListState(params);
  const stored = (params.state as StoredMessageListStateCarrier | undefined)?.messageListState;
  if (stored === undefined) return;
  const run = runTranscriptRefs(params);
  await run.refs.hydrate(stored, run.load, run);
}

/** Frees this process's verified rows once the run has read its transcript for the last time. */
export function releaseMessageListState(params: TranscriptParams): void {
  const { runId } = (params.getInitData() ?? {}) as RunIdentity;
  if (runId) runMessageRefs.delete(runId);
}

/**
 * Recalled messages verified against memory storage, per run, shared by every
 * step this process runs for it. Losing an entry only costs a storage read.
 */
const runMessageRefs = new TTLCache<string, MemoryMessageRefs>({
  max: 1000,
  ttl: 10 * 60 * 1000,
  updateAgeOnGet: true,
});

type RunIdentity = {
  runId?: string;
  agentId?: string;
  requestContextEntries?: Record<string, unknown>;
  state?: SerializableDurableState;
};

function runTranscriptRefs(params: TranscriptParams) {
  // Both the outer loop's and the iteration workflow's init data carry the
  // run identity.
  const run = (params.getInitData() ?? {}) as RunIdentity;
  let refs = run.runId ? runMessageRefs.get(run.runId) : undefined;
  if (!refs) {
    refs = new MemoryMessageRefs();
    if (run.runId) runMessageRefs.set(run.runId, refs);
  }
  let memory: Promise<MastraMemory | undefined> | undefined;
  const load: StoredMessageLoader = async ids =>
    createStoredMessageLoader(await (memory ??= runMemory(params, run)))(ids);
  return { refs, load, runId: run.runId, logger: params.mastra?.getLogger?.() };
}

/** The run's memory: the live instance in this process, else re-resolved from the agent. */
async function runMemory(params: TranscriptParams, run: RunIdentity): Promise<MastraMemory | undefined> {
  const memory = run.runId ? globalRunRegistry.get(run.runId)?.memory : undefined;
  if (memory || !params.mastra || !run.agentId) return memory;
  const agent = params.mastra.getAgentById(run.agentId);
  return agent.getMemory({ requestContext: restoreRequestContext(run.requestContextEntries, params.requestContext) });
}

import { MastraError } from '../../../../error';
import type { Mastra } from '../../../../mastra';
import type { MastraMemory } from '../../../../memory/memory';
import type { RequestContext } from '../../../../request-context';
import { delay } from '../../../../utils';
import type { WorkflowRunState } from '../../../../workflows/types';
import { createStoredMessageLoader, isMemoryMessageRef } from '../../../message-list/memory-message-refs';
import type { DehydratedMessageListState, StoredMessageLoader } from '../../../message-list/memory-message-refs';
import type { SerializedMessageListState } from '../../../message-list/state';
import { getRunMessageRefs, peekRunMessageRefs, releaseRunMessageRefs } from '../../run-message-refs';
import { getRunRegistryEntry } from '../../run-registry';
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
 * In workflow state, messages memory already stores (recalled, or saved by
 * this run) are kept as refs to their memory rows (see {@link MemoryMessageRefs}): reads restore them, writes
 * re-create them. Step payloads carry the full transcript while a step runs;
 * {@link dehydrateSnapshotTranscripts} swaps in refs when a snapshot is persisted.
 */
export async function readMessageListState(
  params: TranscriptParams,
  stepPayload: unknown,
): Promise<SerializedMessageListState> {
  // Every durable run carries the transcript in at least one of the two;
  // workflow state wins.
  // A payload read back from a persisted snapshot can hold refs too.
  const stored =
    (params.state as StoredMessageListStateCarrier | undefined)?.messageListState ??
    (stepPayload as StoredMessageListStateCarrier | undefined)?.messageListState;
  if (!stored?.messages?.some(isMemoryMessageRef)) return stored as SerializedMessageListState;
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
    stepPayload.messageListState = await readMessageListState(params, stepPayload);
    return {
      read: () => stepPayload.messageListState as SerializedMessageListState,
      write: next => {
        stepPayload.messageListState = next;
      },
    };
  }
  const run = runTranscriptRefs(params);
  const { state } = (params.getInitData() ?? {}) as RunIdentity;
  let current = await hydrateMidRun(run, workflowState.messageListState, params.abortSignal);
  return {
    read: () => current,
    write: next => {
      current = next;
      // The messages the run recalled were restored (or verified) on the way
      // in, and saved ones were recorded when saved, so storing needs no reads.
      workflowState.messageListState = state?.fixedMemory ? run.refs.dehydrate(next) : next;
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
  // resolve, so only fixed memory gets refs.
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

/** Restores the refs in a transcript read straight from a persisted snapshot. */
export async function hydrateMessageListState(
  params: TranscriptParams,
  stored: DehydratedMessageListState,
): Promise<SerializedMessageListState> {
  const run = runTranscriptRefs(params);
  return run.refs.hydrate(stored, run.load, run);
}

/**
 * Replaces messages memory already stores with refs in the transcript copies a
 * persisted snapshot carries outside workflow state: the run input, step
 * payloads and outputs, and the evented engine's `__state` mirror. Without
 * this every checkpoint rewrites the conversation once per copy (#26600).
 * Never reads storage; anything not yet saved stays inline. Copy-on-write.
 */
export function dehydrateSnapshotTranscripts(snapshot: WorkflowRunState): WorkflowRunState {
  const context = snapshot.context as Record<string, unknown> | undefined;
  const input = context?.input as { state?: SerializableDurableState } | undefined;
  const refs = input?.state?.fixedMemory ? peekRunMessageRefs(snapshot.runId) : undefined;
  if (!context || !refs) return snapshot;
  const withRefs = (carrier: unknown) => {
    const state = (carrier as MessageListStateCarrier | undefined)?.messageListState;
    if (!state?.messages) return carrier;
    const next = refs.dehydrate(state);
    return next === state ? carrier : { ...(carrier as object), messageListState: next };
  };
  let changed = false;
  const nextContext: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    let next = value;
    if (key === 'input' || key === '__state') {
      next = withRefs(value);
    } else if (value && typeof value === 'object') {
      const step = value as { payload?: unknown; output?: unknown };
      const payload = withRefs(step.payload);
      const output = withRefs(step.output);
      if (payload !== step.payload || output !== step.output) next = { ...step, payload, output };
    }
    changed ||= next !== value;
    nextContext[key] = next;
  }
  // Workflow state was dehydrated when written, which can predate the save.
  const value = withRefs(snapshot.value) as WorkflowRunState['value'];
  if (!changed && value === snapshot.value) return snapshot;
  return { ...snapshot, value, context: (changed ? nextContext : context) as WorkflowRunState['context'] };
}

/** Loads stored messages of the run by id from the run's memory. */
export function loadRunStoredMessages(params: TranscriptParams): StoredMessageLoader {
  return runTranscriptRefs(params).load;
}

/** Frees this process's verified rows once the run has read its transcript for the last time. */
export function releaseMessageListState(params: TranscriptParams): void {
  const { runId } = (params.getInitData() ?? {}) as RunIdentity;
  releaseRunMessageRefs(runId);
}

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
  const refs = getRunMessageRefs(run.runId);
  let memory: Promise<MastraMemory | undefined> | undefined;
  const load: StoredMessageLoader = async ids =>
    createStoredMessageLoader(await (memory ??= runMemory(params, run)))(ids);
  return { refs, load, runId: run.runId, logger: params.mastra?.getLogger?.() };
}

/** The run's memory: the live instance in this process, else re-resolved from the agent. */
async function runMemory(params: TranscriptParams, run: RunIdentity): Promise<MastraMemory | undefined> {
  const memory = run.runId ? getRunRegistryEntry(run.runId, params.mastra)?.memory : undefined;
  if (memory || !params.mastra || !run.agentId) return memory;
  const agent = params.mastra.getAgentById(run.agentId);
  return agent.getMemory({ requestContext: restoreRequestContext(run.requestContextEntries, params.requestContext) });
}

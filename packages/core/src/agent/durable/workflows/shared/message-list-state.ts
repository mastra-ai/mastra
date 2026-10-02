import { TTLCache } from '@isaacs/ttlcache';
import type { Mastra } from '../../../../mastra';
import type { MastraMemory } from '../../../../memory/memory';
import type { RequestContext } from '../../../../request-context';
import { createStoredMessageLoader, MemoryMessageRefs } from '../../../message-list/memory-message-refs';
import type { DehydratedMessageListState, StoredMessageLoader } from '../../../message-list/memory-message-refs';
import type { SerializedMessageListState } from '../../../message-list/state';
import { globalRunRegistry } from '../../run-registry';
import { restoreRequestContext } from '../../utils/resolve-runtime';

type MessageListStateCarrier = { messageListState?: SerializedMessageListState };
type StoredMessageListStateCarrier = { messageListState?: DehydratedMessageListState };

/** The parts of a durable step's (or the loop predicate's) params these helpers use. */
type TranscriptParams = {
  state: unknown;
  getInitData(): unknown;
  mastra?: Mastra;
  requestContext?: RequestContext<any>;
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
  const run = runTranscriptRefs(params);
  return run.refs.hydrate(stored, run.load, run);
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
  let current = await run.refs.hydrate(workflowState.messageListState, run.load, run);
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

async function dehydrate(params: TranscriptParams, messageListState: SerializedMessageListState) {
  const run = runTranscriptRefs(params);
  await run.refs.verify(messageListState, run.load, run.logger);
  return run.refs.dehydrate(messageListState);
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

type RunIdentity = { runId?: string; agentId?: string; requestContextEntries?: Record<string, unknown> };

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

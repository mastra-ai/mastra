import {
  createStoredMessageLoader,
  isMemoryMessageRef,
  MemoryMessageRefs,
} from '../agent/message-list/memory-message-refs';
import type { DehydratedMessageListState } from '../agent/message-list/memory-message-refs';
import type { SerializedMessageListState } from '../agent/message-list/state';
import type { IMastraLogger } from '../logger';
import type { MastraMemory } from '../memory/memory';

type StreamState = { messageList?: SerializedMessageListState | DehydratedMessageListState } & Record<string, unknown>;

/**
 * The `__streamState` a resumed run restores from: the one stashed by the
 * first suspended step of the agentic-loop snapshot.
 */
export function findSuspendedStreamState(snapshot: any): { stepId: string; streamState: StreamState } | undefined {
  for (const stepId in snapshot?.context) {
    const step = snapshot.context[stepId];
    if (step && step.status === 'suspended' && step.suspendPayload?.__streamState) {
      return { stepId, streamState: step.suspendPayload.__streamState };
    }
  }
  return undefined;
}

/**
 * A serialized stream state for a suspend payload, with the memory-recalled
 * messages its transcript copies kept as refs to their memory rows (see
 * {@link MemoryMessageRefs}).
 */
export async function dehydrateStreamState(
  state: StreamState | undefined,
  refs: MemoryMessageRefs,
  memory: MastraMemory | undefined,
  logger?: IMastraLogger,
): Promise<StreamState | undefined> {
  const messageList = state?.messageList as SerializedMessageListState | undefined;
  if (!state || !messageList) return state;
  await refs.verify(messageList, createStoredMessageLoader(memory), logger);
  const dehydrated = refs.dehydrate(messageList);
  return dehydrated === messageList ? state : { ...state, messageList: dehydrated };
}

/** `snapshot` with the stream state its resume restores from carrying full messages again. */
export async function hydrateSuspendedStreamState<T>(
  snapshot: T,
  memory: MastraMemory | undefined,
  context: { logger?: IMastraLogger; runId?: string } = {},
): Promise<T> {
  const suspended = findSuspendedStreamState(snapshot);
  const messageList = suspended?.streamState.messageList;
  if (!suspended || !messageList?.messages?.some(isMemoryMessageRef)) return snapshot;

  const hydrated = await new MemoryMessageRefs().hydrate(messageList, createStoredMessageLoader(memory), context);
  const { context: steps } = snapshot as { context: Record<string, any> };
  const step = steps[suspended.stepId];
  return {
    ...snapshot,
    context: {
      ...steps,
      [suspended.stepId]: {
        ...step,
        suspendPayload: {
          ...step.suspendPayload,
          __streamState: { ...suspended.streamState, messageList: hydrated },
        },
      },
    },
  };
}

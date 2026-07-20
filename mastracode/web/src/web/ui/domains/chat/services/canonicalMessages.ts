import type { MastraDBMessage } from '@mastra/core/agent-controller';

export interface CanonicalMessageState {
  threadId?: string;
  messages: MastraDBMessage[];
  optimisticIds: Set<string>;
}

export function createCanonicalMessageState(
  messages: MastraDBMessage[],
  threadId?: string,
): CanonicalMessageState {
  return { threadId, messages: [...messages], optimisticIds: new Set() };
}

export function resetCanonicalMessages(
  _state: CanonicalMessageState,
  threadId: string | undefined,
  messages: MastraDBMessage[],
): CanonicalMessageState {
  return createCanonicalMessageState(messages, threadId);
}

export function addOptimisticMessage(
  state: CanonicalMessageState,
  message: MastraDBMessage,
): CanonicalMessageState {
  return {
    ...state,
    messages: [...state.messages, message],
    optimisticIds: new Set([...state.optimisticIds, message.id]),
  };
}

export function upsertCanonicalMessage(
  state: CanonicalMessageState,
  message: MastraDBMessage,
): CanonicalMessageState {
  const existingIndex = state.messages.findIndex(candidate => candidate.id === message.id);
  if (existingIndex >= 0) {
    const messages = [...state.messages];
    messages[existingIndex] = message;
    const optimisticIds = new Set(state.optimisticIds);
    optimisticIds.delete(message.id);
    return { ...state, messages, optimisticIds };
  }

  const optimisticIndex = findOptimisticEcho(state, message);
  if (optimisticIndex >= 0) {
    const optimisticId = state.messages[optimisticIndex].id;
    const messages = [...state.messages];
    messages[optimisticIndex] = message;
    const optimisticIds = new Set(state.optimisticIds);
    optimisticIds.delete(optimisticId);
    return { ...state, messages, optimisticIds };
  }

  return { ...state, messages: [...state.messages, message] };
}

function findOptimisticEcho(state: CanonicalMessageState, message: MastraDBMessage): number {
  if (message.role !== 'user') return -1;
  return state.messages.findIndex(
    candidate =>
      candidate.role === 'user' &&
      state.optimisticIds.has(candidate.id) &&
      JSON.stringify(candidate.content.parts) === JSON.stringify(message.content.parts),
  );
}

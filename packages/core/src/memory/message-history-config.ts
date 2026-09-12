import type { MastraDBMessage } from '../agent/message-list';
import type { StorageThreadType } from './types';

/**
 * Token budget for conversation history. Only remembered messages are removed;
 * system instructions and the current turn's input/output are never trimmed.
 */
export type MessageTokens = {
  /** Token budget for context (system prompt + history + current turn). */
  maxTokens: number;
  /** Tokens to free when the budget is exceeded. Defaults to 25% of maxTokens. */
  atMaxRemoveTokens?: number;
};

export type MessageHistoryConfig = {
  enabled: boolean;
  /** Message-count cap. `undefined` means no count cap (token-only history). */
  maxMessages: number | undefined;
  maxTokens?: number;
  atMaxRemoveTokens?: number;
};

/**
 * Resolves `lastMessages` and `messageTokens` into a single history config.
 * A numeric `lastMessages` is a count cap on top of the token budget; `false` disables history entirely.
 */
export function normalizeMessageHistoryConfig(
  lastMessages: number | false | undefined,
  messageTokens?: MessageTokens,
): MessageHistoryConfig {
  if (
    typeof lastMessages === 'number' &&
    (!Number.isFinite(lastMessages) || lastMessages < 0 || !Number.isInteger(lastMessages))
  ) {
    throw new Error('lastMessages must be a finite non-negative integer');
  }
  const maxMessages = lastMessages === false ? 0 : lastMessages;
  if (messageTokens === undefined) {
    return { enabled: maxMessages !== undefined && maxMessages !== 0, maxMessages };
  }
  const { maxTokens, atMaxRemoveTokens } = messageTokens;
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens < 0) {
    throw new Error('messageTokens.maxTokens must be a finite non-negative number');
  }
  if (
    atMaxRemoveTokens !== undefined &&
    (!Number.isFinite(atMaxRemoveTokens) || atMaxRemoveTokens < 0 || atMaxRemoveTokens > maxTokens)
  ) {
    throw new Error('messageTokens.atMaxRemoveTokens must be a finite non-negative number no greater than maxTokens');
  }
  return {
    enabled: maxMessages !== 0,
    maxMessages,
    maxTokens,
    atMaxRemoveTokens: atMaxRemoveTokens ?? maxTokens * 0.25,
  };
}

export type MemoryTokenBoundary = {
  createdAt: string;
  messageIds: string[];
  maxTokens: number;
  atMaxRemoveTokens: number;
};

export function getMemoryTokenBoundary(
  thread: Pick<StorageThreadType, 'metadata'> | undefined | null,
): MemoryTokenBoundary | undefined {
  const value = thread?.metadata?.memoryTokenLimiter;
  if (!value || typeof value !== 'object') return;
  if (!('createdAt' in value) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)))
    return;
  if (
    !('messageIds' in value) ||
    !Array.isArray(value.messageIds) ||
    !value.messageIds.every(id => typeof id === 'string')
  )
    return;
  if (!('maxTokens' in value) || typeof value.maxTokens !== 'number') return;
  if (!('atMaxRemoveTokens' in value) || typeof value.atMaxRemoveTokens !== 'number') return;
  return {
    createdAt: value.createdAt,
    messageIds: value.messageIds,
    maxTokens: value.maxTokens,
    atMaxRemoveTokens: value.atMaxRemoveTokens,
  };
}

export function isAfterMemoryTokenBoundary(message: MastraDBMessage, boundary: MemoryTokenBoundary): boolean {
  const time = new Date(message.createdAt).getTime();
  const start = Date.parse(boundary.createdAt);
  return time > start || (time === start && !boundary.messageIds.includes(message.id));
}

/** Keep the cursor monotonic even when semantic recall brings back older messages. */
export function advanceMemoryTokenBoundary(
  previous: MemoryTokenBoundary | undefined,
  removed: MastraDBMessage[],
  maxTokens: number,
  atMaxRemoveTokens: number,
): MemoryTokenBoundary | undefined {
  if (!removed.length) return previous;
  const newest = Math.max(...removed.map(message => new Date(message.createdAt).getTime()));
  const previousTime = previous ? Date.parse(previous.createdAt) : -Infinity;
  if (newest < previousTime) return previous;
  const messageIds = removed
    .filter(message => new Date(message.createdAt).getTime() === newest)
    .map(message => message.id);
  return {
    createdAt: new Date(newest).toISOString(),
    messageIds: [...new Set([...(newest === previousTime ? previous!.messageIds : []), ...messageIds])],
    maxTokens,
    atMaxRemoveTokens,
  };
}

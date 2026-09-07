import type { MastraDBMessage } from '../agent/message-list';
import type { StorageThreadType } from './types';

export type LastMessages =
  | number
  | false
  | {
      /** Maximum number of recent messages. Omit to limit only by tokens. */
      maxMessages?: number;
      /** Token budget for context; only remembered messages may be removed. */
      maxTokens?: number;
      /** Tokens to free when the budget is exceeded. Defaults to 25% of maxTokens. */
      atMaxRemoveTokens?: number;
    };

export function normalizeLastMessages(value: LastMessages | undefined) {
  if (typeof value !== 'object') {
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
      throw new Error('lastMessages must be a finite non-negative integer');
    }
    return { enabled: value !== undefined && value !== false && value !== 0, maxMessages: value === false ? 0 : value };
  }
  const { maxMessages, maxTokens, atMaxRemoveTokens } = value;
  for (const [name, limit] of Object.entries(value)) {
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) {
      throw new Error(`lastMessages.${name} must be a finite non-negative number`);
    }
  }
  if (maxMessages !== undefined && !Number.isInteger(maxMessages)) {
    throw new Error('lastMessages.maxMessages must be an integer');
  }
  if (atMaxRemoveTokens !== undefined && (maxTokens === undefined || atMaxRemoveTokens > maxTokens)) {
    throw new Error('lastMessages.atMaxRemoveTokens requires maxTokens and cannot exceed it');
  }
  return {
    enabled: maxMessages !== 0,
    maxMessages: maxMessages ?? (maxTokens === undefined ? 10 : undefined),
    maxTokens,
    atMaxRemoveTokens: maxTokens === undefined ? undefined : (atMaxRemoveTokens ?? maxTokens * 0.25),
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

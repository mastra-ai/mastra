import type { MastraDBMessage } from '@mastra/core/agent';
import type { StorageThreadType } from '@mastra/core/memory';

import type { Memory } from '../../..';

export const REMIND_PARENT_THREAD_METADATA_KEY = 'subconsciousRemindParentThreadId';
export const REMIND_MESSAGE_METADATA_KEY = 'subconsciousRemind';

export type RemindMessageMetadata =
  | {
      type: 'passive-check';
      eventId: string;
      candidateIds: string[];
    }
  | {
      type: 'question';
      replyId: string;
      askedAt: number;
    }
  | {
      type: 'continuation';
      replyIds: string[];
      attempt: number;
    };

export function getRemindThreadId(parentThreadId: string): string {
  return `subconscious:${parentThreadId}:remind`;
}

export function isOwnedRemindThread(
  thread: StorageThreadType | null | undefined,
  parentThreadId: string,
  resourceId: string,
): thread is StorageThreadType {
  return thread?.resourceId === resourceId && thread.metadata?.[REMIND_PARENT_THREAD_METADATA_KEY] === parentThreadId;
}

export async function ensureOwnedRemindThread(options: {
  memory: Memory;
  parentThreadId: string;
  resourceId: string;
}): Promise<StorageThreadType> {
  const { memory, parentThreadId, resourceId } = options;
  const threadId = getRemindThreadId(parentThreadId);
  const existing = await memory.getThreadById({ threadId });
  if (existing) {
    if (!isOwnedRemindThread(existing, parentThreadId, resourceId)) {
      throw new Error(`Refusing to use reminder thread ${threadId}: ownership metadata does not match.`);
    }
    return existing;
  }

  await memory.createThread({
    threadId,
    resourceId,
    metadata: { [REMIND_PARENT_THREAD_METADATA_KEY]: parentThreadId },
  });
  const created = await memory.getThreadById({ threadId });
  if (!isOwnedRemindThread(created, parentThreadId, resourceId)) {
    throw new Error(`Refusing to use reminder thread ${threadId}: ownership verification failed after creation.`);
  }
  return created;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseMetadata(value: unknown): RemindMessageMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const metadata = value as Record<string, unknown>;
  switch (metadata.type) {
    case 'passive-check':
      return isString(metadata.eventId) && Array.isArray(metadata.candidateIds) && metadata.candidateIds.every(isString)
        ? (metadata as RemindMessageMetadata)
        : undefined;
    case 'question':
      return isString(metadata.replyId) && typeof metadata.askedAt === 'number' && Number.isFinite(metadata.askedAt)
        ? (metadata as RemindMessageMetadata)
        : undefined;
    case 'continuation':
      return Array.isArray(metadata.replyIds) &&
        metadata.replyIds.every(isString) &&
        Number.isInteger(metadata.attempt) &&
        Number(metadata.attempt) > 0
        ? (metadata as RemindMessageMetadata)
        : undefined;
    default:
      return undefined;
  }
}

export function getRemindMessageMetadata(message: MastraDBMessage): RemindMessageMetadata | undefined {
  const metadata = message.content.metadata as Record<string, unknown> | undefined;
  return parseMetadata(metadata?.[REMIND_MESSAGE_METADATA_KEY]);
}

export function getRemindMessageText(message: MastraDBMessage): string {
  return message.content.parts
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

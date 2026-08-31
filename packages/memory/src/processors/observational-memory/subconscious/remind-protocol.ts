import type { MastraDBMessage } from '@mastra/core/agent';
import type { StorageThreadType } from '@mastra/core/memory';
import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';

import type { Memory } from '../../..';

export const REMIND_PARENT_THREAD_METADATA_KEY = 'subconsciousRemindParentThreadId';
export const REMIND_PROTOCOL_METADATA_KEY = 'subconsciousRemind';
export const REMIND_DELIVERY_METADATA_KEY = 'subconsciousRemindDelivery';

export type RemindPassiveCheckEvent = {
  kind: 'passive-check';
  eventId: string;
  deliveryId: string;
  parentAgentId: string;
  parentThreadId: string;
  resourceId: string;
  createdAt: number;
  replyRequired: false;
  candidateIds: string[];
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

function contentMetadata(message: MastraDBMessage): Record<string, unknown> | undefined {
  return message.content.metadata as Record<string, unknown> | undefined;
}

export function getRemindProtocol(message: MastraDBMessage): RemindPassiveCheckEvent | undefined {
  const value = contentMetadata(message)?.[REMIND_PROTOCOL_METADATA_KEY];
  if (!value || typeof value !== 'object' || (value as { kind?: unknown }).kind !== 'passive-check') return undefined;
  return value as RemindPassiveCheckEvent;
}

function getDeliveryEventId(message: MastraDBMessage): string | undefined {
  const metadata = contentMetadata(message);
  const direct = metadata?.[REMIND_DELIVERY_METADATA_KEY];
  const signalMetadata = metadata?.signal;
  const nested =
    signalMetadata && typeof signalMetadata === 'object'
      ? (signalMetadata as { metadata?: Record<string, unknown> }).metadata?.[REMIND_DELIVERY_METADATA_KEY]
      : undefined;
  const value = direct ?? nested;
  if (!value || typeof value !== 'object') return undefined;
  const eventId = (value as { eventId?: unknown }).eventId;
  return typeof eventId === 'string' ? eventId : undefined;
}

export class RemindEventReferenceProcessor implements Processor<'remind-event-reference'> {
  readonly id = 'remind-event-reference';
  readonly name = 'Reminder Event Reference Processor';

  constructor(
    private readonly memory: Memory,
    private readonly threadId: string,
    private readonly resourceId: string,
  ) {}

  async processInputStep({ messages }: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined> {
    const references = messages.flatMap(message => {
      const eventId = getDeliveryEventId(message);
      return eventId ? [{ message, eventId }] : [];
    });
    if (references.length === 0) return undefined;

    const canonicalById = new Map(
      messages
        .filter(message => message.role === 'user' && getRemindProtocol(message))
        .map(message => [message.id, message]),
    );
    const missingIds = references.map(reference => reference.eventId).filter(eventId => !canonicalById.has(eventId));
    if (missingIds.length > 0) {
      const store = await this.memory.storage.getStore('memory');
      const stored = await store?.listMessagesById({ messageIds: [...new Set(missingIds)] });
      for (const message of stored?.messages ?? []) {
        const protocol = getRemindProtocol(message);
        if (
          message.threadId === this.threadId &&
          message.resourceId === this.resourceId &&
          protocol?.resourceId === this.resourceId &&
          getRemindThreadId(protocol.parentThreadId) === this.threadId
        ) {
          canonicalById.set(message.id, message);
        }
      }
    }

    const referenceIds = new Set(references.map(reference => reference.message.id));
    const nextMessages = messages.filter(message => !referenceIds.has(message.id));
    for (const { eventId } of references) {
      if (!nextMessages.some(message => message.id === eventId)) {
        const canonical = canonicalById.get(eventId);
        if (!canonical) throw new Error(`Reminder event ${eventId} could not be resolved from canonical storage.`);
        nextMessages.push(canonical);
      }
    }
    return { messages: nextMessages };
  }
}

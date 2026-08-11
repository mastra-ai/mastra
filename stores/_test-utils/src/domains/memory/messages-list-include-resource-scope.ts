import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSampleMessageV2, createSampleThread } from './data';

/**
 * Contract for `include` when the caller also passes a `resourceId`.
 *
 * An `include` entry names a message by id only, so the store discovers the thread
 * from the target message itself. Without a resource predicate the store returns
 * the target message and its neighbours even when they belong to another resource.
 *
 * Call this suite from a store package to verify that its include lookup is scoped by
 * `resourceId`.
 */
export function createMessagesListIncludeResourceScopeTest({
  getMemoryStorage,
}: {
  getMemoryStorage: () => MemoryStorage;
}) {
  describe('listMessages include resource scope', () => {
    // resourceA owns threadA1 and threadA2. resourceB owns threadB1.
    let threadA1: StorageThreadType;
    let threadA2: StorageThreadType;
    let threadB1: StorageThreadType;
    let a1: MastraDBMessage;
    let a2: MastraDBMessage;
    let a3: MastraDBMessage;
    let a4: MastraDBMessage;
    let b1: MastraDBMessage;

    beforeEach(async () => {
      const memoryStorage = getMemoryStorage();
      await memoryStorage.dangerouslyClearAll();

      const resourceA = `resource-a-${Date.now()}`;
      const resourceB = `resource-b-${Date.now()}`;
      threadA1 = createSampleThread({ resourceId: resourceA });
      threadA2 = createSampleThread({ resourceId: resourceA });
      threadB1 = createSampleThread({ resourceId: resourceB });
      await memoryStorage.saveThread({ thread: threadA1 });
      await memoryStorage.saveThread({ thread: threadA2 });
      await memoryStorage.saveThread({ thread: threadB1 });

      const base = Date.UTC(2024, 0, 1);
      const at = (minute: number) => new Date(base + minute * 60_000);
      a1 = createSampleMessageV2({
        threadId: threadA1.id,
        resourceId: resourceA,
        content: { content: 'a first' },
        createdAt: at(0),
      });
      a2 = createSampleMessageV2({
        threadId: threadA1.id,
        resourceId: resourceA,
        content: { content: 'a target' },
        createdAt: at(1),
      });
      a3 = createSampleMessageV2({
        threadId: threadA1.id,
        resourceId: resourceA,
        content: { content: 'a last' },
        createdAt: at(2),
      });
      a4 = createSampleMessageV2({
        threadId: threadA2.id,
        resourceId: resourceA,
        content: { content: 'a other thread' },
        createdAt: at(3),
      });
      b1 = createSampleMessageV2({
        threadId: threadB1.id,
        resourceId: resourceB,
        content: { content: 'b message' },
        createdAt: at(4),
      });

      await memoryStorage.saveMessages({ messages: [a1, a2, a3, a4, b1] });
    });

    it('does not return messages owned by another resource', async () => {
      const result = await getMemoryStorage().listMessages({
        threadId: threadB1.id,
        resourceId: threadB1.resourceId,
        include: [{ id: a2.id, withPreviousMessages: 2, withNextMessages: 2 }],
      });

      expect(result.messages.map(message => message.id)).toEqual([b1.id]);
    });

    it('still returns a cross-thread include from the same resource', async () => {
      const result = await getMemoryStorage().listMessages({
        threadId: threadA2.id,
        resourceId: threadA2.resourceId,
        include: [{ id: a2.id, withPreviousMessages: 1, withNextMessages: 1 }],
      });

      expect(result.messages.map(message => message.id)).toEqual([a1.id, a2.id, a3.id, a4.id]);
    });

    it('builds the context window after filtering messages by resource', async () => {
      const foreignMessage = createSampleMessageV2({
        threadId: threadA1.id,
        resourceId: threadB1.resourceId,
        content: { content: 'foreign message in resource-a thread' },
        createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, 30)),
      });
      await getMemoryStorage().saveMessages({ messages: [foreignMessage] });

      const result = await getMemoryStorage().listMessages({
        threadId: threadA2.id,
        resourceId: threadA2.resourceId,
        perPage: 0,
        include: [{ id: a2.id, withPreviousMessages: 1 }],
      });

      expect(result.messages.map(message => message.id)).toEqual([a1.id, a2.id]);
    });

    it('does not return another resource on the semantic recall fast path', async () => {
      const result = await getMemoryStorage().listMessages({
        threadId: threadB1.id,
        resourceId: threadB1.resourceId,
        perPage: 0,
        include: [{ id: a2.id, withPreviousMessages: 2, withNextMessages: 2 }],
      });

      expect(result.messages).toEqual([]);
    });

    it('keeps cross-resource includes when no resourceId is given', async () => {
      const result = await getMemoryStorage().listMessages({
        threadId: threadB1.id,
        include: [{ id: a2.id, withPreviousMessages: 1, withNextMessages: 1 }],
      });

      expect(result.messages.map(message => message.id)).toEqual([a1.id, a2.id, a3.id, b1.id]);
    });

    it('reads the context window from the thread that owns the target message', async () => {
      // The include entry names a thread that the target message does not belong to.
      // The window must still come from the target message's own thread.
      const result = await getMemoryStorage().listMessages({
        threadId: threadA2.id,
        resourceId: threadA2.resourceId,
        include: [{ id: a2.id, threadId: threadB1.id, withPreviousMessages: 1, withNextMessages: 1 }],
      });

      expect(result.messages.map(message => message.id)).toEqual([a1.id, a2.id, a3.id, a4.id]);
    });

    it('does not return messages owned by another resource from listMessagesByResourceId', async () => {
      const result = await getMemoryStorage().listMessagesByResourceId({
        resourceId: threadB1.resourceId,
        include: [{ id: a2.id, withPreviousMessages: 2, withNextMessages: 2 }],
      });

      expect(result.messages.map(message => message.id)).toEqual([b1.id]);
    });

    it('does not return another resource from listMessagesByResourceId on the fast path', async () => {
      const result = await getMemoryStorage().listMessagesByResourceId({
        resourceId: threadB1.resourceId,
        perPage: 0,
        include: [{ id: a2.id, withPreviousMessages: 2, withNextMessages: 2 }],
      });

      expect(result.messages).toEqual([]);
    });

    it('returns the include context window from listMessagesByResourceId', async () => {
      const result = await getMemoryStorage().listMessagesByResourceId({
        resourceId: threadA1.resourceId,
        perPage: 0,
        include: [{ id: a2.id, withPreviousMessages: 1, withNextMessages: 1 }],
      });

      expect(result.messages.map(message => message.id)).toEqual([a1.id, a2.id, a3.id]);
    });
  });
}

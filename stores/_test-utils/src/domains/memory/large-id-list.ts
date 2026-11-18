import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSampleMessageV2, createSampleThread } from './data';

/**
 * Regression suite for issue #30858.
 *
 * The Cloudflare D1 and Durable Object memory domains built `id IN (?, ?, …)` lists from
 * caller-supplied message and thread id arrays. SQLite caps a statement at 100 bound parameters
 * (both engines: measured 100 pass, 101 fail with "too many SQL variables"), so reading, updating
 * or deleting more than ~100 messages at once failed — and real workflows hit it, e.g. moving a
 * thread to another resource re-writes every one of its messages.
 *
 * These tests use 150 ids — past the cap — and drive every affected method through the public
 * storage API, so they fail exactly the way a user's request failed.
 *
 * Deliberately not part of `createMemoryTest`: other adapters may carry the same latent bug, and
 * turning it on for all of them widens this fix's scope. Adapters that want the coverage opt in.
 */
export function createLargeIdListTests({ storage }: { storage: MastraStorage }) {
  describe('Large id lists', () => {
    // Past D1's and Durable Objects' 100-bound-parameter limit, with headroom for the extra
    // parameters some statements append after the id list (resourceId, fence guard, page).
    const TOTAL = 150;

    const threadIds = Array.from({ length: TOTAL }, (_, i) => `large-list-thread-${i}`);
    const messageIds = Array.from({ length: TOTAL }, (_, i) => `large-list-msg-${i}`);

    let memoryStorage: MemoryStorage;

    beforeAll(async () => {
      const store = await storage.getStore('memory');
      if (!store) {
        throw new Error('Memory storage not found');
      }
      memoryStorage = store;

      // One message per thread, so the same 150 ids exercise both the message-id and the
      // thread-id lists that used to be built as bound parameters.
      for (let i = 0; i < threadIds.length; i++) {
        await memoryStorage.saveThread({
          thread: createSampleThread({ id: threadIds[i]!, date: new Date(Date.now() - (TOTAL - i) * 1000) }),
        });
      }

      const messages = threadIds.map((threadId, i) => {
        const message = createSampleMessageV2({
          threadId,
          content: { content: `large list message ${i}` },
          createdAt: new Date(Date.now() - (TOTAL - i) * 1000),
        });
        message.id = messageIds[i]!;
        return message;
      });

      const { messages: saved } = await memoryStorage.saveMessages({ messages });
      expect(saved).toHaveLength(TOTAL);
    });

    it(`returns all ${TOTAL} messages when asked for more ids than the database allows bound parameters`, async () => {
      const { messages } = await memoryStorage.listMessagesById({ messageIds });

      expect(messages.map(m => m.id).sort()).toEqual([...messageIds].sort());
    });

    it(`updates more messages than the database allows bound parameters in one call`, async () => {
      const updated = await memoryStorage.updateMessages({
        messages: messageIds.map((id, i) => ({ id, content: { content: `large list updated ${i}` } })),
      });

      expect(updated).toHaveLength(TOTAL);

      const { messages } = await memoryStorage.listMessagesById({ messageIds });
      expect(messages).toHaveLength(TOTAL);

      const serialized = messages.map(m => JSON.stringify(m.content)).join('\n');
      for (let i = 0; i < TOTAL; i++) {
        expect(serialized).toContain(`large list updated ${i}`);
      }
    });

    it(`lists messages across more threads than the database allows bound parameters`, async () => {
      const result = await memoryStorage.listMessages({ threadId: threadIds, perPage: false });

      expect(result.messages.map(m => m.id).sort()).toEqual([...messageIds].sort());
      expect(result.total).toBe(TOTAL);
    });

    it(`returns context for more included messages than the database allows bound parameters`, async () => {
      const result = await memoryStorage.listMessages({
        threadId: threadIds[0]!,
        perPage: 0,
        include: messageIds.map(id => ({ id })),
      });

      expect(result.messages.map(m => m.id).sort()).toEqual([...messageIds].sort());
    });

    it(`deletes more messages than the database allows bound parameters in one call`, async () => {
      // Its own thread and its own ids, so this case does not depend on the ones above it.
      const thread = createSampleThread({ id: 'large-list-delete-thread' });
      await memoryStorage.saveThread({ thread });

      const doomed = Array.from({ length: TOTAL }, (_, i) => {
        const message = createSampleMessageV2({ threadId: thread.id, content: { content: `delete me ${i}` } });
        message.id = `large-list-delete-msg-${i}`;
        return message;
      });
      await memoryStorage.saveMessages({ messages: doomed });

      await memoryStorage.deleteMessages(doomed.map(m => m.id));

      const { messages } = await memoryStorage.listMessages({ threadId: thread.id, perPage: false });
      expect(messages).toHaveLength(0);
    });
  });
}

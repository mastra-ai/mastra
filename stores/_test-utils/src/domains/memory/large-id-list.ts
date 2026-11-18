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
        // The update contract wants a complete `MastraMessageContentV2`, so a bare
        // `{ content: string }` is rejected by the type checker. Build it from the fixture so
        // `format` and `parts` stay coherent with the text.
        messages: messageIds.map((id, i) => ({
          id,
          content: createSampleMessageV2({ threadId: threadIds[i]!, content: { content: `large list updated ${i}` } })
            .content,
        })),
      });

      expect(updated).toHaveLength(TOTAL);

      const { messages } = await memoryStorage.listMessagesById({ messageIds });
      expect(messages).toHaveLength(TOTAL);

      // Compare per id: a substring check would let `large list updated 1` match `updated 10`
      // and would pass when the update landed on the wrong message.
      const byId = new Map(messages.map(message => [message.id, message]));
      for (const [i, id] of messageIds.entries()) {
        expect(byId.get(id)).toMatchObject({ content: { content: `large list updated ${i}` } });
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

    it(`reports no further pages when the include path returns every message of the requested threads`, async () => {
      // perPage: 1 returns one message; the include brings the other one back, so the call has
      // returned everything the requested threads hold and must not advertise another page.
      // Both ids are included so the case does not depend on which message pagination picks.
      const result = await memoryStorage.listMessages({
        threadId: [threadIds[0]!, threadIds[1]!],
        perPage: 1,
        include: messageIds.slice(0, 2).map(id => ({ id })),
      });

      expect(result.messages.map(m => m.id).sort()).toEqual(messageIds.slice(0, 2).sort());
      expect(result.hasMore).toBe(false);
    });

    it(`does not count an out-of-range include as coverage for unread messages`, async () => {
      // A pinned include is fetched by id and ignores `filter.dateRange`, so it can sit outside the
      // range the count query applies. Counting it as coverage would turn `hasMore` false while a
      // message inside the range had still not been read.
      const rangeThreadA = createSampleThread({ id: 'large-list-range-a' });
      const rangeThreadB = createSampleThread({ id: 'large-list-range-b' });
      await memoryStorage.saveThread({ thread: rangeThreadA });
      await memoryStorage.saveThread({ thread: rangeThreadB });

      const base = Date.now() - 60_000;
      const makeMessage = (threadId: string, id: string, content: string, offsetMs: number) => {
        const message = createSampleMessageV2({
          threadId,
          content: { content },
          createdAt: new Date(base + offsetMs),
        });
        message.id = id;
        return message;
      };

      await memoryStorage.saveMessages({
        messages: [
          makeMessage(rangeThreadA.id, 'large-list-range-old', 'before the range', 0),
          makeMessage(rangeThreadA.id, 'large-list-range-a-current', 'inside the range', 20_000),
          makeMessage(rangeThreadB.id, 'large-list-range-b-current', 'inside the range', 30_000),
        ],
      });

      const result = await memoryStorage.listMessages({
        threadId: [rangeThreadA.id, rangeThreadB.id],
        perPage: 1,
        page: 0,
        filter: { dateRange: { start: new Date(base + 10_000) } },
        include: [{ id: 'large-list-range-old' }],
      });

      // The page holds `a-current`; `b-current` also matches the range and has not been read.
      expect(result.messages.map(m => m.id)).toContain('large-list-range-old');
      expect(result.messages.map(m => m.id)).not.toContain('large-list-range-b-current');
      expect(result.hasMore).toBe(true);
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

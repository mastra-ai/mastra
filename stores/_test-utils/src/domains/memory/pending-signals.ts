import { randomUUID } from 'node:crypto';
import { createSignal, mastraDBMessageToSignal } from '@mastra/core/agent';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleMessageV2, createSampleThread } from './data';

export interface PendingSignalsTestOptions {
  storage: MastraStorage;
  /**
   * A second storage instance on the same database, standing in for another
   * process. When given, the race tests send their concurrent calls through
   * both instances; otherwise everything goes through `storage`.
   */
  peerStorage?: MastraStorage;
}

const RACE_ITERATIONS = 25;
const RACE_ROWS = 8;

const ids = (messages: MastraDBMessage[]) => messages.map(message => message.id);
const sorted = (values: string[]) => [...values].sort();
const newRun = () => `run-${randomUUID()}`;

// Signals are ordered by createdAt, so each one gets its own millisecond in send order.
let clock = Date.now() - 60_000;
const nextCreatedAt = () => new Date(++clock);

async function memoryOf(storage: MastraStorage): Promise<MemoryStorage> {
  await storage.init();
  const store = await storage.getStore('memory');
  if (!store) throw new Error(`${storage.constructor.name} does not provide the memory domain`);
  return store;
}

/**
 * Conformance tests for pending agent signals in the memory domain. They run
 * only for stores whose memory domain sets `supportsPendingSignals`.
 */
export function createPendingSignalsTest({ storage, peerStorage }: PendingSignalsTestOptions) {
  describe('Pending agent signals', () => {
    let memory: MemoryStorage;
    let peer: MemoryStorage;

    beforeAll(async () => {
      memory = await memoryOf(storage);
      peer = peerStorage ? await memoryOf(peerStorage) : memory;
      // A peer means the caller intends to run these tests, so a missing flag must not skip them.
      if (peerStorage && !memory.supportsPendingSignals) {
        throw new Error(`${storage.constructor.name} was given a peer storage but does not set supportsPendingSignals`);
      }
    });

    beforeEach(ctx => {
      if (!memory.supportsPendingSignals) ctx.skip();
    });

    // Every test starts from a thread whose updatedAt lies in the past, so any write that touches it shows.
    async function newThread(): Promise<StorageThreadType> {
      const thread = createSampleThread({ date: new Date(Date.now() - 60_000) }) as StorageThreadType;
      return memory.saveThread({ thread });
    }

    const scope = (thread: StorageThreadType) => ({ threadId: thread.id, resourceId: thread.resourceId });
    const onThread = (thread: StorageThreadType) => ({ threadId: thread.id });

    function signalFor(
      thread: StorageThreadType,
      { id, text, createdAt }: { id?: string; text?: string; createdAt?: Date } = {},
    ): MastraDBMessage {
      return createSignal({
        type: 'user',
        id,
        contents: text ?? 'a signal',
        createdAt: createdAt ?? nextCreatedAt(),
      }).toDBMessage(scope(thread));
    }

    async function send(thread: StorageThreadType, options: { id?: string; text?: string; createdAt?: Date } = {}) {
      const message = signalFor(thread, options);
      expect(await memory.enqueuePendingSignal({ message })).toBe('accepted');
      return message;
    }

    const claim = (thread: StorageThreadType, runId: string, consumedIds: string[] = [], store = memory) =>
      store.claimPendingSignals({ threadId: thread.id, runId, consumedIds });
    const close = (thread: StorageThreadType, runId: string, consumedIds: string[] = [], store = memory) =>
      store.closeSignalRun({ threadId: thread.id, runId, consumedIds });
    const pendingIds = async (thread: StorageThreadType) => ids(await memory.listPendingSignals(onThread(thread)));
    const visibleIds = async (thread: StorageThreadType) =>
      ids((await memory.listMessages({ ...scope(thread), perPage: false })).messages);

    /** Whether no row with `id` exists: a plain send of the id then creates a pending row, which is removed again. */
    async function hasNoRow(thread: StorageThreadType, id: string) {
      expect(await pendingIds(thread)).not.toContain(id);
      await memory.enqueuePendingSignal({ message: signalFor(thread, { id }) });
      const inserted = (await pendingIds(thread)).includes(id);
      if (inserted) await memory.cancelPendingSignals({ ...onThread(thread), ids: [id] });
      return inserted;
    }

    /** Compares what a caller relies on; stores may differ in other harmless details. */
    function expectSameMessages(actual: MastraDBMessage[], expected: MastraDBMessage[]) {
      const essentials = (messages: MastraDBMessage[]) =>
        messages.map(({ id, content, createdAt }) => ({ id, content, createdAt: new Date(createdAt).getTime() }));
      expect(essentials(actual)).toEqual(essentials(expected));
    }

    function expectNoSignalKeys(messages: MastraDBMessage[]) {
      for (const message of messages) {
        expect(Object.keys(message).filter(key => key.toLowerCase().startsWith('signal'))).toEqual([]);
      }
    }

    async function startRun(thread: StorageThreadType, runId = newRun()) {
      await memory.setSignalRun({ threadId: thread.id, runId });
      return runId;
    }

    describe('signal run', () => {
      it('records and replaces the thread signal run without touching the thread', async () => {
        const thread = await newThread();
        const before = await memory.getThreadById({ threadId: thread.id });
        expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();

        const first = await startRun(thread);
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(first);
        const second = await startRun(thread);
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(second);

        expect(await memory.getThreadById({ threadId: thread.id })).toEqual(before);
      });

      it('records nothing for a thread that does not exist', async () => {
        const thread = createSampleThread() as StorageThreadType;
        await memory.setSignalRun({ threadId: thread.id, runId: newRun() });
        expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();

        await memory.saveThread({ thread });
        expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();
      });

      it('keeps the run when the thread row is saved or updated', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        await memory.saveThread({ thread: { ...thread, title: 'renamed' } });
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(runId);
        await memory.updateThread({ id: thread.id, title: 'renamed again', metadata: { key: 'other' } });
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(runId);
      });

      it("returns to the thread's next signal run the rows a run took and never closed", async () => {
        const thread = await newThread();
        const earlier = await startRun(thread);
        const first = await send(thread);
        const second = await send(thread);
        expect(ids(await claim(thread, earlier))).toEqual([first.id, second.id]);

        const later = await startRun(thread);
        expect(await claim(thread, earlier)).toEqual([]);
        const fresh = await send(thread);
        expect(ids(await claim(thread, later))).toEqual([first.id, second.id, fresh.id]);
        expect(await pendingIds(thread)).toEqual([]);
      });
    });

    describe('enqueue', () => {
      it('stores the message as a pending row that only the pending-signal list returns', async () => {
        const thread = await newThread();
        const message = await send(thread, { text: 'hello' });

        const [row, ...rest] = await memory.listPendingSignals(onThread(thread));
        expect(rest).toEqual([]);
        expect(row).toMatchObject({
          id: message.id,
          role: 'signal',
          threadId: thread.id,
          resourceId: thread.resourceId,
          type: message.type,
          content: message.content,
        });
        expect(new Date(row!.createdAt).getTime()).toBe(message.createdAt.getTime());
        expectNoSignalKeys([row!]);
      });

      it('writes nothing when a row with the id exists, whatever its state or thread', async () => {
        const thread = await newThread();
        const elsewhere = await newThread();
        const runId = await startRun(thread);

        const claimed = await send(thread, { text: 'first' });
        await claim(thread, runId);
        const pending = await send(thread, { text: 'first' });
        const saved = createSampleMessageV2({ ...scope(thread), content: { content: 'saved' } });
        await memory.saveMessages({ messages: [saved] });
        const before = await memory.listMessages({ ...scope(thread), perPage: false });

        for (const id of [pending.id, claimed.id, saved.id]) {
          for (const target of [thread, elsewhere]) {
            const message = signalFor(target, { id, text: 'second' });
            expect(await memory.enqueuePendingSignal({ message })).toBe('accepted');
          }
        }

        const [pendingRow] = await memory.listPendingSignals(onThread(thread));
        expect(pendingRow).toMatchObject({ id: pending.id, content: pending.content });
        expect(await memory.listPendingSignals(onThread(elsewhere))).toEqual([]);
        expect(await claim(thread, runId)).toMatchObject([
          { id: claimed.id, content: claimed.content },
          { id: pending.id, content: pending.content },
        ]);
        expect(await memory.listMessages({ ...scope(thread), perPage: false })).toEqual(before);
      });

      it('inserts for the thread signal run and answers run-closed for any other run', async () => {
        const thread = await newThread();
        const noRun = signalFor(thread);
        expect(await memory.enqueuePendingSignal({ message: noRun, toRunId: newRun() })).toBe('run-closed');

        const runId = await startRun(thread);
        const other = signalFor(thread);
        expect(await memory.enqueuePendingSignal({ message: other, toRunId: newRun() })).toBe('run-closed');
        const own = signalFor(thread);
        expect(await memory.enqueuePendingSignal({ message: own, toRunId: runId })).toBe('accepted');

        expect(await pendingIds(thread)).toEqual([own.id]);
        expect(await hasNoRow(thread, noRun.id)).toBe(true);
        expect(await hasNoRow(thread, other.id)).toBe(true);
      });

      it('answers thread-not-found for a run send to a thread that does not exist', async () => {
        const thread = createSampleThread() as StorageThreadType;
        const message = signalFor(thread);
        expect(await memory.enqueuePendingSignal({ message, toRunId: newRun() })).toBe('thread-not-found');

        await memory.saveThread({ thread });
        expect(await hasNoRow(thread, message.id)).toBe(true);
      });

      it('checks the thread before the id on a run send', async () => {
        const thread = await newThread();
        const existing = await send(thread);
        const missing = createSampleThread() as StorageThreadType;

        expect(await memory.enqueuePendingSignal({ message: existing, toRunId: newRun() })).toBe('run-closed');
        expect(
          await memory.enqueuePendingSignal({ message: signalFor(missing, { id: existing.id }), toRunId: newRun() }),
        ).toBe('thread-not-found');
      });

      it('accepts a plain send before the thread exists, for the run that takes the thread', async () => {
        const thread = createSampleThread() as StorageThreadType;
        const early = signalFor(thread);
        expect(await memory.enqueuePendingSignal({ message: early })).toBe('accepted');

        await memory.saveThread({ thread });
        const runId = await startRun(thread);
        expect(ids(await claim(thread, runId))).toEqual([early.id]);
      });

      it('rejects a message without a thread or a resource', async () => {
        const thread = await newThread();
        const { threadId: _threadId, ...withoutThread } = signalFor(thread);
        const { resourceId: _resourceId, ...withoutResource } = signalFor(thread);

        await expect(memory.enqueuePendingSignal({ message: withoutThread as MastraDBMessage })).rejects.toThrow();
        await expect(memory.enqueuePendingSignal({ message: withoutResource as MastraDBMessage })).rejects.toThrow();
        expect(await pendingIds(thread)).toEqual([]);
      });

      it('answers thread-not-found for a run send whose resource is not the thread resource', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const existing = await send(thread);
        const foreignResource = { ...thread, resourceId: `resource-${randomUUID()}` };

        const message = signalFor(foreignResource);
        expect(await memory.enqueuePendingSignal({ message, toRunId: runId })).toBe('thread-not-found');
        expect(
          await memory.enqueuePendingSignal({
            message: signalFor(foreignResource, { id: existing.id }),
            toRunId: runId,
          }),
        ).toBe('thread-not-found');
        expect(await pendingIds(thread)).toEqual([existing.id]);
        expect(await hasNoRow(thread, message.id)).toBe(true);
      });

      it('acts on the rows sent to the thread, whatever resource they named, and on no other thread', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const own = await send(thread);
        const foreign = signalFor({ ...thread, resourceId: `resource-${randomUUID()}` });
        expect(await memory.enqueuePendingSignal({ message: foreign })).toBe('accepted');
        const elsewhere = await newThread();
        const other = await send(elsewhere);
        const cancelled = await send(thread);

        expect(await pendingIds(thread)).toEqual([own.id, foreign.id, cancelled.id]);
        expect(await memory.cancelPendingSignals({ ...onThread(thread), ids: [cancelled.id, other.id] })).toEqual([
          cancelled.id,
        ]);
        expect(ids(await claim(thread, runId))).toEqual([own.id, foreign.id]);
        expect(await pendingIds(elsewhere)).toEqual([other.id]);

        await close(thread, runId, [own.id, other.id]);
        expect(await pendingIds(thread)).toEqual([foreign.id]);
        expect(await pendingIds(elsewhere)).toEqual([other.id]);
      });

      it('lets the signal run claim a row sent before the thread changed resource', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const sent = signalFor(thread);
        expect(await memory.enqueuePendingSignal({ message: sent, toRunId: runId })).toBe('accepted');

        await memory.updateThreadResourceId({ threadId: thread.id, resourceId: `resource-${randomUUID()}` });

        expect(ids(await claim(thread, runId))).toEqual([sent.id]);
      });
    });

    describe('message reads', () => {
      it.each(['pending', 'taken'] as const)('keeps a %s row out of every read by thread or resource', async state => {
        const thread = await newThread();
        const base = Date.now() - 10_000;
        // Every row, hidden or not, carries the metadata the filtered reads below ask for.
        const tag = { tag: `tag-${randomUUID()}` };
        const message = (owner: StorageThreadType, offset: number) =>
          createSampleMessageV2({ ...scope(owner), content: { metadata: tag }, createdAt: new Date(base + offset) });
        const sendTagged = async (owner: StorageThreadType, offset: number) => {
          const signal = signalFor(owner, { createdAt: new Date(base + offset) });
          const tagged = {
            ...signal,
            content: { ...signal.content, metadata: { ...signal.content.metadata, ...tag } },
          };
          expect(await memory.enqueuePendingSignal({ message: tagged })).toBe('accepted');
          return tagged;
        };
        const before = message(thread, 0);
        const after = message(thread, 2);
        await memory.saveMessages({ messages: [before, after] });
        const hidden = await sendTagged(thread, 1);
        // A second thread of the same resource, with a message and a hidden row of its own.
        const sibling = await memory.saveThread({
          thread: createSampleThread({ resourceId: thread.resourceId }) as StorageThreadType,
        });
        const siblingMessage = message(sibling, 3);
        await memory.saveMessages({ messages: [siblingMessage] });
        const siblingHidden = await sendTagged(sibling, 4);
        if (state === 'taken') {
          expect(ids(await claim(thread, await startRun(thread)))).toEqual([hidden.id]);
          expect(ids(await claim(sibling, await startRun(sibling)))).toEqual([siblingHidden.id]);
        }
        const visible = [before.id, after.id];

        const all = await memory.listMessages({ ...scope(thread), perPage: false });
        expect(ids(all.messages)).toEqual(visible);
        expect(all.total).toBe(2);

        const secondPage = await memory.listMessages({ threadId: thread.id, perPage: 1, page: 1 });
        expect(ids(secondPage.messages)).toEqual([after.id]);
        expect(secondPage.total).toBe(2);
        expect(secondPage.hasMore).toBe(false);

        const pastTheEnd = await memory.listMessages({ threadId: thread.id, perPage: 1, page: 5 });
        expect(pastTheEnd.messages).toEqual([]);
        expect(pastTheEnd.total).toBe(2);

        const withoutTotal = await memory.listMessages({ threadId: thread.id, perPage: 3, includeTotal: false });
        expect(ids(withoutTotal.messages)).toEqual(visible);
        expect(withoutTotal.hasMore).toBe(false);

        const allWithoutTotal = await memory.listMessages({ threadId: thread.id, perPage: false, includeTotal: false });
        expect(ids(allWithoutTotal.messages)).toEqual(visible);

        const byMetadata = await memory.listMessages({
          threadId: thread.id,
          perPage: false,
          filter: { metadata: tag },
        });
        expect(ids(byMetadata.messages)).toEqual(visible);
        expect(byMetadata.total).toBe(2);

        const byResource = await memory.listMessagesByResourceId({ resourceId: thread.resourceId, perPage: false });
        expect(ids(byResource.messages)).toEqual([...visible, siblingMessage.id]);
        expect(byResource.total).toBe(3);

        const byResourceAndMetadata = await memory.listMessagesByResourceId({
          resourceId: thread.resourceId,
          perPage: false,
          filter: { metadata: tag },
        });
        expect(ids(byResourceAndMetadata.messages)).toEqual([...visible, siblingMessage.id]);
        expect(byResourceAndMetadata.total).toBe(3);

        // A read by id returns the row as stored, under the thread's reserved id and without a resource.
        const byId = await memory.listMessagesById({ messageIds: [before.id, hidden.id, after.id] });
        expect(sorted(ids(byId.messages))).toEqual(sorted([...visible, hidden.id]));
        const hiddenById = byId.messages.find(row => row.id === hidden.id)!;
        expect(hiddenById.threadId).toBe(`mastra-queue:${state}:${thread.id}`);
        expect(hiddenById.resourceId ?? null).toBeNull();

        // So does an include of its id, unless the include is scoped to a resource.
        const included = await memory.listMessages({ threadId: thread.id, perPage: 0, include: [{ id: hidden.id }] });
        expect(included.messages.map(row => ({ id: row.id, threadId: row.threadId }))).toEqual([
          { id: hidden.id, threadId: `mastra-queue:${state}:${thread.id}` },
        ]);
        const includedForResource = await memory.listMessages({
          ...scope(thread),
          perPage: 0,
          include: [{ id: hidden.id }],
        });
        expect(includedForResource.messages).toEqual([]);

        for (const include of [
          { id: before.id, withNextMessages: 1 },
          { id: after.id, withPreviousMessages: 1 },
        ]) {
          const window = await memory.listMessages({ threadId: thread.id, perPage: 0, include: [include] });
          expect(ids(window.messages)).toEqual(visible);
        }

        const resourceWindow = await memory.listMessagesByResourceId({
          resourceId: thread.resourceId,
          perPage: 0,
          include: [{ id: before.id, withNextMessages: 1 }],
        });
        expect(ids(resourceWindow.messages)).toEqual(visible);
      });

      it('leaves a pending or taken row alone in updateMessages', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const claimed = await send(thread, { text: 'claimed' });
        await claim(thread, runId);
        const pending = await send(thread, { text: 'pending' });
        const message = createSampleMessageV2({ ...scope(thread), content: { content: 'before' } });
        await memory.saveMessages({ messages: [message] });

        const updated = await memory.updateMessages({
          messages: [
            { id: claimed.id, content: { content: 'changed' } as MastraDBMessage['content'] },
            { id: pending.id, content: { content: 'changed' } as MastraDBMessage['content'] },
            { id: message.id, content: { content: 'after' } as MastraDBMessage['content'] },
          ],
        });

        expect(ids(updated)).toEqual([message.id]);
        const contents = (rows: MastraDBMessage[]) => rows.map(({ id, content }) => ({ id, content }));
        expect(contents(await memory.listPendingSignals(onThread(thread)))).toEqual([
          { id: pending.id, content: pending.content },
        ]);
        expect(contents(await claim(thread, runId))).toEqual([
          { id: claimed.id, content: claimed.content },
          { id: pending.id, content: pending.content },
        ]);
        expect(await visibleIds(thread)).toEqual([message.id]);
      });

      it('clones only messages, without the signal run', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const saved = await send(thread);
        await claim(thread, runId);
        await memory.saveMessages({ messages: [{ ...saved, createdAt: new Date() }] });
        await claim(thread, runId);
        await send(thread);
        const message = createSampleMessageV2({ ...scope(thread) });
        await memory.saveMessages({ messages: [message] });

        const { thread: clone, clonedMessages } = await memory.cloneThread({ sourceThreadId: thread.id });
        expect(sorted(clonedMessages.map(cloned => cloned.role))).toEqual(['signal', 'user']);
        expect(sorted(await visibleIds(clone))).toEqual(sorted(ids(clonedMessages)));
        expect(await memory.getSignalRun({ threadId: clone.id })).toBeNull();
        expect(await memory.listPendingSignals(onThread(clone))).toEqual([]);

        await startRun(clone, runId);
        expect(await claim(clone, runId)).toEqual([]);
      });

      it('returns pending and taken rows with the thread current resource after a transfer', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const claimed = await send(thread);
        await claim(thread, runId);
        const pending = await send(thread);
        const message = createSampleMessageV2({ ...scope(thread) });
        await memory.saveMessages({ messages: [message] });

        const resourceId = `resource-${randomUUID()}`;
        const moved = await memory.updateThreadResourceId({ threadId: thread.id, resourceId });

        expect(await memory.listPendingSignals(onThread(moved))).toMatchObject([{ id: pending.id, resourceId }]);
        expect(await visibleIds(moved)).toEqual([message.id]);
        expect(await claim(moved, runId)).toMatchObject([
          { id: claimed.id, resourceId },
          { id: pending.id, resourceId },
        ]);

        // Once saved, the rows are listed under the new resource.
        const [claimedRow, pendingRow] = await claim(moved, runId);
        await memory.saveMessages({ messages: [claimedRow!, pendingRow!] });
        expect(sorted(await visibleIds(moved))).toEqual(sorted([message.id, claimed.id, pending.id]));
      });

      it('deletes pending and taken rows and the signal run with the thread', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const claimed = await send(thread);
        await claim(thread, runId);
        const pending = await send(thread);
        const sibling = await newThread();
        const siblingRun = await startRun(sibling);
        const siblingClaimed = await send(sibling);
        await claim(sibling, siblingRun);
        const siblingPending = await send(sibling);

        await memory.deleteThread({ threadId: thread.id });
        await memory.saveThread({ thread });

        expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();
        expect(await pendingIds(thread)).toEqual([]);
        expect(await hasNoRow(thread, claimed.id)).toBe(true);
        expect(await hasNoRow(thread, pending.id)).toBe(true);
        expect(ids(await claim(sibling, siblingRun))).toEqual([siblingClaimed.id, siblingPending.id]);
      });

      it.each(['pending', 'taken'] as const)('deletes nothing for a %s row named by id', async state => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const signal = await send(thread);
        if (state === 'taken') expect(ids(await claim(thread, runId))).toEqual([signal.id]);
        const message = createSampleMessageV2({ ...scope(thread), createdAt: new Date(Date.now() - 30_000) });
        await memory.saveMessages({ messages: [message] });
        // Saving the thread row again puts its updatedAt back in the past.
        await memory.saveThread({ thread: { ...thread, updatedAt: new Date(Date.now() - 60_000) } });
        const updatedAt = async () =>
          new Date((await memory.getThreadById({ threadId: thread.id }))!.updatedAt).getTime();

        const beforeSignalOnly = await updatedAt();
        await memory.deleteMessages([signal.id]);
        expect(await updatedAt()).toBe(beforeSignalOnly);

        await memory.deleteMessages([signal.id, message.id]);
        expect(await updatedAt()).toBeGreaterThan(beforeSignalOnly);
        expect(await visibleIds(thread)).toEqual([]);

        if (state === 'pending') expect(await pendingIds(thread)).toEqual([signal.id]);
        expect(ids(await claim(thread, runId))).toEqual([signal.id]);
      });

      it('hides a send that named another resource from reads of that resource and of the thread', async () => {
        const thread = await newThread();
        const foreignResource = `resource-${randomUUID()}`;
        const foreign = signalFor({ ...thread, resourceId: foreignResource });
        expect(await memory.enqueuePendingSignal({ message: foreign })).toBe('accepted');
        const own = await send(thread);
        // A thread of the foreign resource, so reads of that resource have a message to return.
        const foreignThread = await memory.saveThread({
          thread: createSampleThread({ resourceId: foreignResource }) as StorageThreadType,
        });
        const foreignMessage = createSampleMessageV2({ ...scope(foreignThread) });
        await memory.saveMessages({ messages: [foreignMessage] });

        for (const resourceId of [undefined, thread.resourceId, foreignResource]) {
          const byThread = await memory.listMessages({ threadId: thread.id, resourceId, perPage: false });
          expect({ resourceId, ids: ids(byThread.messages), total: byThread.total }).toEqual({
            resourceId,
            ids: [],
            total: 0,
          });
        }
        const byForeign = await memory.listMessagesByResourceId({ resourceId: foreignResource, perPage: false });
        expect(ids(byForeign.messages)).toEqual([foreignMessage.id]);
        expect(byForeign.total).toBe(1);
        const byOwn = await memory.listMessagesByResourceId({ resourceId: thread.resourceId, perPage: false });
        expect(byOwn.messages).toEqual([]);
        expect(byOwn.total).toBe(0);
        const included = await memory.listMessagesByResourceId({
          resourceId: foreignResource,
          perPage: 0,
          include: [{ id: foreign.id }, { id: own.id }],
        });
        expect(included.messages).toEqual([]);

        expect(await pendingIds(thread)).toEqual([foreign.id, own.id]);
      });
    });

    describe('reserved thread ids', () => {
      // The prefix is persisted in every queued row, so it is pinned here rather than imported.
      const reservedIds = (thread: StorageThreadType) => [
        `mastra-queue:pending:${thread.id}`,
        `mastra-queue:taken:${thread.id}`,
        `mastra-queue:${thread.id}`,
      ];

      it('rejects a thread id with the reserved prefix wherever a caller chooses one', async () => {
        const thread = await newThread();
        const pending = await send(thread);
        const message = createSampleMessageV2({ ...scope(thread) });
        await memory.saveMessages({ messages: [message] });
        const before = await memory.getThreadById({ threadId: thread.id });

        const rejected = reservedIds(thread).flatMap(reserved => [
          () => memory.saveThread({ thread: { ...thread, id: reserved } }),
          () => memory.copyThread({ sourceThreadId: thread.id, newThreadId: reserved }),
          () => memory.cloneThread({ sourceThreadId: thread.id, newThreadId: reserved }),
          () => memory.saveMessages({ messages: [{ ...pending, threadId: reserved }] }),
          () =>
            memory.saveMessages({
              messages: [createSampleMessageV2({ ...scope(thread) }), { ...message, threadId: reserved }],
            }),
          () => memory.updateMessages({ messages: [{ id: message.id, threadId: reserved }] }),
          () => memory.listMessages({ threadId: reserved }),
          () => memory.listMessages({ threadId: [thread.id, reserved] }),
        ]);
        rejected.push(() =>
          memory.saveThread({ thread: createSampleThread({ id: `mastra-queue:` }) as StorageThreadType }),
        );
        for (const [index, call] of rejected.entries()) {
          await expect(call(), `call ${index}`).rejects.toThrow(/reserved/);
        }

        for (const reserved of reservedIds(thread)) {
          expect(await memory.getThreadById({ threadId: reserved })).toBeNull();
        }
        const { threads } = await memory.listThreads({ filter: { resourceId: thread.resourceId } });
        expect(threads.map(listed => listed.id)).toEqual([thread.id]);
        expect(await memory.getThreadById({ threadId: thread.id })).toEqual(before);
        expect(await visibleIds(thread)).toEqual([message.id]);
        expect(await memory.listPendingSignals(onThread(thread))).toMatchObject([
          { id: pending.id, content: pending.content },
        ]);
      });

      it('deletes nothing when deleteThread gets a reserved id', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const taken = await send(thread);
        expect(ids(await claim(thread, runId))).toEqual([taken.id]);
        const pending = await send(thread);

        for (const reserved of reservedIds(thread)) await memory.deleteThread({ threadId: reserved });

        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(runId);
        expect(await pendingIds(thread)).toEqual([pending.id]);
        expect(ids(await claim(thread, runId))).toEqual([taken.id, pending.id]);
      });

      it('rejects a reserved thread id in every pending-signal method', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const taken = await send(thread);
        expect(ids(await claim(thread, runId))).toEqual([taken.id]);
        const pending = await send(thread);

        const rejected = reservedIds(thread).flatMap(id => {
          const reserved = { ...thread, id };
          return [
            () => memory.setSignalRun({ threadId: reserved.id, runId }),
            () => memory.getSignalRun({ threadId: reserved.id }),
            () => memory.enqueuePendingSignal({ message: signalFor(reserved) }),
            () => memory.enqueuePendingSignal({ message: signalFor(reserved), toRunId: runId }),
            () => memory.claimPendingSignals({ threadId: reserved.id, runId, consumedIds: [] }),
            () => memory.closeSignalRun({ threadId: reserved.id, runId, consumedIds: [taken.id] }),
            () => memory.cancelPendingSignals({ threadId: reserved.id, ids: [pending.id] }),
            () => memory.listPendingSignals({ threadId: reserved.id }),
          ];
        });
        for (const [index, call] of rejected.entries()) {
          await expect(call(), `call ${index}`).rejects.toThrow(/reserved/);
        }

        // The real thread's run, its taken row and its pending row are as they were.
        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(runId);
        expect(await pendingIds(thread)).toEqual([pending.id]);
        expect(ids(await claim(thread, runId))).toEqual([taken.id, pending.id]);
      });

      const lookalikes = ['MASTRA-QUEUE:', 'mastra_queue:', 'mastra-queue-', 'mastra-queue'];
      it.each(lookalikes)('treats a thread id starting with %s as an ordinary thread', async lookalike => {
        const thread = await memory.saveThread({
          thread: createSampleThread({ id: `${lookalike}${randomUUID()}` }) as StorageThreadType,
        });
        const message = createSampleMessageV2({ ...scope(thread), createdAt: new Date(Date.now() - 10_000) });
        const next = createSampleMessageV2({ ...scope(thread), createdAt: new Date(Date.now() - 9_000) });
        await memory.saveMessages({ messages: [message, next] });

        expect(await visibleIds(thread)).toEqual([message.id, next.id]);
        expect(sorted(ids((await memory.listMessagesById({ messageIds: [message.id, next.id] })).messages))).toEqual(
          sorted([message.id, next.id]),
        );
        const window = await memory.listMessages({
          threadId: thread.id,
          perPage: 0,
          include: [{ id: message.id, withNextMessages: 1 }],
        });
        expect(ids(window.messages)).toEqual([message.id, next.id]);
        const updated = await memory.updateMessages({
          messages: [{ id: message.id, content: { content: 'edited' } as MastraDBMessage['content'] }],
        });
        expect(ids(updated)).toEqual([message.id]);

        const runId = await startRun(thread);
        const signal = await send(thread);
        expect(await pendingIds(thread)).toEqual([signal.id]);
        expect(ids(await claim(thread, runId))).toEqual([signal.id]);
        await memory.saveMessages({ messages: [{ ...signal, createdAt: new Date() }] });
        expect(await visibleIds(thread)).toEqual([message.id, next.id, signal.id]);
      });
    });

    describe('claim', () => {
      it('returns nothing and changes nothing for a run that is not the thread signal run', async () => {
        const thread = await newThread();
        const sent = await send(thread);
        const outsider = newRun();

        expect(await claim(thread, outsider)).toEqual([]);
        await startRun(thread);
        expect(await claim(thread, outsider)).toEqual([]);
        expect(await claim(createSampleThread() as StorageThreadType, outsider)).toEqual([]);

        expect(await pendingIds(thread)).toEqual([sent.id]);
      });

      it('returns the rows claimed earlier with the new ones, except the consumed ids', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const base = Date.now() - 10_000;
        const first = await send(thread, { createdAt: new Date(base) });
        const second = await send(thread, { createdAt: new Date(base + 1) });

        const claimed = await claim(thread, runId);
        expect(ids(claimed)).toEqual([first.id, second.id]);
        expect(await pendingIds(thread)).toEqual([]);
        expect(await claim(thread, runId)).toEqual(claimed);

        const third = await send(thread, { createdAt: new Date(base + 2) });
        expect(ids(await claim(thread, runId, [first.id]))).toEqual([second.id, third.id]);
        expect(await claim(thread, runId, [first.id, second.id, third.id])).toEqual([]);
        expect(ids(await claim(thread, runId))).toEqual([first.id, second.id, third.id]);
      });

      it('orders rows by createdAt, then id, and keeps createdAt', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const prefix = randomUUID();
        const at = new Date(Date.now() - 10_000);
        const later = await send(thread, { id: `${prefix}-b`, createdAt: at });
        const tie = await send(thread, { id: `${prefix}-a`, createdAt: at });
        const earliest = await send(thread, { id: `${prefix}-c`, createdAt: new Date(at.getTime() - 1) });
        const order = [earliest.id, tie.id, later.id];

        expect(await pendingIds(thread)).toEqual(order);
        const claimed = await claim(thread, runId);
        expect(ids(claimed)).toEqual(order);
        expect(claimed.map(row => new Date(row.createdAt).getTime())).toEqual(
          [earliest, tie, later].map(message => message.createdAt.getTime()),
        );
      });
    });

    describe('save', () => {
      it('turns a pending row into a message with the saved createdAt', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const pending = await send(thread, { createdAt: new Date(Date.now() - 10_000) });
        const savedAt = new Date(Date.now() - 5_000);

        await memory.saveMessages({ messages: [{ ...pending, createdAt: savedAt }] });

        const [message] = (await memory.listMessages({ ...scope(thread), perPage: false })).messages;
        expect(message).toMatchObject({ id: pending.id, role: 'signal', content: pending.content });
        expect(new Date(message!.createdAt).getTime()).toBe(savedAt.getTime());
        expect(await pendingIds(thread)).toEqual([]);
        expect(await claim(thread, runId)).toEqual([]);
      });

      it('turns a taken row into a message that the claim does not return', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const taken = await send(thread, { createdAt: new Date(Date.now() - 10_000) });
        expect(ids(await claim(thread, runId))).toEqual([taken.id]);
        const savedAt = new Date(Date.now() - 5_000);

        await memory.saveMessages({ messages: [{ ...taken, createdAt: savedAt }] });

        const listed = (await memory.listMessages({ ...scope(thread), perPage: false })).messages;
        expect(ids(listed)).toEqual([taken.id]);
        expect(new Date(listed[0]!.createdAt).getTime()).toBe(savedAt.getTime());
        expectNoSignalKeys(listed);
        expect(await claim(thread, runId)).toEqual([]);
        expect(await pendingIds(thread)).toEqual([]);

        await close(thread, runId, [taken.id]);
        expectSameMessages((await memory.listMessages({ ...scope(thread), perPage: false })).messages, listed);
        await startRun(thread, runId);
        expect(await claim(thread, runId)).toEqual([]);
      });

      // A page read orders by the stored createdAt; a full read re-sorted in JS would not show a stale one.
      it('orders a saved signal by its saved createdAt in a page read', async () => {
        const thread = await newThread();
        const base = Date.now() - 30_000;
        const signal = await send(thread, { createdAt: new Date(base) });
        const message = createSampleMessageV2({ ...scope(thread), createdAt: new Date(base + 1_000) });
        await memory.saveMessages({ messages: [message] });
        await memory.saveMessages({ messages: [{ ...signal, createdAt: new Date(base + 2_000) }] });

        const first = await memory.listMessages({ threadId: thread.id, perPage: 1 });
        expect(ids(first.messages)).toEqual([message.id]);
        const second = await memory.listMessages({ threadId: thread.id, perPage: 1, page: 1 });
        expect(ids(second.messages)).toEqual([signal.id]);
      });

      it.each(['pending', 'taken'] as const)(
        'moves a %s row saved under another thread into that thread',
        async state => {
          const thread = await newThread();
          const other = await newThread();
          const runId = await startRun(thread);
          const signal = await send(thread, { createdAt: new Date(Date.now() - 10_000) });
          if (state === 'taken') expect(ids(await claim(thread, runId))).toEqual([signal.id]);
          const changed = { ...signal.content, parts: [{ type: 'text' as const, text: 'changed' }] };

          await memory.saveMessages({ messages: [{ ...signal, ...scope(other), content: changed }] });

          const [moved, ...rest] = (await memory.listMessages({ ...scope(other), perPage: false })).messages;
          expect(rest).toEqual([]);
          expect(moved).toMatchObject({ id: signal.id, threadId: other.id, resourceId: other.resourceId });
          expect(moved!.content.parts).toEqual(changed.parts);
          expect(await visibleIds(thread)).toEqual([]);
          expect(await pendingIds(thread)).toEqual([]);
          expect(await claim(thread, runId)).toEqual([]);
          expect(await memory.listPendingSignals(onThread(other))).toEqual([]);
        },
      );
    });

    describe('close', () => {
      it('deletes consumed taken rows, returns the others to pending and leaves saved rows as messages', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const base = Date.now() - 10_000;
        const consumed = await send(thread, { createdAt: new Date(base) });
        const unconsumed = await send(thread, { createdAt: new Date(base + 1) });
        const saved = await send(thread, { createdAt: new Date(base + 2) });
        const savedUnconsumed = await send(thread, { createdAt: new Date(base + 3) });
        expect(ids(await claim(thread, runId))).toEqual([consumed.id, unconsumed.id, saved.id, savedUnconsumed.id]);
        await memory.saveMessages({ messages: [saved, savedUnconsumed] });
        const unclaimed = await send(thread, { createdAt: new Date(base + 4) });
        const consumedIds = [consumed.id, saved.id];
        const visible = [saved.id, savedUnconsumed.id];

        await close(thread, runId, consumedIds);

        expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();
        expect(await pendingIds(thread)).toEqual([unconsumed.id, unclaimed.id]);
        expect(await visibleIds(thread)).toEqual(visible);
        expect(await hasNoRow(thread, consumed.id)).toBe(true);

        await close(thread, runId, consumedIds);
        expect(await pendingIds(thread)).toEqual([unconsumed.id, unclaimed.id]);
        expect(await visibleIds(thread)).toEqual(visible);

        const next = await startRun(thread);
        expect(ids(await claim(thread, next))).toEqual([unconsumed.id, unclaimed.id]);
      });

      it('a close by a run that is no longer the signal run deletes what it consumed and leaves the rest to the signal run', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const consumed = await send(thread);
        const left = await send(thread);
        expect(ids(await claim(thread, runId))).toEqual([consumed.id, left.id]);
        const current = await startRun(thread);

        await close(thread, runId, [consumed.id]);

        expect(await memory.getSignalRun({ threadId: thread.id })).toBe(current);
        expect(await pendingIds(thread)).toEqual([]);
        expect(await hasNoRow(thread, consumed.id)).toBe(true);
        expect(ids(await claim(thread, current))).toEqual([left.id]);
      });

      it('settles only the rows of the closed thread when one run is the signal run of two threads', async () => {
        const first = await newThread();
        const second = await newThread();
        const runId = await startRun(first);
        await startRun(second, runId);
        const firstRow = await send(first);
        const secondRow = await send(second);
        expect(ids(await claim(first, runId))).toEqual([firstRow.id]);
        expect(ids(await claim(second, runId))).toEqual([secondRow.id]);

        await close(first, runId, [firstRow.id]);

        expect(await memory.getSignalRun({ threadId: second.id })).toBe(runId);
        expect(await pendingIds(second)).toEqual([]);
        expect(ids(await claim(second, runId))).toEqual([secondRow.id]);
      });

      it('is a no-op for a run that never claimed anything', async () => {
        const thread = await newThread();
        const pending = await send(thread);
        await close(thread, newRun(), [pending.id]);
        expect(await pendingIds(thread)).toEqual([pending.id]);
      });
    });

    describe('cancel', () => {
      it('deletes the named pending rows and skips everything else', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const claimed = await send(thread);
        await claim(thread, runId);
        const first = await send(thread);
        const second = await send(thread);
        const third = await send(thread);
        const kept = await send(thread);
        const message = createSampleMessageV2({ ...scope(thread) });
        await memory.saveMessages({ messages: [message] });

        // Neither the send order nor its reverse.
        const cancelled = await memory.cancelPendingSignals({
          ...onThread(thread),
          ids: [second.id, claimed.id, `unknown-${randomUUID()}`, first.id, message.id, third.id],
        });

        expect(cancelled).toEqual([second.id, first.id, third.id]);
        expect(await pendingIds(thread)).toEqual([kept.id]);
        expect(await visibleIds(thread)).toEqual([message.id]);
        expect(ids(await claim(thread, runId))).toEqual([claimed.id, kept.id]);
        expect(await hasNoRow(thread, first.id)).toBe(true);
      });
    });

    it('never changes the thread updatedAt', async () => {
      const thread = await newThread();
      const before = await memory.getThreadById({ threadId: thread.id });

      const runId = await startRun(thread);
      await memory.enqueuePendingSignal({ message: signalFor(thread), toRunId: runId });
      const consumed = await send(thread);
      const cancelled = await send(thread);
      await memory.cancelPendingSignals({ ...onThread(thread), ids: [cancelled.id] });
      await claim(thread, runId);
      await memory.listPendingSignals(onThread(thread));
      await close(thread, runId, [consumed.id]);

      expect(await memory.getThreadById({ threadId: thread.id })).toEqual(before);
    });

    it('round-trips a signal with text and file parts through a claimed row', async () => {
      const thread = await newThread();
      const runId = await startRun(thread);
      const signal = createSignal({
        type: 'user',
        contents: [
          { type: 'text', text: 'look at this' },
          { type: 'file', data: 'aGVsbG8=', mediaType: 'text/plain', filename: 'hello.txt' },
        ],
        createdAt: new Date(Date.now() - 10_000),
        acceptedAt: new Date(Date.now() - 9_000),
        attributes: { priority: 1, urgent: true },
        metadata: { source: 'test' },
        author: { id: 'user-1', name: 'Ada' },
      });

      expect(await memory.enqueuePendingSignal({ message: signal.toDBMessage(scope(thread)), toRunId: runId })).toBe(
        'accepted',
      );
      const [row] = await claim(thread, runId);

      // The transcript save stamps the time the signal joined it; the signal keeps its own times.
      await memory.saveMessages({ messages: [{ ...row!, createdAt: new Date(Date.now() - 5_000) }] });
      const [saved] = (await memory.listMessages({ ...scope(thread), perPage: false })).messages;

      for (const restored of [mastraDBMessageToSignal(row!), mastraDBMessageToSignal(saved!)]) {
        expect(restored).toMatchObject({
          id: signal.id,
          type: signal.type,
          tagName: signal.tagName,
          contents: signal.contents,
          attributes: signal.attributes,
          metadata: signal.metadata,
          author: signal.author,
        });
        expect(restored.createdAt.toISOString()).toBe(signal.createdAt.toISOString());
        expect(restored.acceptedAt?.toISOString()).toBe(signal.acceptedAt?.toISOString());
        expect(restored.toLLMMessage()).toEqual(signal.toLLMMessage());
      }
    });

    describe('races', () => {
      it('either lists a run send after a racing close or answers run-closed', async () => {
        for (let iteration = 0; iteration < RACE_ITERATIONS; iteration++) {
          const thread = await newThread();
          const runId = await startRun(thread);
          const messages = Array.from({ length: RACE_ROWS }, () => signalFor(thread));

          // Start the close at a different point among the sends on each iteration.
          const closeAt = iteration % (RACE_ROWS + 1);
          const sendOne = (message: MastraDBMessage) =>
            memory.enqueuePendingSignal({ message, toRunId: runId }).then(result => ({ id: message.id, result }));
          const before = messages.slice(0, closeAt).map(sendOne);
          // The list starts once the close has returned, so it must hold every accepted send.
          const closing = close(thread, runId, [], peer).then(() => peer.listPendingSignals(onThread(thread)));
          const after = messages.slice(closeAt).map(sendOne);
          const [results, afterClose] = await Promise.all([Promise.all([...before, ...after]), closing]);

          expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();
          const listedAfterClose = new Set(ids(afterClose));
          const listed = new Set(await pendingIds(thread));
          for (const { id, result } of results) {
            expect(['accepted', 'run-closed']).toContain(result);
            const outcome = { id, result, listedAfterClose: listedAfterClose.has(id), listed: listed.has(id) };
            const accepted = result === 'accepted';
            expect(outcome).toEqual({ id, result, listedAfterClose: accepted, listed: accepted });
          }
          for (const { id } of results.filter(({ result }) => result === 'run-closed')) {
            expect(await hasNoRow(thread, id)).toBe(true);
          }
        }
      });

      it('never leaves a row claimed by a closed run when a claim races with the close', async () => {
        for (let iteration = 0; iteration < RACE_ITERATIONS; iteration++) {
          const thread = await newThread();
          const runId = await startRun(thread);
          const sent: string[] = [];
          for (let index = 0; index < RACE_ROWS; index++) sent.push((await send(thread)).id);

          const claiming = () => claim(thread, runId);
          const closing = () => close(thread, runId, [], peer);
          const claimed =
            iteration % 2 === 0
              ? (await Promise.all([claiming(), closing()]))[0]
              : (await Promise.all([closing(), claiming()]))[1];

          // The claim ran entirely before the close or entirely after it.
          expect([[], sorted(sent)]).toContainEqual(sorted(ids(claimed)));
          expect(sorted(await pendingIds(thread))).toEqual(sorted(sent));
          expect(await memory.getSignalRun({ threadId: thread.id })).toBeNull();
        }
      });

      it('accepts concurrent sends to one run from both instances', async () => {
        const thread = await newThread();
        const runId = await startRun(thread);
        const messages = Array.from({ length: RACE_ROWS * 2 }, () => signalFor(thread));

        const results = await Promise.all(
          messages.map((message, index) =>
            (index % 2 === 0 ? memory : peer).enqueuePendingSignal({ message, toRunId: runId }),
          ),
        );

        expect(results).toEqual(messages.map(() => 'accepted'));
        expect(sorted(await pendingIds(thread))).toEqual(sorted(ids(messages)));
      });
    });
  });
}

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { runOMCommit, waitingOMCommits } from '../commit-queue';
import { getObservationHistoryState } from '../history-loader';
import { filterObservedMessages } from '../message-utils';
import { TokenCounter } from '../token-counter';

const threadId = 'bounded-history';
const resourceId = 'bounded-resource';
const timestamp = new Date('2026-01-01T00:00:00Z');

function message(index: number, createdAt = timestamp): MastraDBMessage {
  return {
    id: `history-${String(index).padStart(5, '0')}`,
    threadId,
    resourceId,
    role: 'user',
    createdAt,
    content: { format: 2, parts: [{ type: 'text', text: `Fact ${index}. ${'history '.repeat(100)}` }] },
  };
}

async function setup(
  scope: 'thread' | 'resource' = 'thread',
  asyncBuffering = false,
  existingRecord = true,
  messageTokens = 300,
) {
  const storage = new InMemoryStore();
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'obs' },
        {
          type: 'text-delta',
          id: 'obs',
          delta: `<observations>${scope === 'resource' ? `<thread id="${threadId}">` : ''}Date: Jan 1, 2026\n- Facts preserved.${scope === 'resource' ? '</thread>' : ''}</observations>`,
        },
        { type: 'text-end', id: 'obs' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
  const open = () =>
    new Memory({
      storage,
      options: {
        semanticRecall: false,
        generateTitle: false,
        workingMemory: { enabled: false },
        observationalMemory: {
          scope,
          observation: { model, messageTokens, bufferTokens: asyncBuffering ? 0.2 : false },
          reflection: { model, observationTokens: 100_000 },
        },
      },
    });
  const memory = open();
  await memory.createThread({ threadId, resourceId, title: 'Bounded history' });
  const store = (await storage.getStore('memory'))!;
  const rows = Array.from({ length: 121 }, (_, index) => message(index));
  const om = await memory.omEngine;
  if (!om) throw new Error('OM engine unavailable');
  // Existing-record tests retain the resumable oldest-first migration behavior.
  if (existingRecord) await om.getOrCreateRecord(threadId, resourceId);
  await store.saveMessages({ messages: rows });
  return { store, open, rows, om, model };
}

async function finishCatchUp(om: NonNullable<Awaited<Memory['omEngine']>>) {
  for (let attempts = 0; attempts <= 121; attempts++) {
    if (getObservationHistoryState((await om.getRecord(threadId, resourceId))!)?.complete) return;
    await om.observe({ threadId, resourceId, force: true });
  }
  throw new Error(`catch-up did not finish: ${JSON.stringify((await om.getRecord(threadId, resourceId))?.metadata)}`);
}

describe('bounded initial observation history', () => {
  it.each([false, true])(
    'does not re-observe retained activated history after cloning (partial: %s)',
    async partial => {
      const { om, rows, store, open, model } = await setup('thread', true, true, 100_000);
      rows[0]!.createdAt = new Date(timestamp.getTime() - 1000);
      await store.saveMessages({ messages: [rows[0]!] });
      const buffered = await om.buffer({
        threadId,
        resourceId,
        messages: [rows[0]!],
        skipMinimumTokenCheck: true,
      });
      expect(buffered.buffered).toBe(true);
      const activated = await om.activate({ threadId, resourceId, pendingTokens: 100_000 });
      expect(activated.activatedMessageIds).toEqual([rows[0]!.id]);
      if (partial) {
        await store.saveMessages({
          messages: [
            {
              ...rows[0]!,
              content: {
                format: 2,
                parts: [
                  ...rows[0]!.content.parts,
                  {
                    type: 'data-om-observation-start',
                    data: { cycleId: 'covered-prefix', operationType: 'observation' },
                  },
                  {
                    type: 'data-om-observation-end',
                    data: { cycleId: 'covered-prefix', operationType: 'observation' },
                  },
                  { type: 'text', text: 'Appended after activation.' },
                ],
              },
            },
          ],
        });
      }
      const memory = open();
      const { thread, messageIdMap } = await memory.cloneThread({ sourceThreadId: threadId });
      const clonedMessage = (await store.listMessagesById({ messageIds: [messageIdMap![rows[0]!.id]!] })).messages[0]!;
      await store.saveMessages({
        messages: [
          {
            ...clonedMessage,
            content: {
              ...clonedMessage.content,
              parts: [...clonedMessage.content.parts, { type: 'text', text: 'Appended to clone.' }],
            },
          },
        ],
      });
      const cloned = (await memory.omEngine)!;
      const observer = vi.spyOn(model, 'doStream');
      await cloned.observe({ threadId: thread.id, resourceId, force: true });
      const prompt = JSON.stringify(observer.mock.calls.map(call => call[0].prompt));
      expect(prompt).toContain('Fact 1.');
      expect(prompt).not.toContain('Fact 0.');
      expect(prompt).toContain('Appended to clone.');
      if (partial) expect(prompt).toContain('Appended after activation.');
    },
  );

  it('observes an unread timestamp tie in a clone without re-observing the source prefix', async () => {
    const { om, rows, store, open, model } = await setup('thread', false, true, 100_000);
    const record = (await om.getRecord(threadId, resourceId))!;
    await store.commitActiveObservations({
      id: record.id,
      observations: 'The first fact was observed.',
      tokenCount: 8,
      lastObservedAt: timestamp,
      observedMessageIds: [rows[0]!.id],
      observationHistory: { after: { createdAt: timestamp.toISOString(), id: rows[0]!.id } },
      expectedActiveObservations: record.activeObservations,
    });
    const memory = open();
    const { thread } = await memory.cloneThread({ sourceThreadId: threadId });
    const cloned = (await memory.omEngine)!;
    const observer = vi.spyOn(model, 'doStream');
    const result = await cloned.observe({ threadId: thread.id, resourceId, force: true });
    expect(result.observed).toBe(true);
    const prompt = JSON.stringify(observer.mock.calls[0]![0].prompt);
    expect(prompt).toContain('Fact 1.');
    expect(prompt).not.toContain('Fact 0.');
    const copied = (await memory.recall({ threadId: thread.id, resourceId, perPage: false })).messages;
    const unread = copied.find(row =>
      row.content.parts.some(part => part.type === 'text' && part.text.startsWith('Fact 1.')),
    )!;
    expect(result.record.observedMessageIds).toContain(unread.id);
  });

  it('drops a source tuple cutoff when cloning tied excluded and retained messages', async () => {
    const { om, rows, open } = await setup('thread', false, false);
    const retained = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(retained.length).toBeLessThan(rows.length);
    const memory = open();
    const { thread } = await memory.cloneThread({ sourceThreadId: threadId });
    const cloned = (await memory.omEngine)!;
    expect((await cloned.getRecord(thread.id, resourceId))!.metadata?.observationHistory).toBeUndefined();
    const loaded = await cloned.loadUnobservedMessages({ threadId: thread.id, resourceId });
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.every(row => row.threadId === thread.id)).toBe(true);
  });
  it('stops the forward window at the message that crosses its token budget', async () => {
    const { om, rows, store } = await setup();
    const reads = vi.spyOn(store, 'listObservationHistory');
    const loaded = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.length).toBeLessThan(40);
    expect(loaded.map(row => row.id)).toEqual(rows.slice(0, loaded.length).map(row => row.id));
    expect(reads.mock.calls[0]![0].after).toBeUndefined();
    await om.observe({ threadId, resourceId, force: true });
    const next = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(next[0]!.id).toBe(rows[loaded.length]!.id);
  });
  it('cancels a queued empty-tail commit and completes catch-up on retry without observation', async () => {
    const { om, store, rows, model } = await setup('thread', false, false);
    await om.loadUnobservedMessages({ threadId, resourceId });
    await store.saveMessages({ messages: rows.map(row => ({ ...row, role: 'system' as const })) });
    const observer = vi.spyOn(model, 'doStream');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const key = om.buffering.getLockKey(threadId, resourceId);
    const blocker = runOMCommit(key, async () => {
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const controller = new AbortController();
    let settled = false;
    const operation = om
      .observe({ threadId, resourceId, force: true, abortSignal: controller.signal })
      .catch(() => undefined)
      .finally(() => {
        settled = true;
      });
    try {
      await vi.waitFor(() => expect(waitingOMCommits(key).normal).toBeGreaterThan(0));
      controller.abort();
      await vi.waitFor(() => expect(settled).toBe(true));
      expect(getObservationHistoryState((await om.getRecord(threadId, resourceId))!)?.complete).not.toBe(true);
    } finally {
      release.resolve();
      await blocker;
      await operation;
    }
    expect((await om.observe({ threadId, resourceId, force: true })).observed).toBe(false);
    expect(getObservationHistoryState((await om.getRecord(threadId, resourceId))!)?.complete).toBe(true);
    expect(observer).not.toHaveBeenCalled();
  });

  it('observes a nonempty bootstrap tail even below the normal threshold', async () => {
    const { om, store, rows } = await setup('thread', false, false);
    await om.loadUnobservedMessages({ threadId, resourceId });
    const record = (await om.getRecord(threadId, resourceId))!;
    expect(record.metadata?.observationHistory).toHaveProperty('after');
    await store.saveMessages({
      messages: rows.slice(-1).map(row => ({
        ...row,
        content: { format: 2, parts: [{ type: 'text', text: 'Small retained fact.' }] },
      })),
    });
    await store.deleteMessages(rows.slice(0, -1).map(row => row.id));
    expect((await om.observe({ threadId, resourceId })).observed).toBe(true);
  });

  it('contains a stored-history read failure in buffer()', async () => {
    const { om, store } = await setup('thread', true);
    vi.spyOn(store, 'listObservationHistory').mockRejectedValueOnce(new Error('history read unavailable'));
    await expect(om.buffer({ threadId, resourceId })).resolves.toMatchObject({ buffered: false });
  });

  it.each([false, undefined])(
    'does not bootstrap backwards on an older forward-only adapter (%s)',
    async capability => {
      const { store, om, rows } = await setup('thread', false, false, 12000);
      Object.defineProperty(store, 'supportsObservationHistoryBootstrap', { value: capability });
      const list = store.listObservationHistory.bind(store);
      const reads = vi
        .spyOn(store, 'listObservationHistory')
        .mockImplementation(input => list({ ...input, before: undefined }));
      const loaded = await om.loadUnobservedMessages({ threadId, resourceId });
      expect(loaded.length).toBeGreaterThan(0);
      expect(reads.mock.calls.some(([input]) => input.order === 'asc' || input.order === undefined)).toBe(true);
      expect(reads.mock.calls.some(([input]) => input.order === 'desc' && input.limit === 40)).toBe(false);
      expect(loaded.map(row => row.id)).toEqual(rows.slice(0, loaded.length).map(row => row.id));
    },
  );

  it('rejects a non-advancing reverse page even when the adapter claims bootstrap support', async () => {
    const { store, om, rows } = await setup('thread', false, false);
    await store.saveMessages({ messages: rows.map(row => ({ ...row, role: 'system' as const })) });
    const list = store.listObservationHistory.bind(store);
    let calls = 0;
    vi.spyOn(store, 'listObservationHistory').mockImplementation(input => {
      if (++calls > 3) throw new Error('probe stopped repeated pages');
      return list({ ...input, before: undefined });
    });
    await expect(om.getOrCreateRecord(threadId, resourceId)).rejects.toThrow(/advance/);
    expect(calls).toBe(2);
    expect(await om.getRecord(threadId, resourceId)).toBeNull();
  });

  it.each(['thread', 'resource'] as const)(
    'completes an exhausted %s bootstrap without observing filtered retained rows',
    async scope => {
      const { store, om, open, rows } = await setup(scope, false, false);
      await om.loadUnobservedMessages({ threadId, resourceId });
      await store.saveMessages({ messages: rows.map(row => ({ ...row, role: 'system' as const })) });
      const observer = vi.fn();
      const result = await om.observe({ threadId, resourceId, force: true, hooks: { onObservationStart: observer } });
      expect(result.observed).toBe(false);
      expect(observer).not.toHaveBeenCalled();
      expect(result.record.metadata?.observationHistory).toMatchObject({ complete: true });
      expect(result.record.observedMessageIds ?? []).toEqual([]);
      const restarted = (await open().omEngine)!;
      const live = message(999, new Date('2026-01-02T00:00:00Z'));
      await restarted.observe({ threadId, resourceId, messages: [live], force: true });
      expect((await restarted.getRecord(threadId, resourceId))?.observedMessageIds).toContain(live.id);
    },
  );

  it.each(['thread', 'resource'] as const)(
    'preserves normal explicit-message handling when all initial %s history fits in budget',
    async scope => {
      const { om } = await setup(scope, false, false, 1_000_000);
      const record = await om.getOrCreateRecord(threadId, resourceId);
      expect(record.metadata?.observationHistory).toBeUndefined();
      const live = message(999, new Date('2026-01-02T00:00:00Z'));
      await om.observe({ threadId, resourceId, messages: [live], force: true });
      expect((await om.getRecord(threadId, resourceId))?.observedMessageIds).toContain(live.id);
    },
  );

  it('rejects an empty reverse page that claims more rows exist', async () => {
    const { store, om } = await setup('thread', false, false);
    vi.spyOn(store, 'listObservationHistory').mockResolvedValue({ messages: [], hasMore: true });
    await expect(om.getOrCreateRecord(threadId, resourceId)).rejects.toThrow(/advance/);
    expect(await om.getRecord(threadId, resourceId)).toBeNull();
  });

  it('rejects an empty forward page that claims more rows exist, without completing the cursor', async () => {
    const { store, om } = await setup('thread', false, true, 1_000_000);
    const list = store.listObservationHistory.bind(store);
    vi.spyOn(store, 'listObservationHistory').mockImplementation(async input =>
      input.order === 'desc' ? list(input) : { messages: [], hasMore: true },
    );
    await expect(om.loadUnobservedMessages({ threadId, resourceId })).rejects.toThrow(/advance/);
    expect((await om.getRecord(threadId, resourceId))?.metadata?.observationHistory).toBeUndefined();
  });

  it('rejects a forward page that repeats rows instead of advancing', async () => {
    const { store, om, rows } = await setup('thread', false, true, 1_000_000);
    const list = store.listObservationHistory.bind(store);
    let forwardCalls = 0;
    vi.spyOn(store, 'listObservationHistory').mockImplementation(async input => {
      if (input.order === 'desc') return list(input);
      // Bound the failure: without the guard the loader would request this page forever.
      if (++forwardCalls > 20) throw new Error('loader kept requesting a repeating page');
      return { messages: rows.slice(0, 2), hasMore: true };
    });
    await expect(om.loadUnobservedMessages({ threadId, resourceId })).rejects.toThrow(/advance/);
    expect(forwardCalls).toBe(2);
  });

  it.each(['thread', 'resource'] as const)(
    'allows live %s messages after initial rows are deleted, with and without a cutoff',
    async scope => {
      for (const budget of [300, 1_000_000]) {
        const { store, om, open, rows } = await setup(scope, false, false, budget);
        await om.loadUnobservedMessages({ threadId, resourceId });
        await store.deleteMessages(rows.map(row => row.id));
        const result = await om.observe({ threadId, resourceId, force: true });
        expect(result.observed).toBe(false);
        if (budget === 300) expect(result.record.metadata?.observationHistory).toMatchObject({ complete: true });
        else expect(result.record.metadata?.observationHistory).toBeUndefined();
        expect(result.record.observedMessageIds ?? []).toEqual([]);
        const restarted = (await open().omEngine)!;
        const live = message(999, new Date('2026-01-02T00:00:00Z'));
        await restarted.observe({ threadId, resourceId, messages: [live], force: true });
        expect((await restarted.getRecord(threadId, resourceId))?.observedMessageIds).toContain(live.id);
      }
    },
  );

  it('retains at least one newest message even below the conversation-overhead budget', async () => {
    const { om, rows } = await setup('thread', false, false, 20);
    expect((await om.loadUnobservedMessages({ threadId, resourceId })).map(message => message.id)).toEqual([
      rows.at(-1)!.id,
    ]);
    expect((await om.observe({ threadId, resourceId, force: true })).observed).toBe(true);
  });

  it('uses one resource-wide budget and boundary across threads', async () => {
    const { om, store, rows } = await setup('resource', false, false, 12000);
    const otherThread = `${threadId}-other`;
    await store.saveThread({
      thread: { id: otherThread, resourceId, title: 'Other thread', createdAt: timestamp, updatedAt: timestamp },
    });
    await store.saveMessages({
      messages: rows.map((message, index) => ({ ...message, threadId: index % 2 ? otherThread : threadId })),
    });
    const first = await om.loadUnobservedMessages({ threadId, resourceId });
    const second = await om.loadUnobservedMessages({ threadId: otherThread, resourceId });
    expect(first.map(message => message.id)).toEqual(rows.slice(-first.length - 1, -1).map(message => message.id));
    expect(second.map(message => message.id)).toEqual(first.map(message => message.id));
    expect(new Set(first.map(message => message.threadId)).size).toBe(2);
    expect(first.length).toBeLessThan(60);
  });

  it.each(['thread', 'resource'] as const)(
    'pages backward through tied rows until the %s token budget is reached',
    async scope => {
      const { store, om, rows } = await setup(scope, false, false, 12000);
      const reads = vi.spyOn(store, 'listObservationHistory');
      const loaded = await om.loadUnobservedMessages({ threadId, resourceId });
      expect(loaded.length).toBeGreaterThan(40);
      expect(loaded.length).toBeLessThan(rows.length);
      expect(loaded.map(row => row.id)).toEqual(rows.slice(-loaded.length - 1, -1).map(row => row.id));
      const descending = reads.mock.calls.map(([input]) => input).filter(input => input.order === 'desc');
      expect(descending.length).toBeGreaterThan(1);
      expect(descending.every(input => input.limit === 40)).toBe(true);
      expect(descending[1]!.before).toEqual({ createdAt: timestamp.toISOString(), id: rows.at(-40)!.id });
    },
  );

  it('does not reopen pre-OM history while buffering the initial suffix', async () => {
    const { store, om, rows, open } = await setup('thread', true, false);
    const first = await om.loadUnobservedMessages({ threadId, resourceId });
    const unboundedRead = vi.spyOn(store, 'listMessages');
    const candidates: string[] = [];
    expect(
      (
        await om.buffer({
          threadId,
          resourceId,
          pendingTokens: 500,
          beforeBuffer: async messages => {
            candidates.push(...messages.map(message => message.id));
          },
        })
      ).buffered,
    ).toBe(false);
    expect(candidates).toEqual(first.map(message => message.id));
    expect(candidates).not.toContain(rows[0]!.id);
    expect(unboundedRead.mock.calls.every(([input]) => typeof input.perPage === 'number' && input.perPage <= 40)).toBe(
      true,
    );
    expect((await om.getRecord(threadId, resourceId))?.observedMessageIds).toEqual(first.map(message => message.id));
    await finishCatchUp(om);
    expect(await (await open().omEngine)!.loadUnobservedMessages({ threadId, resourceId })).toEqual([]);
  });

  it.each(['thread', 'resource'] as const)(
    'drains the selected %s suffix before acknowledging explicit live messages',
    async scope => {
      const { om, rows, open } = await setup(scope, false, false);
      const first = await om.loadUnobservedMessages({ threadId, resourceId });
      const live = message(999, new Date('2026-01-02T00:00:00Z'));
      await om.observe({ threadId, resourceId, messages: [...rows, live], force: true });
      expect((await om.getRecord(threadId, resourceId))?.observedMessageIds).toEqual(first.map(message => message.id));
      await finishCatchUp(om);
      expect(await (await open().omEngine)!.loadUnobservedMessages({ threadId, resourceId })).toEqual([]);
      await om.observe({ threadId, resourceId, messages: [live], force: true });
      expect((await om.getRecord(threadId, resourceId))?.observedMessageIds).toContain(live.id);
    },
  );

  it.each(['thread', 'resource'] as const)(
    'starts a new %s record from only the newest budget of history',
    async scope => {
      const { store, om, rows, model } = await setup(scope, false, false);
      const observer = vi.spyOn(model, 'doStream');
      const reads = vi.spyOn(store, 'listObservationHistory');
      const loaded = await om.loadUnobservedMessages({ threadId, resourceId });
      expect(loaded.length).toBeGreaterThan(0);
      expect(loaded.length).toBeLessThan(10);
      expect(loaded.map(row => row.id)).toEqual(rows.slice(-loaded.length - 1, -1).map(row => row.id));
      expect(reads.mock.calls.some(([input]) => input.order === 'desc' && input.limit === 40)).toBe(true);
      expect(reads.mock.calls.every(([input]) => input.limit <= 40)).toBe(true);
      await om.observe({ threadId, resourceId, force: true });
      const record = await om.getRecord(threadId, resourceId);
      expect(record?.observedMessageIds).toEqual(loaded.map(row => row.id));
      expect(JSON.stringify(observer.mock.calls)).toContain(`Fact ${rows.findIndex(row => row.id === loaded[0]!.id)}.`);
      expect(JSON.stringify(observer.mock.calls)).not.toContain('Fact 0.');
    },
  );

  it.each(['thread', 'resource'] as const)(
    'keeps pre-OM history out before commit, after failure and after restart (%s)',
    async scope => {
      const { store, om, rows, open } = await setup(scope, scope === 'thread', false);
      const first = await om.loadUnobservedMessages({ threadId, resourceId });
      const retained = new Set(rows.slice(-2).map(row => row.id));
      const assertContext = async (engine: typeof om) => {
        const record = await engine.getRecord(threadId, resourceId);
        expect(record?.lastObservedAt).toBeUndefined();
        const list = new MessageList().add(structuredClone(rows), 'memory');
        filterObservedMessages({ messageList: list, record: record! });
        expect(list.get.all.db().map(row => row.id)).toEqual([...retained]);
      };
      await assertContext(om);
      const commit = vi.spyOn(store, 'commitActiveObservations').mockRejectedValue(new Error('first commit fails'));
      await om.observe({ threadId, resourceId, force: true }).catch(() => undefined);
      commit.mockRestore();
      const restarted = (await open().omEngine)!;
      await assertContext(restarted);
      expect((await restarted.loadUnobservedMessages({ threadId, resourceId })).map(row => row.id)).toEqual(
        first.map(row => row.id),
      );
      await restarted.observe({ threadId, resourceId, force: true });
      const record = await restarted.getRecord(threadId, resourceId);
      expect(record?.observedMessageIds?.every(id => retained.has(id))).toBe(true);
      await finishCatchUp(om);
      expect(await (await open().omEngine)!.loadUnobservedMessages({ threadId, resourceId })).toEqual([]);
    },
  );

  it.each(['thread', 'resource'] as const)('uses finite oldest-first pages for %s scope', async scope => {
    const { store, om, rows } = await setup(scope);
    const threadReads = vi.spyOn(store, 'listMessages');
    const resourceReads = vi.spyOn(store, 'listMessagesByResourceId');
    const historyReads = vi.spyOn(store, 'listObservationHistory');
    const loaded = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(historyReads).toHaveBeenCalled();
    expect(historyReads.mock.calls.every(([args]) => args.limit > 0 && args.limit <= 40)).toBe(true);
    expect(threadReads).not.toHaveBeenCalled();
    expect(resourceReads).not.toHaveBeenCalled();
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.length).toBeLessThan(rows.length);
    expect(loaded.map(row => row.id)).toEqual(rows.slice(0, loaded.length).map(row => row.id));
  });

  it('does not advance beyond unread timestamp peers and resumes after restart', async () => {
    const { store, om, rows, open } = await setup();
    const firstBatch = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(firstBatch.length).toBeLessThan(rows.length);
    await om.observe({ threadId, resourceId, force: true });
    const afterRestart = (await open().omEngine)!;
    const secondBatch = await afterRestart.loadUnobservedMessages({ threadId, resourceId });
    expect(secondBatch.length).toBeGreaterThan(0);
    expect(secondBatch.every(row => !firstBatch.some(previous => previous.id === row.id))).toBe(true);
    expect(secondBatch.map(row => row.id)).toEqual(
      rows.slice(firstBatch.length, firstBatch.length + secondBatch.length).map(row => row.id),
    );
    expect((await store.listMessages({ threadId, perPage: false })).messages).toHaveLength(rows.length);
  });

  it('drains every tied message once across restarts, including the below-threshold tail', async () => {
    const { om, rows, open } = await setup();
    const seen: string[] = [];
    let engine = om;
    for (let index = 0; index < rows.length; index++) {
      const batch = await engine.loadUnobservedMessages({ threadId, resourceId });
      if (!batch.length) break;
      seen.push(...batch.map(row => row.id));
      const result = await engine.observe({ threadId, resourceId });
      expect(result.observed).toBe(true);
      engine = (await open().omEngine)!;
    }
    expect(seen).toEqual(rows.map(row => row.id));
    expect(new Set(seen).size).toBe(rows.length);
  });

  it('does not acknowledge later live input ahead of the stored prefix', async () => {
    const { store, om, rows } = await setup();
    const live = message(9999, new Date());
    await store.saveMessages({ messages: [live] });
    const result = await om.observe({ threadId, resourceId, messages: [live], useStoredHistory: true, force: true });
    expect(result.record.observedMessageIds).not.toContain(live.id);
    expect(result.record.lastObservedAt).toEqual(timestamp);
    const batch = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(batch[0]!.id).toBe(rows[(result.record.observedMessageIds ?? []).length]!.id);
    expect(batch).not.toContainEqual(live);
  });

  it('retries the same prefix when the observation commit fails', async () => {
    const { store, om, open } = await setup();
    const first = await om.loadUnobservedMessages({ threadId, resourceId });
    const commit = vi.spyOn(store, 'commitActiveObservations').mockRejectedValue(new Error('commit unavailable'));
    await om.observe({ threadId, resourceId, force: true }).catch(() => undefined);
    commit.mockRestore();
    expect((await store.getObservationalMemory(threadId, resourceId))?.metadata?.observationHistory).toBeUndefined();
    expect(
      (await (await open().omEngine)!.loadUnobservedMessages({ threadId, resourceId })).map(row => row.id),
    ).toEqual(first.map(row => row.id));
  });

  it('recovers the committed prefix even if the process fails before thread metadata is written', async () => {
    const { store, om, open } = await setup();
    const first = await om.loadUnobservedMessages({ threadId, resourceId });
    const commit = store.commitActiveObservations.bind(store);
    vi.spyOn(store, 'commitActiveObservations').mockImplementationOnce(async input => {
      await commit(input);
      throw new Error('process interrupted after the durable commit');
    });
    await om.observe({ threadId, resourceId, force: true }).catch(() => undefined);
    const restarted = (await open().omEngine)!;
    const second = await restarted.loadUnobservedMessages({ threadId, resourceId });
    expect(second.length).toBeGreaterThan(0);
    expect(second.some(row => first.some(prior => prior.id === row.id))).toBe(false);
  });

  it('keeps the batch bounded when every page ends in an excluded message', async () => {
    const { store, om, rows } = await setup('thread', false, true, 9_000);
    await store.saveMessages({
      messages: rows.filter((_, index) => index % 40 === 39).map(row => ({ ...row, role: 'system' as const })),
    });
    const batch = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(batch.length).toBeGreaterThan(0);
    const counter = new TokenCounter();
    const tokens =
      24 + (await Promise.all(batch.map(row => counter.countMessageAsync(row)))).reduce((a, b) => a + b, 0);
    expect(tokens).toBeLessThanOrEqual(9_000);
    const observable = rows.filter((_, index) => index % 40 !== 39);
    expect(batch.map(row => row.id)).toEqual(observable.slice(0, batch.length).map(row => row.id));
    const nextTokens = await counter.countMessageAsync(observable[batch.length]!);
    expect(tokens + nextTokens).toBeGreaterThan(9_000);
    expect(
      batch.every(row => !rows.filter((_, index) => index % 40 === 39).some(excluded => excluded.id === row.id)),
    ).toBe(true);
  });

  it('completes an excluded-only tail and admits later live history', async () => {
    const { store, om, rows, open } = await setup();
    await store.saveMessages({ messages: rows.slice(40).map(row => ({ ...row, role: 'system' as const })) });
    await om.observe({ threadId, resourceId });
    expect((await store.getObservationalMemory(threadId, resourceId))?.metadata?.observationHistory).toMatchObject({
      end: timestamp.toISOString(),
    });
    const restarted = (await open().omEngine)!;
    await finishCatchUp(restarted);
    expect((await store.getObservationalMemory(threadId, resourceId))?.metadata?.observationHistory).toMatchObject({
      complete: true,
    });
    const later = message(9999, new Date('2026-01-02T00:00:00Z'));
    await store.saveMessages({ messages: [later] });
    expect((await restarted.loadUnobservedMessages({ threadId, resourceId })).map(row => row.id)).toEqual([later.id]);
  });

  it('does not commit past a resource thread missing from the observer response', async () => {
    const { store, om, rows, open, model } = await setup('resource', false, true, 9000);
    await store.saveThread({
      thread: { id: 'sibling', resourceId, createdAt: timestamp, updatedAt: timestamp, title: 'Sibling' },
    });
    await store.saveMessages({
      messages: rows.filter((_, index) => index % 2 === 0).map(row => ({ ...row, threadId: 'sibling' })),
    });
    const first = await om.loadUnobservedMessages({ threadId, resourceId });
    await om.observe({ threadId, resourceId }).catch(() => undefined);
    expect(model.doStreamCalls.length).toBeGreaterThan(0);
    const prompt = JSON.stringify(model.doStreamCalls);
    expect(prompt).toContain('Fact 0.');
    expect(prompt).toContain('Fact 1.');
    expect((await store.getObservationalMemory(null, resourceId))?.metadata?.observationHistory).toBeUndefined();
    const restarted = (await open().omEngine)!;
    expect((await restarted.loadUnobservedMessages({ threadId, resourceId })).map(row => row.id)).toEqual(
      first.map(row => row.id),
    );
  });

  it('resumes ordinary async buffering after initial catch-up without replaying activated messages', async () => {
    const { store, om, rows, open } = await setup('thread', true);
    await finishCatchUp(om);
    expect((await store.getObservationalMemory(threadId, resourceId))?.metadata?.observationHistory).toMatchObject({
      complete: true,
    });
    const later = message(9999, new Date('2026-01-02T00:00:00Z'));
    await store.saveMessages({ messages: [later] });
    expect((await om.buffer({ threadId, resourceId, pendingTokens: 500 })).buffered).toBe(true);
    expect((await om.activate({ threadId, resourceId })).activated).toBe(true);
    const restarted = (await open().omEngine)!;
    expect(await restarted.loadUnobservedMessages({ threadId, resourceId })).toEqual([]);
    expect((await restarted.getStatus({ threadId, resourceId })).pendingTokens).toBe(0);
  });

  it('prunes the entire committed tied prefix after observed IDs rotate away', async () => {
    const { om } = await setup();
    const record = await om.getOrCreateRecord(threadId, resourceId);
    record.observedMessageIds = [];
    record.metadata = {
      observationHistory: {
        after: { createdAt: timestamp.toISOString(), id: message(79).id },
        end: timestamp.toISOString(),
      },
    };
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([message(1), message(79), message(80)], 'memory');
    filterObservedMessages({ messageList, record });
    expect(messageList.get.all.db().map(row => row.id)).toEqual([message(80).id]);
  });

  it('preserves the legacy loader on an adapter that does not advertise paging', async () => {
    const { store, om, rows } = await setup();
    Object.defineProperty(store, 'supportsObservationHistoryPaging', { value: false });
    const history = vi.spyOn(store, 'listObservationHistory');
    expect(await om.loadUnobservedMessages({ threadId, resourceId })).toHaveLength(rows.length);
    expect(history).not.toHaveBeenCalled();
  });
});

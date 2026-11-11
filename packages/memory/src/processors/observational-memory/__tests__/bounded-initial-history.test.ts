import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { filterObservedMessages } from '../message-utils';

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

async function setup(scope: 'thread' | 'resource' = 'thread', asyncBuffering = false) {
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
          observation: { model, messageTokens: 300, bufferTokens: asyncBuffering ? 0.2 : false },
          reflection: { model, observationTokens: 100_000 },
        },
      },
    });
  const memory = open();
  await memory.createThread({ threadId, resourceId, title: 'Bounded history' });
  const store = (await storage.getStore('memory'))!;
  const rows = Array.from({ length: 121 }, (_, index) => message(index));
  await store.saveMessages({ messages: rows });
  const om = await memory.omEngine;
  if (!om) throw new Error('OM engine unavailable');
  return { store, open, rows, om };
}

describe('bounded initial observation history', () => {
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
    const { store, om, rows } = await setup();
    await store.saveMessages({
      messages: rows.filter((_, index) => index % 40 === 39).map(row => ({ ...row, role: 'system' as const })),
    });
    const batch = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(batch.map(row => row.id)).toEqual(rows.slice(0, 39).map(row => row.id));
  });

  it('completes an excluded-only tail and admits later live history', async () => {
    const { store, om, rows, open } = await setup();
    await store.saveMessages({ messages: rows.slice(40).map(row => ({ ...row, role: 'system' as const })) });
    await om.observe({ threadId, resourceId });
    expect((await store.getObservationalMemory(threadId, resourceId))?.metadata?.observationHistory).toMatchObject({
      end: timestamp.toISOString(),
    });
    const restarted = (await open().omEngine)!;
    await restarted.observe({ threadId, resourceId });
    expect((await store.getObservationalMemory(threadId, resourceId))?.metadata?.observationHistory).toMatchObject({
      complete: true,
    });
    const later = message(9999, new Date('2026-01-02T00:00:00Z'));
    await store.saveMessages({ messages: [later] });
    expect((await restarted.loadUnobservedMessages({ threadId, resourceId })).map(row => row.id)).toEqual([later.id]);
  });

  it('does not commit past a resource thread missing from the observer response', async () => {
    const { store, om, rows, open } = await setup('resource');
    await store.saveThread({
      thread: { id: 'sibling', resourceId, createdAt: timestamp, updatedAt: timestamp, title: 'Sibling' },
    });
    await store.saveMessages({
      messages: rows.filter((_, index) => index % 2 === 0).map(row => ({ ...row, threadId: 'sibling' })),
    });
    const first = await om.loadUnobservedMessages({ threadId, resourceId });
    await om.observe({ threadId, resourceId }).catch(() => undefined);
    expect((await store.getObservationalMemory(null, resourceId))?.metadata?.observationHistory).toBeUndefined();
    const restarted = (await open().omEngine)!;
    expect((await restarted.loadUnobservedMessages({ threadId, resourceId })).map(row => row.id)).toEqual(
      first.map(row => row.id),
    );
  });

  it('resumes ordinary async buffering after initial catch-up without replaying activated messages', async () => {
    const { store, om, rows, open } = await setup('thread', true);
    for (let index = 0; index < Math.ceil(rows.length / 40); index++) await om.observe({ threadId, resourceId });
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

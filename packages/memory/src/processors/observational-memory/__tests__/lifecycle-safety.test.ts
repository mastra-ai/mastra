/**
 * Lifecycle safety: observations only leave the actor's context once they land on the current
 * (head) generation, and a reflection never drops observations committed while it ran.
 *
 * Each test races two lifecycle writes against real InMemory storage by pausing one of them
 * (a gated model call or storage method) while the other commits.
 */
import { randomUUID } from 'node:crypto';

import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { filterObservedMessages } from '../message-utils';
import { AsyncBufferObservationStrategy } from '../observation-strategies/async-buffer';
import { ObservationalMemory } from '../observational-memory';
import { isOpActiveInProcess } from '../operation-registry';

const SECRET = 'ACTIVATED_FACT_7c1e';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function message(
  threadId: string,
  resourceId: string,
  id: string,
  text: string,
  createdAt: Date,
  role: 'user' | 'assistant' = 'user',
): MastraDBMessage {
  return {
    id,
    role,
    type: 'text',
    threadId,
    resourceId,
    createdAt,
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function createWriter() {
  const custom = vi.fn(async (_chunk: { type: string; data?: unknown }) => {});
  return { writer: { custom } as unknown as ProcessorStreamWriter, types: () => custom.mock.calls.map(c => c[0].type) };
}

function createOM(
  storage: InMemoryMemory,
  opts: { scope?: 'thread' | 'resource'; bufferTokens?: number | false; messageTokens?: number } = {},
) {
  const om = new ObservationalMemory({
    storage,
    scope: opts.scope ?? 'thread',
    observation: {
      model: 'openai/gpt-4o-mini',
      messageTokens: opts.messageTokens ?? 1_000,
      bufferTokens: opts.bufferTokens ?? false,
    },
    reflection: { model: 'openai/gpt-4o-mini', observationTokens: 2_000 },
  });
  // Model calls are mocked per test; an unexpected call would be a different runtime path.
  vi.spyOn(om.observer, 'call').mockRejectedValue(new Error('Unexpected Observer call'));
  vi.spyOn(om.observer, 'callMultiThread').mockRejectedValue(new Error('Unexpected multi-thread Observer call'));
  vi.spyOn(om.reflector, 'call').mockRejectedValue(new Error('Unexpected Reflector call'));
  return om;
}

async function setupThread(storage: InMemoryMemory, resourceId = randomUUID()) {
  const threadId = randomUUID();
  const t0 = new Date(Date.now() - 60_000);
  await storage.saveThread({
    thread: { id: threadId, resourceId, title: 'lifecycle', createdAt: t0, updatedAt: t0 },
  });
  return { threadId, resourceId, t0 };
}

/** Seed the head with active observations and one buffered chunk holding SECRET for `source`. */
async function seedReadyChunk(
  storage: InMemoryMemory,
  om: ObservationalMemory,
  ids: { threadId: string; resourceId: string; t0: Date },
) {
  const { threadId, resourceId, t0 } = ids;
  const source = message(
    threadId,
    resourceId,
    `source-${threadId}`,
    `${SECRET} details`,
    new Date(t0.getTime() + 1_000),
  );
  await storage.saveMessages({ messages: [source] });
  const initial = await om.getOrCreateRecord(threadId, resourceId);
  await storage.updateActiveObservations({
    id: initial.id,
    observations: '- earlier knowledge',
    tokenCount: 5_000,
    lastObservedAt: t0,
  });
  await storage.updateBufferedObservations({
    id: initial.id,
    chunk: {
      cycleId: `ready-${threadId}`,
      observations: `- ${SECRET}`,
      tokenCount: 20,
      messageIds: [source.id],
      messageTokens: 2_000,
      lastObservedAt: new Date(source.createdAt!.getTime() + 1),
    },
    lastBufferedAtTime: new Date(source.createdAt!.getTime() + 1),
  });
  return { source, initial: (await storage.getObservationalMemory(threadId, resourceId))! };
}

async function history(storage: InMemoryMemory, threadId: string, resourceId: string) {
  const rows = await storage.getObservationalMemoryHistory(threadId, resourceId);
  const head = (await storage.getObservationalMemory(threadId, resourceId))!;
  return { rows, head, byId: (id: string) => rows.find(r => r.id === id)! };
}

beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reflection keeps observations activated while the Reflector runs (P6)', () => {
  it.each(['sync maybeReflect', 'manual reflect()'] as const)('%s', async path => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage);
    const ids = await setupThread(storage);
    const { initial } = await seedReadyChunk(storage, om, ids);

    const entered = deferred();
    const release = deferred();
    vi.spyOn(om.reflector, 'call').mockImplementation(async () => {
      entered.resolve();
      await release.promise;
      return { observations: '- reflected summary' } as Awaited<ReturnType<typeof om.reflector.call>>;
    });

    const reflecting =
      path === 'sync maybeReflect'
        ? om.reflector.maybeReflect({ record: initial, observationTokens: 5_000, threadId: ids.threadId })
        : om.reflect(ids.threadId, ids.resourceId);
    await entered.promise;

    // Activation commits the ready chunk while the Reflector is still working.
    const activation = await om.activate({ threadId: ids.threadId, resourceId: ids.resourceId });
    expect(activation.activated).toBe(true);
    const activatedCursor = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!.lastObservedAt!;

    release.resolve();
    await reflecting;

    const { head } = await history(storage, ids.threadId, ids.resourceId);
    expect(head.generationCount).toBe(1);
    expect(head.activeObservations).toContain('- reflected summary');
    expect(head.activeObservations).toContain(SECRET);
    expect(head.activeObservations).not.toContain('earlier knowledge');
    expect(head.lastObservedAt!.getTime()).toBeGreaterThanOrEqual(activatedCursor.getTime());
  });
});

describe('activation commits only to the head generation', () => {
  it('retries on the head when a reflection retires the record mid-activation; activated ids come from the head', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage);
    const ids = await setupThread(storage);
    const { source, initial } = await seedReadyChunk(storage, om, ids);

    const originalSwap = storage.swapBufferedToActive.bind(storage);
    const swapTargets: string[] = [];
    vi.spyOn(storage, 'swapBufferedToActive').mockImplementation(async input => {
      swapTargets.push(input.id);
      if (swapTargets.length === 1) {
        // A reflection from another writer retires the record between activation's read and its swap.
        const stored = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
        await storage.createReflectionGeneration({
          currentRecord: stored,
          reflection: '- other reflection',
          tokenCount: 3,
        });
      }
      return originalSwap(input);
    });

    const result = await om.activate({ threadId: ids.threadId, resourceId: ids.resourceId });

    const { head, byId } = await history(storage, ids.threadId, ids.resourceId);
    expect(head.id).not.toBe(initial.id);
    expect(result.activated).toBe(true);
    expect(result.activatedMessageIds).toEqual([source.id]);
    expect(result.record.id).toBe(head.id);
    expect(swapTargets).toEqual([initial.id, head.id]);
    expect(head.activeObservations).toContain(SECRET);
    expect(byId(initial.id).activeObservations).not.toContain(SECRET);
    expect(head.bufferedObservationChunks ?? []).toEqual([]);
  });

  it('keeps the source or its observation in the actor context when a reflection overlaps step-0 activation (P4)', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 1_000, bufferTokens: 200 });
    const otherOm = createOM(storage, { messageTokens: 1_000, bufferTokens: 200 });
    const ids = await setupThread(storage);
    const t0 = ids.t0;
    const source = message(
      ids.threadId,
      ids.resourceId,
      `source-${ids.threadId}`,
      `${SECRET} ${'data '.repeat(1_500)}`,
      new Date(t0.getTime() + 1_000),
    );
    const prompt = message(ids.threadId, ids.resourceId, `prompt-${ids.threadId}`, 'Continue.', new Date());
    await storage.saveMessages({ messages: [source, prompt] });
    const initial = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
    await storage.updateActiveObservations({
      id: initial.id,
      observations: '- earlier knowledge',
      tokenCount: 5_000,
      lastObservedAt: t0,
    });
    await storage.updateBufferedObservations({
      id: initial.id,
      chunk: {
        cycleId: `ready-${ids.threadId}`,
        observations: `- ${SECRET}`,
        tokenCount: 20,
        messageIds: [source.id],
        messageTokens: 1_500,
        lastObservedAt: new Date(source.createdAt!.getTime() + 1),
      },
      lastBufferedAtTime: new Date(source.createdAt!.getTime() + 1),
    });

    const list = new MessageList({ threadId: ids.threadId, resourceId: ids.resourceId });
    list.add(source, 'memory');
    list.add(prompt, 'input');
    const turn = om.beginTurn({ threadId: ids.threadId, resourceId: ids.resourceId, messageList: list });
    await turn.start();

    const entered = deferred();
    const release = deferred();
    const originalSwap = storage.swapBufferedToActive.bind(storage);
    vi.spyOn(storage, 'swapBufferedToActive').mockImplementation(async input => {
      entered.resolve();
      await release.promise;
      return originalSwap(input);
    });
    vi.spyOn(otherOm.reflector, 'call').mockResolvedValue({ observations: '- compressed earlier knowledge' } as Awaited<
      ReturnType<typeof otherOm.reflector.call>
    >);

    const step = turn.step(0).prepare();
    await entered.promise;
    const record = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    await otherOm.reflector.maybeReflect({ record, observationTokens: 5_000, threadId: ids.threadId });
    release.resolve();
    const context = await step;

    const { head, byId } = await history(storage, ids.threadId, ids.resourceId);
    const system = context.systemMessage?.join('\n') ?? '';
    expect(head.id).not.toBe(initial.id);
    const sourceInLiveList = list.get.all.db().some(m => m.id === source.id);
    // The retired generation never receives the activation.
    expect(byId(initial.id).activeObservations).not.toContain(SECRET);
    // The actor sees the source message or the fact that replaced it.
    expect(sourceInLiveList || system.includes(SECRET)).toBe(true);
    // With the retry, the fact landed on the head and is in the prompt.
    expect(head.activeObservations).toContain(SECRET);
    expect(system).toContain(SECRET);
    await om.settled();
    await otherOm.settled();
  });
});

describe('sync observation commits against the head text', () => {
  function observerReturns(om: ObservationalMemory, observations: string) {
    vi.spyOn(om.observer, 'call').mockResolvedValue({ observations } as Awaited<ReturnType<typeof om.observer.call>>);
  }

  it('thread scope: recomposes on top of a concurrent append instead of overwriting it', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 100 });
    const ids = await setupThread(storage);
    const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- base',
      tokenCount: 2,
      lastObservedAt: ids.t0,
    });
    const messages = [
      message(ids.threadId, ids.resourceId, 'm1', 'x'.repeat(2_000), new Date(ids.t0.getTime() + 1_000)),
    ];
    await storage.saveMessages({ messages });
    observerReturns(om, '- observed fact');

    const original = storage.updateActiveObservations.bind(storage);
    let injected = false;
    vi.spyOn(storage, 'updateActiveObservations').mockImplementation(async input => {
      if (input.expectedActiveObservations !== undefined && !injected) {
        injected = true;
        const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
        await original({
          id: head.id,
          observations: `${head.activeObservations}\n\n--- message boundary ---\n\n- concurrent activation`,
          tokenCount: head.observationTokenCount + 2,
          lastObservedAt: head.lastObservedAt!,
        });
      }
      return original(input);
    });

    const result = await om.observe({ threadId: ids.threadId, resourceId: ids.resourceId, messages });

    const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    expect(injected).toBe(true);
    expect(result.observed).toBe(true);
    expect(head.activeObservations).toContain('- concurrent activation');
    expect(head.activeObservations).toContain('- observed fact');
    expect(head.activeObservations.startsWith('- base')).toBe(true);
  });

  it('resource scope: a same-day thread-section merge recomposes and commits after a concurrent change', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { scope: 'resource', messageTokens: 100 });
    const resourceId = randomUUID();
    const ids = await setupThread(storage, resourceId);
    const record = await om.getOrCreateRecord(ids.threadId, resourceId);
    const existing = `<thread id="${ids.threadId}">\nDate: Jan 10, 2026\n* earlier same-day fact\n</thread>`;
    await storage.updateActiveObservations({
      id: record.id,
      observations: existing,
      tokenCount: 10,
      lastObservedAt: ids.t0,
    });
    const messages = [message(ids.threadId, resourceId, 'r1', 'y'.repeat(2_000), new Date(ids.t0.getTime() + 1_000))];
    await storage.saveMessages({ messages });
    vi.spyOn(om.observer, 'callMultiThread').mockResolvedValue({
      results: new Map([[ids.threadId, { observations: 'Date: Jan 10, 2026\n* merged new fact' }]]),
    } as Awaited<ReturnType<typeof om.observer.callMultiThread>>);

    const original = storage.updateActiveObservations.bind(storage);
    let injected = false;
    vi.spyOn(storage, 'updateActiveObservations').mockImplementation(async input => {
      if (input.expectedActiveObservations !== undefined && !injected) {
        injected = true;
        const head = (await storage.getObservationalMemory(null, resourceId))!;
        await original({
          id: head.id,
          observations: `${head.activeObservations}\n\n<thread id="other">\nDate: Jan 10, 2026\n* other thread fact\n</thread>`,
          tokenCount: head.observationTokenCount + 5,
          lastObservedAt: head.lastObservedAt!,
        });
      }
      return original(input);
    });

    const result = await om.observe({ threadId: ids.threadId, resourceId, messages });

    const head = (await storage.getObservationalMemory(null, resourceId))!;
    expect(injected).toBe(true);
    expect(result.observed).toBe(true);
    expect(head.activeObservations).toContain('* other thread fact');
    // Merged into the existing same-day section (a middle rewrite), not appended as a new section.
    expect(head.activeObservations).toContain('* earlier same-day fact\n* merged new fact\n</thread>');
    expect(head.activeObservations.match(new RegExp(`<thread id="${ids.threadId}">`, 'g'))).toHaveLength(1);
  });

  it('commits to the head when a reflection retires the record during the Observer call, and patches the thread cursor only after (H3)', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 100 });
    const ids = await setupThread(storage);
    const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- base',
      tokenCount: 2,
      lastObservedAt: ids.t0,
    });
    const messages = [
      message(ids.threadId, ids.resourceId, 'h3r-1', 'v'.repeat(2_000), new Date(ids.t0.getTime() + 1_000)),
    ];
    await storage.saveMessages({ messages });

    const entered = deferred();
    const release = deferred();
    vi.spyOn(om.observer, 'call').mockImplementation(async () => {
      entered.resolve();
      await release.promise;
      return { observations: '- observed fact' } as Awaited<ReturnType<typeof om.observer.call>>;
    });
    const update = vi.spyOn(storage, 'updateActiveObservations');
    const patch = vi.spyOn(storage, 'patchThread');

    const observing = om.observe({ threadId: ids.threadId, resourceId: ids.resourceId, messages });
    await entered.promise;
    const snapshot = { ...(await storage.getObservationalMemory(ids.threadId, ids.resourceId))! };
    const reflected = await storage.createReflectionGeneration({
      currentRecord: snapshot,
      reflection: '- other reflection',
      tokenCount: 3,
    });
    release.resolve();
    const result = await observing;

    const { head, byId } = await history(storage, ids.threadId, ids.resourceId);
    expect(head.id).toBe(reflected.id);
    expect(result.observed).toBe(true);
    expect(head.activeObservations).toContain('- other reflection');
    expect(head.activeObservations).toContain('- observed fact');
    expect(byId(record.id).activeObservations).not.toContain('- observed fact');

    const headCommit = update.mock.calls.findIndex(([input]) => input.id === head.id);
    const cursorPatch = patch.mock.calls.findIndex(
      ([input]) => getThreadOMMetadata(input.metadata)?.lastObservedMessageCursor !== undefined,
    );
    expect(headCommit).toBeGreaterThanOrEqual(0);
    expect(cursorPatch).toBeGreaterThanOrEqual(0);
    expect(update.mock.invocationCallOrder[headCommit]!).toBeLessThan(patch.mock.invocationCallOrder[cursorPatch]!);
  });

  it('aborts without a thread cursor, completion marker, or context removal when the head keeps changing (H3)', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 100 });
    const ids = await setupThread(storage);
    const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- base',
      tokenCount: 2,
      lastObservedAt: ids.t0,
    });
    const source = message(
      ids.threadId,
      ids.resourceId,
      'h3-source',
      `${SECRET} ${'z'.repeat(2_000)}`,
      new Date(ids.t0.getTime() + 1_000),
    );
    const reply = message(
      ids.threadId,
      ids.resourceId,
      'h3-reply',
      'ok',
      new Date(ids.t0.getTime() + 2_000),
      'assistant',
    );
    await storage.saveMessages({ messages: [source, reply] });
    observerReturns(om, '- observed fact');

    // Every commit attempt races a concurrent writer that changes the head text first.
    const original = storage.updateActiveObservations.bind(storage);
    let concurrentWrites = 0;
    vi.spyOn(storage, 'updateActiveObservations').mockImplementation(async input => {
      if (input.expectedActiveObservations !== undefined) {
        const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
        concurrentWrites++;
        await original({
          id: head.id,
          observations: `${head.activeObservations}\n- concurrent ${concurrentWrites}`,
          tokenCount: head.observationTokenCount + 1,
          lastObservedAt: head.lastObservedAt!,
        });
      }
      return original(input);
    });

    const list = new MessageList({ threadId: ids.threadId, resourceId: ids.resourceId });
    list.add(source, 'memory');
    list.add(reply, 'memory');
    const { writer, types } = createWriter();
    const result = await om.observe({
      threadId: ids.threadId,
      resourceId: ids.resourceId,
      messages: [source, reply],
      messageList: list,
      writer,
    });

    const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    const thread = await storage.getThreadById({ threadId: ids.threadId });
    // The first commit plus three recompose-and-retry rounds, each beaten by the concurrent writer.
    expect(concurrentWrites).toBe(4);
    expect(result.observed).toBe(false);
    expect(head.activeObservations).not.toContain('- observed fact');
    expect(getThreadOMMetadata(thread?.metadata)?.lastObservedMessageCursor).toBeUndefined();
    expect(types()).toContain('data-om-observation-failed');
    expect(types()).not.toContain('data-om-observation-end');
    expect(list.get.all.db().some(m => m.id === source.id)).toBe(true);
  });
});

describe('reflection side effects only follow an applied reflection', () => {
  it('a reflection that lost to a newer head skips notify, suppression, extracted values, and the end marker', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage);
    const ids = await setupThread(storage);
    const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- earlier knowledge',
      tokenCount: 5_000,
      lastObservedAt: ids.t0,
    });
    const snapshot = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;

    const entered = deferred();
    const release = deferred();
    vi.spyOn(om.reflector, 'call').mockImplementation(async () => {
      entered.resolve();
      await release.promise;
      // Above the reflection threshold so an applied commit would record suppression.
      return {
        observations: `- slow reflection ${'w '.repeat(3_000)}`,
        extractedValues: { currentTask: 'loser task' },
      } as Awaited<ReturnType<typeof om.reflector.call>>;
    });
    const notify = vi.spyOn(
      om.reflector as unknown as { notifyReflectionCommitted: () => Promise<void> },
      'notifyReflectionCommitted',
    );
    const suppression = (om.reflector as unknown as { syncReflectionSuppression: Map<string, number> })
      .syncReflectionSuppression;
    const patchThread = vi.spyOn(storage, 'patchThread');
    const { writer, types } = createWriter();

    const reflecting = om.reflector.maybeReflect({
      record: snapshot,
      observationTokens: 5_000,
      threadId: ids.threadId,
      writer,
    });
    await entered.promise;
    // Another writer reflects first and retires the snapshot's record.
    const winner = await storage.createReflectionGeneration({
      currentRecord: snapshot,
      reflection: '- winning reflection',
      tokenCount: 3,
    });
    release.resolve();
    await reflecting;

    const { rows, head } = await history(storage, ids.threadId, ids.resourceId);
    expect(head.id).toBe(winner.id);
    expect(head.activeObservations).toBe('- winning reflection');
    expect(rows).toHaveLength(2);
    expect(notify).not.toHaveBeenCalled();
    expect(suppression.size).toBe(0);
    // The losing reflection's extracted values must not overwrite the winner's thread metadata.
    expect(patchThread).not.toHaveBeenCalled();
    expect(types()).not.toContain('data-om-observation-end');
    expect(types()).toContain('data-om-observation-failed');
  });
});

describe('async buffering only reports chunks that landed', () => {
  it.each([
    ['different text', '- sync observed'],
    // A first-attempt skip is final even when the head already holds identical text.
    ['identical text', '- buffered fact'],
  ])(
    'a chunk the cursor covered while the Observer ran is not indexed, marked buffered, or advanced past (%s)',
    async (_label, syncText) => {
      const storage = new InMemoryMemory({ db: new InMemoryDB() });
      const om = createOM(storage, { messageTokens: 1_000, bufferTokens: 200 });
      const ids = await setupThread(storage);
      const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
      const messages = [
        message(ids.threadId, ids.resourceId, 'b1', 'q'.repeat(1_200), new Date(ids.t0.getTime() + 1_000)),
        message(ids.threadId, ids.resourceId, 'b2', 'ok', new Date(ids.t0.getTime() + 2_000), 'assistant'),
      ];
      await storage.saveMessages({ messages });

      const entered = deferred();
      const release = deferred();
      vi.spyOn(om.observer, 'call').mockImplementation(async () => {
        entered.resolve();
        await release.promise;
        return { observations: '- buffered fact' } as Awaited<ReturnType<typeof om.observer.call>>;
      });
      const index = vi.spyOn(AsyncBufferObservationStrategy.prototype as any, 'indexObservationGroups');
      const { writer, types } = createWriter();

      const buffering = om.buffer({ threadId: ids.threadId, resourceId: ids.resourceId, messages, writer });
      await entered.promise;
      // A sync observation covers the same messages while the buffer's Observer runs.
      await storage.updateActiveObservations({
        id: record.id,
        observations: syncText,
        tokenCount: 3,
        lastObservedAt: new Date(ids.t0.getTime() + 2_000),
      });
      release.resolve();
      const result = await buffering;
      await om.waitForBuffering(ids.threadId, ids.resourceId, 5_000);

      const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
      expect(result.buffered).toBe(false);
      expect(head.bufferedObservationChunks ?? []).toEqual([]);
      expect(index).not.toHaveBeenCalled();
      expect(types()).not.toContain('data-om-buffering-end');
      expect(types()).toContain('data-om-buffering-failed');
      const bufferKey = (om as any).buffering.getObservationBufferKey(
        (om as any).buffering.getLockKey(ids.threadId, ids.resourceId),
      );
      expect(BufferingCoordinator.lastBufferedAtTime.get(bufferKey)).toBeUndefined();
    },
  );
});

describe('sync observation with nothing to observe', () => {
  it.each(['thread', 'resource'] as const)(
    '%s scope: a stale pending count does not run the Observer or move the cursor to the current time',
    async scope => {
      const storage = new InMemoryMemory({ db: new InMemoryDB() });
      const om = createOM(storage, { scope, messageTokens: 1_000 });
      const ids = await setupThread(storage);
      const observed = message(
        ids.threadId,
        ids.resourceId,
        `seen-${ids.threadId}`,
        'seen',
        new Date(ids.t0.getTime() + 1_000),
      );
      await storage.saveMessages({ messages: [observed] });
      const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
      const cursor = new Date(ids.t0.getTime() + 1_000);
      await storage.updateActiveObservations({
        id: record.id,
        observations: '- seen',
        tokenCount: 2,
        lastObservedAt: cursor,
      });
      if (scope === 'resource') {
        // Resource scope tracks each thread's cursor in thread metadata.
        const thread = (await storage.getThreadById({ threadId: ids.threadId }))!;
        await storage.updateThread({
          id: ids.threadId,
          title: thread.title ?? '',
          metadata: setThreadOMMetadata(thread.metadata, { lastObservedAt: cursor.toISOString() }),
        });
      }
      // The persisted pending count is stale: everything it counted has been observed.
      await storage.setPendingMessageTokens(record.id, 5_000);

      const result = await om.observe({ threadId: ids.threadId, resourceId: ids.resourceId, messages: [observed] });

      const head = (await storage.getObservationalMemory(scope === 'resource' ? null : ids.threadId, ids.resourceId))!;
      expect(result.observed).toBe(false);
      expect(om.observer.call).not.toHaveBeenCalled();
      expect(om.observer.callMultiThread).not.toHaveBeenCalled();
      expect(head.lastObservedAt!.getTime()).toBe(cursor.getTime());
      expect(head.activeObservations).toBe('- seen');
    },
  );
});

describe('observation markers land on an observed message', () => {
  it.each(['thread', 'resource'] as const)(
    '%s scope: a message saved while the Observer runs keeps its content unobserved',
    async scope => {
      const storage = new InMemoryMemory({ db: new InMemoryDB() });
      const om = createOM(storage, { scope, messageTokens: 100 });
      const ids = await setupThread(storage);
      const at = (s: number) => new Date(ids.t0.getTime() + s * 1_000);
      const asked = message(ids.threadId, ids.resourceId, `asked-${ids.threadId}`, 'question', at(1));
      const answered = message(
        ids.threadId,
        ids.resourceId,
        `answered-${ids.threadId}`,
        'answer '.repeat(300),
        at(2),
        'assistant',
      );
      const late = message(ids.threadId, ids.resourceId, `late-${ids.threadId}`, 'LATE_FACT', at(3), 'assistant');
      await storage.saveMessages({ messages: [asked, answered] });

      // Another instance saves `late` while this cycle's Observer runs on `asked` + `answered`.
      const saveLate = async () => {
        await storage.saveMessages({ messages: [late] });
      };
      if (scope === 'thread') {
        vi.spyOn(om.observer, 'call').mockImplementation(async () => {
          await saveLate();
          return { observations: '- question answered' } as Awaited<ReturnType<typeof om.observer.call>>;
        });
      } else {
        vi.spyOn(om.observer, 'callMultiThread').mockImplementation(async () => {
          await saveLate();
          return {
            results: new Map([[ids.threadId, { observations: '- question answered' }]]),
          } as Awaited<ReturnType<typeof om.observer.callMultiThread>>;
        });
      }

      const result = await om.observe({
        threadId: ids.threadId,
        resourceId: ids.resourceId,
        messages: [asked, answered],
      });

      expect(result.observed).toBe(true);
      const stored = (await storage.listMessages({ threadId: ids.threadId, perPage: false })).messages;
      const markerTypes = (id: string) =>
        stored
          .find(m => m.id === id)!
          .content.parts.map(p => p.type)
          .filter(t => t.startsWith('data-om-observation'));
      expect(markerTypes(answered.id)).toEqual(['data-om-observation-start', 'data-om-observation-end']);
      expect(markerTypes(late.id)).toEqual([]);
      const head = (await storage.getObservationalMemory(scope === 'resource' ? null : ids.threadId, ids.resourceId))!;
      const unobserved = om.getUnobservedMessages(stored, head);
      expect(unobserved.map(m => m.id)).toEqual([late.id]);
      expect(JSON.stringify(unobserved[0]!.content.parts)).toContain('LATE_FACT');
    },
  );
});

describe('observed messages that later receive OM markers', () => {
  it('are not sent to the Observer again when only OM markers follow the observation boundary', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage);
    const ids = await setupThread(storage);
    const record = await om.getOrCreateRecord(ids.threadId, ids.resourceId);
    const at = new Date(ids.t0.getTime() + 1_000);
    const observedThenBuffered = message(ids.threadId, ids.resourceId, 'observed', 'seen', at, 'assistant');
    const withNewContent = message(ids.threadId, ids.resourceId, 'continued', 'seen', at, 'assistant');
    for (const msg of [observedThenBuffered, withNewContent]) {
      msg.content.parts.push(
        { type: 'data-om-observation-start', data: { cycleId: 'c1', operationType: 'observation' } } as any,
        { type: 'data-om-observation-end', data: { cycleId: 'c1', operationType: 'observation' } } as any,
        { type: 'data-om-buffering-start', data: { cycleId: 'b1', operationType: 'observation' } } as any,
        { type: 'data-om-buffering-end', data: { cycleId: 'b1', operationType: 'observation' } } as any,
      );
    }
    withNewContent.content.parts.push({ type: 'text', text: 'NEW_CONTENT' });

    const unobserved = om.getUnobservedMessages([observedThenBuffered, withNewContent], record);

    expect(unobserved.map(m => m.id)).toEqual(['continued']);
    expect(JSON.stringify(unobserved[0]!.content.parts)).toContain('NEW_CONTENT');
  });
});

describe('observation markers never cover content the cycle did not observe', () => {
  it("resource scope: another thread's markers stay off the current thread's live response", async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { scope: 'resource', messageTokens: 100 });
    const resourceId = randomUUID();
    const current = await setupThread(storage, resourceId);
    const other = await setupThread(storage, resourceId);
    const at = (s: number) => new Date(current.t0.getTime() + s * 1_000);
    // Both threads cross the threshold; the other thread is larger, so it alone fills the cycle and the
    // current thread is left out.
    await storage.saveMessages({
      messages: [message(other.threadId, resourceId, 'other-q', 'other '.repeat(1_000), at(1))],
    });
    const prompt = message(current.threadId, resourceId, 'cur-q', 'hello '.repeat(150), at(2));
    const response = message(current.threadId, resourceId, 'cur-a', 'CURRENT_LIVE_ANSWER', at(3), 'assistant');
    const messageList = new MessageList({ threadId: current.threadId, resourceId });
    messageList.add(prompt, 'input');
    messageList.add(response, 'response');
    vi.spyOn(om.observer, 'callMultiThread').mockResolvedValue({
      results: new Map([[other.threadId, { observations: '- other thread observed' }]]),
    } as Awaited<ReturnType<typeof om.observer.callMultiThread>>);

    const result = await om.observe({
      threadId: current.threadId,
      resourceId,
      messages: [prompt, response],
      messageList,
    });

    expect(result.observed).toBe(true);
    const live = messageList.get.all.db().find(m => m.id === response.id)!;
    expect(live.content.parts.map(p => p.type).filter(t => t.startsWith('data-om-observation'))).toEqual([]);
    const head = (await storage.getObservationalMemory(null, resourceId))!;
    expect(om.getUnobservedMessages([live], head).map(m => m.id)).toEqual([response.id]);
  });

  it('a part added to the observed message while the Observer runs stays after the end marker and in live context', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 100 });
    const ids = await setupThread(storage);
    const at = (s: number) => new Date(ids.t0.getTime() + s * 1_000);
    const asked = message(ids.threadId, ids.resourceId, 'grow-q', 'question', at(1));
    const answered = message(ids.threadId, ids.resourceId, 'grow-a', 'answer '.repeat(300), at(2), 'assistant');
    await storage.saveMessages({ messages: [asked, answered] });
    vi.spyOn(om.observer, 'call').mockImplementation(async () => {
      // Another instance's running turn appends a part to the same assistant message.
      const stored = (await storage.listMessagesById({ messageIds: [answered.id] })).messages[0]!;
      stored.content.parts.push({ type: 'text', text: 'GROWN_PART' });
      await storage.saveMessages({ messages: [stored] });
      return { observations: '- answered' } as Awaited<ReturnType<typeof om.observer.call>>;
    });

    const result = await om.observe({
      threadId: ids.threadId,
      resourceId: ids.resourceId,
      messages: [asked, answered],
    });

    expect(result.observed).toBe(true);
    const stored = (await storage.listMessages({ threadId: ids.threadId, perPage: false })).messages;
    const grown = stored.find(m => m.id === answered.id)!;
    expect(grown.content.parts.map(p => (p.type === 'text' ? p.text.slice(0, 6) : p.type))).toEqual([
      'answer',
      'data-om-observation-start',
      'data-om-observation-end',
      'GROWN_',
    ]);
    // The actor's context filter keeps parts after the end marker. (Whether the Observer later picks
    // the part up is a separate, pre-existing whole-message id check — ARCHITECTURE.md H7.)
    const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    const live = new MessageList({ threadId: ids.threadId, resourceId: ids.resourceId });
    live.add(stored, 'memory');
    filterObservedMessages({ messageList: live, record: head });
    const kept = live.get.all.db().find(m => m.id === answered.id);
    expect(JSON.stringify(kept?.content.parts)).toContain('GROWN_PART');
    expect(JSON.stringify(kept?.content.parts)).not.toContain('answer answer');
  });
});

describe('markers on already marked messages', () => {
  const marker = (type: string, cycleId: string) => ({ type, data: { cycleId, operationType: 'observation' } });
  const shape = (m: MastraDBMessage) => m.content.parts.map(p => (p.type === 'text' ? p.text.split(' ')[0] : p.type));

  it('a stored message that already has an end marker gets the new markers right after the newly observed parts', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 100 });
    const ids = await setupThread(storage);
    const at = (s: number) => new Date(ids.t0.getTime() + s * 1_000);
    const asked = message(ids.threadId, ids.resourceId, 'tr-q', 'question', at(1));
    const answered = message(ids.threadId, ids.resourceId, 'tr-a', 'OLD '.repeat(200), at(2), 'assistant');
    answered.content.parts.push(
      marker('data-om-observation-start', 'c0') as any,
      marker('data-om-observation-end', 'c0') as any,
      { type: 'text', text: 'NEW '.repeat(300) },
    );
    await storage.saveMessages({ messages: [asked, answered] });
    vi.spyOn(om.observer, 'call').mockImplementation(async () => {
      // Another instance's running turn appends to the same message while the Observer runs.
      const stored = (await storage.listMessagesById({ messageIds: [answered.id] })).messages[0]!;
      stored.content.parts.push({ type: 'text', text: 'GROWN part' });
      await storage.saveMessages({ messages: [stored] });
      return { observations: '- new answer' } as Awaited<ReturnType<typeof om.observer.call>>;
    });

    const stored = (await storage.listMessages({ threadId: ids.threadId, perPage: false })).messages;
    const result = await om.observe({ threadId: ids.threadId, resourceId: ids.resourceId, messages: stored });

    expect(result.observed).toBe(true);
    const after = (await storage.listMessagesById({ messageIds: [answered.id] })).messages[0]!;
    expect(shape(after)).toEqual([
      'OLD',
      'data-om-observation-start',
      'data-om-observation-end',
      'NEW',
      'data-om-observation-start',
      'data-om-observation-end',
      'GROWN',
    ]);
  });

  it("resource scope: no marker lands on another thread's message that still has unobserved parts", async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { scope: 'resource', messageTokens: 100 });
    const resourceId = randomUUID();
    const current = await setupThread(storage, resourceId);
    const other = await setupThread(storage, resourceId);
    const at = (s: number) => new Date(other.t0.getTime() + s * 1_000);
    // The other thread's answer was observed mid-loop, then gained a part. Its cursor is past the
    // answer, so this cycle only reads the user message that followed.
    const answer = message(other.threadId, resourceId, 'ot-a', 'ANSWER '.repeat(50), at(1), 'assistant');
    answer.content.parts.push(
      marker('data-om-observation-start', 'c0') as any,
      marker('data-om-observation-end', 'c0') as any,
      { type: 'text', text: 'UNOBSERVED tail' },
    );
    const followUp = message(other.threadId, resourceId, 'ot-q', 'follow '.repeat(1_000), at(3));
    await storage.saveMessages({ messages: [answer, followUp] });
    const thread = (await storage.getThreadById({ threadId: other.threadId }))!;
    await storage.updateThread({
      id: other.threadId,
      title: thread.title ?? '',
      metadata: setThreadOMMetadata(thread.metadata, { lastObservedAt: at(2).toISOString() }),
    });
    const prompt = message(current.threadId, resourceId, 'cur-q', 'hello '.repeat(150), at(4));
    vi.spyOn(om.observer, 'callMultiThread').mockResolvedValue({
      results: new Map([[other.threadId, { observations: '- follow-up observed' }]]),
    } as Awaited<ReturnType<typeof om.observer.callMultiThread>>);

    const result = await om.observe({ threadId: current.threadId, resourceId, messages: [prompt] });

    expect(result.observed).toBe(true);
    const after = (await storage.listMessagesById({ messageIds: [answer.id] })).messages[0]!;
    expect(shape(after)).toEqual(['ANSWER', 'data-om-observation-start', 'data-om-observation-end', 'UNOBSERVED']);
  });
});

describe('concurrent buffer() calls', () => {
  it('queued behind the same op run one after another, so new messages are buffered once', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 1_000, bufferTokens: 200 });
    const ids = await setupThread(storage);
    const at = (s: number) => new Date(ids.t0.getTime() + s * 1_000);
    const first = message(ids.threadId, ids.resourceId, 'cb-1', 'buffer me '.repeat(60), at(1));
    const second = message(ids.threadId, ids.resourceId, 'cb-2', 'and me '.repeat(60), at(2));
    await storage.saveMessages({ messages: [first, second] });
    // The processor passes the record it cached at turn start, before any buffering flag was set.
    const turnRecord = { ...(await om.getOrCreateRecord(ids.threadId, ids.resourceId)) };
    const firstObserverCall = deferred();
    const observerCall = vi.spyOn(om.observer, 'call').mockImplementation(async (_existing, messages) => {
      if (observerCall.mock.calls.length === 1) await firstObserverCall.promise;
      return { observations: `- obs ${messages.map(m => m.id).join(',')}` } as Awaited<
        ReturnType<typeof om.observer.call>
      >;
    });

    // The first op buffers cb-1; two more calls arrive while it runs and both cover cb-2.
    const running = om.buffer({ ...ids, messages: [first], skipMinimumTokenCheck: true });
    await vi.waitFor(() => expect(observerCall).toHaveBeenCalledTimes(1));
    const queued = [1, 2].map(() =>
      om.buffer({ ...ids, record: { ...turnRecord }, messages: [first, second], skipMinimumTokenCheck: true }),
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    firstObserverCall.resolve();
    await Promise.all([running, ...queued]);

    const head = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
    expect(observerCall).toHaveBeenCalledTimes(2);
    expect((head.bufferedObservationChunks ?? []).map(c => c.messageIds)).toEqual([['cb-1'], ['cb-2']]);
  });

  it('keep a later buffer() registered when the processor-path op ahead of it finishes', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 1_000, bufferTokens: 200 });
    const ids = await setupThread(storage);
    const at = (s: number) => new Date(ids.t0.getTime() + s * 1_000);
    const first = message(ids.threadId, ids.resourceId, 'pp-1', 'buffer me '.repeat(60), at(1));
    const second = message(ids.threadId, ids.resourceId, 'pp-2', 'and me '.repeat(60), at(2));
    await storage.saveMessages({ messages: [first, second] });
    const turnRecord = { ...(await om.getOrCreateRecord(ids.threadId, ids.resourceId)) };
    const internals = om as any;
    const lockKey = internals.buffering.getLockKey(ids.threadId, ids.resourceId);
    const bufferKey = internals.buffering.getObservationBufferKey(lockKey);
    const gate = deferred();
    let registeredDuringSecond: boolean | undefined;
    const observerCall = vi.spyOn(om.observer, 'call').mockImplementation(async () => {
      if (observerCall.mock.calls.length === 1) await gate.promise;
      else registeredDuringSecond = BufferingCoordinator.asyncBufferingOps.has(bufferKey);
      return { observations: '- buffered' } as Awaited<ReturnType<typeof om.observer.call>>;
    });

    // The processor path starts an op; buffer() queues behind it.
    await internals.startAsyncBufferedObservation({ ...turnRecord }, ids.threadId, [first], lockKey, undefined, 1_000);
    await vi.waitFor(() => expect(observerCall).toHaveBeenCalledTimes(1));
    const queued = om.buffer({
      ...ids,
      record: { ...turnRecord },
      messages: [first, second],
      skipMinimumTokenCheck: true,
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    gate.resolve();
    await queued;

    expect(observerCall).toHaveBeenCalledTimes(2);
    expect(registeredDuringSecond).toBe(true);
  });

  it('release the in-flight registration under the id they took it with, even after a rollover', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const om = createOM(storage, { messageTokens: 1_000, bufferTokens: 200 });
    const ids = await setupThread(storage);
    const at = (s: number) => new Date(ids.t0.getTime() + s * 1_000);
    const messages = [message(ids.threadId, ids.resourceId, 'rb-1', 'buffer me '.repeat(60), at(1))];
    await storage.saveMessages({ messages });
    // The turn cached generation 0; another process reflects before this buffer call runs.
    const turnRecord = { ...(await om.getOrCreateRecord(ids.threadId, ids.resourceId)) };
    const head = await storage.createReflectionGeneration({
      currentRecord: turnRecord,
      reflection: '- reflected',
      tokenCount: 2,
    });
    expect(head.id).not.toBe(turnRecord.id);
    let activeDuringObserver: Record<string, boolean> = {};
    vi.spyOn(om.observer, 'call').mockImplementation(async () => {
      activeDuringObserver = {
        turn: isOpActiveInProcess(turnRecord.id, 'bufferingObservation'),
        head: isOpActiveInProcess(head.id, 'bufferingObservation'),
      };
      return { observations: '- buffered' } as Awaited<ReturnType<typeof om.observer.call>>;
    });

    await om.buffer({ ...ids, record: turnRecord, messages, skipMinimumTokenCheck: true });

    expect(activeDuringObserver.turn).toBe(true);
    expect(isOpActiveInProcess(turnRecord.id, 'bufferingObservation')).toBe(false);
    expect(isOpActiveInProcess(head.id, 'bufferingObservation')).toBe(false);
  });
});

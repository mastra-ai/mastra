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
import { AsyncBufferObservationStrategy } from '../observation-strategies/async-buffer';
import { ObservationalMemory } from '../observational-memory';

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

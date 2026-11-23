import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { Extractor } from '../extractor';

function scriptedModel(reply: () => string | Promise<string>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: 'text' },
        { type: 'text-delta', id: 'text', delta: await reply() },
        { type: 'text-end', id: 'text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 } },
      ]),
    }),
  });
}

function createMemory(storage: InMemoryStore, reply: () => string | Promise<string>) {
  return new Memory({
    storage,
    options: {
      semanticRecall: false,
      observationalMemory: {
        scope: 'thread',
        observation: { model: scriptedModel(() => '<observations>* observed</observations>'), messageTokens: 1000 },
        reflection: {
          model: scriptedModel(reply),
          observationTokens: 1000,
          bufferActivation: 0.5,
          extract: [
            new Extractor({ name: 'Priority', instructions: 'Extract the priority.' }),
            new Extractor({ name: 'Task', instructions: 'Extract the task.', metadataKeyPath: 'currentTask' }),
            new Extractor({ name: 'Title', instructions: 'Extract the title.', metadataKeyPath: 'threadTitle' }),
          ],
        },
      },
    },
  });
}

function reflection(value: string) {
  return `<observations>* condensed ${value}</observations><current-task>${value} task</current-task><thread-title>${value} title</thread-title><extracted-values>{"priority":"${value}","task":"${value} task","title":"${value} title"}</extracted-values>`;
}

async function prepare(memory: Memory, threadId: string, resourceId: string, writer?: ProcessorStreamWriter) {
  const om = await memory.omEngine;
  if (!om) throw new Error('OM must be enabled');
  const turn = om.beginTurn({ threadId, resourceId, messageList: new MessageList({ threadId, resourceId }) });
  turn.writer = writer;
  await turn.start(memory);
  await turn.step(0).prepare();
  await om.settled();
  return om;
}

async function setup(reply: () => string | Promise<string>, initialTokens = 800) {
  const storage = new InMemoryStore();
  const memory = createMemory(storage, reply);
  const threadId = randomUUID();
  const resourceId = randomUUID();
  await memory.createThread({
    threadId,
    resourceId,
    title: 'Original',
    metadata: setThreadOMMetadata(
      { unrelated: 'preserved' },
      {
        currentTask: 'original task',
        threadTitle: 'original title',
        extracted: { priority: 'original' },
      },
    ),
  });
  const om = await memory.omEngine;
  if (!om) throw new Error('OM must be enabled');
  const record = await om.getOrCreateRecord(threadId, resourceId);
  const store = await storage.getStore('memory');
  if (!store) throw new Error('Memory store must exist');
  await store.updateActiveObservations({
    id: record.id,
    observations: '* original fact',
    tokenCount: initialTokens,
    lastObservedAt: new Date(),
  });
  return { storage, memory, om, store, threadId, resourceId };
}

async function values(memory: Memory, threadId: string) {
  return getThreadOMMetadata((await memory.getThreadById({ threadId }))?.metadata);
}

async function reachActivation(
  fixture: Awaited<ReturnType<typeof setup>>,
  memory = fixture.memory,
  { tail = '\n* later fact', writer }: { tail?: string; writer?: ProcessorStreamWriter } = {},
) {
  const head = await fixture.om.getRecord(fixture.threadId, fixture.resourceId);
  if (!head) throw new Error('Missing head');
  await fixture.store.updateActiveObservations({
    id: head.id,
    observations: head.activeObservations + tail,
    tokenCount: 1100,
    lastObservedAt: new Date(),
  });
  return prepare(memory, fixture.threadId, fixture.resourceId, writer);
}

function recordingWriter() {
  const chunks: Array<{ type: string; data?: unknown }> = [];
  const writer = {
    custom: async (chunk: { type: string; data?: unknown }) => {
      chunks.push(chunk);
    },
  } as unknown as ProcessorStreamWriter;
  const reflectionActivations = () =>
    chunks.filter(
      chunk =>
        chunk.type === 'data-om-activation' &&
        (chunk.data as { operationType?: string } | undefined)?.operationType === 'reflection',
    );
  return { writer, reflectionActivations };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

/**
 * Runs `write` as another writer whose storage write lands after the activation's head check but
 * before its swap reads storage. Only real storage calls run, so the adapter's swap logic is used.
 * With `legacy`, the adapter behaves like one that predates `newRecordId`: it ignores the id and
 * never reports `supersededBy`.
 */
function writeDuringSwap(
  f: Fixture,
  write: (snapshot: ObservationalMemoryRecord) => Promise<unknown>,
  { legacy = false }: { legacy?: boolean } = {},
) {
  const swap = f.store.swapBufferedReflectionToActive.bind(f.store);
  return vi.spyOn(f.store, 'swapBufferedReflectionToActive').mockImplementationOnce(async input => {
    await write(input.currentRecord);
    if (!legacy) return swap(input);
    const result = { ...(await swap({ ...input, newRecordId: undefined })) };
    delete result.supersededBy;
    return result;
  });
}

describe('buffered reflection extracted thread values (#27262)', () => {
  it.each([false, true])('publishes only after successful activation (reload=%s)', async reload => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.bufferedReflection).toContain('condensed prepared');
    expect(await values(f.memory, f.threadId)).toMatchObject({
      currentTask: 'original task',
      threadTitle: 'original title',
      extracted: { priority: 'original' },
    });
    if (reload) f.om.buffering.cleanupStaticMaps(f.threadId, f.resourceId);
    const activeMemory = reload
      ? createMemory(f.storage, () => {
          throw new Error('Must activate persisted buffer without another model call');
        })
      : f.memory;
    const activeOm = await reachActivation(f, activeMemory);
    const head = await activeOm.getRecord(f.threadId, f.resourceId);
    expect(head?.generationCount).toBe(1);
    expect(head?.activeObservations).toContain('condensed prepared');
    expect(head?.activeObservations).toContain('later fact');
    expect(await values(activeMemory, f.threadId)).toMatchObject({
      currentTask: 'prepared task',
      threadTitle: 'prepared title',
      extracted: { priority: 'prepared' },
    });
    expect((await activeMemory.getThreadById({ threadId: f.threadId }))?.metadata?.unrelated).toBe('preserved');
  });

  it('stores a compact reflection fingerprint instead of duplicating the reflection', async () => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const thread = await f.memory.getThreadById({ threadId: f.threadId });
    expect(thread?.metadata?.mastra).toMatchObject({
      omBufferedReflection: { reflectionDigest: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(JSON.stringify(thread?.metadata)).not.toContain('condensed prepared');
    await reachActivation(f);
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
  });

  it('publishes a legacy pending entry containing the full reflection after reload', async () => {
    const f = await setup(() => reflection('legacy'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const record = await f.om.getRecord(f.threadId, f.resourceId);
    if (!record) throw new Error('Missing head');
    await f.store.updateThreadMetadata({
      id: f.threadId,
      update: thread => ({
        ...thread.metadata,
        mastra: {
          omBufferedReflection: {
            recordId: record.id,
            reflection: record.bufferedReflection,
            reflectedObservationLineCount: record.reflectedObservationLineCount ?? 0,
            values: { priority: 'legacy' },
          },
        },
      }),
    });
    f.om.buffering.cleanupStaticMaps(f.threadId, f.resourceId);
    const replacement = createMemory(f.storage, () => {
      throw new Error('Must activate the persisted legacy buffer');
    });
    await reachActivation(f, replacement);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'legacy' } });
  });

  it('completes activation cleanup even when publishing thread metadata fails', async () => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    // Inject a failed storage write only at publication; preparation and the swap
    // use the real store. The next turn must be able to buffer another reflection.
    const publish = vi.spyOn(f.store, 'updateThreadMetadata').mockRejectedValueOnce(new Error('storage unavailable'));
    try {
      await reachActivation(f);
    } finally {
      publish.mockRestore();
    }
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.generationCount).toBe(1);
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    const head = await f.om.getRecord(f.threadId, f.resourceId);
    if (!head) throw new Error('Missing head');
    await f.store.updateActiveObservations({
      id: head.id,
      observations: head.activeObservations + '\n* new observations after activation',
      tokenCount: 800,
      lastObservedAt: new Date(),
    });
    await prepare(f.memory, f.threadId, f.resourceId);
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.bufferedReflection).toContain('condensed prepared');
  });

  it('does not publish staged values if the persisted buffer has changed', async () => {
    const f = await setup(() => reflection('stale'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const record = await f.om.getRecord(f.threadId, f.resourceId);
    if (!record) throw new Error('Missing head');
    // Another writer extends the same record's buffer without this extraction result.
    await f.store.updateBufferedReflection({
      id: record.id,
      reflection: '* newer buffered fact',
      tokenCount: 5,
      inputTokenCount: 10,
      reflectedObservationLineCount: record.reflectedObservationLineCount ?? 0,
    });
    await reachActivation(f);
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.activeObservations).toContain('newer buffered fact');
  });

  it('discards a reflector result when its generation was superseded while the model ran', async () => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const f = await setup(async () => {
      entered();
      await gate;
      return reflection('losing');
    });
    const preparing = prepare(f.memory, f.threadId, f.resourceId);
    await started;
    try {
      const old = await f.om.getRecord(f.threadId, f.resourceId);
      if (!old) throw new Error('Missing head');
      await f.store.createReflectionGeneration({
        currentRecord: { ...old },
        reflection: '* winning fact',
        tokenCount: 100,
      });
    } finally {
      release();
      await preparing;
    }
    expect(await values(f.memory, f.threadId)).toMatchObject({
      currentTask: 'original task',
      threadTitle: 'original title',
      extracted: { priority: 'original' },
    });
    const head = await f.om.getRecord(f.threadId, f.resourceId);
    expect(head?.activeObservations).toBe('* winning fact');
    expect(head?.bufferedReflection).toBeUndefined();
  });

  it('never publishes values from a superseded generation, including after reload', async () => {
    const f = await setup(() => reflection('discarded'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const old = await f.om.getRecord(f.threadId, f.resourceId);
    if (!old) throw new Error('Missing head');
    await f.store.createReflectionGeneration({
      currentRecord: { ...old },
      reflection: '* replacement fact',
      tokenCount: 800,
    });
    // A cold process has no coordinator boundary left from the retired generation.
    f.om.buffering.cleanupStaticMaps(f.threadId, f.resourceId);
    const replacement = createMemory(f.storage, () => reflection('replacement'));
    await prepare(replacement, f.threadId, f.resourceId);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    await reachActivation(f, replacement);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'replacement' } });
    expect((await (await replacement.omEngine)?.getRecord(f.threadId, f.resourceId))?.activeObservations).not.toContain(
      'discarded',
    );
  });

  // Technical: another process creates a new generation after this activation read the head but
  // before its commit ran, on an adapter that does not report `supersededBy`. The commit must not
  // treat the other process's generation as its own activation. (#27262)
  it('does not show a reflection activation when another process replaced the generation first', async () => {
    const f = await setup(() => reflection('losing'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const read = f.store.getObservationalMemory.bind(f.store);
    let replaced = false;
    const legacyAdapter = vi
      .spyOn(f.store, 'getObservationalMemory')
      .mockImplementation(async (threadId, resourceId) => {
        // Target the activation's snapshot read: the first read made by tryActivateBufferedReflection.
        const fromActivation = new Error().stack?.includes('tryActivateBufferedReflection') ?? false;
        const record = await read(threadId, resourceId);
        if (!record) return record;
        if (!replaced && fromActivation && record.bufferedReflection) {
          replaced = true;
          await f.store.createReflectionGeneration({
            currentRecord: { ...record },
            reflection: '* winning fact',
            tokenCount: 100,
          });
        }
        const legacy = { ...record };
        delete legacy.supersededBy;
        return legacy;
      });
    const { writer, reflectionActivations } = recordingWriter();
    try {
      await reachActivation(f, f.memory, { writer });
    } finally {
      legacyAdapter.mockRestore();
    }
    expect(replaced).toBe(true);
    expect(reflectionActivations()).toEqual([]);
    const head = await f.om.getRecord(f.threadId, f.resourceId);
    expect(head?.activeObservations).toBe('* winning fact');
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
  });
  // Another writer (a second process sharing the store) writes between this activation's head
  // check and its swap. Storage builds the new generation from what it stores at swap time, not
  // from the activation's snapshot. (#27262)
  describe('when another writer lands during activation', () => {
    // Technical: the swap trims only the outer ends of the tail it reads, so whitespace around the
    // snapshot tail ends up in the middle of the new active observations after an append.
    it.each([
      ['an empty tail', '', '\n\n* appended\n', '* appended'],
      ['a whitespace-only tail', '\n \t\n', '\n\n* appended\n', '* appended'],
      ['blank lines around the tail', '\n\n  * later\n\n', '\n  * appended\n\n', '* later\n\n\n  * appended'],
      ['a whitespace-only append', '\n  * later \t\n', '\n\t\n', '* later'],
      ['a tail ending in spaces', '\n  * later \t\n', '\n\n\t* appended  \n', '* later \t\n\n\n\t* appended'],
    ])('publishes values when observations are appended, after %s', async (_label, tail, append, expectedTail) => {
      const f = await setup(() => reflection('prepared'), 500);
      await prepare(f.memory, f.threadId, f.resourceId);
      const prepared = await f.om.getRecord(f.threadId, f.resourceId);
      // Copy it now: some stores return live records, which the swap clears.
      const preparedBuffer = prepared?.bufferedReflection;
      expect(prepared?.reflectedObservationLineCount).toBe(1);
      writeDuringSwap(f, snapshot =>
        f.store.updateActiveObservations({
          id: snapshot.id,
          observations: snapshot.activeObservations + append,
          tokenCount: 1150,
          lastObservedAt: new Date(),
        }),
      );
      const { writer, reflectionActivations } = recordingWriter();
      await reachActivation(f, f.memory, { tail, writer });
      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 1,
        activeObservations: `${preparedBuffer}\n\n${expectedTail}`,
      });
      expect(reflectionActivations()).toHaveLength(1);
      expect(await values(f.memory, f.threadId)).toMatchObject({
        currentTask: 'prepared task',
        threadTitle: 'prepared title',
        extracted: { priority: 'prepared' },
      });
    });

    it('keeps the buffer when observations are rewritten, and activates it on the next turn', async () => {
      const f = await setup(() => reflection('prepared'), 500);
      await prepare(f.memory, f.threadId, f.resourceId);
      writeDuringSwap(f, snapshot =>
        f.store.updateActiveObservations({
          id: snapshot.id,
          observations: '* original fact\n* later\n\n* appended',
          tokenCount: 1150,
          lastObservedAt: new Date(),
        }),
      );
      const { writer, reflectionActivations } = recordingWriter();
      await reachActivation(f, f.memory, { tail: '\n  * later \t', writer });
      expect(reflectionActivations()).toEqual([]);
      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 0,
        bufferedReflection: expect.stringContaining('condensed prepared'),
      });
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });

      await prepare(f.memory, f.threadId, f.resourceId, writer);
      expect(reflectionActivations()).toHaveLength(1);
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
    });

    // Technical: updateBufferedReflection appends to the stored buffer, so the activated text
    // starts with the snapshot's buffer and can look like the snapshot's buffer plus an append.
    it.each([
      ['an empty tail', '', 0, '* newer buffered fact'],
      ['a whitespace-only tail', '\n \t', 1, '* newer buffered fact'],
      ['a tail the extension also reflected', '\n* later fact', 1, '* later fact condensed by the other writer'],
    ] as const)(
      'does not publish staged values when the buffer is extended, after %s',
      async (_label, tail, extraReflectedLines, extension) => {
        const f = await setup(() => reflection('stale'), 500);
        await prepare(f.memory, f.threadId, f.resourceId);
        const prepared = await f.om.getRecord(f.threadId, f.resourceId);
        // Copy it now: some stores return live records, which the swap clears.
        const preparedBuffer = prepared?.bufferedReflection;
        expect(prepared?.reflectedObservationLineCount).toBe(1);
        writeDuringSwap(f, snapshot =>
          f.store.updateBufferedReflection({
            id: snapshot.id,
            reflection: extension,
            tokenCount: 50,
            inputTokenCount: 100,
            reflectedObservationLineCount: (snapshot.reflectedObservationLineCount ?? 0) + extraReflectedLines,
          }),
        );
        await reachActivation(f, f.memory, { tail });
        expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
          generationCount: 1,
          activeObservations: `${preparedBuffer}\n\n${extension}`,
        });
        expect(await values(f.memory, f.threadId)).toMatchObject({
          currentTask: 'original task',
          threadTitle: 'original title',
          extracted: { priority: 'original' },
        });
      },
    );

    it.each([false, true])(
      'shows no activation and keeps values when the generation is replaced (legacy adapter=%s)',
      async legacy => {
        const f = await setup(() => reflection('losing'));
        await prepare(f.memory, f.threadId, f.resourceId);
        writeDuringSwap(
          f,
          snapshot =>
            f.store.createReflectionGeneration({
              currentRecord: snapshot,
              reflection: '* winning fact',
              tokenCount: 100,
            }),
          { legacy },
        );
        const { writer, reflectionActivations } = recordingWriter();
        await reachActivation(f, f.memory, { writer, tail: '' });
        expect(reflectionActivations()).toEqual([]);
        expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
          generationCount: 1,
          activeObservations: '* winning fact',
        });
        expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
      },
    );

    // Technical: the losing activation must drop this process's reflection buffering boundary for
    // the retired generation, or the boundary blocks buffering for the generation that won.
    it.each([false, true])(
      'buffers the next reflection for the generation that won (legacy adapter=%s)',
      async legacy => {
        let reply = 'losing';
        const f = await setup(() => reflection(reply));
        await prepare(f.memory, f.threadId, f.resourceId);
        reply = 'next';
        let winnerId: string | undefined;
        writeDuringSwap(
          f,
          async snapshot => {
            winnerId = (
              await f.store.createReflectionGeneration({
                currentRecord: snapshot,
                reflection: '* winning fact',
                tokenCount: 800,
              })
            ).id;
          },
          { legacy },
        );
        const { writer, reflectionActivations } = recordingWriter();
        await reachActivation(f, f.memory, { writer });
        expect(reflectionActivations()).toEqual([]);
        // The winning generation's stored state is left as the other writer made it.
        const winner = await f.om.getRecord(f.threadId, f.resourceId);
        expect(winner).toMatchObject({
          id: winnerId,
          activeObservations: '* winning fact',
          observationTokenCount: 800,
        });
        expect(winner?.bufferedReflection).toBeUndefined();

        await prepare(f.memory, f.threadId, f.resourceId);
        expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
          bufferedReflection: expect.stringContaining('condensed next'),
        });
        expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
      },
    );

    it('publishes values and shows the activation on an adapter without newRecordId support', async () => {
      const f = await setup(() => reflection('prepared'));
      await prepare(f.memory, f.threadId, f.resourceId);
      writeDuringSwap(f, async () => {}, { legacy: true });
      const { writer, reflectionActivations } = recordingWriter();
      await reachActivation(f, f.memory, { writer });
      expect(reflectionActivations()).toHaveLength(1);
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
    });

    it('publishes activated values when a history adapter ignores the fourth options argument', async () => {
      const f = await setup(() => reflection('prepared'));
      await prepare(f.memory, f.threadId, f.resourceId);
      const getHistory = f.store.getObservationalMemoryHistory.bind(f.store);
      f.store.getObservationalMemoryHistory = (threadId, resourceId, limit) => getHistory(threadId, resourceId, limit);

      try {
        await reachActivation(f);
      } finally {
        f.store.getObservationalMemoryHistory = getHistory;
      }

      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 1,
        activeObservations: expect.stringContaining('condensed prepared'),
      });
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
    });
  });
});

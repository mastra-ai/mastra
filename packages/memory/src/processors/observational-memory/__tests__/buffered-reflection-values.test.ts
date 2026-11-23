import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
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

async function setup(reply: () => string | Promise<string>) {
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
    tokenCount: 800,
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

  // Technical: the snapshot tail ends in spaces, and another process appends an observation
  // between the snapshot read and the swap. The swap trims only the outer ends of the tail it
  // reads, so the spaces stay in the middle of the new active observations. (#27262)
  it('publishes values when observations are appended during activation after a tail ending in spaces', async () => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const swap = f.store.swapBufferedReflectionToActive.bind(f.store);
    const concurrentAppend = vi.spyOn(f.store, 'swapBufferedReflectionToActive').mockImplementationOnce(async input => {
      const head = await f.store.getObservationalMemory(f.threadId, f.resourceId);
      if (!head) throw new Error('Missing head');
      await f.store.updateActiveObservations({
        id: head.id,
        observations: `${head.activeObservations}\n* concurrent fact`,
        tokenCount: 1150,
        lastObservedAt: new Date(),
      });
      return swap(input);
    });
    try {
      await reachActivation(f, f.memory, { tail: '\n* later fact  ' });
    } finally {
      concurrentAppend.mockRestore();
    }
    const head = await f.om.getRecord(f.threadId, f.resourceId);
    expect(head?.generationCount).toBe(1);
    expect(head?.activeObservations).toContain('condensed prepared');
    expect(head?.activeObservations).toContain('* later fact  \n* concurrent fact');
    expect(await values(f.memory, f.threadId)).toMatchObject({
      currentTask: 'prepared task',
      threadTitle: 'prepared title',
      extracted: { priority: 'prepared' },
    });
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
});

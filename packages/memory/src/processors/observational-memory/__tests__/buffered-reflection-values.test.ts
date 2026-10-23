import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

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
          extract: [new Extractor({ name: 'Priority', instructions: 'Extract the priority.' })],
        },
      },
    },
  });
}

function reflection(value: string) {
  return `<observations>* condensed ${value}</observations><current-task>${value} task</current-task><thread-title>${value} title</thread-title><extracted-values>{"priority":"${value}"}</extracted-values>`;
}

async function prepare(memory: Memory, threadId: string, resourceId: string) {
  const om = await memory.omEngine;
  if (!om) throw new Error('OM must be enabled');
  const turn = om.beginTurn({ threadId, resourceId, messageList: new MessageList({ threadId, resourceId }) });
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
    metadata: setThreadOMMetadata({ unrelated: 'preserved' }, {
      currentTask: 'original task', threadTitle: 'original title', extracted: { priority: 'original' },
    }),
  });
  const om = await memory.omEngine;
  if (!om) throw new Error('OM must be enabled');
  const record = await om.getOrCreateRecord(threadId, resourceId);
  const store = await storage.getStore('memory');
  if (!store) throw new Error('Memory store must exist');
  await store.updateActiveObservations({ id: record.id, observations: '* original fact', tokenCount: 800, lastObservedAt: new Date() });
  return { storage, memory, om, store, threadId, resourceId };
}

async function values(memory: Memory, threadId: string) {
  return getThreadOMMetadata((await memory.getThreadById({ threadId }))?.metadata);
}

async function reachActivation(fixture: Awaited<ReturnType<typeof setup>>, memory = fixture.memory) {
  const head = await fixture.om.getRecord(fixture.threadId, fixture.resourceId);
  if (!head) throw new Error('Missing head');
  await fixture.store.updateActiveObservations({ id: head.id, observations: head.activeObservations + '\n* later fact', tokenCount: 1100, lastObservedAt: new Date() });
  return prepare(memory, fixture.threadId, fixture.resourceId);
}

describe('buffered reflection extracted thread values (#27262)', () => {
  it.each([false, true])('publishes only after successful activation (reload=%s)', async reload => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.bufferedReflection).toContain('condensed prepared');
    expect(await values(f.memory, f.threadId)).toMatchObject({
      currentTask: 'original task', threadTitle: 'original title', extracted: { priority: 'original' },
    });
    const activeMemory = reload ? createMemory(f.storage, () => { throw new Error('Must activate persisted buffer without another model call'); }) : f.memory;
    const activeOm = await reachActivation(f, activeMemory);
    const head = await activeOm.getRecord(f.threadId, f.resourceId);
    expect(head?.generationCount).toBe(1);
    expect(head?.activeObservations).toContain('condensed prepared');
    expect(head?.activeObservations).toContain('later fact');
    expect(await values(activeMemory, f.threadId)).toMatchObject({
      currentTask: 'prepared task', threadTitle: 'prepared title', extracted: { priority: 'prepared' },
    });
    expect((await activeMemory.getThreadById({ threadId: f.threadId }))?.metadata?.unrelated).toBe('preserved');
  });

  it('never publishes values from a superseded generation, including after reload', async () => {
    const f = await setup(() => reflection('discarded'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const old = await f.om.getRecord(f.threadId, f.resourceId);
    if (!old) throw new Error('Missing head');
    await f.store.createReflectionGeneration({ currentRecord: { ...old }, reflection: '* replacement fact', tokenCount: 800 });
    const replacement = createMemory(f.storage, () => reflection('replacement'));
    await prepare(replacement, f.threadId, f.resourceId);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    await reachActivation(f, replacement);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'replacement' } });
    expect((await (await replacement.omEngine)?.getRecord(f.threadId, f.resourceId))?.activeObservations).not.toContain('discarded');
  });
});

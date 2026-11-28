import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { Extractor } from '../extractor';

function createModel(text: string) {
  return new MockLanguageModelV2({
    provider: 'mock',
    modelId: 'mock',
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: '1' });
          controller.enqueue({ type: 'text-delta', id: '1', delta: text });
          controller.enqueue({ type: 'text-end', id: '1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
      warnings: [],
    }),
  });
}

function extractors() {
  return [
    new Extractor({
      name: 'Broken',
      instructions: () => {
        throw new Error('broken extractor');
      },
    }),
    new Extractor({ name: 'Healthy', instructions: 'Extract the healthy value.' }),
  ];
}

function message(threadId: string, resourceId: string): MastraDBMessage {
  return {
    id: `message-${threadId}`,
    threadId,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'Remember the healthy value.' }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
  };
}

async function createMemory(stage: 'observation' | 'reflection') {
  const model = createModel(
    '<observations>\n- Healthy observation.\n</observations>\n<extracted-values>\n{"healthy":"committed"}\n</extracted-values>',
  );
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    options: {
      generateTitle: false,
      observationalMemory: {
        enabled: true,
        observation: {
          model,
          messageTokens: 100_000,
          bufferTokens: false,
          extract: stage === 'observation' ? extractors() : undefined,
        },
        reflection: {
          model,
          observationTokens: 100,
          extract: stage === 'reflection' ? extractors() : undefined,
        },
      },
    },
  });
  return { memory, storage, engine: (await memory.omEngine)! };
}

async function saveThread(storage: InMemoryStore, threadId: string, resourceId: string) {
  const memoryStore = await storage.getStore('memory');
  await memoryStore!.saveThread({
    thread: { id: threadId, resourceId, title: 'Test', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
  });
  return memoryStore!;
}

describe('extractor resolution failure commit isolation', () => {
  it('commits healthy observation extraction when another extractor fails to resolve', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const threadId = 'observation-extractor-isolation';
    const resourceId = 'resource';
    const { storage, engine } = await createMemory('observation');
    const memoryStore = await saveThread(storage, threadId, resourceId);

    await engine.observe({ threadId, resourceId, messages: [message(threadId, resourceId)], force: true });

    const record = await engine.getRecord(threadId, resourceId);
    const thread = await memoryStore.getThreadById({ threadId });
    expect(record?.activeObservations).toContain('Healthy observation');
    expect(thread?.metadata).toMatchObject({ mastra: { om: { extracted: { healthy: 'committed' } } } });
    expect(JSON.stringify(thread?.metadata)).not.toContain('broken');
    warn.mockRestore();
  });

  it('commits healthy reflection extraction when another extractor fails to resolve', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const threadId = 'reflection-extractor-isolation';
    const resourceId = 'resource';
    const { storage, engine } = await createMemory('reflection');
    const memoryStore = await saveThread(storage, threadId, resourceId);
    const created = await engine.getOrCreateRecord(threadId, resourceId);
    await memoryStore.updateActiveObservations({
      id: created.id,
      observations: '- Existing observation.\n'.repeat(30),
      tokenCount: 1000,
    });
    const record = (await engine.getRecord(threadId, resourceId))!;

    await engine.reflector.maybeReflect({ record, observationTokens: 1000, threadId });

    const persisted = await engine.getRecord(threadId, resourceId);
    const thread = await memoryStore.getThreadById({ threadId });
    expect(persisted?.activeObservations).toContain('Healthy observation');
    expect(thread?.metadata).toMatchObject({ mastra: { om: { extracted: { healthy: 'committed' } } } });
    expect(JSON.stringify(thread?.metadata)).not.toContain('broken');
    warn.mockRestore();
  });
});

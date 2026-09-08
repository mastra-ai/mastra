import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import type { ObservationalMemoryModel } from '../types';

const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function createMockObserverModel(observations = 'User confirmed Project Atlas launches on 2026-09-15.') {
  const text = `<observations>\n${observations}\n</observations>\n<current-task>Continue the launch work.</current-task>`;
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text' as const, text }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'observer-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: text },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createMemory(options?: { omModel?: ObservationalMemoryModel | false }) {
  return new Memory({
    storage: new InMemoryStore(),
    ...semanticInfrastructure,
    options: {
      observationalMemory: {
        ...(options?.omModel === false ? {} : { model: options?.omModel ?? 'openai/om-model' }),
        observation: { messageTokens: 1, bufferTokens: false },
        experimental_subconscious: new Subconscious({ defaultScope: 'resource', maxScope: 'resource' }),
      },
    },
  });
}

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

async function seedMessages(memory: Memory, threadId = 'alpha', resourceId = 'user-42') {
  const now = new Date();
  const messageStore = (await memory.storage.getStore('memory'))!;
  await messageStore.saveMessages({
    messages: [
      {
        id: `${threadId}-user`,
        threadId,
        resourceId,
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Project Atlas launch details. '.repeat(20), createdAt: now.getTime() }],
        },
        createdAt: now,
      },
      {
        id: `${threadId}-assistant`,
        threadId,
        resourceId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Understood. '.repeat(20), createdAt: now.getTime() + 1 }],
        },
        createdAt: new Date(now.getTime() + 1),
      },
    ] as MastraDBMessage[],
  });
}

afterEach(() => vi.restoreAllMocks());

describe('direct observation curation', () => {
  it('dispatches the raw observation through the configured curate extractor', async () => {
    const observation = 'User confirmed Project Atlas launches on 2026-09-15.';
    const memory = createMemory({ omModel: createMockObserverModel(observation) });
    const accepted = new Promise<any>(() => {});
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockReturnValue({ accepted, signal: {} } as any);
    await seedMessages(memory);

    const om = await memory.omEngine;
    expect(om).not.toBeNull();
    const result = await om!.observe({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.observed).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(
      { contents: expect.stringContaining(observation) },
      expect.objectContaining({ threadId: 'subconscious:alpha:curate' }),
    );
  });

  it('does not wait for the curator run before resolving the observation cycle', async () => {
    const memory = createMemory({ omModel: createMockObserverModel() });
    const accepted = new Promise<any>(() => {});
    vi.spyOn(Agent.prototype, 'sendMessage').mockReturnValue({ accepted, signal: {} } as any);
    await seedMessages(memory);

    const om = (await memory.omEngine)!;
    await expect(
      om.observe({ threadId: 'alpha', resourceId: 'user-42', requestContext: requestContext() }),
    ).resolves.toMatchObject({ observed: true });
  });

  it('isolates asynchronous curator failure from observation persistence', async () => {
    const memory = createMemory({ omModel: createMockObserverModel() });
    vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation(
      () => ({ accepted: Promise.reject(new Error('curator unavailable')), signal: {} }) as any,
    );
    await seedMessages(memory);

    const om = (await memory.omEngine)!;
    const result = await om.observe({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.observed).toBe(true);
    expect(result.record.activeObservations).toContain('Project Atlas launches on 2026-09-15');
  });
});

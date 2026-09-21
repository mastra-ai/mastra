import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { ConsoleLogger, noopLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { ObserverRunner } from '../observer-runner';
import { ReflectorRunner } from '../reflector-runner';

function createInMemoryStorage(): InMemoryMemory {
  return new InMemoryMemory({ db: new InMemoryDB() });
}

function createNoopModel(modelId: string) {
  return new MockLanguageModelV2({
    modelId,
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      text: '<observations>* noop</observations>',
      content: [{ type: 'text' as const, text: '<observations>* noop</observations>' }],
      warnings: [],
    }),
  });
}

function createObserverRunner(mastra?: Mastra) {
  return new ObserverRunner({
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
      bufferTokens: false,
      previousObserverTokens: 1000,
      observeAttachments: false,
    } as any,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: 'mock/model' as any }),
    tokenCounter: {
      countMessages: () => 1,
    } as any,
    ...(mastra ? { mastra } : {}),
  });
}

function createReflectorRunner(mastra?: Mastra) {
  return new ReflectorRunner({
    reflectionConfig: {
      model: 'mock/model',
      observationTokens: 1000,
    } as any,
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
    } as any,
    tokenCounter: {
      countObservations: () => 1,
    } as any,
    storage: {} as any,
    scope: 'thread',
    buffering: {} as any,
    emitDebugEvent: vi.fn(),
    persistMarkerToStorage: vi.fn(),
    persistMarkerToMessage: vi.fn(),
    getCompressionStartLevel: async () => 0,
    resolveModel: () => ({ model: 'mock/model' as any }),
    ...(mastra ? { mastra } : {}),
  });
}

describe('OM agent logger propagation', () => {
  it('observer agent uses the configured Mastra logger', () => {
    const mastra = new Mastra({ logger: noopLogger });
    const runner = createObserverRunner(mastra);

    const agent = (runner as any).createAgent('mock/model');

    expect(agent.logger).toBe(mastra.getLogger());
    expect(agent.logger instanceof ConsoleLogger).toBe(false);
  });

  it('multi-thread observer agent uses the configured Mastra logger', () => {
    const mastra = new Mastra({ logger: noopLogger });
    const runner = createObserverRunner(mastra);

    const agent = (runner as any).createAgent('mock/model', true);

    expect(agent.logger).toBe(mastra.getLogger());
    expect(agent.logger instanceof ConsoleLogger).toBe(false);
  });

  it('reflector agent uses the configured Mastra logger', () => {
    const mastra = new Mastra({ logger: noopLogger });
    const runner = createReflectorRunner(mastra);

    const agent = (runner as any).createAgent('mock/model');

    expect(agent.logger).toBe(mastra.getLogger());
    expect(agent.logger instanceof ConsoleLogger).toBe(false);
  });

  it('foreign-thread drop warns on the logger installed after construction', async () => {
    const storage = createInMemoryStorage();
    // Constructed BEFORE any Mastra exists: a constructor-time logger snapshot
    // would capture `undefined` and never warn.
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: createNoopModel('mock-observer'), messageTokens: 1000 },
    } as any);

    const warn = vi.fn();
    const mastra = new Mastra({ logger: { ...noopLogger, warn } as any });
    om.__registerMastra(mastra as any);

    const sharedId = 'shared-message-id';
    await storage.saveThread({
      thread: {
        id: 'thread-b',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      } as any,
    });
    await storage.saveMessages({
      messages: [
        {
          id: sharedId,
          threadId: 'thread-b',
          resourceId: 'resource-1',
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'canonical' }] },
        } as any,
      ],
    });

    await om.persistClientInputMessages(
      [
        {
          id: sharedId,
          threadId: 'thread-a',
          resourceId: 'resource-1',
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'echo' }] },
        } as any,
      ],
      [],
      'thread-a',
      'resource-1',
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('foreign-thread IDs'),
      expect.objectContaining({ threadId: 'thread-a', droppedMessageIds: [sharedId] }),
    );
  });

  it('observer agent registered via __registerMastra uses the configured logger', () => {
    const mastra = new Mastra({ logger: noopLogger });
    const runner = createObserverRunner();
    runner.__registerMastra(mastra);

    const agent = (runner as any).createAgent('mock/model');

    expect(agent.logger).toBe(mastra.getLogger());
    expect(agent.logger instanceof ConsoleLogger).toBe(false);
  });
});

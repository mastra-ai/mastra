import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { RequestContext } from '@mastra/core/di';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
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

describe('getCompressionStartLevel', () => {
  it('returns level 2 for google/gemini-2.5-flash', async () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      observation: {
        model: createNoopModel('mock-observer'),
        messageTokens: 1000,
      },
      reflection: {
        model: 'google/gemini-2.5-flash',
        observationTokens: 40000,
      },
    });

    const level = await (om as any).getCompressionStartLevel();

    expect(level).toBe(2);
  });

  it('returns level 1 for non-gemini-2.5-flash models', async () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      observation: {
        model: createNoopModel('mock-observer'),
        messageTokens: 1000,
      },
      reflection: {
        model: 'google/gemini-3.1-flash-lite-preview',
        observationTokens: 40000,
      },
    });

    const level = await (om as any).getCompressionStartLevel();

    expect(level).toBe(1);
  });

  it('uses request-scoped model resolution when choosing the compression start level', async () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      observation: {
        model: createNoopModel('mock-observer'),
        messageTokens: 1000,
      },
      reflection: {
        model: ({ requestContext }: { requestContext: RequestContext }) => {
          const selectedModel = requestContext.get('selectedReflectorModel');
          return selectedModel === 'gemini-2.5-flash'
            ? 'google/gemini-2.5-flash'
            : 'google/gemini-3.1-flash-lite-preview';
        },
        observationTokens: 40000,
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('selectedReflectorModel', 'gemini-2.5-flash');

    const level = await (om as any).getCompressionStartLevel(requestContext);

    expect(level).toBe(2);
  });

  it('returns level 1 when model resolution fails', async () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: 'thread',
      observation: {
        model: createNoopModel('mock-observer'),
        messageTokens: 1000,
      },
      reflection: {
        model: 'google/gemini-2.5-flash',
        observationTokens: 40000,
      },
    });

    (om as any).resolveModelContext = async () => {
      throw new Error('boom');
    };

    const level = await (om as any).getCompressionStartLevel();

    expect(level).toBe(1);
  });
});

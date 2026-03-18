import { describe, expect, it } from 'vitest';

import { InMemoryStore } from '../storage';

import { MockMemory } from './mock';

describe('MastraMemory config serialization', () => {
  it('should serialize observational memory graph config for thread scope', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          graph: true,
          observation: {
            messageTokens: 500,
            model: 'test-observer-model',
          },
          reflection: {
            observationTokens: 1000,
            model: 'test-reflector-model',
          },
        },
      },
    });

    expect(memory.getConfig().observationalMemory).toEqual({
      scope: 'thread',
      graph: true,
      observation: {
        messageTokens: 500,
        model: 'test-observer-model',
        modelSettings: undefined,
        providerOptions: undefined,
        maxTokensPerBatch: undefined,
        bufferTokens: undefined,
        bufferActivation: undefined,
        blockAfter: undefined,
      },
      reflection: {
        observationTokens: 1000,
        model: 'test-reflector-model',
        modelSettings: undefined,
        providerOptions: undefined,
        blockAfter: undefined,
      },
      shareTokenBudget: undefined,
    });
  });

  it('should serialize graph config for resource scope without changing the requested config', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'resource',
          graph: true,
          model: 'test-model',
        },
      },
    });

    expect(memory.getConfig().observationalMemory).toEqual({
      scope: 'resource',
      graph: true,
      model: 'test-model',
      shareTokenBudget: undefined,
    });
  });
});

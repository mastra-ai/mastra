import { describe, expect, it } from 'vitest';

import { InMemoryStore } from '../storage';

import { MockMemory } from './mock';

describe('MastraMemory config serialization', () => {
  it('should serialize observational memory retrieval config for thread scope', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          retrieval: true,
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
      retrieval: true,
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

  it('should serialize retrieval config for resource scope without changing the requested config', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'resource',
          retrieval: true,
          model: 'test-model',
        },
      },
    });

    expect(memory.getConfig().observationalMemory).toEqual({
      scope: 'resource',
      retrieval: true,
      model: 'test-model',
      shareTokenBudget: undefined,
    });
  });

  it('should serialize retrieval config with vector: true', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          retrieval: { vector: true },
          model: 'test-model',
        },
      },
    });

    const omConfig = memory.getConfig().observationalMemory;
    expect(typeof omConfig).not.toBe('boolean');
    if (typeof omConfig !== 'boolean' && omConfig) {
      expect(omConfig.retrieval).toEqual({ vector: true });
    }
  });

  it('should preserve backward compatibility with retrieval: false', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          retrieval: false,
          model: 'test-model',
        },
      },
    });

    const omConfig = memory.getConfig().observationalMemory;
    expect(typeof omConfig).not.toBe('boolean');
    if (typeof omConfig !== 'boolean' && omConfig) {
      expect(omConfig.retrieval).toBe(false);
    }
  });
});

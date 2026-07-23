import { describe, expect, it, vi } from 'vitest';

import { MastraFGAPermissions } from '../auth/ee';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage';

import { MockMemory } from './mock';

describe('MastraMemory FGA', () => {
  it('bypasses thread membership resolution for a tenant-scoped trusted actor', async () => {
    const fgaProvider = {
      require: vi.fn().mockResolvedValue(undefined),
    };
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');

    await MockMemory.checkThreadFGA({
      mastra: {
        getServer: () => ({ fga: fgaProvider }),
      } as any,
      threadId: 'thread-1',
      resourceId: 'tenant-1',
      requestContext,
      permission: MastraFGAPermissions.MEMORY_READ,
      actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
    });

    expect(fgaProvider.require).not.toHaveBeenCalled();
  });
});

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
      activateAfterIdle: undefined,
      temporalMarkers: undefined,
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
      activateAfterIdle: undefined,
      temporalMarkers: undefined,
      retrieval: true,
      model: 'test-model',
      shareTokenBudget: undefined,
    });
  });

  it('should serialize retrieval config with additional instructions', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          retrieval: {
            vector: true,
            additionalInstructions: 'Use message browsing before semantic search.',
          },
          model: 'test-model',
        },
      },
    });

    const omConfig = memory.getConfig().observationalMemory;
    expect(typeof omConfig).not.toBe('boolean');
    if (typeof omConfig !== 'boolean' && omConfig) {
      expect(omConfig.retrieval).toEqual({
        vector: true,
        additionalInstructions: 'Use message browsing before semantic search.',
      });
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

  it('should serialize top-level activateAfterIdle for observational memory', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          activateAfterIdle: '5m',
          model: 'test-model',
        },
      },
    });

    expect(memory.getConfig().observationalMemory).toEqual({
      scope: 'thread',
      activateAfterIdle: '5m',
      model: 'test-model',
      shareTokenBudget: undefined,
      temporalMarkers: undefined,
      retrieval: undefined,
    });
  });

  it('should serialize auto activateAfterIdle for observational memory', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          activateAfterIdle: 'auto',
          model: 'test-model',
        },
      },
    });

    expect(memory.getConfig().observationalMemory).toEqual({
      scope: 'thread',
      activateAfterIdle: 'auto',
      model: 'test-model',
      shareTokenBudget: undefined,
      temporalMarkers: undefined,
      retrieval: undefined,
    });
  });

  it('should serialize temporalMarkers for observational memory', () => {
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          scope: 'thread',
          temporalMarkers: true,
          model: 'test-model',
        },
      },
    });

    expect(memory.getConfig().observationalMemory).toEqual({
      scope: 'thread',
      activateAfterIdle: undefined,
      model: 'test-model',
      shareTokenBudget: undefined,
      temporalMarkers: true,
      retrieval: undefined,
    });
  });
});

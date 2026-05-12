import { MastraModelGateway } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryMemory, InMemoryDB, InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';

class TestGateway extends MastraModelGateway {
  readonly id = 'om-test';
  readonly name = 'observational-memory-test-gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      provider: {
        name: 'Observational Memory Test Provider',
        models: ['model'],
        apiKeyEnvVar: 'TEST_API_KEY',
        gateway: this.name,
        url: 'https://example.test/v1',
      },
    };
  }

  buildUrl(): string {
    return 'https://example.test/v1';
  }

  async getApiKey(): Promise<string> {
    return 'test-key';
  }

  resolveLanguageModel(): never {
    throw new Error('resolveLanguageModel should not be called by this regression test');
  }
}

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
}

describe('ObservationalMemory — custom gateway propagation', () => {
  it('resolves custom gateway models when Memory receives the parent Mastra instance before OM initialization', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          model: 'om-test/provider/model',
          scope: 'resource',
          observation: { messageTokens: 100_000 },
          reflection: { observationTokens: 100_000 },
        },
      },
    });

    const mastra = new Mastra({ logger: false, gateways: { omTest: new TestGateway() } });
    memory.__registerMastra(mastra);

    const om = await memory.omEngine;
    expect(om).not.toBeNull();

    const resolved = await (om as any).resolveModelContext('om-test/provider/model');
    expect(resolved).toMatchObject({ provider: 'provider', modelId: 'model' });
    expect((om!.observer as any).createAgent('om-test/provider/model').getMastraInstance()).toBe(mastra);
    expect((om!.reflector as any).createAgent('om-test/provider/model').getMastraInstance()).toBe(mastra);
  });

  it('updates an already-created ObservationalMemory engine when Memory is registered later', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          model: 'om-test/provider/model',
          observation: { messageTokens: 100_000 },
          reflection: { observationTokens: 100_000 },
        },
      },
    });

    const om = await memory.omEngine;
    expect(om).not.toBeNull();

    const mastra = new Mastra({ logger: false, gateways: { omTest: new TestGateway() } });
    memory.__registerMastra(mastra);

    const resolved = await (om as any).resolveModelContext('om-test/provider/model');
    expect(resolved).toMatchObject({ provider: 'provider', modelId: 'model' });
    expect((om!.observer as any).createAgent('om-test/provider/model').getMastraInstance()).toBe(mastra);
    expect((om!.reflector as any).createAgent('om-test/provider/model').getMastraInstance()).toBe(mastra);
  });

  it('forwards the parent Mastra instance to the Observer agent', () => {
    const mastra = new Mastra({ logger: false });
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'thread',
      mastra,
    });

    const agent = (om.observer as any).createAgent('test-model');
    expect(agent.getMastraInstance()).toBe(mastra);
  });

  it('forwards the parent Mastra instance to the multi-thread Observer agent', () => {
    const mastra = new Mastra({ logger: false });
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'resource',
      mastra,
    });

    const agent = (om.observer as any).createAgent('test-model', true);
    expect(agent.getMastraInstance()).toBe(mastra);
  });

  it('forwards the parent Mastra instance to the Reflector agent', () => {
    const mastra = new Mastra({ logger: false });
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'thread',
      mastra,
    });

    const agent = (om.reflector as any).createAgent('test-model');
    expect(agent.getMastraInstance()).toBe(mastra);
  });

  it('preserves prior behavior when no Mastra instance is supplied', () => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'thread',
    });

    expect((om.observer as any).createAgent('test-model').getMastraInstance()).toBeUndefined();
    expect((om.reflector as any).createAgent('test-model').getMastraInstance()).toBeUndefined();
  });
});

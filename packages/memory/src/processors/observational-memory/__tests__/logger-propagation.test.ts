import { ConsoleLogger, noopLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';

import { ObserverRunner } from '../observer-runner';
import { ReflectorRunner } from '../reflector-runner';

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

  it('observer agent registered via __registerMastra uses the configured logger', () => {
    const mastra = new Mastra({ logger: noopLogger });
    const runner = createObserverRunner();
    runner.__registerMastra(mastra);

    const agent = (runner as any).createAgent('mock/model');

    expect(agent.logger).toBe(mastra.getLogger());
    expect(agent.logger instanceof ConsoleLogger).toBe(false);
  });
});

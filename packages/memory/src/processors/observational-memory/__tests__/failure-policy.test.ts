import { describe, expect, it, vi } from 'vitest';

import { ResourceScopedObservationStrategy } from '../observation-strategies/resource-scoped';
import { SyncObservationStrategy } from '../observation-strategies/sync';
import type { StrategyDeps } from '../observation-strategies/base';
import type { ObservationRunOpts } from '../observation-strategies/types';
import type { ObservationFailurePolicy, ResolvedObservationConfig } from '../types';

function createMockDeps(failurePolicy?: ObservationFailurePolicy): StrategyDeps {
  return {
    storage: {
      getObservationalMemory: vi.fn(),
      persistMarkerToStorage: vi.fn(),
    } as any,
    messageHistory: {} as any,
    tokenCounter: {
      countMessagesAsync: vi.fn().mockResolvedValue(100),
    } as any,
    observationConfig: {
      failurePolicy: failurePolicy ?? 'throw',
      modelSettings: {},
      providerOptions: {},
      maxTokensPerBatch: 1000,
      extractors: [],
    } as unknown as ResolvedObservationConfig,
    reflectionConfig: {} as any,
    scope: 'thread',
    retrieval: false,
    observer: {} as any,
    reflector: {} as any,
    observedMessageIds: new Set(),
    obscureThreadIds: false,
    emitDebugEvent: vi.fn(),
    persistMarkerToStorage: vi.fn().mockResolvedValue(undefined),
    persistMarkerToMessage: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockOpts(): ObservationRunOpts {
  return {
    record: {
      id: 'rec-test-1',
      threadId: 'thread-test-1',
      resourceId: 'resource-test-1',
      activeObservations: '',
    } as any,
    threadId: 'thread-test-1',
    resourceId: 'resource-test-1',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello world',
        createdAt: new Date(),
        type: 'text',
      } as any,
    ],
  };
}

describe('ObservationFailurePolicy', () => {
  describe('SyncObservationStrategy.rethrowOnFailure', () => {
    it('returns true when failurePolicy is "throw"', () => {
      const deps = createMockDeps('throw');
      const strategy = new SyncObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(true);
    });

    it('defaults to true when failurePolicy is undefined or default', () => {
      const deps = createMockDeps();
      const strategy = new SyncObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(true);
    });

    it('returns false when failurePolicy is "warn"', () => {
      const deps = createMockDeps('warn');
      const strategy = new SyncObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(false);
    });

    it('returns false when failurePolicy is "bypass"', () => {
      const deps = createMockDeps('bypass');
      const strategy = new SyncObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(false);
    });
  });

  describe('ResourceScopedObservationStrategy.rethrowOnFailure', () => {
    it('returns true when failurePolicy is "throw"', () => {
      const deps = createMockDeps('throw');
      const strategy = new ResourceScopedObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(true);
    });

    it('defaults to true when failurePolicy is undefined or default', () => {
      const deps = createMockDeps();
      const strategy = new ResourceScopedObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(true);
    });

    it('returns false when failurePolicy is "warn"', () => {
      const deps = createMockDeps('warn');
      const strategy = new ResourceScopedObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(false);
    });

    it('returns false when failurePolicy is "bypass"', () => {
      const deps = createMockDeps('bypass');
      const strategy = new ResourceScopedObservationStrategy(deps, createMockOpts());
      expect(strategy.rethrowOnFailure).toBe(false);
    });
  });

  describe('ObservationStrategy error handling execution', () => {
    it('rethrows error when rethrowOnFailure is true', async () => {
      const deps = createMockDeps('throw');
      const strategy = new SyncObservationStrategy(deps, createMockOpts());

      // Mock prepare and observe to throw
      vi.spyOn(strategy, 'prepare').mockRejectedValue(new Error('LLM rate limit reached'));

      await expect(strategy.run()).rejects.toThrow('LLM rate limit reached');
    });

    it('returns { observed: false, error } and does not throw when failurePolicy is "warn"', async () => {
      const deps = createMockDeps('warn');
      const strategy = new SyncObservationStrategy(deps, createMockOpts());

      const failureError = new Error('Observer network timeout');
      vi.spyOn(strategy, 'prepare').mockRejectedValue(failureError);

      const result = await strategy.run();
      expect(result.observed).toBe(false);
      expect(result.error).toBe(failureError);
    });

    it('returns { observed: false, error } and does not throw when failurePolicy is "bypass"', async () => {
      const deps = createMockDeps('bypass');
      const strategy = new SyncObservationStrategy(deps, createMockOpts());

      const failureError = new Error('Observer token budget exceeded');
      vi.spyOn(strategy, 'prepare').mockRejectedValue(failureError);

      const result = await strategy.run();
      expect(result.observed).toBe(false);
      expect(result.error).toBe(failureError);
    });
  });
});

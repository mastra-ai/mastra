import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { MastraServerCache } from '../../cache';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { ProcessInputStepArgs } from '../index';
import { AdaptiveModelRouter } from './adaptive-model-router';
import type { AdaptiveModelRouterOptions, ErrorRateRule, ScoreRule, FeedbackRule } from './adaptive-model-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockObservabilityStorage(overrides?: {
  getMetricBreakdown?: ReturnType<typeof vi.fn>;
  getScoreAggregate?: ReturnType<typeof vi.fn>;
  getFeedbackBreakdown?: ReturnType<typeof vi.fn>;
}): ObservabilityStorage {
  return {
    getMetricBreakdown: overrides?.getMetricBreakdown ?? vi.fn().mockResolvedValue({ groups: [] }),
    getScoreAggregate: overrides?.getScoreAggregate ?? vi.fn().mockResolvedValue({ value: null }),
    getFeedbackBreakdown: overrides?.getFeedbackBreakdown ?? vi.fn().mockResolvedValue({ groups: [] }),
    getMetricAggregate: vi.fn().mockResolvedValue({ value: null }),
  } as unknown as ObservabilityStorage;
}

function createMockCache(): MastraServerCache {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn().mockImplementation(async (key: string) => store.get(key) ?? null),
    set: vi.fn().mockImplementation(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }),
    clear: vi.fn().mockImplementation(async () => {
      store.clear();
    }),
    increment: vi.fn(),
    listLength: vi.fn(),
    listPush: vi.fn(),
    listFromTo: vi.fn(),
  } as unknown as MastraServerCache;
}

function createMockTracing(traceId: string) {
  return {
    currentSpan: { traceId },
  };
}

function createInputStepArgs(overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs {
  return {
    steps: [],
    stepNumber: 0,
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text' as const, text: 'hello' }] },
        createdAt: new Date(),
      },
    ],
    messageList: {} as MessageList,
    abort: ((reason?: string, options?: any) => {
      throw new TripWire(reason ?? 'abort', options ?? {});
    }) as any,
    retryCount: 0,
    model: { modelId: 'gpt-4o', provider: 'openai', specificationVersion: 'v2' } as any,
    systemMessages: [],
    state: {},
    ...overrides,
  };
}

function createRouter(
  options: AdaptiveModelRouterOptions,
  obsStorage?: ObservabilityStorage,
  cache?: MastraServerCache,
): AdaptiveModelRouter {
  const router = new AdaptiveModelRouter(options);
  if (obsStorage) {
    (router as any).observabilityStorage = obsStorage;
  }
  if (cache) {
    (router as any).cache = cache;
  }
  return router;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdaptiveModelRouter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Constructor validation
  // =========================================================================

  describe('constructor', () => {
    it('throws if no rules provided', () => {
      expect(() => new AdaptiveModelRouter({ rules: [] })).toThrow('at least one rule');
    });

    it('throws if error-rate threshold is out of range', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            rules: [{ signal: 'error-rate', threshold: 0, fallbackModels: ['openai/gpt-4o-mini'] }],
          }),
      ).toThrow('threshold must be between');

      expect(
        () =>
          new AdaptiveModelRouter({
            rules: [{ signal: 'error-rate', threshold: 1.5, fallbackModels: ['openai/gpt-4o-mini'] }],
          }),
      ).toThrow('threshold must be between');
    });

    it('throws if error-rate rule has no fallback models', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: [] }],
          }),
      ).toThrow('at least one fallback model');
    });

    it('throws if score rule has no scorerId', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            rules: [{ signal: 'score', scorerId: '', minScore: 0.7, fallbackModels: ['openai/gpt-4o'] }],
          }),
      ).toThrow('scorerId');
    });

    it('throws if score rule has no fallback models', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            rules: [{ signal: 'score', scorerId: 'relevance', minScore: 0.7, fallbackModels: [] }],
          }),
      ).toThrow('at least one fallback model');
    });

    it('throws if feedback rule has fewer than 2 models', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            rules: [{ signal: 'feedback', feedbackType: 'thumbs', models: ['openai/gpt-4o'] }],
          }),
      ).toThrow('at least two models');
    });

    it('accepts valid configuration', () => {
      const router = new AdaptiveModelRouter({
        rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
      });
      expect(router.id).toBe('adaptive-model-router');
      expect(router.name).toBe('Adaptive Model Router');
    });

    it('defaults scope to resource', () => {
      const router = new AdaptiveModelRouter({
        rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
      });
      expect((router as any).scope).toBe('resource');
    });

    it('defaults window to 24h', () => {
      const router = new AdaptiveModelRouter({
        rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
      });
      expect((router as any).defaultWindow).toBe('24h');
    });
  });

  // =========================================================================
  // __registerMastra
  // =========================================================================

  describe('__registerMastra', () => {
    it('resolves observability storage and cache', () => {
      const obsStorage = createMockObservabilityStorage();
      const mockCache = createMockCache();
      const mockMastra = {
        getStorage: () => ({ stores: { observability: obsStorage } }),
        getServerCache: () => mockCache,
      } as any;

      const router = new AdaptiveModelRouter({
        rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
      });
      router.__registerMastra(mockMastra);

      expect((router as any).observabilityStorage).toBe(obsStorage);
      expect((router as any).cache).toBe(mockCache);
    });

    it('throws when observability storage is not available', () => {
      const mockMastra = {
        getStorage: () => ({ stores: {} }),
        getServerCache: () => createMockCache(),
      } as any;

      const router = new AdaptiveModelRouter({
        rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
      });
      expect(() => router.__registerMastra(mockMastra)).toThrow('observability storage');
    });

    it('falls back to InMemoryServerCache when getServerCache throws', () => {
      const obsStorage = createMockObservabilityStorage();
      const mockMastra = {
        getStorage: () => ({ stores: { observability: obsStorage } }),
        getServerCache: () => {
          throw new Error('no cache configured');
        },
      } as any;

      const router = new AdaptiveModelRouter({
        rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
      });
      router.__registerMastra(mockMastra);

      expect((router as any).cache).toBeDefined();
      expect((router as any).cache.constructor.name).toBe('InMemoryServerCache');
    });
  });

  // =========================================================================
  // Scope resolution
  // =========================================================================

  describe('scope resolution', () => {
    it('returns undefined when no scope context is available (resource scope, no resourceId)', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        { rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }] },
        obsStorage,
        createMockCache(),
      );

      const args = createInputStepArgs({ stepNumber: 1 });
      const result = await router.processInputStep(args);
      expect(result).toBeUndefined();
      expect(obsStorage.getMetricBreakdown).not.toHaveBeenCalled();
    });

    it('uses resourceId for resource scope', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-123');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      await router.processInputStep(args);

      expect(obsStorage.getMetricBreakdown).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ resourceId: 'user-123' }),
        }),
      );
    });

    it('uses threadId for thread scope', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'thread',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-abc');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      await router.processInputStep(args);

      expect(obsStorage.getMetricBreakdown).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ threadId: 'thread-abc' }),
        }),
      );
    });

    it('uses traceId for run scope', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'run',
        },
        obsStorage,
        createMockCache(),
      );

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-123') as any,
      });
      await router.processInputStep(args);

      expect(obsStorage.getMetricBreakdown).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ traceId: 'trace-123' }),
        }),
      );
    });

    it('returns undefined for run scope without tracing context', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'run',
        },
        obsStorage,
        createMockCache(),
      );

      const args = createInputStepArgs({ stepNumber: 1 });
      const result = await router.processInputStep(args);
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // Error-rate rule
  // =========================================================================

  describe('error-rate rule', () => {
    function createErrorRateRouter(
      overrides: Partial<ErrorRateRule> = {},
      obsStorage?: ObservabilityStorage,
      cache?: MastraServerCache,
    ) {
      const rule: ErrorRateRule = {
        signal: 'error-rate',
        threshold: 0.3,
        fallbackModels: ['openai/gpt-4o-mini'],
        ...overrides,
      };
      return createRouter({ rules: [rule], scope: 'resource' }, obsStorage, cache);
    }

    it('does not switch when error rate is below threshold', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 9 },
            { dimensions: { 'labels.status': 'error' }, value: 1 },
          ],
        }),
      });

      const router = createErrorRateRouter({ threshold: 0.3 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // 1/10 = 10% < 30% threshold
      expect(result).toBeUndefined();
    });

    it('switches model when error rate exceeds threshold', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 6 },
            { dimensions: { 'labels.status': 'error' }, value: 4 },
          ],
        }),
      });

      const router = createErrorRateRouter(
        { threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // 4/10 = 40% > 30% threshold
      expect(result).toBeDefined();
      expect(result?.model).toBe('openai/gpt-4o-mini');
    });

    it('does not switch when total requests are below minRequests', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 1 },
            { dimensions: { 'labels.status': 'error' }, value: 2 },
          ],
        }),
      });

      const router = createErrorRateRouter({ threshold: 0.3, minRequests: 10 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Only 3 total requests < 10 minRequests
      expect(result).toBeUndefined();
    });

    it('opens circuit and uses cached cooldown on subsequent requests', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const cache = createMockCache();
      const router = createErrorRateRouter(
        { threshold: 0.3, cooldown: '2m', fallbackModels: ['openai/gpt-4o-mini'] },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      // First call — error rate 70% exceeds threshold, opens circuit
      const args1 = createInputStepArgs({ stepNumber: 1, requestContext });
      const result1 = await router.processInputStep(args1);
      expect(result1?.model).toBe('openai/gpt-4o-mini');
      expect(cache.set).toHaveBeenCalled();

      // Second call — circuit is open, should still route to fallback without re-querying breakdown
      const mockBreakdown = obsStorage.getMetricBreakdown as ReturnType<typeof vi.fn>;
      mockBreakdown.mockClear();

      const args2 = createInputStepArgs({ stepNumber: 2, requestContext });
      const result2 = await router.processInputStep(args2);
      expect(result2?.model).toBe('openai/gpt-4o-mini');
    });

    it('applies time window filter for non-run scopes', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createErrorRateRouter({ window: '5m' }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const before = Date.now();
      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      await router.processInputStep(args);

      const call = (obsStorage.getMetricBreakdown as any).mock.calls[0][0];
      expect(call.filters.timestamp).toBeDefined();
      const windowStart = call.filters.timestamp.start.getTime();
      const expectedStart = before - 5 * 60 * 1000;
      expect(Math.abs(windowStart - expectedStart)).toBeLessThan(1000);
    });

    it('does not apply time window filter for run scope', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'], window: '5m' }],
          scope: 'run',
        },
        obsStorage,
        createMockCache(),
      );

      const args = createInputStepArgs({
        stepNumber: 1,
        tracing: createMockTracing('trace-1') as any,
      });
      await router.processInputStep(args);

      const call = (obsStorage.getMetricBreakdown as any).mock.calls[0][0];
      expect(call.filters.timestamp).toBeUndefined();
    });

    it('handles observability storage errors gracefully', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      });

      const router = createErrorRateRouter({}, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Should not throw, should return undefined (keep current model)
      expect(result).toBeUndefined();
    });

    it('also counts "failed" status as errors', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 5 },
            { dimensions: { 'labels.status': 'failed' }, value: 5 },
          ],
        }),
      });

      const router = createErrorRateRouter(
        { threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // 5/10 = 50% > 30%
      expect(result?.model).toBe('openai/gpt-4o-mini');
    });
  });

  // =========================================================================
  // Score rule
  // =========================================================================

  describe('score rule', () => {
    function createScoreRouter(
      overrides: Partial<ScoreRule> = {},
      obsStorage?: ObservabilityStorage,
      cache?: MastraServerCache,
    ) {
      const rule: ScoreRule = {
        signal: 'score',
        scorerId: 'relevance',
        minScore: 0.7,
        fallbackModels: ['openai/gpt-4o'],
        ...overrides,
      };
      return createRouter({ rules: [rule], scope: 'resource' }, obsStorage, cache);
    }

    it('does not switch when score is above minimum', async () => {
      const obsStorage = createMockObservabilityStorage({
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.85 }),
      });

      const router = createScoreRouter({ minScore: 0.7 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result).toBeUndefined();
    });

    it('switches model when score drops below minimum', async () => {
      const obsStorage = createMockObservabilityStorage({
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.55 }),
      });

      const router = createScoreRouter(
        { minScore: 0.7, fallbackModels: ['openai/gpt-4o'] },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result).toBeDefined();
      expect(result?.model).toBe('openai/gpt-4o');
    });

    it('does not switch when score is null (no data)', async () => {
      const obsStorage = createMockObservabilityStorage({
        getScoreAggregate: vi.fn().mockResolvedValue({ value: null }),
      });

      const router = createScoreRouter({}, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result).toBeUndefined();
    });

    it('queries with correct scorerId and aggregation', async () => {
      const obsStorage = createMockObservabilityStorage({
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.9 }),
      });

      const router = createScoreRouter({ scorerId: 'accuracy', aggregation: 'min' }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      await router.processInputStep(args);

      expect(obsStorage.getScoreAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'accuracy',
          aggregation: 'min',
        }),
      );
    });

    it('opens cooldown and uses cached state on subsequent requests', async () => {
      const obsStorage = createMockObservabilityStorage({
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.4 }),
      });

      const cache = createMockCache();
      const router = createScoreRouter(
        { minScore: 0.7, cooldown: '5m', fallbackModels: ['openai/gpt-4o'] },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      // First call — score below threshold
      const args1 = createInputStepArgs({ stepNumber: 1, requestContext });
      const result1 = await router.processInputStep(args1);
      expect(result1?.model).toBe('openai/gpt-4o');
      expect(cache.set).toHaveBeenCalled();

      // Second call — should still route to fallback (cooldown active)
      const args2 = createInputStepArgs({ stepNumber: 2, requestContext });
      const result2 = await router.processInputStep(args2);
      expect(result2?.model).toBe('openai/gpt-4o');
    });

    it('handles storage errors gracefully', async () => {
      const obsStorage = createMockObservabilityStorage({
        getScoreAggregate: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      });

      const router = createScoreRouter({}, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // Feedback rule
  // =========================================================================

  describe('feedback rule', () => {
    function createFeedbackRouter(
      overrides: Partial<FeedbackRule> = {},
      obsStorage?: ObservabilityStorage,
      cache?: MastraServerCache,
    ) {
      const rule: FeedbackRule = {
        signal: 'feedback',
        feedbackType: 'thumbs',
        models: ['openai/gpt-4o', 'anthropic/claude-3-sonnet'],
        ...overrides,
      };
      return createRouter({ rules: [rule], scope: 'resource' }, obsStorage, cache);
    }

    it('selects the best-rated model when feedback data is available', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { entityName: 'openai/gpt-4o' }, value: 0.6 },
            { dimensions: { entityName: 'anthropic/claude-3-sonnet' }, value: 0.85 },
            // Enough groups to pass minSamples
            ...Array.from({ length: 10 }, (_, i) => ({
              dimensions: { entityName: i % 2 === 0 ? 'openai/gpt-4o' : 'anthropic/claude-3-sonnet' },
              value: i % 2 === 0 ? 0.6 : 0.85,
            })),
          ],
        }),
      });

      const router = createFeedbackRouter(
        { minSamples: 2, models: ['openai/gpt-4o', 'anthropic/claude-3-sonnet'] },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // anthropic/claude-3-sonnet has higher score, and current model is openai/gpt-4o
      expect(result).toBeDefined();
      expect(result?.model).toBe('anthropic/claude-3-sonnet');
    });

    it('does not switch when current model is already the best-rated', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { entityName: 'openai/gpt-4o' }, value: 0.9 },
            { dimensions: { entityName: 'anthropic/claude-3-sonnet' }, value: 0.6 },
          ],
        }),
      });

      const router = createFeedbackRouter(
        {
          minSamples: 1,
          models: ['openai/gpt-4o', 'anthropic/claude-3-sonnet'],
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      // Current model is openai/gpt-4o which is already the best-rated
      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: { modelId: 'gpt-4o', provider: 'openai', specificationVersion: 'v2' } as any,
      });
      const result = await router.processInputStep(args);

      expect(result).toBeUndefined();
    });

    it('does not switch when not enough feedback samples', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({
          groups: [{ dimensions: { entityName: 'openai/gpt-4o' }, value: 0.9 }],
        }),
      });

      const router = createFeedbackRouter(
        { minSamples: 10, models: ['openai/gpt-4o', 'anthropic/claude-3-sonnet'] },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Only 1 sample < 10 minSamples
      expect(result).toBeUndefined();
    });

    it('does not switch when no feedback groups returned', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({ groups: [] }),
      });

      const router = createFeedbackRouter({}, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);
      expect(result).toBeUndefined();
    });

    it('handles storage errors gracefully', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      });

      const router = createFeedbackRouter({}, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // Chained fallbacks
  // =========================================================================

  describe('chained fallbacks', () => {
    it('tries second fallback when first fallback is also in cooldown', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 2 },
            { dimensions: { 'labels.status': 'error' }, value: 8 },
          ],
        }),
      });

      const cache = createMockCache();
      const router = createRouter(
        {
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              cooldown: '2m',
              fallbackModels: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-chain');

      // Put first fallback in cooldown manually
      const cooldownKey = 'adaptive-router:circuit-breaker:openai/gpt-4o-mini:resource:user-chain';
      await cache.set(cooldownKey, Date.now());

      const args = createInputStepArgs({ stepNumber: 1, requestContext });

      // First, open the circuit for the primary model
      const primaryKey = 'adaptive-router:circuit-breaker:openai/gpt-4o:resource:user-chain';
      await cache.set(primaryKey, Date.now());

      const result = await router.processInputStep(args);

      // Should skip openai/gpt-4o-mini (in cooldown) and use anthropic/claude-3-haiku
      expect(result).toBeDefined();
      expect(result?.model).toBe('anthropic/claude-3-haiku');
    });

    it('stays with current model when all fallbacks are in cooldown', async () => {
      const cache = createMockCache();
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 2 },
            { dimensions: { 'labels.status': 'error' }, value: 8 },
          ],
        }),
      });

      const router = createRouter(
        {
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              cooldown: '2m',
              fallbackModels: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-all-down');

      // Put all fallbacks in cooldown
      await cache.set('adaptive-router:circuit-breaker:openai/gpt-4o-mini:resource:user-all-down', Date.now());
      await cache.set('adaptive-router:circuit-breaker:anthropic/claude-3-haiku:resource:user-all-down', Date.now());

      // Also put primary in cooldown to trigger the cooldown path
      await cache.set('adaptive-router:circuit-breaker:openai/gpt-4o:resource:user-all-down', Date.now());

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // All fallbacks in cooldown → stay with current model
      expect(result).toBeUndefined();
    });

    it('selects first available fallback in order', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 1 },
            { dimensions: { 'labels.status': 'error' }, value: 9 },
          ],
        }),
      });

      const cache = createMockCache();
      const router = createRouter(
        {
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              cooldown: '2m',
              fallbackModels: ['fallback-a', 'fallback-b', 'fallback-c'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-order');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Should select first available fallback
      expect(result?.model).toBe('fallback-a');
    });
  });

  // =========================================================================
  // Rule priority
  // =========================================================================

  describe('rule priority', () => {
    it('first matching rule wins', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.4 }),
      });

      const router = createRouter(
        {
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              fallbackModels: ['error-fallback'],
            },
            {
              signal: 'score',
              scorerId: 'relevance',
              minScore: 0.7,
              fallbackModels: ['score-fallback'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-priority');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Both rules would fire, but error-rate is first → wins
      expect(result?.model).toBe('error-fallback');
      // Score rule should not have been called
      expect(obsStorage.getScoreAggregate).not.toHaveBeenCalled();
    });

    it('falls through to second rule when first does not fire', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 9 },
            { dimensions: { 'labels.status': 'error' }, value: 1 },
          ],
        }),
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.4 }),
      });

      const router = createRouter(
        {
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              fallbackModels: ['error-fallback'],
            },
            {
              signal: 'score',
              scorerId: 'relevance',
              minScore: 0.7,
              fallbackModels: ['score-fallback'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-fallthrough');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Error rate 10% < 30%, so it falls through to score rule
      // Score 0.4 < 0.7, so score rule fires
      expect(result?.model).toBe('score-fallback');
    });

    it('returns undefined when no rules fire', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [{ dimensions: { 'labels.status': 'ok' }, value: 10 }],
        }),
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.9 }),
      });

      const router = createRouter(
        {
          rules: [
            { signal: 'error-rate', threshold: 0.3, fallbackModels: ['error-fallback'] },
            { signal: 'score', scorerId: 'relevance', minScore: 0.7, fallbackModels: ['score-fallback'] },
          ],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-none');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // onViolation callback
  // =========================================================================

  describe('onViolation callback', () => {
    it('calls onViolation when a model switch occurs', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const onViolation = vi.fn();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );
      router.onViolation = onViolation;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      await router.processInputStep(args);

      expect(onViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          processorId: 'adaptive-model-router',
          message: expect.stringContaining('Switching from'),
          detail: expect.objectContaining({
            rule: 'error-rate',
            originalModel: expect.any(String),
            selectedModel: 'openai/gpt-4o-mini',
          }),
        }),
      );
    });

    it('does not throw when onViolation callback throws', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );
      router.onViolation = () => {
        throw new Error('callback error');
      };

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Should still return the fallback despite the callback error
      expect(result?.model).toBe('openai/gpt-4o-mini');
    });
  });

  // =========================================================================
  // Cache failure resilience
  // =========================================================================

  describe('cache failure resilience', () => {
    it('continues working when cache.get throws', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const cache = createMockCache();
      (cache.get as any).mockRejectedValue(new Error('cache unavailable'));

      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Should still evaluate the rule and switch models
      expect(result?.model).toBe('openai/gpt-4o-mini');
    });

    it('continues working when cache.set throws', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const cache = createMockCache();
      (cache.set as any).mockRejectedValue(new Error('cache unavailable'));

      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // Should still route to fallback
      expect(result?.model).toBe('openai/gpt-4o-mini');
    });

    it('works without cache (no cache configured)', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        // No cache
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result?.model).toBe('openai/gpt-4o-mini');
    });
  });

  // =========================================================================
  // Model ID resolution
  // =========================================================================

  describe('model ID resolution', () => {
    it('resolves model ID from string', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'openai/gpt-4o' as any,
      });
      await router.processInputStep(args);

      // Should resolve the string model ID correctly
      expect(obsStorage.getMetricBreakdown).toHaveBeenCalled();
    });

    it('resolves model ID from MastraLanguageModel object', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: { modelId: 'gpt-4o', provider: 'openai', specificationVersion: 'v2' } as any,
      });
      await router.processInputStep(args);

      expect(obsStorage.getMetricBreakdown).toHaveBeenCalled();
    });

    it('resolves model ID from OpenAICompatibleConfig', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter(
        {
          rules: [{ signal: 'error-rate', threshold: 0.3, fallbackModels: ['openai/gpt-4o-mini'] }],
          scope: 'resource',
        },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: { providerId: 'openai', modelId: 'gpt-4o' } as any,
      });
      await router.processInputStep(args);

      expect(obsStorage.getMetricBreakdown).toHaveBeenCalled();
    });
  });
});

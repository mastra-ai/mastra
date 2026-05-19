import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { MastraServerCache } from '../../cache';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { ProcessInputStepArgs, ProcessAPIErrorArgs, ProcessOutputStepArgs } from '../index';
import { AdaptiveModelRouter } from './adaptive-model-router';
import type {
  AdaptiveModelRouterOptions,
  AdaptiveModelRouterTripwireMetadata,
  AdaptiveModelRouterModel,
  ErrorRateRule,
  ScoreRule,
  FeedbackRule,
} from './adaptive-model-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Two-model default used by most tests. */
const DEFAULT_MODELS: AdaptiveModelRouterModel[] = [
  { id: 'openai/gpt-5', model: 'openai/gpt-5' },
  { id: 'openai/gpt-5-mini', model: 'openai/gpt-5-mini' },
];

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
    model: { modelId: 'gpt-5', provider: 'openai', specificationVersion: 'v2' } as any,
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

function createAPIErrorArgs(
  overrides: Partial<ProcessAPIErrorArgs<AdaptiveModelRouterTripwireMetadata>> = {},
): ProcessAPIErrorArgs<AdaptiveModelRouterTripwireMetadata> {
  return {
    steps: [],
    stepNumber: 0,
    messages: [],
    messageList: {} as MessageList,
    abort: ((reason?: string, options?: any) => {
      throw new TripWire(reason ?? 'abort', options ?? {});
    }) as any,
    retryCount: 0,
    error: new Error('API error'),
    state: {},
    ...overrides,
  };
}

function createOutputStepArgs(
  overrides: Partial<ProcessOutputStepArgs<AdaptiveModelRouterTripwireMetadata>> = {},
): ProcessOutputStepArgs<AdaptiveModelRouterTripwireMetadata> {
  return {
    steps: [],
    stepNumber: 0,
    messages: [
      {
        id: 'msg-1',
        role: 'assistant' as const,
        content: { format: 2, parts: [{ type: 'text' as const, text: 'hello' }] },
        createdAt: new Date(),
      },
    ],
    messageList: {} as MessageList,
    abort: ((reason?: string, options?: any) => {
      throw new TripWire(reason ?? 'abort', options ?? {});
    }) as any,
    retryCount: 0,
    finishReason: 'stop',
    text: 'hello',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    systemMessages: [],
    state: {},
    ...overrides,
  };
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
    it('throws if fewer than 2 models provided', () => {
      expect(() => new AdaptiveModelRouter({ models: [] })).toThrow('at least 2 models');
      expect(() => new AdaptiveModelRouter({ models: [{ id: 'a', model: 'openai/gpt-5' }] })).toThrow(
        'at least 2 models',
      );
    });

    it('throws if error-rate threshold is out of range', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            models: DEFAULT_MODELS,
            rules: [{ signal: 'error-rate', threshold: 0 }],
          }),
      ).toThrow('threshold must be between');

      expect(
        () =>
          new AdaptiveModelRouter({
            models: DEFAULT_MODELS,
            rules: [{ signal: 'error-rate', threshold: 1.5 }],
          }),
      ).toThrow('threshold must be between');
    });

    it('throws if score rule has no scorerId', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            models: DEFAULT_MODELS,
            rules: [{ signal: 'score', scorerId: '', minScore: 0.7 }],
          }),
      ).toThrow('scorerId');
    });

    it('throws if feedback rule has no feedbackType', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            models: DEFAULT_MODELS,
            rules: [{ signal: 'feedback', feedbackType: '' }],
          }),
      ).toThrow('feedbackType');
    });

    it('accepts valid configuration with explicit rules', () => {
      const router = new AdaptiveModelRouter({
        models: DEFAULT_MODELS,
        rules: [{ signal: 'error-rate', threshold: 0.3 }],
      });
      expect(router.id).toBe('adaptive-model-router');
      expect(router.name).toBe('Adaptive Model Router');
    });

    it('auto-generates default error-rate rule when rules are omitted', () => {
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      expect((router as any).rules).toHaveLength(1);
      expect((router as any).rules[0].signal).toBe('error-rate');
      expect((router as any).rules[0].threshold).toBe(0.3);
    });

    it('uses custom errorRateThreshold / minRequests for default rule', () => {
      const router = new AdaptiveModelRouter({
        models: DEFAULT_MODELS,
        errorRateThreshold: 0.5,
        minRequests: 20,
      });
      expect((router as any).rules[0].threshold).toBe(0.5);
      expect((router as any).rules[0].minRequests).toBe(20);
    });

    it('defaults scope to resource', () => {
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      expect((router as any).scope).toBe('resource');
    });

    it('defaults window to 24h', () => {
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      expect((router as any).defaultWindow).toBe('24h');
    });

    it('stores modelIds derived from models array', () => {
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      expect((router as any).modelIds).toEqual(['openai/gpt-5', 'openai/gpt-5-mini']);
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

      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      router.__registerMastra(mockMastra);

      expect((router as any).observabilityStorage).toBe(obsStorage);
      expect((router as any).cache).toBe(mockCache);
    });

    it('throws when observability storage is not available', () => {
      const mockMastra = {
        getStorage: () => ({ stores: {} }),
        getServerCache: () => createMockCache(),
      } as any;

      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
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

      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
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
      const router = createRouter({ models: DEFAULT_MODELS }, obsStorage, createMockCache());

      const args = createInputStepArgs({ stepNumber: 1 });
      const result = await router.processInputStep(args);
      expect(result).toBeUndefined();
      expect(obsStorage.getMetricBreakdown).not.toHaveBeenCalled();
    });

    it('uses resourceId for resource scope', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter({ models: DEFAULT_MODELS, scope: 'resource' }, obsStorage, createMockCache());

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
      const router = createRouter({ models: DEFAULT_MODELS, scope: 'thread' }, obsStorage, createMockCache());

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
      const router = createRouter({ models: DEFAULT_MODELS, scope: 'run' }, obsStorage, createMockCache());

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
      const router = createRouter({ models: DEFAULT_MODELS, scope: 'run' }, obsStorage, createMockCache());

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
        ...overrides,
      };
      return createRouter({ models: DEFAULT_MODELS, rules: [rule], scope: 'resource' }, obsStorage, cache);
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

      const router = createErrorRateRouter({ threshold: 0.3 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // 4/10 = 40% > 30% threshold
      expect(result).toBeDefined();
      expect(result?.model).toBe('openai/gpt-5-mini');
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
      const router = createErrorRateRouter({ threshold: 0.3, cooldown: '2m' }, obsStorage, cache);

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      // First call — error rate 70% exceeds threshold, opens circuit
      const args1 = createInputStepArgs({ stepNumber: 1, requestContext });
      const result1 = await router.processInputStep(args1);
      expect(result1?.model).toBe('openai/gpt-5-mini');
      expect(cache.set).toHaveBeenCalled();

      // Second call — circuit is open, should still route to fallback without re-querying breakdown
      const mockBreakdown = obsStorage.getMetricBreakdown as ReturnType<typeof vi.fn>;
      mockBreakdown.mockClear();

      const args2 = createInputStepArgs({ stepNumber: 2, requestContext });
      const result2 = await router.processInputStep(args2);
      expect(result2?.model).toBe('openai/gpt-5-mini');
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
          models: DEFAULT_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3, window: '5m' }],
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

      const router = createErrorRateRouter({ threshold: 0.3 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // 5/10 = 50% > 30%
      expect(result?.model).toBe('openai/gpt-5-mini');
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
        ...overrides,
      };
      return createRouter({ models: DEFAULT_MODELS, rules: [rule], scope: 'resource' }, obsStorage, cache);
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

      const router = createScoreRouter({ minScore: 0.7 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result).toBeDefined();
      expect(result?.model).toBe('openai/gpt-5-mini');
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
      const router = createScoreRouter({ minScore: 0.7, cooldown: '5m' }, obsStorage, cache);

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      // First call — score below threshold
      const args1 = createInputStepArgs({ stepNumber: 1, requestContext });
      const result1 = await router.processInputStep(args1);
      expect(result1?.model).toBe('openai/gpt-5-mini');
      expect(cache.set).toHaveBeenCalled();

      // Second call — should still route to fallback (cooldown active)
      const args2 = createInputStepArgs({ stepNumber: 2, requestContext });
      const result2 = await router.processInputStep(args2);
      expect(result2?.model).toBe('openai/gpt-5-mini');
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
    const FEEDBACK_MODELS: AdaptiveModelRouterModel[] = [
      { id: 'openai/gpt-5', model: 'openai/gpt-5' },
      { id: 'anthropic/claude-3-sonnet', model: 'anthropic/claude-3-sonnet' },
    ];

    function createFeedbackRouter(
      overrides: Partial<FeedbackRule> = {},
      obsStorage?: ObservabilityStorage,
      cache?: MastraServerCache,
    ) {
      const rule: FeedbackRule = {
        signal: 'feedback',
        feedbackType: 'thumbs',
        ...overrides,
      };
      return createRouter({ models: FEEDBACK_MODELS, rules: [rule], scope: 'resource' }, obsStorage, cache);
    }

    it('selects the best-rated model when feedback data is available', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { entityName: 'openai/gpt-5' }, value: 0.6 },
            { dimensions: { entityName: 'anthropic/claude-3-sonnet' }, value: 0.85 },
            // Enough groups to pass minSamples
            ...Array.from({ length: 10 }, (_, i) => ({
              dimensions: { entityName: i % 2 === 0 ? 'openai/gpt-5' : 'anthropic/claude-3-sonnet' },
              value: i % 2 === 0 ? 0.6 : 0.85,
            })),
          ],
        }),
      });

      const router = createFeedbackRouter({ minSamples: 2 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // anthropic/claude-3-sonnet has higher score, and current model is openai/gpt-5
      expect(result).toBeDefined();
      expect(result?.model).toBe('anthropic/claude-3-sonnet');
    });

    it('does not switch when current model is already the best-rated', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { entityName: 'openai/gpt-5' }, value: 0.9 },
            { dimensions: { entityName: 'anthropic/claude-3-sonnet' }, value: 0.6 },
          ],
        }),
      });

      const router = createFeedbackRouter({ minSamples: 1 }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      // Current model is openai/gpt-5 which is already the best-rated
      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: { modelId: 'gpt-5', provider: 'openai', specificationVersion: 'v2' } as any,
      });
      const result = await router.processInputStep(args);

      expect(result).toBeUndefined();
    });

    it('does not switch when not enough feedback samples', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({
          groups: [{ dimensions: { entityName: 'openai/gpt-5' }, value: 0.9 }],
        }),
      });

      const router = createFeedbackRouter({ minSamples: 10 }, obsStorage, createMockCache());

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
    const THREE_MODELS: AdaptiveModelRouterModel[] = [
      { id: 'openai/gpt-5', model: 'openai/gpt-5' },
      { id: 'openai/gpt-5-mini', model: 'openai/gpt-5-mini' },
      { id: 'anthropic/claude-3-haiku', model: 'anthropic/claude-3-haiku' },
    ];

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
          models: THREE_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3, cooldown: '2m' }],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-chain');

      // Put first fallback in cooldown manually
      const cooldownKey = 'adaptive-router:circuit-breaker:openai/gpt-5-mini:resource:user-chain';
      await cache.set(cooldownKey, Date.now());

      const args = createInputStepArgs({ stepNumber: 1, requestContext });

      // First, open the circuit for the primary model
      const primaryKey = 'adaptive-router:circuit-breaker:openai/gpt-5:resource:user-chain';
      await cache.set(primaryKey, Date.now());

      const result = await router.processInputStep(args);

      // Should skip openai/gpt-5-mini (in cooldown) and use anthropic/claude-3-haiku
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
          models: THREE_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3, cooldown: '2m' }],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-all-down');

      // Put all fallbacks in cooldown
      await cache.set('adaptive-router:circuit-breaker:openai/gpt-5-mini:resource:user-all-down', Date.now());
      await cache.set('adaptive-router:circuit-breaker:anthropic/claude-3-haiku:resource:user-all-down', Date.now());

      // Also put primary in cooldown to trigger the cooldown path
      await cache.set('adaptive-router:circuit-breaker:openai/gpt-5:resource:user-all-down', Date.now());

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      // All models in cooldown — should return undefined (keep current model)
      expect(result).toBeUndefined();
    });

    it('respects fallback order (selects first available)', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 2 },
            { dimensions: { 'labels.status': 'error' }, value: 8 },
          ],
        }),
      });

      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'primary', model: 'primary' },
        { id: 'fallback-a', model: 'fallback-a' },
        { id: 'fallback-b', model: 'fallback-b' },
        { id: 'fallback-c', model: 'fallback-c' },
      ];
      const router = createRouter(
        {
          models,
          rules: [{ signal: 'error-rate', threshold: 0.3, cooldown: '2m' }],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-order');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'primary' as any,
      });
      const result = await router.processInputStep(args);

      // Should select first available fallback
      expect(result?.model).toBe('fallback-a');
    });
  });

  // =========================================================================
  // Per-rule fallbackOrder
  // =========================================================================

  describe('per-rule fallbackOrder', () => {
    const FOUR_MODELS: AdaptiveModelRouterModel[] = [
      { id: 'gpt-5', model: 'gpt-5' },
      { id: 'gpt-5-mini', model: 'gpt-5-mini' },
      { id: 'claude-sonnet', model: 'claude-sonnet' },
      { id: 'claude-haiku', model: 'claude-haiku' },
    ];

    it('constructor throws when fallbackOrder references an unknown model ID', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            models: DEFAULT_MODELS,
            rules: [{ signal: 'error-rate', threshold: 0.3, fallbackOrder: ['nonexistent-model'] }],
          }),
      ).toThrow("unknown model 'nonexistent-model'");
    });

    it('constructor accepts fallbackOrder with valid model IDs', () => {
      expect(
        () =>
          new AdaptiveModelRouter({
            models: FOUR_MODELS,
            rules: [{ signal: 'error-rate', threshold: 0.3, fallbackOrder: ['claude-sonnet', 'gpt-5-mini'] }],
          }),
      ).not.toThrow();
    });

    it('error-rate rule uses custom fallbackOrder instead of default models order', async () => {
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
          models: FOUR_MODELS,
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              // Prefer claude-sonnet over gpt-5-mini (reverse of default order)
              fallbackOrder: ['claude-sonnet', 'gpt-5-mini'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-order');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'gpt-5' as any,
      });
      const result = await router.processInputStep(args);

      // Should pick claude-sonnet (first in fallbackOrder), NOT gpt-5-mini (second in models array)
      expect(result?.model).toBe('claude-sonnet');
    });

    it('error-rate rule skips cooled-down models in custom fallbackOrder', async () => {
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
          models: FOUR_MODELS,
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              cooldown: '2m',
              fallbackOrder: ['claude-sonnet', 'gpt-5-mini', 'claude-haiku'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      // Put claude-sonnet in cooldown
      await cache.set('adaptive-router:circuit-breaker:claude-sonnet:resource:user-fo', Date.now());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-fo');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'gpt-5' as any,
      });
      const result = await router.processInputStep(args);

      // claude-sonnet is in cooldown → should pick gpt-5-mini (second in fallbackOrder)
      expect(result?.model).toBe('gpt-5-mini');
    });

    it('score rule uses custom fallbackOrder', async () => {
      const obsStorage = createMockObservabilityStorage({
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.4 }),
      });

      const cache = createMockCache();
      const router = createRouter(
        {
          models: FOUR_MODELS,
          rules: [
            {
              signal: 'score',
              scorerId: 'relevance',
              minScore: 0.7,
              // On quality issues → prefer stronger model
              fallbackOrder: ['claude-sonnet', 'claude-haiku'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-score-fo');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'gpt-5' as any,
      });
      const result = await router.processInputStep(args);

      // Score 0.4 < 0.7 → should use claude-sonnet (first in fallbackOrder)
      expect(result?.model).toBe('claude-sonnet');
    });

    it('different rules can specify different fallback orders', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 2 },
            { dimensions: { 'labels.status': 'error' }, value: 8 },
          ],
        }),
        getScoreAggregate: vi.fn().mockResolvedValue({ value: 0.4 }),
      });

      const cache = createMockCache();

      // Error-rate rule fires first (threshold 0.3, error rate is 80%)
      // It should use the error-rate rule's fallbackOrder, not the score rule's
      const router = createRouter(
        {
          models: FOUR_MODELS,
          rules: [
            {
              signal: 'error-rate',
              threshold: 0.3,
              fallbackOrder: ['gpt-5-mini', 'claude-haiku'],
            },
            {
              signal: 'score',
              scorerId: 'relevance',
              minScore: 0.7,
              fallbackOrder: ['claude-sonnet', 'claude-haiku'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-multi-fo');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'gpt-5' as any,
      });
      const result = await router.processInputStep(args);

      // Error-rate rule fires first → should use gpt-5-mini (from error-rate's fallbackOrder)
      expect(result?.model).toBe('gpt-5-mini');
    });

    it('feedback rule with fallbackOrder limits candidate set', async () => {
      const obsStorage = createMockObservabilityStorage({
        getFeedbackBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { entityName: 'gpt-5' }, value: 3.0 },
            { dimensions: { entityName: 'gpt-5-mini' }, value: 4.5 },
            { dimensions: { entityName: 'claude-sonnet' }, value: 5.0 },
            { dimensions: { entityName: 'claude-haiku' }, value: 4.0 },
          ],
        }),
      });

      const cache = createMockCache();
      const router = createRouter(
        {
          models: FOUR_MODELS,
          rules: [
            {
              signal: 'feedback',
              feedbackType: 'rating',
              minSamples: 1,
              // Only consider gpt-5-mini and claude-haiku as candidates
              fallbackOrder: ['gpt-5-mini', 'claude-haiku'],
            },
          ],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-fb-fo');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'gpt-5' as any,
      });
      const result = await router.processInputStep(args);

      // claude-sonnet has highest score (5.0) but is NOT in fallbackOrder
      // Among candidates: gpt-5-mini (4.5) vs claude-haiku (4.0) → gpt-5-mini wins
      expect(result?.model).toBe('gpt-5-mini');
    });

    it('falls back to default models order when fallbackOrder is not specified', async () => {
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
          models: FOUR_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3 }],
          scope: 'resource',
        },
        obsStorage,
        cache,
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-default');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'gpt-5' as any,
      });
      const result = await router.processInputStep(args);

      // No fallbackOrder → uses default models order → gpt-5-mini (index 1)
      expect(result?.model).toBe('gpt-5-mini');
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
          models: DEFAULT_MODELS,
          rules: [
            { signal: 'error-rate', threshold: 0.3 },
            { signal: 'score', scorerId: 'relevance', minScore: 0.7 },
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

      // Both rules would fire, but error-rate is first -> wins
      expect(result?.model).toBe('openai/gpt-5-mini');
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
          models: DEFAULT_MODELS,
          rules: [
            { signal: 'error-rate', threshold: 0.3 },
            { signal: 'score', scorerId: 'relevance', minScore: 0.7 },
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
      expect(result?.model).toBe('openai/gpt-5-mini');
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
          models: DEFAULT_MODELS,
          rules: [
            { signal: 'error-rate', threshold: 0.3 },
            { signal: 'score', scorerId: 'relevance', minScore: 0.7 },
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
          models: DEFAULT_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3 }],
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
            selectedModel: 'openai/gpt-5-mini',
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
          models: DEFAULT_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3 }],
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
      expect(result?.model).toBe('openai/gpt-5-mini');
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
          models: DEFAULT_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3 }],
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
      expect(result?.model).toBe('openai/gpt-5-mini');
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
          models: DEFAULT_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3 }],
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
      expect(result?.model).toBe('openai/gpt-5-mini');
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
          models: DEFAULT_MODELS,
          rules: [{ signal: 'error-rate', threshold: 0.3 }],
          scope: 'resource',
        },
        obsStorage,
        // No cache
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result?.model).toBe('openai/gpt-5-mini');
    });
  });

  // =========================================================================
  // Model ID resolution
  // =========================================================================

  describe('model ID resolution', () => {
    it('resolves model ID from string', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter({ models: DEFAULT_MODELS }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'openai/gpt-5' as any,
      });
      await router.processInputStep(args);

      // Should resolve the string model ID correctly
      expect(obsStorage.getMetricBreakdown).toHaveBeenCalled();
    });

    it('resolves model ID from MastraLanguageModel object', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter({ models: DEFAULT_MODELS }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: { modelId: 'gpt-5', provider: 'openai', specificationVersion: 'v2' } as any,
      });
      await router.processInputStep(args);

      expect(obsStorage.getMetricBreakdown).toHaveBeenCalled();
    });

    it('resolves model ID from OpenAICompatibleConfig', async () => {
      const obsStorage = createMockObservabilityStorage();
      const router = createRouter({ models: DEFAULT_MODELS }, obsStorage, createMockCache());

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: { providerId: 'openai', modelId: 'gpt-5' } as any,
      });
      await router.processInputStep(args);

      expect(obsStorage.getMetricBreakdown).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Per-model settings
  // =========================================================================

  describe('per-model settings', () => {
    it('includes modelSettings in the result when switching models', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const models: AdaptiveModelRouterModel[] = [
        { id: 'openai/gpt-5', model: 'openai/gpt-5' },
        {
          id: 'openai/gpt-5-mini',
          model: 'openai/gpt-5-mini',
          modelSettings: { temperature: 0.5, maxTokens: 1000 },
          providerOptions: { openai: { reasoningEffort: 'low' } },
        },
      ];

      const router = createRouter(
        { models, rules: [{ signal: 'error-rate', threshold: 0.3 }], scope: 'resource' },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result).toBeDefined();
      expect(result?.model).toBe('openai/gpt-5-mini');
      expect(result?.modelSettings).toEqual({ temperature: 0.5, maxTokens: 1000 });
      expect(result?.providerOptions).toEqual({ openai: { reasoningEffort: 'low' } });
    });

    it('does not include modelSettings when fallback has none', async () => {
      const obsStorage = createMockObservabilityStorage({
        getMetricBreakdown: vi.fn().mockResolvedValue({
          groups: [
            { dimensions: { 'labels.status': 'ok' }, value: 3 },
            { dimensions: { 'labels.status': 'error' }, value: 7 },
          ],
        }),
      });

      const router = createRouter(
        { models: DEFAULT_MODELS, rules: [{ signal: 'error-rate', threshold: 0.3 }], scope: 'resource' },
        obsStorage,
        createMockCache(),
      );

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const args = createInputStepArgs({ stepNumber: 1, requestContext });
      const result = await router.processInputStep(args);

      expect(result).toBeDefined();
      expect(result?.model).toBe('openai/gpt-5-mini');
      expect(result?.modelSettings).toBeUndefined();
      expect(result?.providerOptions).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // processAPIError — records failures for future proactive routing
  // -------------------------------------------------------------------------
  describe('processAPIError', () => {
    it('opens circuit on API failure and returns undefined (no retry signal)', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'openai/gpt-5', model: 'openai/gpt-5' },
        { id: 'anthropic/claude-3.5-sonnet', model: 'anthropic/claude-3.5-sonnet' },
        { id: 'openai/gpt-5-mini', model: 'openai/gpt-5-mini' },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      const state: Record<string, unknown> = {
        __adaptiveRouter_currentModelId: 'openai/gpt-5',
        __adaptiveRouter_scopeKey: 'resource:user-1',
      };

      const result = await router.processAPIError(
        createAPIErrorArgs({
          state,
          error: new Error('429 Too Many Requests'),
        }),
      );

      // Does NOT signal retry — executeStreamWithFallbackModels handles that
      expect(result).toBeUndefined();
      // Circuit should be open for the failed model (for future proactive routing)
      expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('openai/gpt-5'), expect.any(Number));
    });

    it('returns undefined when missing state (no prior processInputStep call)', async () => {
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = createMockCache();

      const result = await router.processAPIError(createAPIErrorArgs({ state: {} }));
      expect(result).toBeUndefined();
    });

    it('opens circuit for each model that fails (successive failures)', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'model-a', model: 'model-a' },
        { id: 'model-b', model: 'model-b' },
        { id: 'model-c', model: 'model-c' },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      const state: Record<string, unknown> = {
        __adaptiveRouter_currentModelId: 'model-a',
        __adaptiveRouter_scopeKey: 'resource:user-1',
      };

      // First failure — opens circuit for model-a
      const result1 = await router.processAPIError(createAPIErrorArgs({ state }));
      expect(result1).toBeUndefined();
      expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('model-a'), expect.any(Number));

      // Second failure (now failing on model-b)
      state.__adaptiveRouter_currentModelId = 'model-b';
      const result2 = await router.processAPIError(createAPIErrorArgs({ state }));
      expect(result2).toBeUndefined();
      expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('model-b'), expect.any(Number));

      // Third failure (model-c)
      state.__adaptiveRouter_currentModelId = 'model-c';
      const result3 = await router.processAPIError(createAPIErrorArgs({ state }));
      expect(result3).toBeUndefined();
      expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('model-c'), expect.any(Number));
    });

    it('triggers onViolation callback on API error', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;
      const violations: any[] = [];
      router.onViolation = (v: any) => violations.push(v);

      await router.processAPIError(
        createAPIErrorArgs({
          state: {
            __adaptiveRouter_currentModelId: 'openai/gpt-5',
            __adaptiveRouter_scopeKey: 'resource:user-1',
          },
        }),
      );

      expect(violations).toHaveLength(1);
      expect(violations[0]!.message).toContain('openai/gpt-5');
      expect(violations[0]!.message).toContain('API error');
    });

    it('still records failure even when cache.set fails', async () => {
      const cache = createMockCache();
      (cache.set as any).mockRejectedValue(new Error('Redis unavailable'));
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const violations: any[] = [];
      router.onViolation = (v: any) => violations.push(v);

      const result = await router.processAPIError(
        createAPIErrorArgs({
          state: {
            __adaptiveRouter_currentModelId: 'openai/gpt-5',
            __adaptiveRouter_scopeKey: 'resource:user-1',
          },
        }),
      );

      // Should not throw; returns undefined (no retry signal)
      expect(result).toBeUndefined();
      // Violation still fired even though cache write failed
      expect(violations).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // processOutputStep — soft-failure detection
  // -------------------------------------------------------------------------
  describe('processOutputStep', () => {
    it('returns messages unchanged when state is missing', async () => {
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = createMockCache();

      const args = createOutputStepArgs({ state: {} });
      const result = await router.processOutputStep(args);
      expect(result).toBe(args.messages);
    });

    it('returns messages unchanged on successful response (no soft failure)', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const args = createOutputStepArgs({
        finishReason: 'stop',
        text: 'Some response',
        state: {
          __adaptiveRouter_currentModelId: 'openai/gpt-5',
          __adaptiveRouter_scopeKey: 'resource:user-1',
        },
      });

      const result = await router.processOutputStep(args);
      expect(result).toBe(args.messages);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('opens circuit on error finish reason', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const args = createOutputStepArgs({
        finishReason: 'error',
        text: '',
        state: {
          __adaptiveRouter_currentModelId: 'openai/gpt-5',
          __adaptiveRouter_scopeKey: 'resource:user-1',
        },
      });

      await router.processOutputStep(args);
      expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('openai/gpt-5'), expect.any(Number));
    });

    it('opens circuit on unknown finish reason', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const args = createOutputStepArgs({
        finishReason: 'unknown',
        state: {
          __adaptiveRouter_currentModelId: 'openai/gpt-5',
          __adaptiveRouter_scopeKey: 'resource:user-1',
        },
      });

      await router.processOutputStep(args);
      expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('openai/gpt-5'), expect.any(Number));
    });

    it('opens circuit on empty response (stop with no text and no tool calls)', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const args = createOutputStepArgs({
        finishReason: 'stop',
        text: '',
        toolCalls: [],
        state: {
          __adaptiveRouter_currentModelId: 'openai/gpt-5',
          __adaptiveRouter_scopeKey: 'resource:user-1',
        },
      });

      await router.processOutputStep(args);
      expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('openai/gpt-5'), expect.any(Number));
    });

    it('does NOT open circuit when stop with text', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const args = createOutputStepArgs({
        finishReason: 'stop',
        text: 'valid response',
        state: {
          __adaptiveRouter_currentModelId: 'openai/gpt-5',
          __adaptiveRouter_scopeKey: 'resource:user-1',
        },
      });

      await router.processOutputStep(args);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('does NOT open circuit when stop with tool calls', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const args = createOutputStepArgs({
        finishReason: 'stop',
        text: '',
        toolCalls: [{ toolCallId: 'tc1', toolName: 'search', args: {} }],
        state: {
          __adaptiveRouter_currentModelId: 'openai/gpt-5',
          __adaptiveRouter_scopeKey: 'resource:user-1',
        },
      });

      await router.processOutputStep(args);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('triggers onViolation on soft failure', async () => {
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;
      const violations: any[] = [];
      router.onViolation = (v: any) => violations.push(v);

      await router.processOutputStep(
        createOutputStepArgs({
          finishReason: 'error',
          state: {
            __adaptiveRouter_currentModelId: 'openai/gpt-5',
            __adaptiveRouter_scopeKey: 'resource:user-1',
          },
        }),
      );

      expect(violations).toHaveLength(1);
      expect(violations[0]!.message).toContain('Soft failure');
      expect(violations[0]!.message).toContain('openai/gpt-5');
    });

    it('returns messages unchanged even when cache fails', async () => {
      const cache = createMockCache();
      (cache.set as any).mockRejectedValue(new Error('Redis unavailable'));
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).cache = cache;

      const args = createOutputStepArgs({
        finishReason: 'error',
        state: {
          __adaptiveRouter_currentModelId: 'openai/gpt-5',
          __adaptiveRouter_scopeKey: 'resource:user-1',
        },
      });

      const result = await router.processOutputStep(args);
      expect(result).toBe(args.messages);
    });
  });

  // -------------------------------------------------------------------------
  // processInputStep state tracking
  // -------------------------------------------------------------------------
  describe('processInputStep state tracking', () => {
    it('stores current model ID in state for processAPIError to read', async () => {
      const obsStorage = createMockObservabilityStorage();
      const cache = createMockCache();
      const router = new AdaptiveModelRouter({ models: DEFAULT_MODELS });
      (router as any).observabilityStorage = obsStorage;
      (router as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      const state: Record<string, unknown> = {};
      const args = createInputStepArgs({
        stepNumber: 1,
        requestContext,
        model: 'openai/gpt-5' as any,
        state,
      });

      await router.processInputStep(args);

      expect(state.__adaptiveRouter_currentModelId).toBe('openai/gpt-5');
      expect(state.__adaptiveRouter_scopeKey).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // End-to-end proactive routing after failure recording
  // -------------------------------------------------------------------------
  describe('end-to-end proactive routing after failure recording', () => {
    it('processAPIError records failure, future processInputStep skips failed model', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'model-a', model: 'model-a' },
        { id: 'model-b', model: 'model-b' },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');
      const state: Record<string, unknown> = {};

      // Step 1: processInputStep — no cooldowns, should not switch
      const args1 = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state,
      });
      const result1 = await router.processInputStep(args1);
      expect(result1).toBeUndefined(); // no switch needed
      expect(state.__adaptiveRouter_currentModelId).toBe('model-a');

      // Step 2: API error — opens circuit for model-a (no retry signal)
      const errorResult = await router.processAPIError(
        createAPIErrorArgs({
          state,
          error: new Error('500 Internal Server Error'),
        }),
      );
      expect(errorResult).toBeUndefined();

      // Step 3: On a FUTURE request, processInputStep sees model-a in cooldown
      const state2: Record<string, unknown> = {};
      const args2 = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state: state2,
      });
      const result2 = await router.processInputStep(args2);
      expect(result2).toBeDefined();
      expect(result2!.model).toBe('model-b');
    });

    it('circuit opening works WITHOUT scope context (global cooldown key)', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'model-a', model: 'model-a' },
        { id: 'model-b', model: 'model-b' },
        { id: 'model-c', model: 'model-c' },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      // No resourceId or threadId — scope resolution returns undefined
      const requestContext = new RequestContext();
      const state: Record<string, unknown> = {};

      // Step 1: processInputStep with no scope — should still track state
      const args1 = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state,
      });
      const result1 = await router.processInputStep(args1);
      expect(result1).toBeUndefined(); // no proactive switch (no scope for rules)
      expect(state.__adaptiveRouter_currentModelId).toBe('model-a');
      expect(state.__adaptiveRouter_scopeKey).toBeUndefined();

      // Step 2: API error — opens circuit without scopeKey (global key)
      const errorResult = await router.processAPIError(
        createAPIErrorArgs({
          state,
          error: new Error('500 Internal Server Error'),
        }),
      );
      expect(errorResult).toBeUndefined();

      // Step 3: Future request — model-a in cooldown, should switch
      const state2: Record<string, unknown> = {};
      const args2 = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state: state2,
      });
      const result2 = await router.processInputStep(args2);
      expect(result2).toBeDefined();
      expect(result2!.model).toBe('model-b');
    });

    it('multiple failures put multiple models in cooldown for future requests', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'model-a', model: 'model-a' },
        { id: 'model-b', model: 'model-b' },
        { id: 'model-c', model: 'model-c' },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

      // Record failures for model-a and model-b
      const state1: Record<string, unknown> = {
        __adaptiveRouter_currentModelId: 'model-a',
        __adaptiveRouter_scopeKey: 'resource:user-1',
      };
      await router.processAPIError(createAPIErrorArgs({ state: state1 }));

      const state2: Record<string, unknown> = {
        __adaptiveRouter_currentModelId: 'model-b',
        __adaptiveRouter_scopeKey: 'resource:user-1',
      };
      await router.processAPIError(createAPIErrorArgs({ state: state2 }));

      // Future request: both model-a and model-b in cooldown → routes to model-c
      const state3: Record<string, unknown> = {};
      const args = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state: state3,
      });
      const result = await router.processInputStep(args);
      expect(result).toBeDefined();
      expect(result!.model).toBe('model-c');
    });
  });

  // -------------------------------------------------------------------------
  // buildFallbackResult — headers in modelSettings
  // -------------------------------------------------------------------------
  describe('buildFallbackResult headers', () => {
    it('includes per-model headers in modelSettings when switching models', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'model-a', model: 'model-a', headers: { Authorization: 'Bearer key-a' } },
        {
          id: 'model-b',
          model: 'model-b',
          headers: { Authorization: 'Bearer key-b', 'X-Custom': 'value' },
          modelSettings: { temperature: 0.5 },
        },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');
      const state: Record<string, unknown> = {};

      // Put model-a in cooldown so processInputStep switches to model-b
      await cache.set('adaptive-router:circuit-breaker:model-a:resource:user-1', Date.now());

      const args = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state,
      });
      const result = await router.processInputStep(args);

      expect(result).toBeDefined();
      expect(result!.model).toBe('model-b');
      // Headers should be merged into modelSettings
      expect(result!.modelSettings).toBeDefined();
      expect((result!.modelSettings as any).headers).toEqual({
        Authorization: 'Bearer key-b',
        'X-Custom': 'value',
      });
      // Original modelSettings should be preserved
      expect((result!.modelSettings as any).temperature).toBe(0.5);
    });

    it('includes providerOptions in fallback result', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'model-a', model: 'model-a' },
        {
          id: 'model-b',
          model: 'model-b',
          providerOptions: { openai: { organization: 'org-123' } },
        },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');
      const state: Record<string, unknown> = {};

      await cache.set('adaptive-router:circuit-breaker:model-a:resource:user-1', Date.now());

      const args = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state,
      });
      const result = await router.processInputStep(args);

      expect(result).toBeDefined();
      expect(result!.model).toBe('model-b');
      expect(result!.providerOptions).toEqual({ openai: { organization: 'org-123' } });
    });

    it('does not include modelSettings when model has no settings or headers', async () => {
      const cache = createMockCache();
      const models: AdaptiveModelRouterModel[] = [
        { id: 'model-a', model: 'model-a' },
        { id: 'model-b', model: 'model-b' },
      ];
      const router = new AdaptiveModelRouter({ models });
      (router as any).cache = cache;

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');
      const state: Record<string, unknown> = {};

      await cache.set('adaptive-router:circuit-breaker:model-a:resource:user-1', Date.now());

      const args = createInputStepArgs({
        stepNumber: 0,
        requestContext,
        model: 'model-a' as any,
        state,
      });
      const result = await router.processInputStep(args);

      expect(result).toBeDefined();
      expect(result!.model).toBe('model-b');
      expect(result!.modelSettings).toBeUndefined();
      expect(result!.providerOptions).toBeUndefined();
    });
  });
});

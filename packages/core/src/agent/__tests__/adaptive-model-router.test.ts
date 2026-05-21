import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it, vi } from 'vitest';
import { AdaptiveModelRouter } from '../../processors';

const primary = { specificationVersion: 'v2', provider: 'test', modelId: 'primary' } as any;
const secondary = { specificationVersion: 'v2', provider: 'test', modelId: 'secondary' } as any;
const tertiary = { specificationVersion: 'v2', provider: 'test', modelId: 'tertiary' } as any;

class TestCache {
  entries = new Map<string, unknown>();
  ttls: Array<{ key: string; ttl?: number }> = [];

  async get(key: string) {
    return this.entries.get(key);
  }

  async set(key: string, value: unknown, ttl?: number) {
    this.entries.set(key, value);
    this.ttls.push({ key, ttl });
  }
}

function createRouter(
  options: ConstructorParameters<typeof AdaptiveModelRouter>[0],
  observability: Record<string, any> = {},
  cache = new TestCache(),
) {
  const router = new AdaptiveModelRouter(options);
  router.__registerMastra({
    getStorage: () => ({ getStore: (name: string) => (name === 'observability' ? observability : undefined) }),
    getServerCache: () => cache,
  } as any);
  return { router, cache };
}

function inputArgs(overrides: Record<string, any> = {}) {
  return {
    state: {},
    requestContext: { resourceId: 'agent-1', threadId: 'thread-1', runId: 'run-1' },
    retryCount: 0,
    ...overrides,
  } as any;
}

function retryableError(statusCode = 429) {
  return new APICallError({
    message: 'retry me',
    url: 'https://api.example.com',
    requestBodyValues: {},
    statusCode,
    isRetryable: true,
  });
}

describe('AdaptiveModelRouter', () => {
  it('creates a default error-rate rule when rules are omitted', () => {
    const { router } = createRouter({
      models: [
        { id: 'primary', model: primary },
        { id: 'secondary', model: secondary },
      ],
    });

    expect(router.rules).toEqual([
      expect.objectContaining({ signal: 'error-rate', threshold: 0.3, minRequests: 5, window: '24h', cooldown: '2m' }),
    ]);
  });

  it('switches on error-rate only after minRequests and threshold are met', async () => {
    const getMetricBreakdown = vi.fn().mockResolvedValue([
      { labels: { status: 'success' }, count: 7 },
      { labels: { status: 'error' }, count: 3 },
    ]);
    const { router } = createRouter(
      {
        models: [
          { id: 'primary', model: primary },
          { id: 'secondary', model: secondary, modelSettings: { temperature: 0.9 } },
        ],
        rules: [
          {
            signal: 'error-rate',
            threshold: 0.2,
            minRequests: 10,
            window: '5m',
            fallbackOrder: ['secondary', 'primary'],
          },
        ],
      },
      { getMetricBreakdown },
    );

    const result = await router.processInputStep(inputArgs());

    expect(result?.model).toBe(secondary);
    expect(result?.modelSettings).toEqual({ temperature: 0.9 });
    expect(getMetricBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({
        metricName: 'mastra_model_duration_ms',
        filters: { resourceId: 'agent-1', modelId: 'primary' },
        groupBy: ['status', 'error'],
      }),
    );
  });

  it('does not proactively switch when observability queries are unsupported', async () => {
    const { router } = createRouter({
      models: [
        { id: 'primary', model: primary },
        { id: 'secondary', model: secondary },
      ],
      rules: [{ signal: 'error-rate', threshold: 0, minRequests: 1, fallbackOrder: ['secondary', 'primary'] }],
    });

    const result = await router.processInputStep(inputArgs());

    expect(result?.model).toBe(primary);
  });

  it('switches when score aggregate falls below the configured minimum', async () => {
    const { router } = createRouter(
      {
        models: [
          { id: 'primary', model: primary },
          { id: 'secondary', model: secondary },
        ],
        rules: [
          {
            signal: 'score',
            scorerId: 'quality',
            minScore: 0.8,
            aggregation: 'avg',
            fallbackOrder: ['secondary', 'primary'],
          },
        ],
      },
      { getScoreAggregate: vi.fn().mockResolvedValue({ avg: 0.5, count: 12 }) },
    );

    const result = await router.processInputStep(inputArgs());

    expect(result?.model).toBe(secondary);
  });

  it('selects the best-rated feedback model once minSamples is met', async () => {
    const getFeedbackAggregate = vi
      .fn()
      .mockResolvedValueOnce({ avg: 0.6, count: 12 })
      .mockResolvedValueOnce({ avg: 0.9, count: 12 })
      .mockResolvedValueOnce({ avg: 0.7, count: 12 });
    const { router } = createRouter(
      {
        models: [
          { id: 'primary', model: primary },
          { id: 'secondary', model: secondary },
          { id: 'tertiary', model: tertiary },
        ],
        rules: [
          {
            signal: 'feedback',
            feedbackType: 'thumbs',
            minSamples: 10,
            fallbackOrder: ['primary', 'secondary', 'tertiary'],
          },
        ],
      },
      { getFeedbackAggregate },
    );

    const result = await router.processInputStep(inputArgs());

    expect(result?.model).toBe(secondary);
    expect(getFeedbackAggregate).toHaveBeenCalledTimes(3);
  });

  it('opens cooldown state and retries the next eligible model on retryable API errors', async () => {
    const { router, cache } = createRouter({
      models: [
        { id: 'primary', model: primary },
        { id: 'secondary', model: secondary },
      ],
    });
    const state = {};
    await router.processInputStep(inputArgs({ state }));
    const rotateResponseMessageId = vi.fn();

    const result = await router.processAPIError({ state, error: retryableError(), rotateResponseMessageId } as any);

    expect(result).toEqual({ retry: true });
    expect(rotateResponseMessageId).toHaveBeenCalledOnce();
    expect(cache.ttls.some(entry => entry.key.includes('primary') && entry.ttl === 120_000)).toBe(true);
  });

  it('resolves DynamicArgument modelSettings/providerOptions/headers with requestContext at request time', async () => {
    const modelSettings = vi.fn().mockImplementation(({ requestContext }) => ({
      temperature: requestContext?.tier === 'gold' ? 0.1 : 0.9,
    }));
    const providerOptions = vi.fn().mockResolvedValue({ openai: { reasoning: 'high' } });
    const headers = vi.fn().mockResolvedValue({ 'x-tier': 'gold' });

    const { router } = createRouter({
      models: [
        { id: 'primary', model: primary, modelSettings, providerOptions, headers },
        { id: 'secondary', model: secondary },
      ],
    });

    const result = await router.processInputStep(
      inputArgs({ requestContext: { resourceId: 'agent-1', tier: 'gold' } }),
    );

    expect(modelSettings).toHaveBeenCalledWith(
      expect.objectContaining({ requestContext: expect.objectContaining({ tier: 'gold' }) }),
    );
    expect(providerOptions).toHaveBeenCalledOnce();
    expect(headers).toHaveBeenCalledOnce();
    expect(result).toEqual(
      expect.objectContaining({
        modelSettings: expect.objectContaining({ temperature: 0.1, headers: { 'x-tier': 'gold' } }),
        providerOptions: { openai: { reasoning: 'high' } },
      }),
    );
  });

  it('routes plain stream errors to the next fallback model like legacy model fallbacks', async () => {
    const { router, cache } = createRouter({
      models: [
        { id: 'primary', model: primary },
        { id: 'secondary', model: secondary },
      ],
    });
    const state = {};
    await router.processInputStep(inputArgs({ state }));
    const rotateResponseMessageId = vi.fn();

    const result = await router.processAPIError({
      state,
      error: new Error('plain stream failure'),
      rotateResponseMessageId,
    } as any);

    expect(result).toEqual({ retry: true });
    expect(rotateResponseMessageId).toHaveBeenCalledOnce();
    expect(cache.ttls.some(entry => entry.key.includes('primary') && entry.ttl === 120_000)).toBe(true);
  });
});

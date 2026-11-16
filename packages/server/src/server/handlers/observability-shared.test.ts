import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { QUERY_TRACES, QUERY_SPANS, AGGREGATE_TRACES, AGGREGATE_SPANS } from './observability-new-endpoints';
import { getObservabilityStorageCapabilities, getObservabilityStore, getScoresStore } from './observability-shared';
import { createTestServerContext } from './test-utils';

const createMockMastra = (storage?: Partial<MastraCompositeStore>): Mastra =>
  ({
    getStorage: vi.fn(() => storage as MastraCompositeStore),
  }) as unknown as Mastra;

describe('getObservabilityStore', () => {
  it('returns the observability store when the domain is available', async () => {
    const observabilityStore = { listScores: vi.fn() };
    const mastra = createMockMastra({
      getStore: vi.fn(() => Promise.resolve(observabilityStore)) as unknown as MastraCompositeStore['getStore'],
    });

    await expect(getObservabilityStore(mastra)).resolves.toBe(observabilityStore);
  });

  it('throws 501 when the observability domain is disabled or missing', async () => {
    const mastra = createMockMastra({
      getStore: vi.fn(() => Promise.resolve(undefined)) as unknown as MastraCompositeStore['getStore'],
    });

    const error = await getObservabilityStore(mastra).catch(e => e);
    expect(error).toBeInstanceOf(HTTPException);
    expect(error.status).toBe(501);
    expect(error.message).toBe('Observability storage domain is not available');
  });

  it('throws 500 when no storage is configured at all', async () => {
    const mastra = createMockMastra(undefined);

    const error = await getObservabilityStore(mastra).catch(e => e);
    expect(error).toBeInstanceOf(HTTPException);
    expect(error.status).toBe(500);
  });
});

describe('getScoresStore', () => {
  it('returns the scores store when the domain is available', async () => {
    const scoresStore = { listScoresBySpan: vi.fn() };
    const mastra = createMockMastra({
      getStore: vi.fn(() => Promise.resolve(scoresStore)) as unknown as MastraCompositeStore['getStore'],
    });

    await expect(getScoresStore(mastra)).resolves.toBe(scoresStore);
  });

  it('throws 501 when the scores domain is disabled or missing', async () => {
    const mastra = createMockMastra({
      getStore: vi.fn(() => Promise.resolve(undefined)) as unknown as MastraCompositeStore['getStore'],
    });

    const error = await getScoresStore(mastra).catch(e => e);
    expect(error).toBeInstanceOf(HTTPException);
    expect(error.status).toBe(501);
    expect(error.message).toBe('Scores storage domain is not available');
  });

  it('throws 500 when no storage is configured at all', async () => {
    const mastra = createMockMastra(undefined);

    const error = await getScoresStore(mastra).catch(e => e);
    expect(error).toBeInstanceOf(HTTPException);
    expect(error.status).toBe(500);
  });
});

describe('token search is unavailable in OSS Server', () => {
  it('does not advertise token search even when a store declares support', () => {
    const store = {
      getFeatures: () => [
        'trace-query',
        'span-query',
        'trace-aggregate',
        'span-aggregate',
        'trace-query-token-search',
        'span-query-token-search',
        'trace-aggregate-token-search',
        'span-aggregate-token-search',
      ],
    } as Parameters<typeof getObservabilityStorageCapabilities>[0];
    expect(getObservabilityStorageCapabilities(store)).toMatchObject({
      traceQueryTokenSearch: false,
      spanQueryTokenSearch: false,
      traceAggregateTokenSearch: false,
      spanAggregateTokenSearch: false,
    });
  });
  it.each([
    ['queryTraces', QUERY_TRACES, true, false],
    ['querySpans', QUERY_SPANS, false, false],
    ['aggregateTraces', AGGREGATE_TRACES, true, true],
    ['aggregateSpans', AGGREGATE_SPANS, false, true],
  ] as const)('rejects %s token predicates during planning', async (_, route, trace, aggregate) => {
    const mastra = new Mastra({ storage: new InMemoryStore() });
    const token = { op: 'hasAllTokens' as const, left: { path: 'input' as const }, right: { literal: 'tacos' } };
    const request = {
      timeRange: { from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' },
      where: trace ? { spans: { some: token } } : token,
      ...(aggregate ? { measures: ['count'] } : {}),
    };
    const error = await route
      .handler({ ...createTestServerContext({ mastra }), ...route.bodySchema!.parse(request) } as Parameters<
        typeof route.handler
      >[0])
      .catch(error => error);
    expect(error).toBeInstanceOf(HTTPException);
    expect(error.status).toBe(422);
    await expect(error.getResponse().json()).resolves.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'operator_not_allowed',
          message: 'Token search requires a supporting host',
        }),
      ]),
    });
  });
});

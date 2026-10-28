import type { Mastra } from '@mastra/core/mastra';
import type { MastraCompositeStore, ObservabilityStorage, TrustedTraceQueryPredicate } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  assertObservabilityTraceQueryTimeToFirstChunkSortSupported,
  assertObservabilityTraceQueryTimeToFirstChunkSupported,
  getObservabilityStore,
  getScoresStore,
  supportsObservabilityTraceQueryTimeToFirstChunk,
  supportsObservabilityTraceQueryTimeToFirstChunkSort,
} from './observability-shared';

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

describe('deprecated time to first chunk helpers', () => {
  const store = (...features: string[]) => ({ getFeatures: () => features }) as unknown as ObservabilityStorage;
  const where = (field: string) =>
    ({ type: 'comparison', field, operator: 'gt', value: 100 }) as unknown as TrustedTraceQueryPredicate;

  it('still gate time to first chunk predicates and sort on the store features', () => {
    expect(supportsObservabilityTraceQueryTimeToFirstChunk(store('trace-query-time-to-first-chunk'))).toBe(true);
    expect(supportsObservabilityTraceQueryTimeToFirstChunk(store())).toBe(false);
    expect(supportsObservabilityTraceQueryTimeToFirstChunkSort(store('trace-query-time-to-first-chunk-sort'))).toBe(
      true,
    );
    expect(supportsObservabilityTraceQueryTimeToFirstChunkSort(store())).toBe(false);

    expect(() => assertObservabilityTraceQueryTimeToFirstChunkSupported(store(), where('timeToFirstChunkMs'))).toThrow(
      HTTPException,
    );
    expect(() =>
      assertObservabilityTraceQueryTimeToFirstChunkSupported(
        store('trace-query-time-to-first-chunk'),
        where('timeToFirstChunkMs'),
      ),
    ).not.toThrow();
    expect(() =>
      assertObservabilityTraceQueryTimeToFirstChunkSortSupported(store(), { field: 'timeToFirstChunkMs' }),
    ).toThrow(HTTPException);
    expect(() =>
      assertObservabilityTraceQueryTimeToFirstChunkSortSupported(store('trace-query-time-to-first-chunk-sort'), {
        field: 'timeToFirstChunkMs',
      }),
    ).not.toThrow();
  });
});

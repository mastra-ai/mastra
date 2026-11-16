import type { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  assertObservabilityTextSearchSupported,
  getObservabilityStorageCapabilities,
  getObservabilityStore,
  getScoresStore,
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

describe('text search capabilities', () => {
  it.each(['span', 'trace'] as const)(
    'rejects %s search on a real store without indexed search support',
    async kind => {
      const store = await new InMemoryStore().getStore('observability');
      if (!store) throw new Error('Missing observability store');
      const capabilities = getObservabilityStorageCapabilities(store);
      expect(capabilities.spanQueryTokenSearch).toBe(false);
      expect(capabilities.traceQueryTokenSearch).toBe(false);
      expect(() =>
        assertObservabilityTextSearchSupported(
          store,
          { type: 'tokens', field: 'all', operator: 'hasAllTokens', value: 'error' },
          kind,
        ),
      ).toThrow(expect.objectContaining({ status: 501 }));
      // The same store remains usable for requests that don't ask for text search.
      assertObservabilityTextSearchSupported(store, undefined, kind);
      expect(await store.getEntityTypes({})).toEqual({ entityTypes: [] });
    },
  );
});

describe.each(['trace', 'span'] as const)('%s aggregate search capability', kind => {
  it('does not treat list search support as aggregate search support', () => {
    const store = { getFeatures: () => [`${kind}-query-token-search`, `${kind}-aggregate`] } as Parameters<
      typeof assertObservabilityTextSearchSupported
    >[0];
    expect(() =>
      assertObservabilityTextSearchSupported(
        store,
        { type: 'tokens', field: 'all', operator: 'hasAllTokens', value: 'error' },
        kind,
        'aggregate',
      ),
    ).toThrow(HTTPException);
    expect(getObservabilityStorageCapabilities(store)[`${kind}AggregateTokenSearch`]).toBe(false);
  });
  it('requires the explicit aggregate search feature', () => {
    const store = { getFeatures: () => [`${kind}-aggregate`, `${kind}-aggregate-token-search`] } as Parameters<
      typeof assertObservabilityTextSearchSupported
    >[0];
    expect(getObservabilityStorageCapabilities(store)[`${kind}AggregateTokenSearch`]).toBe(true);
  });
});

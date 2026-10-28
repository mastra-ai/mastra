import type { Mastra } from '@mastra/core/mastra';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { getObservabilityStore, getScoresStore } from './observability-shared';

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

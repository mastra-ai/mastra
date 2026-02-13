import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { MastraError } from '../../error/index';
import type { MastraScorer } from '../../evals/base';
import { Mastra } from '../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import { Dataset } from '../dataset';
import { runExperiment } from '../experiment/index';
import { DatasetsManager } from '../manager';

const createMockScorer = (scorerId: string, scorerName: string): MastraScorer<any, any, any, any> => ({
  id: scorerId,
  name: scorerName,
  description: 'Mock scorer',
  run: vi.fn().mockImplementation(async ({ output }: { output: unknown }) => ({
    score: output ? 1.0 : 0.0,
    reason: output ? 'Has output' : 'No output',
  })),
});

describe('DatasetsManager', () => {
  let db: InMemoryDB;
  let datasetsStorage: DatasetsInMemory;
  let experimentsStorage: ExperimentsInMemory;
  let scoresStorage: ScoresInMemory;
  let mockStorage: MastraCompositeStore;
  let mastra: Mastra;
  let mgr: DatasetsManager;

  beforeEach(() => {
    db = new InMemoryDB();
    datasetsStorage = new DatasetsInMemory({ db });
    experimentsStorage = new ExperimentsInMemory({ db });
    scoresStorage = new ScoresInMemory({ db });

    mockStorage = {
      id: 'test-storage',
      stores: {
        datasets: datasetsStorage,
        experiments: experimentsStorage,
        scores: scoresStorage,
      } as unknown as StorageDomains,
      getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
        if (name === 'datasets') return datasetsStorage;
        if (name === 'experiments') return experimentsStorage;
        if (name === 'scores') return scoresStorage;
        return undefined;
      }),
    } as unknown as MastraCompositeStore;

    mastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getAgent: vi.fn(),
      getAgentById: vi.fn(),
      getScorerById: vi.fn(),
      getWorkflowById: vi.fn(),
      getWorkflow: vi.fn(),
    } as unknown as Mastra;

    mgr = new DatasetsManager(mastra);
  });

  // 1. Construction — does not call getStorage()
  it('does not call getStorage() on construction', () => {
    const m = {
      getStorage: vi.fn(),
    } as unknown as Mastra;
    new DatasetsManager(m);
    expect(m.getStorage).not.toHaveBeenCalled();
  });

  // 2. MastraError on missing storage
  it('throws MastraError when storage is not configured', async () => {
    const noStorageMastra = {
      getStorage: vi.fn().mockReturnValue(undefined),
    } as unknown as Mastra;
    const noStorageMgr = new DatasetsManager(noStorageMastra);

    try {
      await noStorageMgr.list();
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('DATASETS_STORAGE_NOT_CONFIGURED');
      expect((err as MastraError).domain).toBe('STORAGE');
      expect((err as MastraError).category).toBe('USER');
    }
  });

  // 3. Lazy storage caching — getStore called once even after two operations
  it('caches storage after first resolution', async () => {
    await mgr.list();
    await mgr.list();
    expect(mockStorage.getStore).toHaveBeenCalledTimes(1);
  });

  // 4. create — returns Dataset instance
  it('create returns a Dataset instance with a string id', async () => {
    const result = await mgr.create({ name: 'Test' });
    expect(result).toBeInstanceOf(Dataset);
    expect(typeof result.id).toBe('string');
  });

  // 5. create — Zod schema conversion
  it('create converts Zod schemas to JSON Schema', async () => {
    const result = await mgr.create({
      name: 'Zod DS',
      inputSchema: z.object({ q: z.string() }),
      groundTruthSchema: z.object({ a: z.number() }),
    });

    const details = await result.getDetails();
    expect(details.groundTruthSchema).toBeDefined();
    expect((details.groundTruthSchema as Record<string, unknown>).type).toBe('object');
    expect((details.groundTruthSchema as Record<string, unknown>).properties).toBeDefined();
    expect(details.inputSchema).toBeDefined();
    expect((details.inputSchema as Record<string, unknown>).type).toBe('object');
  });

  // 6. get — returns Dataset instance
  it('get returns a Dataset instance for an existing dataset', async () => {
    const created = await mgr.create({ name: 'Existing' });
    const fetched = await mgr.get({ id: created.id });
    expect(fetched).toBeInstanceOf(Dataset);
    expect(fetched.id).toBe(created.id);
  });

  // 7. get — throws on not found
  it('get throws MastraError for nonexistent dataset', async () => {
    try {
      await mgr.get({ id: 'nonexistent' });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('DATASET_NOT_FOUND');
    }
  });

  // 8. list — returns datasets and pagination
  it('list returns datasets and pagination', async () => {
    await mgr.create({ name: 'DS1' });
    await mgr.create({ name: 'DS2' });
    const result = await mgr.list();
    expect(result.datasets.length).toBeGreaterThanOrEqual(2);
    expect(result.pagination).toBeDefined();
  });

  // 9. list — empty result
  it('list returns empty array when no datasets exist', async () => {
    const result = await mgr.list();
    expect(result.datasets.length).toBe(0);
  });

  // 10. delete — delegates
  it('delete removes dataset so get throws', async () => {
    const created = await mgr.create({ name: 'ToDelete' });
    await mgr.delete({ id: created.id });
    try {
      await mgr.get({ id: created.id });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('DATASET_NOT_FOUND');
    }
  });

  // 11. getExperiment — returns null for missing
  it('getExperiment returns null for nonexistent experiment', async () => {
    const result = await mgr.getExperiment({ experimentId: 'nonexistent' });
    expect(result).toBeNull();
  });

  // 12. compareExperiments — validates length
  it('compareExperiments throws when fewer than 2 experiment IDs', async () => {
    try {
      await mgr.compareExperiments({ experimentIds: ['one'] });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('COMPARE_INVALID_INPUT');
    }
  });

  // 13. compareExperiments — MVP output shape
  it('compareExperiments returns { baselineId, items } with correct shape', async () => {
    // Create dataset with items
    const record = await datasetsStorage.createDataset({ name: 'Compare DS' });
    await datasetsStorage.addItem({
      datasetId: record.id,
      input: { prompt: 'Hello' },
      groundTruth: { text: 'Hi' },
    });
    await datasetsStorage.addItem({
      datasetId: record.id,
      input: { prompt: 'Goodbye' },
      groundTruth: { text: 'Bye' },
    });

    const scorer = createMockScorer('accuracy', 'Accuracy');

    // Run 2 experiments
    const exp1 = await runExperiment(mastra, {
      datasetId: record.id,
      task: async ({ input }) => 'response-1-' + JSON.stringify(input),
      scorers: [scorer],
    });
    const exp2 = await runExperiment(mastra, {
      datasetId: record.id,
      task: async ({ input }) => 'response-2-' + JSON.stringify(input),
      scorers: [scorer],
    });

    const comparison = await mgr.compareExperiments({
      experimentIds: [exp1.experimentId, exp2.experimentId],
    });

    expect(comparison.baselineId).toBe(exp1.experimentId);
    expect(Array.isArray(comparison.items)).toBe(true);
    expect(comparison.items.length).toBeGreaterThan(0);

    const item = comparison.items[0]!;
    expect(item.itemId).toBeDefined();
    expect(item).toHaveProperty('input');
    expect(item).toHaveProperty('groundTruth');
    expect(item).toHaveProperty('results');
    expect(item.results[exp1.experimentId]).toBeDefined();
    expect(item.results[exp2.experimentId]).toBeDefined();
  });

  // 14. compareExperiments — explicit baselineId
  it('compareExperiments uses explicit baselineId', async () => {
    const record = await datasetsStorage.createDataset({ name: 'Baseline DS' });
    await datasetsStorage.addItem({
      datasetId: record.id,
      input: { prompt: 'Test' },
      groundTruth: { text: 'Expected' },
    });

    const scorer = createMockScorer('acc', 'Acc');

    const exp1 = await runExperiment(mastra, {
      datasetId: record.id,
      task: async () => 'r1',
      scorers: [scorer],
    });
    const exp2 = await runExperiment(mastra, {
      datasetId: record.id,
      task: async () => 'r2',
      scorers: [scorer],
    });

    const comparison = await mgr.compareExperiments({
      experimentIds: [exp1.experimentId, exp2.experimentId],
      baselineId: exp2.experimentId,
    });

    expect(comparison.baselineId).toBe(exp2.experimentId);
  });

  // 15. mastra.datasets singleton
  it('mastra.datasets returns the same instance on repeated access', () => {
    const realMastra = new Mastra({ logger: false });
    expect(realMastra.datasets).toBe(realMastra.datasets);
  });
});

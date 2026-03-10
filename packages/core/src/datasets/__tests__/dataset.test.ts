import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { MastraError } from '../../error/index';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import { Dataset } from '../dataset';
import { SchemaValidationError, SchemaUpdateValidationError } from '../validation/errors';

const createMockScorer = (scorerId: string, scorerName: string): MastraScorer<any, any, any, any> => ({
  id: scorerId,
  name: scorerName,
  description: 'Mock scorer',
  run: vi.fn().mockImplementation(async ({ output }: { output: unknown }) => ({
    score: output ? 1.0 : 0.0,
    reason: output ? 'Has output' : 'No output',
  })),
});

const createMockAgent = (response: string, shouldFail = false) => ({
  id: 'test-agent',
  name: 'Test Agent',
  getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
  generate: vi.fn().mockImplementation(async () => {
    if (shouldFail) throw new Error('Agent error');
    return { text: response };
  }),
});

describe('Dataset', () => {
  let db: InMemoryDB;
  let datasetsStorage: DatasetsInMemory;
  let experimentsStorage: ExperimentsInMemory;
  let scoresStorage: ScoresInMemory;
  let mockStorage: MastraCompositeStore;
  let mastra: Mastra;
  let ds: Dataset;
  let datasetId: string;

  beforeEach(async () => {
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

    const mockAgent = createMockAgent('Response');
    mastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getAgent: vi.fn().mockReturnValue(mockAgent),
      getAgentById: vi.fn().mockReturnValue(mockAgent),
      getScorerById: vi.fn(),
      getWorkflowById: vi.fn(),
      getWorkflow: vi.fn(),
    } as unknown as Mastra;

    // Create a dataset for tests that need one
    const record = await datasetsStorage.createDataset({ name: 'Test DS' });
    datasetId = record.id;
    ds = new Dataset(datasetId, mastra);
  });

  // 1. Construction — does not call getStorage()
  it('does not call getStorage() on construction', () => {
    const m = { getStorage: vi.fn() } as unknown as Mastra;
    new Dataset('some-id', m);
    expect(m.getStorage).not.toHaveBeenCalled();
  });

  // 2. .id matches
  it('.id matches the constructor argument', () => {
    expect(ds.id).toBe(datasetId);
  });

  // 3. MastraError on missing storage
  it('throws MastraError when storage is not configured', async () => {
    const noStorageMastra = {
      getStorage: vi.fn().mockReturnValue(undefined),
    } as unknown as Mastra;
    const noDs = new Dataset('x', noStorageMastra);

    try {
      await noDs.getDetails();
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('DATASETS_STORAGE_NOT_CONFIGURED');
    }
  });

  // 4. Lazy storage caching
  it('caches storage after first resolution', async () => {
    await ds.getDetails();
    await ds.getDetails();
    // getStore should be called once for datasets (lazy caching)
    expect(mockStorage.getStore).toHaveBeenCalledTimes(1);
  });

  // 5. getDetails — returns DatasetRecord
  it('getDetails returns a DatasetRecord with expected fields', async () => {
    const details = await ds.getDetails();
    expect(details.id).toBe(datasetId);
    expect(details.name).toBe('Test DS');
  });

  // 6. getDetails — throws on nonexistent
  it('getDetails throws MastraError for nonexistent dataset', async () => {
    const badDs = new Dataset('nonexistent', mastra);
    try {
      await badDs.getDetails();
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('DATASET_NOT_FOUND');
    }
  });

  // 7. update — delegates with renamed fields
  it('update changes description', async () => {
    const updated = await ds.update({ description: 'New desc' });
    expect(updated.description).toBe('New desc');
  });

  // 8. update — Zod schema conversion
  it('update converts Zod schemas to JSON Schema', async () => {
    const updated = await ds.update({
      inputSchema: z.object({ q: z.string() }),
    });
    expect(updated.inputSchema).toBeDefined();
    expect((updated.inputSchema as Record<string, unknown>).type).toBe('object');
  });

  // 9. addItem — with groundTruth and metadata
  it('addItem returns a DatasetItem with correct datasetId', async () => {
    const item = await ds.addItem({
      input: { prompt: 'Hello' },
      groundTruth: { text: 'Hi' },
      metadata: { source: 'test' },
    });
    expect(item.datasetId).toBe(datasetId);
    expect(item.input).toEqual({ prompt: 'Hello' });
    expect(item.groundTruth).toEqual({ text: 'Hi' });
    expect(item.metadata).toEqual({ source: 'test' });
  });

  // 10. addItems — bulk create
  it('addItems returns an array of items', async () => {
    const items = await ds.addItems({
      items: [{ input: { a: 1 } }, { input: { a: 2 }, groundTruth: { b: 2 } }],
    });
    expect(items).toHaveLength(2);
    expect(items[0]!.datasetId).toBe(datasetId);
  });

  // 11. getItem — without version
  it('getItem without version returns DatasetItem', async () => {
    const added = await ds.addItem({ input: { x: 1 } });
    const fetched = await ds.getItem({ itemId: added.id });
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(added.id);
  });

  // 12. getItem — with version
  it('getItem with version returns DatasetItem at that version', async () => {
    const added = await ds.addItem({ input: { x: 1 } });
    const fetched = await ds.getItem({ itemId: added.id, version: added.datasetVersion });
    expect(fetched).not.toBeNull();
    expect(fetched!.datasetVersion).toBe(added.datasetVersion);
  });

  // 13. getItem — nonexistent returns null
  it('getItem returns null for nonexistent item', async () => {
    const fetched = await ds.getItem({ itemId: 'nonexistent' });
    expect(fetched).toBeNull();
  });

  // 14. listItems — without version
  it('listItems without version returns { items, pagination }', async () => {
    await ds.addItem({ input: { a: 1 } });
    const result = await ds.listItems();
    expect('items' in (result as any)).toBe(true);
    expect('pagination' in (result as any)).toBe(true);
    expect((result as any).items.length).toBeGreaterThanOrEqual(1);
  });

  // 15. listItems — with version
  it('listItems with version returns DatasetItem[]', async () => {
    const item = await ds.addItem({ input: { a: 1 } });
    const result = await ds.listItems({ version: item.datasetVersion });
    // When version is set, returns DatasetItem[] (from getItemsByVersion)
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBeGreaterThanOrEqual(1);
  });

  // 16. updateItem
  it('updateItem returns updated item', async () => {
    const added = await ds.addItem({ input: { x: 1 } });
    const updated = await ds.updateItem({ itemId: added.id, input: { x: 2 } });
    expect(updated.input).toEqual({ x: 2 });
  });

  // 17. deleteItem
  it('deleteItem removes the item', async () => {
    const added = await ds.addItem({ input: { x: 1 } });
    await ds.deleteItem({ itemId: added.id });
    const fetched = await ds.getItem({ itemId: added.id });
    expect(fetched).toBeNull();
  });

  // 18. deleteItems — bulk delete
  it('deleteItems removes multiple items', async () => {
    const items = await ds.addItems({
      items: [{ input: { a: 1 } }, { input: { a: 2 } }],
    });
    await ds.deleteItems({ itemIds: items.map(i => i.id) });
    const fetched1 = await ds.getItem({ itemId: items[0]!.id });
    const fetched2 = await ds.getItem({ itemId: items[1]!.id });
    expect(fetched1).toBeNull();
    expect(fetched2).toBeNull();
  });

  // 19. listVersions
  it('listVersions returns { versions, pagination }', async () => {
    await ds.addItem({ input: { a: 1 } });
    const result = await ds.listVersions();
    expect(result.versions).toBeDefined();
    expect(result.pagination).toBeDefined();
    expect(result.versions.length).toBeGreaterThanOrEqual(1);
  });

  // 20. getItemHistory
  it('getItemHistory returns SCD-2 row history', async () => {
    const added = await ds.addItem({ input: { a: 1 } });
    await ds.updateItem({ itemId: added.id, input: { a: 2 } });
    const history = await ds.getItemHistory({ itemId: added.id });
    // SCD-2: at least 2 rows (original closed + updated current)
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  // 21. startExperiment
  it('startExperiment returns ExperimentSummary with completed status', async () => {
    await ds.addItem({ input: { prompt: 'Hello' }, groundTruth: { text: 'Hi' } });

    const mockScorer = createMockScorer('acc', 'Accuracy');
    const result = await ds.startExperiment({
      task: async ({ input }) => 'processed-' + JSON.stringify(input),
      scorers: [mockScorer],
    });

    expect(result.status).toBe('completed');
    expect(result.experimentId).toBeTruthy();
    expect(result.totalItems).toBeGreaterThanOrEqual(1);
  });

  // 22. startExperiment — inline task receives mastra
  it('startExperiment inline task receives mastra instance', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });

    let capturedMastra: unknown = null;
    await ds.startExperiment({
      task: async ({ mastra: m }) => {
        capturedMastra = m;
        return 'ok';
      },
      scorers: [],
    });

    expect(capturedMastra).toBe(mastra);
  });

  // 23. startExperimentAsync
  it('startExperimentAsync returns pending status immediately', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });

    const { experimentId, status } = await ds.startExperimentAsync({
      task: async () => 'ok',
      scorers: [],
    });

    expect(status).toBe('pending');
    expect(experimentId).toBeTruthy();

    // Verify run record exists
    const run = await experimentsStorage.getExperimentById({ id: experimentId });
    expect(run).not.toBeNull();

    // Wait for fire-and-forget to complete
    await new Promise(r => setTimeout(r, 500));
  });

  // 24. listExperiments
  it('listExperiments returns runs for this dataset', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });
    await ds.startExperiment({
      task: async () => 'ok',
      scorers: [],
    });

    const result = await ds.listExperiments();
    expect(result.experiments.length).toBeGreaterThanOrEqual(1);
    expect(result.pagination).toBeDefined();
  });

  // 25. getExperiment
  it('getExperiment returns a Run', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });
    const summary = await ds.startExperiment({
      task: async () => 'ok',
      scorers: [],
    });

    const run = await ds.getExperiment({ experimentId: summary.experimentId });
    expect(run).not.toBeNull();
    expect(run!.id).toBe(summary.experimentId);
  });

  // 26. listExperimentResults — experimentId → runId translation
  it('listExperimentResults returns results for the experiment', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });
    const summary = await ds.startExperiment({
      task: async () => 'ok',
      scorers: [],
    });

    const { results } = await ds.listExperimentResults({
      experimentId: summary.experimentId,
    });
    expect(results.length).toBeGreaterThan(0);
  });

  // 27. deleteExperiment
  it('deleteExperiment removes the run', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });
    const summary = await ds.startExperiment({
      task: async () => 'ok',
      scorers: [],
    });

    await ds.deleteExperiment({ experimentId: summary.experimentId });
    const run = await ds.getExperiment({ experimentId: summary.experimentId });
    expect(run).toBeNull();
  });

  // 28. SchemaValidationError — invalid input
  it('throws SchemaValidationError for invalid input', async () => {
    // Create dataset with JSON Schema
    const schemaDs = await datasetsStorage.createDataset({
      name: 'Schema DS',
      inputSchema: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
        additionalProperties: false,
      },
    });
    const sds = new Dataset(schemaDs.id, mastra);

    try {
      await sds.addItem({ input: { q: 123 } }); // q should be string
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      expect((err as SchemaValidationError).field).toBe('input');
    }
  });

  // 29. SchemaValidationError — invalid groundTruth
  it('throws SchemaValidationError for invalid groundTruth', async () => {
    const schemaDs = await datasetsStorage.createDataset({
      name: 'Schema DS',
      groundTruthSchema: {
        type: 'object',
        properties: { a: { type: 'number' } },
        required: ['a'],
        additionalProperties: false,
      },
    });
    const sds = new Dataset(schemaDs.id, mastra);

    try {
      await sds.addItem({ input: { x: 1 }, groundTruth: { a: 'not-a-number' } });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      expect((err as SchemaValidationError).field).toBe('groundTruth');
    }
  });

  // 30. SchemaUpdateValidationError
  it('throws SchemaUpdateValidationError when schema update invalidates existing items', async () => {
    // Create dataset without schema, add items
    const noSchemaDs = await datasetsStorage.createDataset({ name: 'No Schema DS' });
    const nsds = new Dataset(noSchemaDs.id, mastra);
    await nsds.addItem({ input: { q: 123 } }); // q is a number

    try {
      // Now update with a schema that requires q to be a string
      await nsds.update({
        inputSchema: {
          type: 'object',
          properties: { q: { type: 'string' } },
          required: ['q'],
          additionalProperties: false,
        },
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaUpdateValidationError);
      const sErr = err as SchemaUpdateValidationError;
      expect(sErr.failingItems.length).toBeGreaterThan(0);
      expect(sErr.failingItems[0]!.field).toBe('input');
    }
  });

  // 31. Pagination forwarding
  it('listItems respects perPage pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await ds.addItem({ input: { i } });
    }
    const result = await ds.listItems({ perPage: 2 });
    expect('items' in (result as any)).toBe(true);
    expect((result as any).items.length).toBe(2);
  });
});

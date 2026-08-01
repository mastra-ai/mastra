import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraError } from '../../error/index';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { ExperimentsInMemory } from '../../storage/domains/experiments/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { ScoresInMemory } from '../../storage/domains/scores/inmemory';
import type { DatasetItem, ListDatasetItemsOutput } from '../../storage/types';
import { Dataset } from '../dataset';
import { SchemaValidationError, SchemaUpdateValidationError } from '../validation/errors';

// Dataset.listItems returns a union: bare `DatasetItem[]` when only `version`
// is passed, else the paginated `{ items, pagination }` shape. Narrow to the
// paginated branch in tests that pass `search`/`page`/`perPage` (with or
// without `version`).
const paginated = <T>(r: T | ListDatasetItemsOutput): ListDatasetItemsOutput => r as ListDatasetItemsOutput;

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
      getLogger: vi.fn().mockReturnValue({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
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
    const result = paginated(await ds.listItems());
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.pagination).toBeDefined();
  });

  // 15. listItems — version-only returns bare DatasetItem[] snapshot
  it('listItems with only version returns a bare DatasetItem[] snapshot', async () => {
    const item = await ds.addItem({ input: { a: 1 } });
    const result = await ds.listItems({ version: item.datasetVersion });
    expect(Array.isArray(result)).toBe(true);
    expect((result as DatasetItem[]).length).toBeGreaterThanOrEqual(1);
  });

  // 15a. listItems — version + search
  it('listItems with version + search filters at that version', async () => {
    await ds.addItem({ input: { q: 'apple' } });
    await ds.addItem({ input: { q: 'banana' } });
    const last = await ds.addItem({ input: { q: 'apricot' } });

    const result = paginated(await ds.listItems({ version: last.datasetVersion, search: 'ap' }));
    expect(result.items.length).toBe(2);
    expect(result.items.every(i => JSON.stringify(i.input).includes('ap'))).toBe(true);
  });

  // 15b. listItems — version + pagination
  it('listItems with version respects page/perPage', async () => {
    for (let i = 0; i < 5; i++) {
      await ds.addItem({ input: { a: i } });
    }
    const latest = await ds.addItem({ input: { a: 5 } });

    const page0 = paginated(await ds.listItems({ version: latest.datasetVersion, page: 0, perPage: 2 }));
    expect(page0.items).toHaveLength(2);
    expect(page0.pagination.total).toBe(6);
    expect(page0.pagination.hasMore).toBe(true);

    const page1 = paginated(await ds.listItems({ version: latest.datasetVersion, page: 1, perPage: 2 }));
    expect(page1.items).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);
  });

  // 16. updateItem
  it('updateItem returns updated item and supports clearing scorer IDs', async () => {
    const added = await ds.addItem({ input: { x: 1 }, scorerIds: ['quality'] });
    const updated = await ds.updateItem({ itemId: added.id, input: { x: 2 } });
    expect(updated.input).toEqual({ x: 2 });
    expect(updated.scorerIds).toEqual(['quality']);

    const cleared = await ds.updateItem({ itemId: added.id, scorerIds: null });
    expect(cleared.scorerIds).toBeUndefined();
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

  it('startExperimentAsync throws EXPERIMENT_NO_ITEMS on empty dataset', async () => {
    await expect(
      ds.startExperimentAsync({
        task: async () => 'ok',
        scorers: [],
      }),
    ).rejects.toThrow('has no items');

    try {
      await ds.startExperimentAsync({ task: async () => 'ok', scorers: [] });
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('EXPERIMENT_NO_ITEMS');
    }

    // Verify no experiment record was created
    const { experiments } = await ds.listExperiments();
    expect(experiments).toHaveLength(0);
  });

  it('startExperimentAsync returns totalItems matching dataset item count', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });
    await ds.addItem({ input: { prompt: 'World' } });

    const result = await ds.startExperimentAsync({
      task: async () => 'ok',
      scorers: [],
    });

    expect(result.totalItems).toBe(2);

    // Wait for fire-and-forget to complete
    await new Promise(r => setTimeout(r, 500));
  });

  it('startExperimentAsync records the resolved version in experiment record', async () => {
    // Add two items → dataset version becomes 2
    await ds.addItem({ input: { prompt: 'A' } });
    await ds.addItem({ input: { prompt: 'B' } });

    // Run experiment pinned to version 1 (only first item visible)
    const result = await ds.startExperimentAsync({
      task: async () => 'ok',
      scorers: [],
      version: 1,
    });

    const experiment = await experimentsStorage.getExperimentById({ id: result.experimentId });
    expect(experiment).not.toBeNull();
    expect(experiment!.datasetVersion).toBe(1);
    expect(result.totalItems).toBe(1);

    // Wait for fire-and-forget to complete
    await new Promise(r => setTimeout(r, 500));
  });

  it('startExperimentAsync forwards requestContext to agent.generate()', async () => {
    await ds.addItem({ input: { prompt: 'Hello' } });

    const mockAgent = createMockAgent('Response');
    const localMastra = {
      ...mastra,
      getAgent: vi.fn().mockReturnValue(mockAgent),
      getAgentById: vi.fn().mockReturnValue(mockAgent),
    } as unknown as Mastra;

    // Create a new dataset instance bound to localMastra
    const localDs = new Dataset(datasetId, localMastra);

    await localDs.startExperimentAsync({
      targetType: 'agent',
      targetId: 'test-agent',
      requestContext: { userId: 'dev-user-123', environment: 'development' },
    });

    // Wait for fire-and-forget execution
    await new Promise(r => setTimeout(r, 1000));

    // agent.generate should have been called
    expect(mockAgent.generate).toHaveBeenCalled();

    // Verify requestContext was forwarded
    const firstCallOptions = (mockAgent.generate as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const { RequestContext } = await import('../../request-context');
    expect(firstCallOptions.requestContext).toBeInstanceOf(RequestContext);
    expect(firstCallOptions.requestContext.all).toEqual({
      userId: 'dev-user-123',
      environment: 'development',
    });
  });

  // 23b. startExperimentAsync — throws on empty dataset
  it('startExperimentAsync throws EXPERIMENT_NO_ITEMS when dataset has no items', async () => {
    // Dataset has no items — do NOT add any
    try {
      await ds.startExperimentAsync({
        task: async () => 'ok',
        scorers: [],
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('EXPERIMENT_NO_ITEMS');
    }

    // Verify no experiment record was created
    const result = await experimentsStorage.listExperiments({
      datasetId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(result.experiments.length).toBe(0);
  });

  // 23c. startExperiment — throws on empty dataset (sync path)
  it('startExperiment throws on empty dataset', async () => {
    try {
      await ds.startExperiment({
        task: async () => 'ok',
        scorers: [],
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MastraError);
      expect((err as MastraError).id).toBe('EXPERIMENT_NO_ITEMS');
    }
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
    const result = paginated(await ds.listItems({ perPage: 2 }));
    expect(result.items).toHaveLength(2);
    expect(result.pagination.total).toBe(5);
  });

  // 32. listExperiments filter passthrough
  describe('listExperiments filter passthrough', () => {
    beforeEach(async () => {
      await experimentsStorage.createExperiment({
        datasetId,
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-a',
        agentVersion: 'v1',
        totalItems: 1,
        organizationId: 'org-1',
        projectId: 'proj-1',
      });
      await experimentsStorage.createExperiment({
        datasetId,
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-a',
        agentVersion: 'v2',
        totalItems: 1,
        organizationId: 'org-2',
        projectId: 'proj-2',
      });
      await experimentsStorage.createExperiment({
        datasetId,
        datasetVersion: 1,
        targetType: 'workflow',
        targetId: 'wf-1',
        totalItems: 1,
        organizationId: 'org-1',
        projectId: 'proj-1',
      });
    });

    it('scopes results to the dataset by default', async () => {
      const { experiments, pagination } = await ds.listExperiments();
      expect(experiments).toHaveLength(3);
      expect(pagination.total).toBe(3);
      expect(experiments.every(e => e.datasetId === datasetId)).toBe(true);
    });

    it('filters by targetType', async () => {
      const { experiments } = await ds.listExperiments({ targetType: 'workflow' });
      expect(experiments).toHaveLength(1);
      expect(experiments[0]!.targetType).toBe('workflow');
    });

    it('filters by targetId', async () => {
      const { experiments } = await ds.listExperiments({ targetId: 'agent-a' });
      expect(experiments).toHaveLength(2);
      expect(experiments.every(e => e.targetId === 'agent-a')).toBe(true);
    });

    it('filters by agentVersion', async () => {
      const { experiments } = await ds.listExperiments({ agentVersion: 'v2' });
      expect(experiments).toHaveLength(1);
      expect(experiments[0]!.agentVersion).toBe('v2');
    });

    it('filters by status', async () => {
      const [firstExp] = await experimentsStorage
        .listExperiments({
          datasetId,
          pagination: { page: 0, perPage: 100 },
        })
        .then(r => r.experiments);
      expect(firstExp).toBeDefined();
      await experimentsStorage.updateExperiment({ id: firstExp!.id, status: 'completed' });

      const { experiments } = await ds.listExperiments({ status: 'completed' });
      expect(experiments).toHaveLength(1);
      expect(experiments[0]!.status).toBe('completed');
    });

    it('forwards tenancy filters', async () => {
      const { experiments } = await ds.listExperiments({
        filters: { organizationId: 'org-1', projectId: 'proj-1' },
      });
      expect(experiments).toHaveLength(2);
      expect(experiments.every(e => e.organizationId === 'org-1' && e.projectId === 'proj-1')).toBe(true);
    });

    it('respects pagination alongside filters', async () => {
      const { experiments, pagination } = await ds.listExperiments({
        targetType: 'agent',
        page: 0,
        perPage: 1,
      });
      expect(experiments).toHaveLength(1);
      expect(pagination.total).toBe(2);
      expect(pagination.hasMore).toBe(true);
    });
  });

  // 33. listExperimentResults filter passthrough
  describe('listExperimentResults filter passthrough', () => {
    let experimentId: string;

    beforeEach(async () => {
      const experiment = await experimentsStorage.createExperiment({
        datasetId,
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-a',
        totalItems: 3,
      });
      experimentId = experiment.id;

      await experimentsStorage.addExperimentResult({
        experimentId,
        itemId: 'item-1',
        itemDatasetVersion: 1,
        input: { prompt: 'p1' },
        output: { text: 'r1' },
        groundTruth: null,
        error: null,
        startedAt: new Date(1000),
        completedAt: new Date(2000),
        retryCount: 0,
        traceId: 'trace-a',
        status: 'reviewed',
        organizationId: 'org-1',
        projectId: 'proj-1',
      });
      await experimentsStorage.addExperimentResult({
        experimentId,
        itemId: 'item-2',
        itemDatasetVersion: 1,
        input: { prompt: 'p2' },
        output: { text: 'r2' },
        groundTruth: null,
        error: null,
        startedAt: new Date(3000),
        completedAt: new Date(4000),
        retryCount: 0,
        traceId: 'trace-b',
        status: 'needs-review',
        organizationId: 'org-2',
        projectId: 'proj-2',
      });
      await experimentsStorage.addExperimentResult({
        experimentId,
        itemId: 'item-3',
        itemDatasetVersion: 1,
        input: { prompt: 'p3' },
        output: { text: 'r3' },
        groundTruth: null,
        error: null,
        startedAt: new Date(5000),
        completedAt: new Date(6000),
        retryCount: 0,
        traceId: 'trace-a',
        status: null,
        organizationId: 'org-1',
        projectId: 'proj-1',
      });
    });

    it('scopes results to the experiment by default', async () => {
      const { results, pagination } = await ds.listExperimentResults({ experimentId });
      expect(results).toHaveLength(3);
      expect(pagination.total).toBe(3);
    });

    it('filters by traceId', async () => {
      const { results } = await ds.listExperimentResults({ experimentId, traceId: 'trace-a' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.traceId === 'trace-a')).toBe(true);
    });

    it('filters by status', async () => {
      const { results } = await ds.listExperimentResults({ experimentId, status: 'reviewed' });
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('reviewed');
    });

    it('forwards tenancy filters', async () => {
      const { results } = await ds.listExperimentResults({
        experimentId,
        filters: { organizationId: 'org-1', projectId: 'proj-1' },
      });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.organizationId === 'org-1' && r.projectId === 'proj-1')).toBe(true);
    });

    it('respects pagination alongside filters', async () => {
      const { results, pagination } = await ds.listExperimentResults({
        experimentId,
        traceId: 'trace-a',
        page: 0,
        perPage: 1,
      });
      expect(results).toHaveLength(1);
      expect(pagination.total).toBe(2);
      expect(pagination.hasMore).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Ownership gates: reject child records that belong to a different dataset
  // even when the caller holds a valid handle to the current dataset.
  // ---------------------------------------------------------------------------

  it('getItem returns null when the item belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherItem = await datasetsStorage.addItem({ datasetId: other.id, input: { x: 1 } });
    const leaked = await ds.getItem({ itemId: otherItem.id });
    expect(leaked).toBeNull();
  });

  it('getItemHistory filters out rows that belong to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherItem = await datasetsStorage.addItem({ datasetId: other.id, input: { x: 1 } });
    const rows = await ds.getItemHistory({ itemId: otherItem.id });
    expect(rows).toEqual([]);
  });

  it('getExperiment returns null when the experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    const leaked = await ds.getExperiment({ experimentId: otherExp.id });
    expect(leaked).toBeNull();
  });

  it('deleteExperiment throws NOT_FOUND when the experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    await expect(ds.deleteExperiment({ experimentId: otherExp.id })).rejects.toMatchObject({
      id: 'EXPERIMENT_NOT_FOUND',
    });
    // Original experiment should still exist under its true dataset
    const stillThere = await experimentsStorage.getExperimentById({ id: otherExp.id });
    expect(stillThere?.id).toBe(otherExp.id);
  });

  it('listExperimentResults throws NOT_FOUND when experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    await expect(ds.listExperimentResults({ experimentId: otherExp.id })).rejects.toMatchObject({
      id: 'EXPERIMENT_NOT_FOUND',
    });
  });

  it('updateExperimentResult throws when experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    await expect(
      ds.updateExperimentResult({ id: 'any-result-id', experimentId: otherExp.id, status: 'reviewed' }),
    ).rejects.toMatchObject({
      id: 'EXPERIMENT_NOT_FOUND',
    });
  });

  it('updateExperimentResult rejects when called without experimentId', async () => {
    await expect(
      // Runtime guard for JS callers that bypass the type narrowing
      (ds.updateExperimentResult as (input: { id: string; status: string }) => Promise<unknown>)({
        id: 'any-result-id',
        status: 'reviewed',
      }),
    ).rejects.toMatchObject({
      id: 'EXPERIMENT_RESULT_MISSING_EXPERIMENT_ID',
    });
  });

  // ---------------------------------------------------------------------------
  // Ownership gates: reject child records that belong to a different dataset
  // even when the caller holds a valid handle to the current dataset.
  // ---------------------------------------------------------------------------

  it('getItem returns null when the item belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherItem = await datasetsStorage.addItem({ datasetId: other.id, input: { x: 1 } });
    const leaked = await ds.getItem({ itemId: otherItem.id });
    expect(leaked).toBeNull();
  });

  it('getItemHistory filters out rows that belong to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherItem = await datasetsStorage.addItem({ datasetId: other.id, input: { x: 1 } });
    const rows = await ds.getItemHistory({ itemId: otherItem.id });
    expect(rows).toEqual([]);
  });

  it('getExperiment returns null when the experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    const leaked = await ds.getExperiment({ experimentId: otherExp.id });
    expect(leaked).toBeNull();
  });

  it('deleteExperiment throws NOT_FOUND when the experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    await expect(ds.deleteExperiment({ experimentId: otherExp.id })).rejects.toMatchObject({
      id: 'EXPERIMENT_NOT_FOUND',
    });
    // Original experiment should still exist under its true dataset
    const stillThere = await experimentsStorage.getExperimentById({ id: otherExp.id });
    expect(stillThere?.id).toBe(otherExp.id);
  });

  it('listExperimentResults throws NOT_FOUND when experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    await expect(ds.listExperimentResults({ experimentId: otherExp.id })).rejects.toMatchObject({
      id: 'EXPERIMENT_NOT_FOUND',
    });
  });

  it('updateExperimentResult throws when experiment belongs to a different dataset', async () => {
    const other = await datasetsStorage.createDataset({ name: 'Other DS' });
    const otherExp = await experimentsStorage.createExperiment({
      datasetId: other.id,
      datasetVersion: 0,
      targetType: 'agent',
      targetId: 'inline',
      totalItems: 0,
    });
    await expect(
      ds.updateExperimentResult({ id: 'any-result-id', experimentId: otherExp.id, status: 'reviewed' }),
    ).rejects.toMatchObject({
      id: 'EXPERIMENT_NOT_FOUND',
    });
  });

  it('updateExperimentResult rejects when called without experimentId', async () => {
    await expect(
      // Runtime guard for JS callers that bypass the type narrowing
      (ds.updateExperimentResult as (input: { id: string; status: string }) => Promise<unknown>)({
        id: 'any-result-id',
        status: 'reviewed',
      }),
    ).rejects.toMatchObject({
      id: 'EXPERIMENT_RESULT_MISSING_EXPERIMENT_ID',
    });
  });
});

import { createClient } from '@libsql/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExperimentsLibSQL } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_DB_URL = 'file::memory:?cache=shared';

describe('ExperimentsLibSQL', () => {
  let storage: ExperimentsLibSQL;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    storage = new ExperimentsLibSQL({ client });
    await storage.init();
  });

  afterEach(async () => {
    await storage.dangerouslyClearAll();
  });

  // ------------- Experiment CRUD -------------
  describe('createExperiment', () => {
    it('creates experiment with pending status', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 10,
      });

      expect(experiment.id).toBeDefined();
      expect(experiment.status).toBe('pending');
      expect(experiment.succeededCount).toBe(0);
      expect(experiment.failedCount).toBe(0);
      expect(experiment.startedAt).toBeNull();
      expect(experiment.completedAt).toBeNull();
    });

    it('stores datasetVersion as integer', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 5,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
      });

      expect(experiment.datasetVersion).toBe(5);
      expect(typeof experiment.datasetVersion).toBe('number');

      // Verify via getExperimentById round-trip
      const fetched = await storage.getExperimentById({ id: experiment.id });
      expect(fetched!.datasetVersion).toBe(5);
    });

    it('creates experiment with null datasetId and datasetVersion (inline)', async () => {
      const experiment = await storage.createExperiment({
        datasetId: null,
        datasetVersion: null,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 3,
      });

      expect(experiment.id).toBeDefined();
      expect(experiment.datasetId).toBeNull();
      expect(experiment.datasetVersion).toBeNull();

      // Round-trip
      const fetched = await storage.getExperimentById({ id: experiment.id });
      expect(fetched!.datasetId).toBeNull();
      expect(fetched!.datasetVersion).toBeNull();
    });

    it('uses provided id if given', async () => {
      const experiment = await storage.createExperiment({
        id: 'custom-experiment-id',
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'workflow',
        targetId: 'wf-1',
        totalItems: 5,
      });

      expect(experiment.id).toBe('custom-experiment-id');
    });
  });

  // ------------- updateExperiment (F2 fix) -------------
  describe('updateExperiment', () => {
    it('updates status and counts', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 10,
      });

      const updated = await storage.updateExperiment({
        id: experiment.id,
        status: 'completed',
        succeededCount: 8,
        failedCount: 2,
        completedAt: new Date(),
      });

      expect(updated.status).toBe('completed');
      expect(updated.succeededCount).toBe(8);
      expect(updated.failedCount).toBe(2);
      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it('returns complete object with name, description, metadata, skippedCount (F2 fix)', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        name: 'Test Experiment',
        description: 'A test',
        metadata: { key: 'value' },
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 5,
      });

      const updated = await storage.updateExperiment({
        id: experiment.id,
        status: 'running',
        skippedCount: 1,
      });

      // F2: these fields must be present in the returned object
      expect(updated.name).toBe('Test Experiment');
      expect(updated.description).toBe('A test');
      expect(updated.metadata).toEqual({ key: 'value' });
      expect(updated.skippedCount).toBe(1);
    });

    it('throws for non-existent experiment', async () => {
      await expect(storage.updateExperiment({ id: 'non-existent', status: 'running' })).rejects.toThrow();
    });
  });

  // ------------- getExperimentById -------------
  describe('getExperimentById', () => {
    it('returns experiment by id', async () => {
      const created = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 5,
      });

      const fetched = await storage.getExperimentById({ id: created.id });
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.datasetVersion).toBe(1);
    });

    it('returns null for non-existent id', async () => {
      const result = await storage.getExperimentById({ id: 'does-not-exist' });
      expect(result).toBeNull();
    });
  });

  // ------------- listExperiments -------------
  describe('listExperiments', () => {
    it('lists all experiments', async () => {
      await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      await storage.createExperiment({
        datasetId: 'ds-2',
        datasetVersion: 2,
        targetType: 'workflow',
        targetId: 'w1',
        totalItems: 2,
      });

      const result = await storage.listExperiments({ pagination: { page: 0, perPage: 10 } });
      expect(result.experiments).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('filters by datasetId', async () => {
      await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      await storage.createExperiment({
        datasetId: 'ds-2',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.listExperiments({
        datasetId: 'ds-1',
        pagination: { page: 0, perPage: 10 },
      });
      expect(result.experiments).toHaveLength(1);
      expect(result.experiments[0].datasetId).toBe('ds-1');
    });

    it('respects pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.createExperiment({
          datasetId: 'ds-1',
          datasetVersion: 1,
          targetType: 'agent',
          targetId: `a${i}`,
          totalItems: 1,
        });
      }

      const page0 = await storage.listExperiments({ pagination: { page: 0, perPage: 2 } });
      expect(page0.experiments).toHaveLength(2);
      expect(page0.pagination.total).toBe(5);

      const page1 = await storage.listExperiments({ pagination: { page: 1, perPage: 2 } });
      expect(page1.experiments).toHaveLength(2);
    });
  });

  // ------------- deleteExperiment -------------
  describe('deleteExperiment', () => {
    it('deletes experiment and its results', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemDatasetVersion: 1,
        input: { prompt: 'test' },
        output: { response: 'result' },
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      await storage.deleteExperiment({ id: experiment.id });

      expect(await storage.getExperimentById({ id: experiment.id })).toBeNull();
      const results = await storage.listExperimentResults({
        experimentId: experiment.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(results.results).toHaveLength(0);
    });
  });

  // ------------- addExperimentResult -------------
  describe('addExperimentResult', () => {
    it('adds result with itemDatasetVersion as integer', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemDatasetVersion: 3,
        input: { prompt: 'Hello' },
        output: { text: 'Hi there' },
        groundTruth: { text: 'Hello!' },
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      expect(result.id).toBeDefined();
      expect(result.itemDatasetVersion).toBe(3);

      // Round-trip
      const fetched = await storage.getExperimentResultById({ id: result.id });
      expect(fetched!.itemDatasetVersion).toBe(3);
    });

    it('stores null itemDatasetVersion', async () => {
      const experiment = await storage.createExperiment({
        datasetId: null,
        datasetVersion: null,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemDatasetVersion: null,
        input: 'x',
        output: 'y',
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      expect(result.itemDatasetVersion).toBeNull();

      // Round-trip
      const fetched = await storage.getExperimentResultById({ id: result.id });
      expect(fetched!.itemDatasetVersion).toBeNull();
    });

    it('stores error for failed item', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemDatasetVersion: 1,
        input: { prompt: 'test' },
        output: null,
        groundTruth: null,
        error: { message: 'Agent timeout' },
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 2,
      });

      expect(result.error).toEqual({ message: 'Agent timeout' });
      expect(result.retryCount).toBe(2);
    });
  });

  // ------------- listExperimentResults -------------
  describe('listExperimentResults', () => {
    it('lists results for an experiment', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemDatasetVersion: 1,
        input: 'a',
        output: 'b',
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });
      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-2',
        itemDatasetVersion: 1,
        input: 'c',
        output: 'd',
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      const result = await storage.listExperimentResults({
        experimentId: experiment.id,
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.results).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('returns empty for non-existent experiment', async () => {
      const result = await storage.listExperimentResults({
        experimentId: 'non-existent',
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.results).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  // ------------- deleteExperimentResults -------------
  describe('deleteExperimentResults', () => {
    it('deletes all results for an experiment', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemDatasetVersion: 1,
        input: 'a',
        output: 'b',
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      await storage.deleteExperimentResults({ experimentId: experiment.id });

      const result = await storage.listExperimentResults({
        experimentId: experiment.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(result.results).toHaveLength(0);
    });
  });

  // ------------- Indexes (T4.11, T4.12) -------------
  describe('indexes', () => {
    it('creates indexes on init', async () => {
      // Just verify init doesn't throw — indexes created in beforeEach
      const rows = await client.execute({
        sql: `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('mastra_experiments', 'mastra_experiment_results')`,
        args: [],
      });

      const indexNames = rows.rows.map(r => r.name as string);
      expect(indexNames).toContain('idx_experiments_datasetid');
      expect(indexNames).toContain('idx_experiment_results_experimentid');
      expect(indexNames).toContain('idx_experiment_results_exp_item');
    });
  });
});

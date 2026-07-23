import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../../inmemory-db';
import { ExperimentsInMemory } from '../inmemory';

describe('ExperimentsInMemory', () => {
  let storage: ExperimentsInMemory;
  let db: InMemoryDB;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new ExperimentsInMemory({ db });
  });

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
      expect(experiment.executionStatusCounts).toEqual({ completed: 0, skipped: 0, error: 0, cancelled: 0 });
      expect(experiment.scorerStatusCounts).toEqual({ completed: 0, error: 0 });
      expect(experiment.thresholds).toEqual([]);
      expect(experiment.succeededCount).toBe(0);
      expect(experiment.failedCount).toBe(0);
      expect(experiment.startedAt).toBeNull();
      expect(experiment.completedAt).toBeNull();
    });

    it('snapshots threshold bindings on creation', async () => {
      const thresholds = [
        { scorerId: 'quality', threshold: { min: 0.7, max: 0.9 }, targetScope: 'span' as const },
        { scorerId: 'style', threshold: 0.6, targetScope: 'span' as const, stepId: 'draft' },
      ];
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'workflow',
        targetId: 'workflow-1',
        totalItems: 1,
        thresholds,
      });

      (thresholds[0]!.threshold as { min: number }).min = 0;
      expect(experiment.thresholds).toEqual([
        { scorerId: 'quality', threshold: { min: 0.7, max: 0.9 }, targetScope: 'span' },
        { scorerId: 'style', threshold: 0.6, targetScope: 'span', stepId: 'draft' },
      ]);
      expect((await storage.getExperimentById({ id: experiment.id }))?.thresholds).toEqual(experiment.thresholds);
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
      expect(experiment.status).toBe('pending');
    });
  });

  describe('updateExperiment', () => {
    it('updates status to running', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 3,
      });

      const updated = await storage.updateExperiment({
        id: experiment.id,
        status: 'running',
        startedAt: new Date(),
      });

      expect(updated.status).toBe('running');
      expect(updated.startedAt).toBeInstanceOf(Date);
    });

    it('updates counts and status to completed', async () => {
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
        executionStatusCounts: { completed: 8, skipped: 0, error: 1, cancelled: 1 },
        scorerStatusCounts: { completed: 16, error: 2 },
        succeededCount: 8,
        failedCount: 2,
        completedAt: new Date(),
      });

      expect(updated.status).toBe('completed');
      expect(updated.executionStatusCounts).toEqual({ completed: 8, skipped: 0, error: 1, cancelled: 1 });
      expect(updated.scorerStatusCounts).toEqual({ completed: 16, error: 2 });
      expect(updated.succeededCount).toBe(8);
      expect(updated.failedCount).toBe(2);
      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it('derives target status counts from legacy-only updates', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 4,
      });

      const updated = await storage.updateExperiment({
        id: experiment.id,
        succeededCount: 1,
        failedCount: 2,
        skippedCount: 1,
      });

      expect(updated.executionStatusCounts).toEqual({ completed: 1, skipped: 1, error: 2, cancelled: 0 });
    });

    it('returns complete object with name, description, metadata, skippedCount', async () => {
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

      expect(updated.name).toBe('Test Experiment');
      expect(updated.description).toBe('A test');
      expect(updated.metadata).toEqual({ key: 'value' });
      expect(updated.skippedCount).toBe(1);
    });

    it('throws for non-existent experiment', async () => {
      await expect(storage.updateExperiment({ id: 'non-existent', status: 'running' })).rejects.toThrow(
        'Experiment not found',
      );
    });
  });

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
    });

    it('normalizes historical rows without inventing scorer counts or thresholds', async () => {
      const created = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 4,
      });
      db.experiments.set(created.id, {
        ...created,
        succeededCount: 1,
        failedCount: 2,
        skippedCount: 1,
        executionStatusCounts: null,
        scorerStatusCounts: null,
        thresholds: null,
      });

      const fetched = await storage.getExperimentById({ id: created.id });
      expect(fetched?.executionStatusCounts).toEqual({ completed: 1, skipped: 1, error: 2, cancelled: 0 });
      expect(fetched?.scorerStatusCounts).toBeNull();
      expect(fetched?.thresholds).toBeNull();
    });

    it('returns null for non-existent id', async () => {
      const result = await storage.getExperimentById({ id: 'does-not-exist' });
      expect(result).toBeNull();
    });
  });

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

    it('sorts by createdAt descending', async () => {
      const exp1 = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      const exp2 = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.listExperiments({ pagination: { page: 0, perPage: 10 } });
      expect(result.experiments[0].id).toBe(exp2.id); // Most recent first
      expect(result.experiments[1].id).toBe(exp1.id);
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

  describe('addExperimentResult', () => {
    it('adds result with all fields', async () => {
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
        executionStatus: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      expect(result.id).toBeDefined();
      expect(result.experimentId).toBe(experiment.id);
      expect(result.itemDatasetVersion).toBe(3);
      expect(result.input).toEqual({ prompt: 'Hello' });
      expect(result.output).toEqual({ text: 'Hi there' });
      expect(result.executionStatus).toBe('completed');
    });

    it('stores itemDatasetVersion as integer', async () => {
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
        input: 'x',
        output: 'y',
        groundTruth: null,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      expect(result.itemDatasetVersion).toBe(3);
      expect(typeof result.itemDatasetVersion).toBe('number');
      expect(result.executionStatus).toBeNull();
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
      expect(result.output).toBeNull();
      expect(result.retryCount).toBe(2);
    });
  });

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
});

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
        datasetVersion: new Date('2024-01-01'),
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

    it('uses provided id if given', async () => {
      const experiment = await storage.createExperiment({
        id: 'custom-experiment-id',
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'workflow',
        targetId: 'wf-1',
        totalItems: 5,
      });

      expect(experiment.id).toBe('custom-experiment-id');
    });

    it('stores datasetVersion as Date', async () => {
      const version = new Date('2024-06-15T10:30:00Z');
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: version,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
      });

      expect(experiment.datasetVersion).toBeInstanceOf(Date);
      expect(experiment.datasetVersion.getTime()).toBe(version.getTime());
    });
  });

  describe('updateExperiment', () => {
    it('updates status to running', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
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
        datasetVersion: new Date(),
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
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 5,
      });

      const fetched = await storage.getExperimentById({ id: created.id });
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
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
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      await storage.createExperiment({
        datasetId: 'ds-2',
        datasetVersion: new Date(),
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
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      await storage.createExperiment({
        datasetId: 'ds-2',
        datasetVersion: new Date(),
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
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      const exp2 = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
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
          datasetVersion: new Date(),
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
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: { prompt: 'test' },
        output: { response: 'result' },
        groundTruth: null,
        latency: 100,
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
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemVersion: new Date('2024-01-01'),
        input: { prompt: 'Hello' },
        output: { text: 'Hi there' },
        groundTruth: { text: 'Hello!' },
        latency: 150.5,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      expect(result.id).toBeDefined();
      expect(result.experimentId).toBe(experiment.id);
      expect(result.input).toEqual({ prompt: 'Hello' });
      expect(result.output).toEqual({ text: 'Hi there' });
      expect(result.latency).toBe(150.5);
    });

    it('stores error for failed item', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: { prompt: 'test' },
        output: null,
        groundTruth: null,
        latency: 50,
        error: 'Agent timeout',
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 2,
      });

      expect(result.error).toBe('Agent timeout');
      expect(result.output).toBeNull();
      expect(result.retryCount).toBe(2);
    });
  });

  describe('listExperimentResults', () => {
    it('lists results for an experiment', async () => {
      const experiment = await storage.createExperiment({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: 'a',
        output: 'b',
        groundTruth: null,
        latency: 100,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });
      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-2',
        itemVersion: new Date(),
        input: 'c',
        output: 'd',
        groundTruth: null,
        latency: 200,
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
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addExperimentResult({
        experimentId: experiment.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: 'a',
        output: 'b',
        groundTruth: null,
        latency: 100,
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

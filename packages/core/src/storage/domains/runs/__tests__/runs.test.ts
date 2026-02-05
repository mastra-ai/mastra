import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../../inmemory-db';
import { RunsInMemory } from '../inmemory';

describe('RunsInMemory', () => {
  let storage: RunsInMemory;
  let db: InMemoryDB;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new RunsInMemory({ db });
  });

  describe('createRun', () => {
    it('creates run with pending status', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date('2024-01-01'),
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 10,
      });

      expect(run.id).toBeDefined();
      expect(run.status).toBe('pending');
      expect(run.succeededCount).toBe(0);
      expect(run.failedCount).toBe(0);
      expect(run.startedAt).toBeNull();
      expect(run.completedAt).toBeNull();
    });

    it('uses provided id if given', async () => {
      const run = await storage.createRun({
        id: 'custom-run-id',
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'workflow',
        targetId: 'wf-1',
        totalItems: 5,
      });

      expect(run.id).toBe('custom-run-id');
    });

    it('stores datasetVersion as Date', async () => {
      const version = new Date('2024-06-15T10:30:00Z');
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: version,
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
      });

      expect(run.datasetVersion).toBeInstanceOf(Date);
      expect(run.datasetVersion.getTime()).toBe(version.getTime());
    });
  });

  describe('updateRun', () => {
    it('updates status to running', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 3,
      });

      const updated = await storage.updateRun({
        id: run.id,
        status: 'running',
        startedAt: new Date(),
      });

      expect(updated.status).toBe('running');
      expect(updated.startedAt).toBeInstanceOf(Date);
    });

    it('updates counts and status to completed', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 10,
      });

      const updated = await storage.updateRun({
        id: run.id,
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

    it('throws for non-existent run', async () => {
      await expect(storage.updateRun({ id: 'non-existent', status: 'running' })).rejects.toThrow('Run not found');
    });
  });

  describe('getRunById', () => {
    it('returns run by id', async () => {
      const created = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 5,
      });

      const fetched = await storage.getRunById({ id: created.id });
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
    });

    it('returns null for non-existent id', async () => {
      const result = await storage.getRunById({ id: 'does-not-exist' });
      expect(result).toBeNull();
    });
  });

  describe('listRuns', () => {
    it('lists all runs', async () => {
      await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      await storage.createRun({
        datasetId: 'ds-2',
        datasetVersion: new Date(),
        targetType: 'workflow',
        targetId: 'w1',
        totalItems: 2,
      });

      const result = await storage.listRuns({ pagination: { page: 0, perPage: 10 } });
      expect(result.runs).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('filters by datasetId', async () => {
      await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      await storage.createRun({
        datasetId: 'ds-2',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.listRuns({
        datasetId: 'ds-1',
        pagination: { page: 0, perPage: 10 },
      });
      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].datasetId).toBe('ds-1');
    });

    it('sorts by createdAt descending', async () => {
      const run1 = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      const run2 = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.listRuns({ pagination: { page: 0, perPage: 10 } });
      expect(result.runs[0].id).toBe(run2.id); // Most recent first
      expect(result.runs[1].id).toBe(run1.id);
    });

    it('respects pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.createRun({
          datasetId: 'ds-1',
          datasetVersion: new Date(),
          targetType: 'agent',
          targetId: `a${i}`,
          totalItems: 1,
        });
      }

      const page0 = await storage.listRuns({ pagination: { page: 0, perPage: 2 } });
      expect(page0.runs).toHaveLength(2);
      expect(page0.pagination.total).toBe(5);

      const page1 = await storage.listRuns({ pagination: { page: 1, perPage: 2 } });
      expect(page1.runs).toHaveLength(2);
    });
  });

  describe('deleteRun', () => {
    it('deletes run and its results', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addResult({
        runId: run.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: { prompt: 'test' },
        output: { response: 'result' },
        expectedOutput: null,
        latency: 100,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      await storage.deleteRun({ id: run.id });

      expect(await storage.getRunById({ id: run.id })).toBeNull();
      const results = await storage.listResults({
        runId: run.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(results.results).toHaveLength(0);
    });
  });

  describe('addResult', () => {
    it('adds result with all fields', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.addResult({
        runId: run.id,
        itemId: 'item-1',
        itemVersion: new Date('2024-01-01'),
        input: { prompt: 'Hello' },
        output: { text: 'Hi there' },
        expectedOutput: { text: 'Hello!' },
        latency: 150.5,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      expect(result.id).toBeDefined();
      expect(result.runId).toBe(run.id);
      expect(result.input).toEqual({ prompt: 'Hello' });
      expect(result.output).toEqual({ text: 'Hi there' });
      expect(result.latency).toBe(150.5);
    });

    it('stores error for failed item', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 1,
      });

      const result = await storage.addResult({
        runId: run.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: { prompt: 'test' },
        output: null,
        expectedOutput: null,
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

  describe('listResults', () => {
    it('lists results for a run', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addResult({
        runId: run.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: 'a',
        output: 'b',
        expectedOutput: null,
        latency: 100,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });
      await storage.addResult({
        runId: run.id,
        itemId: 'item-2',
        itemVersion: new Date(),
        input: 'c',
        output: 'd',
        expectedOutput: null,
        latency: 200,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      const result = await storage.listResults({
        runId: run.id,
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.results).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('returns empty for non-existent run', async () => {
      const result = await storage.listResults({
        runId: 'non-existent',
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.results).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('deleteResultsByRunId', () => {
    it('deletes all results for a run', async () => {
      const run = await storage.createRun({
        datasetId: 'ds-1',
        datasetVersion: new Date(),
        targetType: 'agent',
        targetId: 'a1',
        totalItems: 2,
      });

      await storage.addResult({
        runId: run.id,
        itemId: 'item-1',
        itemVersion: new Date(),
        input: 'a',
        output: 'b',
        expectedOutput: null,
        latency: 100,
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      await storage.deleteResultsByRunId({ runId: run.id });

      const result = await storage.listResults({
        runId: run.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(result.results).toHaveLength(0);
    });
  });
});

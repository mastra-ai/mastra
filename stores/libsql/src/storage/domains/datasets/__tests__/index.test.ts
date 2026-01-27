import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { DatasetsLibSQL } from '../index';

// ============================================================================
// Setup
// ============================================================================

let client: Client;
let storage: DatasetsLibSQL;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  storage = new DatasetsLibSQL({ client });
  await storage.init();
});

afterAll(async () => {
  client.close();
});

beforeEach(async () => {
  await storage.dangerouslyClearAll();
});

// ============================================================================
// Dataset Tests
// ============================================================================

describe('Datasets', () => {
  describe('createDataset', () => {
    it('creates with generated ID and timestamps', async () => {
      const dataset = await storage.createDataset({
        name: 'test-dataset',
        description: 'A test dataset',
        metadata: { key: 'value' },
      });

      expect(dataset.id).toBeDefined();
      expect(typeof dataset.id).toBe('string');
      expect(dataset.name).toBe('test-dataset');
      expect(dataset.description).toBe('A test dataset');
      expect(dataset.metadata).toEqual({ key: 'value' });
      expect(dataset.createdAt).toBeInstanceOf(Date);
      expect(dataset.updatedAt).toBeInstanceOf(Date);
    });

    it('persists dataset to database', async () => {
      const created = await storage.createDataset({ name: 'persisted-dataset' });
      const found = await storage.getDatasetById({ id: created.id });
      expect(found).not.toBeNull();
      expect(found?.name).toBe('persisted-dataset');
    });
  });

  describe('getDatasetById', () => {
    it('returns dataset when found', async () => {
      const created = await storage.createDataset({ name: 'find-me' });
      const found = await storage.getDatasetById({ id: created.id });
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('find-me');
    });

    it('returns null when not found', async () => {
      const found = await storage.getDatasetById({ id: 'nonexistent-id' });
      expect(found).toBeNull();
    });
  });

  describe('getDatasetByName', () => {
    it('returns dataset when found', async () => {
      const created = await storage.createDataset({ name: 'unique-name' });
      const found = await storage.getDatasetByName({ name: 'unique-name' });
      expect(found?.id).toBe(created.id);
    });

    it('returns null when not found', async () => {
      const found = await storage.getDatasetByName({ name: 'nonexistent-name' });
      expect(found).toBeNull();
    });

    it('returns correct dataset when multiple exist', async () => {
      await storage.createDataset({ name: 'first-dataset' });
      const target = await storage.createDataset({ name: 'target-dataset' });
      await storage.createDataset({ name: 'third-dataset' });

      const found = await storage.getDatasetByName({ name: 'target-dataset' });
      expect(found?.id).toBe(target.id);
    });
  });

  describe('updateDataset', () => {
    it('merges payload and updates timestamp', async () => {
      const created = await storage.createDataset({
        name: 'original-name',
        description: 'original-desc',
        metadata: { original: true },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await storage.updateDataset({
        id: created.id,
        payload: {
          name: 'updated-name',
          metadata: { updated: true },
        },
      });

      expect(updated.name).toBe('updated-name');
      expect(updated.description).toBe('original-desc');
      expect(updated.metadata).toEqual({ updated: true });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

      // Verify persistence
      const found = await storage.getDatasetById({ id: created.id });
      expect(found?.name).toBe('updated-name');
    });

    it('throws error when dataset not found', async () => {
      await expect(storage.updateDataset({ id: 'nonexistent', payload: { name: 'new' } })).rejects.toThrow(
        'Dataset not found: nonexistent',
      );
    });
  });

  describe('deleteDataset', () => {
    it('removes dataset from database', async () => {
      const created = await storage.createDataset({ name: 'to-delete' });
      expect(await storage.getDatasetById({ id: created.id })).not.toBeNull();

      await storage.deleteDataset({ id: created.id });
      expect(await storage.getDatasetById({ id: created.id })).toBeNull();
    });

    it('does not throw when deleting nonexistent dataset', async () => {
      await expect(storage.deleteDataset({ id: 'nonexistent' })).resolves.toBeUndefined();
    });
  });

  describe('listDatasets', () => {
    it('returns paginated results', async () => {
      await storage.createDataset({ name: 'dataset-1' });
      await storage.createDataset({ name: 'dataset-2' });
      await storage.createDataset({ name: 'dataset-3' });

      const result = await storage.listDatasets({ page: 0, perPage: 2 });

      expect(result.datasets).toHaveLength(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(0);
      expect(result.pagination.perPage).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('returns empty array when no datasets', async () => {
      const result = await storage.listDatasets({ page: 0, perPage: 10 });

      expect(result.datasets).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('handles perPage: false to return all', async () => {
      await storage.createDataset({ name: 'dataset-1' });
      await storage.createDataset({ name: 'dataset-2' });
      await storage.createDataset({ name: 'dataset-3' });

      const result = await storage.listDatasets({ page: 0, perPage: false });

      expect(result.datasets).toHaveLength(3);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
});

// ============================================================================
// Dataset Item Tests
// ============================================================================

describe('DatasetItems', () => {
  let datasetId: string;

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
    const dataset = await storage.createDataset({ name: 'items-test-dataset' });
    datasetId = dataset.id;
  });

  describe('createDatasetItem', () => {
    it('creates with all fields', async () => {
      const item = await storage.createDatasetItem({
        datasetId,
        input: { prompt: 'Hello' },
        expectedOutput: { response: 'World' },
        metadata: { category: 'greeting' },
      });

      expect(item.id).toBeDefined();
      expect(item.datasetId).toBe(datasetId);
      expect(item.input).toEqual({ prompt: 'Hello' });
      expect(item.expectedOutput).toEqual({ response: 'World' });
      expect(item.metadata).toEqual({ category: 'greeting' });
      expect(item.archivedAt).toBeNull();
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
    });

    it('persists item to database', async () => {
      const item = await storage.createDatasetItem({
        datasetId,
        input: 'test',
      });
      const found = await storage.getDatasetItemById({ id: item.id });
      expect(found).not.toBeNull();
      expect(found?.input).toBe('test');
    });
  });

  describe('createDatasetItems', () => {
    it('bulk creates multiple items', async () => {
      const items = await storage.createDatasetItems([
        { datasetId, input: 'input-1' },
        { datasetId, input: 'input-2' },
        { datasetId, input: 'input-3' },
      ]);

      expect(items).toHaveLength(3);
      expect(items[0].input).toBe('input-1');
      expect(items[1].input).toBe('input-2');
      expect(items[2].input).toBe('input-3');

      // Verify persistence
      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 10 } });
      expect(result.items).toHaveLength(3);
    });

    it('returns empty array for empty input', async () => {
      const items = await storage.createDatasetItems([]);
      expect(items).toEqual([]);
    });
  });

  describe('getDatasetItemById', () => {
    it('returns item when found', async () => {
      const created = await storage.createDatasetItem({
        datasetId,
        input: 'find-me',
      });
      const found = await storage.getDatasetItemById({ id: created.id });
      expect(found?.id).toBe(created.id);
      expect(found?.input).toBe('find-me');
    });

    it('returns null when not found', async () => {
      const found = await storage.getDatasetItemById({ id: 'nonexistent' });
      expect(found).toBeNull();
    });
  });

  describe('updateDatasetItem', () => {
    it('merges payload and updates timestamp', async () => {
      const created = await storage.createDatasetItem({
        datasetId,
        input: 'original-input',
        expectedOutput: 'original-output',
        metadata: { original: true },
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await storage.updateDatasetItem({
        id: created.id,
        payload: {
          input: 'updated-input',
          metadata: { updated: true },
        },
      });

      expect(updated.input).toBe('updated-input');
      expect(updated.expectedOutput).toBe('original-output');
      expect(updated.metadata).toEqual({ updated: true });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

      // Verify persistence
      const found = await storage.getDatasetItemById({ id: created.id });
      expect(found?.input).toBe('updated-input');
    });

    it('throws error when item not found', async () => {
      await expect(storage.updateDatasetItem({ id: 'nonexistent', payload: { input: 'new' } })).rejects.toThrow(
        'DatasetItem not found: nonexistent',
      );
    });
  });

  describe('archiveDatasetItem', () => {
    it('sets archivedAt timestamp', async () => {
      const created = await storage.createDatasetItem({
        datasetId,
        input: 'to-archive',
      });

      expect(created.archivedAt).toBeNull();

      await storage.archiveDatasetItem({ id: created.id });

      const archived = await storage.getDatasetItemById({ id: created.id });
      expect(archived?.archivedAt).toBeInstanceOf(Date);
    });

    it('throws error when item not found', async () => {
      await expect(storage.archiveDatasetItem({ id: 'nonexistent' })).rejects.toThrow(
        'DatasetItem not found: nonexistent',
      );
    });
  });

  describe('listDatasetItems', () => {
    it('filters by datasetId', async () => {
      const otherDataset = await storage.createDataset({ name: 'other-dataset' });
      await storage.createDatasetItem({ datasetId, input: 'item-1' });
      await storage.createDatasetItem({ datasetId, input: 'item-2' });
      await storage.createDatasetItem({ datasetId: otherDataset.id, input: 'other-item' });

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 10 } });

      expect(result.items).toHaveLength(2);
      expect(result.items.every(item => item.datasetId === datasetId)).toBe(true);
    });

    it('excludes archived items by default', async () => {
      await storage.createDatasetItem({ datasetId, input: 'active-item' });
      const toArchive = await storage.createDatasetItem({ datasetId, input: 'to-archive' });
      await storage.archiveDatasetItem({ id: toArchive.id });

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 10 } });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].input).toBe('active-item');
    });

    it('includes archived items when includeArchived is true', async () => {
      await storage.createDatasetItem({ datasetId, input: 'active-item' });
      const toArchive = await storage.createDatasetItem({ datasetId, input: 'archived-item' });
      await storage.archiveDatasetItem({ id: toArchive.id });

      const result = await storage.listDatasetItems({
        options: { datasetId, includeArchived: true },
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.items).toHaveLength(2);
    });

    describe('asOf point-in-time query', () => {
      it('returns items that existed at asOf time', async () => {
        const beforeCreate = new Date();
        await new Promise(resolve => setTimeout(resolve, 50));

        await storage.createDatasetItem({ datasetId, input: 'item-after' });

        const afterCreate = new Date();

        // Query for items at time before creation
        const resultBefore = await storage.listDatasetItems({
          options: { datasetId, asOf: beforeCreate },
          pagination: { page: 0, perPage: 10 },
        });
        expect(resultBefore.items).toHaveLength(0);

        // Query for items at time after creation
        const resultAfter = await storage.listDatasetItems({
          options: { datasetId, asOf: afterCreate },
          pagination: { page: 0, perPage: 10 },
        });
        expect(resultAfter.items).toHaveLength(1);
      });

      it('excludes items archived before asOf time', async () => {
        const item = await storage.createDatasetItem({ datasetId, input: 'item-to-archive' });
        await new Promise(resolve => setTimeout(resolve, 50));

        const beforeArchive = new Date();
        await new Promise(resolve => setTimeout(resolve, 50));

        await storage.archiveDatasetItem({ id: item.id });
        await new Promise(resolve => setTimeout(resolve, 50));

        const afterArchive = new Date();

        // Query before archiving - should include item
        const resultBefore = await storage.listDatasetItems({
          options: { datasetId, asOf: beforeArchive },
          pagination: { page: 0, perPage: 10 },
        });
        expect(resultBefore.items).toHaveLength(1);

        // Query after archiving - should exclude item
        const resultAfter = await storage.listDatasetItems({
          options: { datasetId, asOf: afterArchive },
          pagination: { page: 0, perPage: 10 },
        });
        expect(resultAfter.items).toHaveLength(0);
      });
    });
  });
});

// ============================================================================
// Dataset Run Tests
// ============================================================================

describe('DatasetRuns', () => {
  let datasetId: string;

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
    const dataset = await storage.createDataset({ name: 'runs-test-dataset' });
    datasetId = dataset.id;
  });

  describe('createDatasetRun', () => {
    it('creates with status pending', async () => {
      const run = await storage.createDatasetRun({
        datasetId,
        name: 'test-run',
        targetType: 'AGENT',
        targetId: 'my-agent',
        scorerIds: ['scorer-1', 'scorer-2'],
        itemCount: 100,
        metadata: { version: '1.0' },
      });

      expect(run.id).toBeDefined();
      expect(run.datasetId).toBe(datasetId);
      expect(run.name).toBe('test-run');
      expect(run.targetType).toBe('AGENT');
      expect(run.targetId).toBe('my-agent');
      expect(run.scorerIds).toEqual(['scorer-1', 'scorer-2']);
      expect(run.status).toBe('pending');
      expect(run.itemCount).toBe(100);
      expect(run.completedCount).toBe(0);
      expect(run.metadata).toEqual({ version: '1.0' });
      expect(run.createdAt).toBeInstanceOf(Date);
      expect(run.completedAt).toBeNull();
    });

    it('persists run to database', async () => {
      const run = await storage.createDatasetRun({
        datasetId,
        targetType: 'WORKFLOW',
        scorerIds: [],
        itemCount: 10,
      });
      const found = await storage.getDatasetRunById({ id: run.id });
      expect(found).not.toBeNull();
      expect(found?.targetType).toBe('WORKFLOW');
    });
  });

  describe('getDatasetRunById', () => {
    it('returns run when found', async () => {
      const created = await storage.createDatasetRun({
        datasetId,
        targetType: 'CUSTOM',
        scorerIds: [],
        itemCount: 5,
      });
      const found = await storage.getDatasetRunById({ id: created.id });
      expect(found?.id).toBe(created.id);
    });

    it('returns null when not found', async () => {
      const found = await storage.getDatasetRunById({ id: 'nonexistent' });
      expect(found).toBeNull();
    });
  });

  describe('updateDatasetRun', () => {
    it('updates status and completedCount', async () => {
      const created = await storage.createDatasetRun({
        datasetId,
        targetType: 'AGENT',
        scorerIds: [],
        itemCount: 10,
      });

      const updated = await storage.updateDatasetRun({
        id: created.id,
        payload: {
          status: 'running',
          completedCount: 5,
        },
      });

      expect(updated.status).toBe('running');
      expect(updated.completedCount).toBe(5);

      // Verify persistence
      const found = await storage.getDatasetRunById({ id: created.id });
      expect(found?.status).toBe('running');
      expect(found?.completedCount).toBe(5);
    });

    it('updates completedAt', async () => {
      const created = await storage.createDatasetRun({
        datasetId,
        targetType: 'AGENT',
        scorerIds: [],
        itemCount: 10,
      });

      const completedAt = new Date();
      const updated = await storage.updateDatasetRun({
        id: created.id,
        payload: {
          status: 'completed',
          completedCount: 10,
          completedAt,
        },
      });

      expect(updated.status).toBe('completed');
      expect(updated.completedCount).toBe(10);
      expect(updated.completedAt).toEqual(completedAt);

      // Verify persistence
      const found = await storage.getDatasetRunById({ id: created.id });
      expect(found?.completedAt).toBeInstanceOf(Date);
    });

    it('throws error when run not found', async () => {
      await expect(storage.updateDatasetRun({ id: 'nonexistent', payload: { status: 'running' } })).rejects.toThrow(
        'DatasetRun not found: nonexistent',
      );
    });
  });

  describe('listDatasetRuns', () => {
    it('filters by datasetId', async () => {
      const otherDataset = await storage.createDataset({ name: 'other' });
      await storage.createDatasetRun({ datasetId, targetType: 'AGENT', scorerIds: [], itemCount: 1 });
      await storage.createDatasetRun({ datasetId, targetType: 'AGENT', scorerIds: [], itemCount: 2 });
      await storage.createDatasetRun({ datasetId: otherDataset.id, targetType: 'AGENT', scorerIds: [], itemCount: 3 });

      const result = await storage.listDatasetRuns({ options: { datasetId }, pagination: { page: 0, perPage: 10 } });

      expect(result.runs).toHaveLength(2);
      expect(result.runs.every(run => run.datasetId === datasetId)).toBe(true);
    });

    it('filters by status', async () => {
      const run1 = await storage.createDatasetRun({ datasetId, targetType: 'AGENT', scorerIds: [], itemCount: 1 });
      await storage.createDatasetRun({ datasetId, targetType: 'AGENT', scorerIds: [], itemCount: 2 });

      await storage.updateDatasetRun({ id: run1.id, payload: { status: 'running' } });

      const result = await storage.listDatasetRuns({
        options: { status: 'running' },
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].status).toBe('running');
    });

    it('filters by both datasetId and status', async () => {
      const otherDataset = await storage.createDataset({ name: 'other' });
      const run1 = await storage.createDatasetRun({ datasetId, targetType: 'AGENT', scorerIds: [], itemCount: 1 });
      await storage.createDatasetRun({ datasetId, targetType: 'AGENT', scorerIds: [], itemCount: 2 });
      await storage.createDatasetRun({ datasetId: otherDataset.id, targetType: 'AGENT', scorerIds: [], itemCount: 3 });

      await storage.updateDatasetRun({ id: run1.id, payload: { status: 'completed' } });

      const result = await storage.listDatasetRuns({
        options: { datasetId, status: 'completed' },
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].datasetId).toBe(datasetId);
      expect(result.runs[0].status).toBe('completed');
    });

    it('returns all runs when no filters', async () => {
      await storage.createDatasetRun({ datasetId, targetType: 'AGENT', scorerIds: [], itemCount: 1 });
      await storage.createDatasetRun({ datasetId, targetType: 'WORKFLOW', scorerIds: [], itemCount: 2 });

      const result = await storage.listDatasetRuns({ options: {}, pagination: { page: 0, perPage: 10 } });

      expect(result.runs).toHaveLength(2);
    });
  });
});

// ============================================================================
// Dataset Run Result Tests
// ============================================================================

describe('DatasetRunResults', () => {
  let datasetId: string;
  let runId: string;
  let itemId: string;

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
    const dataset = await storage.createDataset({ name: 'results-test-dataset' });
    datasetId = dataset.id;

    const run = await storage.createDatasetRun({
      datasetId,
      targetType: 'AGENT',
      scorerIds: ['scorer-1'],
      itemCount: 10,
    });
    runId = run.id;

    const item = await storage.createDatasetItem({ datasetId, input: 'test-input' });
    itemId = item.id;
  });

  describe('createDatasetRunResult', () => {
    it('creates result with all fields', async () => {
      const result = await storage.createDatasetRunResult({
        runId,
        itemId,
        actualOutput: { response: 'Hello world' },
        traceId: 'trace-123',
        spanId: 'span-456',
        status: 'success',
        durationMs: 150,
      });

      expect(result.id).toBeDefined();
      expect(result.runId).toBe(runId);
      expect(result.itemId).toBe(itemId);
      expect(result.actualOutput).toEqual({ response: 'Hello world' });
      expect(result.traceId).toBe('trace-123');
      expect(result.spanId).toBe('span-456');
      expect(result.status).toBe('success');
      expect(result.durationMs).toBe(150);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('creates result with error status', async () => {
      const result = await storage.createDatasetRunResult({
        runId,
        itemId,
        actualOutput: { partial: 'data' },
        status: 'error',
        error: 'Something went wrong',
      });

      expect(result.status).toBe('error');
      expect(result.error).toBe('Something went wrong');
    });

    it('creates result with null actualOutput (error case)', async () => {
      const result = await storage.createDatasetRunResult({
        runId,
        itemId,
        actualOutput: null,
        status: 'error',
        error: 'Agent failed to respond',
      });

      expect(result.id).toBeDefined();
      expect(result.actualOutput).toBeNull();
      expect(result.status).toBe('error');
      expect(result.error).toBe('Agent failed to respond');

      // Verify it persists and can be read back
      const listed = await storage.listDatasetRunResults({ options: { runId }, pagination: { page: 0, perPage: 10 } });
      const found = listed.results.find(r => r.id === result.id);
      expect(found).toBeDefined();
      expect(found?.actualOutput).toBeNull();
    });

    it('persists result to database', async () => {
      const created = await storage.createDatasetRunResult({
        runId,
        itemId,
        actualOutput: 'test',
        status: 'success',
      });

      const results = await storage.listDatasetRunResults({ options: { runId }, pagination: { page: 0, perPage: 10 } });
      expect(results.results).toHaveLength(1);
      expect(results.results[0].id).toBe(created.id);
    });
  });

  describe('createDatasetRunResults', () => {
    it('bulk creates multiple results', async () => {
      const item2 = await storage.createDatasetItem({ datasetId, input: 'input-2' });
      const item3 = await storage.createDatasetItem({ datasetId, input: 'input-3' });

      const results = await storage.createDatasetRunResults([
        { runId, itemId, actualOutput: 'output-1', status: 'success' },
        { runId, itemId: item2.id, actualOutput: 'output-2', status: 'success' },
        { runId, itemId: item3.id, actualOutput: { partial: 'data' }, status: 'error', error: 'failed' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('success');
      expect(results[2].status).toBe('error');

      // Verify persistence
      const listed = await storage.listDatasetRunResults({ options: { runId }, pagination: { page: 0, perPage: 10 } });
      expect(listed.results).toHaveLength(3);
    });

    it('returns empty array for empty input', async () => {
      const results = await storage.createDatasetRunResults([]);
      expect(results).toEqual([]);
    });
  });

  describe('listDatasetRunResults', () => {
    it('filters by runId', async () => {
      const otherRun = await storage.createDatasetRun({
        datasetId,
        targetType: 'AGENT',
        scorerIds: [],
        itemCount: 5,
      });

      await storage.createDatasetRunResult({ runId, itemId, actualOutput: 'a', status: 'success' });
      await storage.createDatasetRunResult({ runId, itemId, actualOutput: 'b', status: 'success' });
      await storage.createDatasetRunResult({ runId: otherRun.id, itemId, actualOutput: 'c', status: 'success' });

      const result = await storage.listDatasetRunResults({ options: { runId }, pagination: { page: 0, perPage: 10 } });

      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.runId === runId)).toBe(true);
    });

    it('filters by status', async () => {
      await storage.createDatasetRunResult({ runId, itemId, actualOutput: 'a', status: 'success' });
      await storage.createDatasetRunResult({
        runId,
        itemId,
        actualOutput: { partial: 'data' },
        status: 'error',
        error: 'fail',
      });
      await storage.createDatasetRunResult({ runId, itemId, actualOutput: 'c', status: 'success' });

      const result = await storage.listDatasetRunResults({
        options: { runId, status: 'error' },
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('error');
    });

    it('filters by both runId and status', async () => {
      const otherRun = await storage.createDatasetRun({
        datasetId,
        targetType: 'AGENT',
        scorerIds: [],
        itemCount: 5,
      });

      await storage.createDatasetRunResult({ runId, itemId, actualOutput: 'a', status: 'success' });
      await storage.createDatasetRunResult({
        runId,
        itemId,
        actualOutput: { partial: 'data' },
        status: 'error',
        error: 'fail',
      });
      await storage.createDatasetRunResult({
        runId: otherRun.id,
        itemId,
        actualOutput: 'c',
        status: 'error',
        error: 'x',
      });

      const result = await storage.listDatasetRunResults({
        options: { runId, status: 'error' },
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].runId).toBe(runId);
      expect(result.results[0].status).toBe('error');
    });
  });
});

// ============================================================================
// Pagination Tests
// ============================================================================

describe('Pagination', () => {
  let datasetId: string;

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
    const dataset = await storage.createDataset({ name: 'pagination-test' });
    datasetId = dataset.id;
  });

  describe('total count', () => {
    it('returns correct total count for datasets', async () => {
      await storage.createDataset({ name: 'd1' });
      await storage.createDataset({ name: 'd2' });
      await storage.createDataset({ name: 'd3' });
      await storage.createDataset({ name: 'd4' });
      await storage.createDataset({ name: 'd5' });

      const result = await storage.listDatasets({ page: 0, perPage: 2 });

      // 6 total including the one from beforeEach
      expect(result.pagination.total).toBe(6);
      expect(result.datasets).toHaveLength(2);
    });

    it('returns correct total count for items', async () => {
      await storage.createDatasetItems([
        { datasetId, input: '1' },
        { datasetId, input: '2' },
        { datasetId, input: '3' },
        { datasetId, input: '4' },
      ]);

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 2 } });

      expect(result.pagination.total).toBe(4);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('hasMore flag', () => {
    it('returns hasMore: true when more results exist', async () => {
      await storage.createDatasetItems([
        { datasetId, input: '1' },
        { datasetId, input: '2' },
        { datasetId, input: '3' },
      ]);

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 2 } });

      expect(result.pagination.hasMore).toBe(true);
    });

    it('returns hasMore: false when no more results', async () => {
      await storage.createDatasetItems([
        { datasetId, input: '1' },
        { datasetId, input: '2' },
      ]);

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 10 } });

      expect(result.pagination.hasMore).toBe(false);
    });

    it('returns hasMore: false on last page', async () => {
      await storage.createDatasetItems([
        { datasetId, input: '1' },
        { datasetId, input: '2' },
        { datasetId, input: '3' },
      ]);

      // Page 1 (second page, 0-indexed) with perPage 2 should have 1 item
      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 1, perPage: 2 } });

      expect(result.pagination.hasMore).toBe(false);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('page/perPage logic', () => {
    it('returns correct items for page 0', async () => {
      await storage.createDatasetItems([
        { datasetId, input: '1' },
        { datasetId, input: '2' },
        { datasetId, input: '3' },
        { datasetId, input: '4' },
      ]);

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 2 } });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.page).toBe(0);
      expect(result.pagination.perPage).toBe(2);
    });

    it('returns correct items for page 1', async () => {
      await storage.createDatasetItems([
        { datasetId, input: '1' },
        { datasetId, input: '2' },
        { datasetId, input: '3' },
        { datasetId, input: '4' },
      ]);

      // Page 1 (second page, 0-indexed) should return 2 items
      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 1, perPage: 2 } });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
    });

    it('returns empty array for page beyond data', async () => {
      await storage.createDatasetItem({ datasetId, input: '1' });

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 5, perPage: 10 } });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(1);
    });

    it('handles perPage larger than total', async () => {
      await storage.createDatasetItems([
        { datasetId, input: '1' },
        { datasetId, input: '2' },
      ]);

      const result = await storage.listDatasetItems({ options: { datasetId }, pagination: { page: 0, perPage: 100 } });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
});

// ============================================================================
// dangerouslyClearAll Tests
// ============================================================================

describe('dangerouslyClearAll', () => {
  it('clears all dataset-related tables', async () => {
    // Create data in all tables
    const dataset = await storage.createDataset({ name: 'test' });
    const item = await storage.createDatasetItem({ datasetId: dataset.id, input: 'test' });
    const run = await storage.createDatasetRun({
      datasetId: dataset.id,
      targetType: 'AGENT',
      scorerIds: [],
      itemCount: 1,
    });
    await storage.createDatasetRunResult({
      runId: run.id,
      itemId: item.id,
      actualOutput: 'test',
      status: 'success',
    });

    // Verify data exists
    expect((await storage.listDatasets({ page: 0, perPage: 10 })).datasets).toHaveLength(1);
    expect(
      (await storage.listDatasetItems({ options: { datasetId: dataset.id }, pagination: { page: 0, perPage: 10 } }))
        .items,
    ).toHaveLength(1);
    expect((await storage.listDatasetRuns({ options: {}, pagination: { page: 0, perPage: 10 } })).runs).toHaveLength(1);
    expect(
      (await storage.listDatasetRunResults({ options: { runId: run.id }, pagination: { page: 0, perPage: 10 } }))
        .results,
    ).toHaveLength(1);

    // Clear all
    await storage.dangerouslyClearAll();

    // Verify all cleared
    expect((await storage.listDatasets({ page: 0, perPage: 10 })).datasets).toHaveLength(0);
    expect((await storage.listDatasetRuns({ options: {}, pagination: { page: 0, perPage: 10 } })).runs).toHaveLength(0);
  });
});

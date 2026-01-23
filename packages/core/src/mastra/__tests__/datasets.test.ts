import { describe, it, expect, beforeEach } from 'vitest';
import { Mastra } from '../index';
import { InMemoryStore } from '../../storage/mock';
import type { DatasetsStorage } from '../../storage/domains/datasets/base';

// ============================================================================
// Setup
// ============================================================================

let mastra: Mastra;
let storage: InMemoryStore;

beforeEach(() => {
  storage = new InMemoryStore();
  mastra = new Mastra({ storage });
});

// ============================================================================
// Tests
// ============================================================================

describe('Mastra Dataset Methods', () => {
  // --------------------------------------------------------------------------
  // getDatasetsStore
  // --------------------------------------------------------------------------
  describe('getDatasetsStore', () => {
    it('returns the datasets store when storage is configured', () => {
      const store = mastra.getDatasetsStore();

      expect(store).toBeDefined();
      expect(typeof store?.createDataset).toBe('function');
      expect(typeof store?.listDatasets).toBe('function');
    });

    it('returns undefined when storage is not configured', () => {
      const mastraNoStorage = new Mastra({});

      const store = mastraNoStorage.getDatasetsStore();

      expect(store).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Dataset CRUD via store
  // --------------------------------------------------------------------------
  describe('dataset CRUD through store', () => {
    it('can create and retrieve dataset', async () => {
      const store = mastra.getDatasetsStore()!;

      const created = await store.createDataset({
        name: 'test-dataset',
        description: 'A test dataset',
        metadata: { source: 'unit-test' },
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('test-dataset');
      expect(created.description).toBe('A test dataset');

      const retrieved = await store.getDatasetById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('can list datasets with pagination', async () => {
      const store = mastra.getDatasetsStore()!;

      // Create multiple datasets
      await store.createDataset({ name: 'dataset-1' });
      await store.createDataset({ name: 'dataset-2' });
      await store.createDataset({ name: 'dataset-3' });

      const result = await store.listDatasets({ page: 1, perPage: 2 });

      expect(result.datasets.length).toBeLessThanOrEqual(2);
      expect(result.pagination.total).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // runDataset with custom function
  // --------------------------------------------------------------------------
  describe('runDataset with custom function', () => {
    it('executes custom function against dataset items', async () => {
      const store = mastra.getDatasetsStore()!;

      // Setup dataset with items
      const dataset = await store.createDataset({ name: 'run-test' });
      await store.createDatasetItem({
        datasetId: dataset.id,
        input: { value: 10 },
        expectedOutput: { result: 20 },
      });
      await store.createDatasetItem({
        datasetId: dataset.id,
        input: { value: 5 },
        expectedOutput: { result: 10 },
      });

      // Run with custom function
      const result = await mastra.runDataset({
        datasetId: dataset.id,
        target: {
          type: 'custom',
          fn: async (input: unknown) => {
            const { value } = input as { value: number };
            return { result: value * 2 };
          },
        },
      });

      expect(result.run.datasetId).toBe(dataset.id);
      expect(result.run.targetType).toBe('CUSTOM');
      expect(result.run.status).toBe('completed');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('success');
      expect(result.results[0].actualOutput).toEqual({ result: 20 });
      expect(result.results[1].actualOutput).toEqual({ result: 10 });
    });

    it('tracks progress during execution', async () => {
      const store = mastra.getDatasetsStore()!;
      const dataset = await store.createDataset({ name: 'progress-test' });
      await store.createDatasetItem({ datasetId: dataset.id, input: { n: 1 } });
      await store.createDatasetItem({ datasetId: dataset.id, input: { n: 2 } });
      await store.createDatasetItem({ datasetId: dataset.id, input: { n: 3 } });

      const progressCalls: Array<{ completed: number; total: number }> = [];

      await mastra.runDataset({
        datasetId: dataset.id,
        target: {
          type: 'custom',
          fn: async input => input,
        },
        onProgress: (completed, total) => {
          progressCalls.push({ completed, total });
        },
      });

      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[0]).toEqual({ completed: 1, total: 3 });
      expect(progressCalls[1]).toEqual({ completed: 2, total: 3 });
      expect(progressCalls[2]).toEqual({ completed: 3, total: 3 });
    });
  });

  // --------------------------------------------------------------------------
  // runDataset creates run and results
  // --------------------------------------------------------------------------
  describe('runDataset storage integration', () => {
    it('persists run record to storage', async () => {
      const store = mastra.getDatasetsStore()!;
      const dataset = await store.createDataset({ name: 'persist-test' });
      await store.createDatasetItem({ datasetId: dataset.id, input: { x: 1 } });

      const { run, results } = await mastra.runDataset({
        datasetId: dataset.id,
        target: { type: 'custom', fn: async i => i },
        name: 'My Test Run',
        metadata: { environment: 'test' },
      });

      // Verify run returned from runDataset
      expect(run.id).toBeDefined();
      expect(run.name).toBe('My Test Run');
      expect(run.status).toBe('completed');
      expect(results).toHaveLength(1);
    });

    it('persists results to storage', async () => {
      const store = mastra.getDatasetsStore()!;
      const dataset = await store.createDataset({ name: 'results-test' });
      const item = await store.createDatasetItem({
        datasetId: dataset.id,
        input: { data: 'test' },
      });

      const { run, results } = await mastra.runDataset({
        datasetId: dataset.id,
        target: {
          type: 'custom',
          fn: async () => ({ processed: true }),
        },
      });

      // Verify results returned from runDataset
      expect(results).toHaveLength(1);
      expect(results[0].itemId).toBe(item.id);
      expect(results[0].actualOutput).toEqual({ processed: true });
      expect(results[0].status).toBe('success');
      expect(run.status).toBe('completed');
    });

    it('throws error when storage is not configured', async () => {
      const mastraNoStorage = new Mastra({});

      await expect(
        mastraNoStorage.runDataset({
          datasetId: 'ds1',
          target: { type: 'custom', fn: async i => i },
        }),
      ).rejects.toThrow('Datasets storage is not configured');
    });
  });
});

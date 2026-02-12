import { createClient } from '@libsql/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExperimentsLibSQL } from '../experiments/index';
import { DatasetsLibSQL } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_DB_URL = 'file::memory:?cache=shared';

describe('DatasetsLibSQL', () => {
  let storage: DatasetsLibSQL;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    storage = new DatasetsLibSQL({ client });
    await storage.init(); // Creates tables
  });

  afterEach(async () => {
    await storage.dangerouslyClearAll();
  });

  // ------------- Dataset CRUD -------------
  describe('Dataset CRUD', () => {
    it('createDataset creates with name, description, metadata', async () => {
      const dataset = await storage.createDataset({
        name: 'test-dataset',
        description: 'Test description',
        metadata: { key: 'value' },
      });

      expect(dataset.id).toBeDefined();
      expect(dataset.name).toBe('test-dataset');
      expect(dataset.description).toBe('Test description');
      expect(dataset.metadata).toEqual({ key: 'value' });
      expect(dataset.lastModifiedAt).toBeInstanceOf(Date);
      expect(dataset.createdAt).toBeInstanceOf(Date);
      expect(dataset.updatedAt).toBeInstanceOf(Date);
    });

    it('createDataset initializes lastModifiedAt as Date', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      expect(dataset.lastModifiedAt).toBeInstanceOf(Date);
    });

    it('getDatasetById returns dataset or null', async () => {
      const created = await storage.createDataset({ name: 'test' });
      const fetched = await storage.getDatasetById({ id: created.id });
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.name).toBe('test');

      const notFound = await storage.getDatasetById({ id: 'non-existent' });
      expect(notFound).toBeNull();
    });

    it('updateDataset updates fields and updatedAt', async () => {
      const created = await storage.createDataset({ name: 'original' });
      const initialUpdatedAt = created.updatedAt;

      await new Promise(r => setTimeout(r, 10));

      const updated = await storage.updateDataset({
        id: created.id,
        name: 'updated-name',
        description: 'new desc',
      });

      expect(updated.name).toBe('updated-name');
      expect(updated.description).toBe('new desc');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('updateDataset throws for non-existent dataset', async () => {
      await expect(storage.updateDataset({ id: 'non-existent', name: 'x' })).rejects.toThrow();
    });

    it('deleteDataset removes dataset and its items', async () => {
      const dataset = await storage.createDataset({ name: 'to-delete' });
      await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });
      await storage.addItem({ datasetId: dataset.id, input: { b: 2 } });

      await storage.deleteDataset({ id: dataset.id });

      const fetched = await storage.getDatasetById({ id: dataset.id });
      expect(fetched).toBeNull();

      // Items should also be deleted
      const items = await storage.listItems({
        datasetId: dataset.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(items.items).toHaveLength(0);
    });

    it('listDatasets supports pagination (0-indexed)', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.createDataset({ name: `dataset-${i}` });
      }

      // Page 0 is the first page
      const page0 = await storage.listDatasets({ pagination: { page: 0, perPage: 2 } });
      expect(page0.datasets).toHaveLength(2);
      expect(page0.pagination.total).toBe(5);
      expect(page0.pagination.hasMore).toBe(true);

      const page1 = await storage.listDatasets({ pagination: { page: 1, perPage: 2 } });
      expect(page1.datasets).toHaveLength(2);
      expect(page1.pagination.hasMore).toBe(true);

      const page2 = await storage.listDatasets({ pagination: { page: 2, perPage: 2 } });
      expect(page2.datasets).toHaveLength(1);
      expect(page2.pagination.hasMore).toBe(false);
    });
  });

  // ------------- Item CRUD -------------
  describe('Item CRUD', () => {
    it('addItem creates item with input, groundTruth, context', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'hello' },
        groundTruth: { response: 'world' },
        metadata: { user: 'test' },
      });

      expect(item.id).toBeDefined();
      expect(item.datasetId).toBe(dataset.id);
      expect(item.input).toEqual({ prompt: 'hello' });
      expect(item.groundTruth).toEqual({ response: 'world' });
      expect(item.metadata).toEqual({ user: 'test' });
      expect(item.datasetVersion).toBeInstanceOf(Date);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
    });

    it('addItem throws for non-existent dataset', async () => {
      await expect(storage.addItem({ datasetId: 'non-existent', input: {} })).rejects.toThrow();
    });

    it('getItemById returns item or null', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });

      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(item.id);

      const notFound = await storage.getItemById({ id: 'non-existent' });
      expect(notFound).toBeNull();
    });

    it('updateItem modifies item fields', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });

      const updated = await storage.updateItem({
        id: item.id,
        datasetId: dataset.id,
        input: { a: 2 },
        groundTruth: { b: 3 },
      });

      expect(updated.input).toEqual({ a: 2 });
      expect(updated.groundTruth).toEqual({ b: 3 });
    });

    it('updateItem throws for non-existent item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await expect(storage.updateItem({ id: 'non-existent', datasetId: dataset.id, input: {} })).rejects.toThrow();
    });

    it('updateItem throws when item does not belong to dataset', async () => {
      const dataset1 = await storage.createDataset({ name: 'ds1' });
      const dataset2 = await storage.createDataset({ name: 'ds2' });
      const item = await storage.addItem({ datasetId: dataset1.id, input: {} });

      await expect(storage.updateItem({ id: item.id, datasetId: dataset2.id, input: {} })).rejects.toThrow();
    });

    it('deleteItem removes item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: {} });

      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched).toBeNull();
    });

    it('deleteItem is a no-op for non-existent item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      // Should not throw — deleting a missing item is idempotent
      await expect(storage.deleteItem({ id: 'non-existent', datasetId: dataset.id })).resolves.not.toThrow();
    });

    it('deleteItem throws when item does not belong to dataset', async () => {
      const dataset1 = await storage.createDataset({ name: 'ds1' });
      const dataset2 = await storage.createDataset({ name: 'ds2' });
      const item = await storage.addItem({ datasetId: dataset1.id, input: {} });

      await expect(storage.deleteItem({ id: item.id, datasetId: dataset2.id })).rejects.toThrow();
    });

    it('listItems supports pagination (0-indexed)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      for (let i = 0; i < 5; i++) {
        await storage.addItem({ datasetId: dataset.id, input: { n: i } });
      }

      // Page 0 is the first page
      const page0 = await storage.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: 2 } });
      expect(page0.items).toHaveLength(2);
      expect(page0.pagination.total).toBe(5);
      expect(page0.pagination.hasMore).toBe(true);
    });
  });

  // ------------- Timestamp Versioning -------------
  describe('timestamp versioning', () => {
    it('lastModifiedAt is Date instance on create', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      expect(dataset.lastModifiedAt).toBeInstanceOf(Date);
    });

    it('updates lastModifiedAt timestamp on addItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const initialVersion = dataset.lastModifiedAt;

      await new Promise(r => setTimeout(r, 10));

      await storage.addItem({ datasetId: dataset.id, input: { prompt: 'hello' } });
      const updated = await storage.getDatasetById({ id: dataset.id });
      expect(updated?.lastModifiedAt).toBeInstanceOf(Date);
      expect(updated?.lastModifiedAt.getTime()).toBeGreaterThan(initialVersion.getTime());
    });

    it('updates lastModifiedAt timestamp on updateItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });
      const afterAddVersion = (await storage.getDatasetById({ id: dataset.id }))?.lastModifiedAt;

      await new Promise(r => setTimeout(r, 10));

      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { a: 2 } });
      const updated = await storage.getDatasetById({ id: dataset.id });
      expect(updated?.lastModifiedAt.getTime()).toBeGreaterThan(afterAddVersion!.getTime());
    });

    it('updates lastModifiedAt timestamp on deleteItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: {} });
      const afterAddVersion = (await storage.getDatasetById({ id: dataset.id }))?.lastModifiedAt;

      await new Promise(r => setTimeout(r, 10));

      await storage.deleteItem({ id: item.id, datasetId: dataset.id });
      const updated = await storage.getDatasetById({ id: dataset.id });
      expect(updated?.lastModifiedAt.getTime()).toBeGreaterThan(afterAddVersion!.getTime());
    });

    it('item stores datasetVersion timestamp when added', async () => {
      const dataset = await storage.createDataset({ name: 'test' });

      const item1 = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      expect(item1.datasetVersion).toBeInstanceOf(Date);
      const v1 = item1.datasetVersion;

      await new Promise(r => setTimeout(r, 10));

      const item2 = await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });
      expect(item2.datasetVersion).toBeInstanceOf(Date);
      expect(item2.datasetVersion.getTime()).toBeGreaterThan(v1.getTime());
    });

    it('item datasetVersion updates on updateItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const originalVersion = item.datasetVersion;

      await new Promise(r => setTimeout(r, 10));

      const updated = await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });
      expect(updated.datasetVersion.getTime()).toBeGreaterThan(originalVersion.getTime());
    });
  });

  // ------------- Version Query Semantics -------------
  describe('version query semantics', () => {
    it('getItemsByVersion returns snapshot at timestamp', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item1 = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const item1Version = item1.datasetVersion;

      await new Promise(r => setTimeout(r, 10));

      const item2 = await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });

      // Query at item1's version timestamp should only return item1
      const itemsAtV1 = await storage.getItemsByVersion({ datasetId: dataset.id, version: item1Version });
      expect(itemsAtV1).toHaveLength(1);
      expect(itemsAtV1[0].itemId).toBe(item1.id);

      // Query at item2's version timestamp should return both
      const itemsAtV2 = await storage.getItemsByVersion({ datasetId: dataset.id, version: item2.datasetVersion });
      expect(itemsAtV2).toHaveLength(2);
    });

    it('listItems with version filter uses snapshot semantics', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item1 = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const snapshotTime = item1.datasetVersion;

      await new Promise(r => setTimeout(r, 10));

      await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });

      // Page 0 is the first page
      const result = await storage.listItems({
        datasetId: dataset.id,
        version: snapshotTime,
        pagination: { page: 0, perPage: 100 },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(item1.id);
    });

    it('items added after version N not returned for version N query', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const snapshotTime = new Date(); // Snapshot before any items

      await new Promise(r => setTimeout(r, 10));

      await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });

      const itemsAtSnapshot = await storage.getItemsByVersion({ datasetId: dataset.id, version: snapshotTime });
      expect(itemsAtSnapshot).toHaveLength(0);
    });

    it('old version snapshot still contains the original item data', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const v1 = item.datasetVersion;

      await new Promise(r => setTimeout(r, 10));

      // Update item - creates a new version
      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });

      // Querying at v1 should still return the original snapshot
      const itemsAtV1 = await storage.getItemsByVersion({ datasetId: dataset.id, version: v1 });
      expect(itemsAtV1).toHaveLength(1);
      expect(itemsAtV1[0].snapshot.input).toEqual({ n: 1 });
    });
  });

  // ------------- Edge Cases -------------
  describe('edge cases', () => {
    it('getDatasetById with non-existent ID returns null', async () => {
      const result = await storage.getDatasetById({ id: 'non-existent-uuid' });
      expect(result).toBeNull();
    });

    it('deleteDataset with non-existent ID is a no-op', async () => {
      // Should not throw - just deletes nothing
      await storage.deleteDataset({ id: 'non-existent-uuid' });
    });

    it('addItem to non-existent dataset throws', async () => {
      await expect(storage.addItem({ datasetId: 'non-existent', input: {} })).rejects.toThrow();
    });

    it('JSON input with nested objects roundtrips correctly', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const complexInput = {
        nested: {
          deep: {
            value: 'test',
            numbers: [1, 2, 3],
          },
        },
        array: [{ a: 1 }, { b: 2 }],
      };

      const item = await storage.addItem({ datasetId: dataset.id, input: complexInput });
      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched?.input).toEqual(complexInput);
    });

    it('JSON with null values roundtrips correctly', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const inputWithNulls = {
        value: null,
        nested: { alsoNull: null },
      };

      const item = await storage.addItem({ datasetId: dataset.id, input: inputWithNulls });
      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched?.input).toEqual(inputWithNulls);
    });

    it('groundTruth with complex JSON roundtrips correctly', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const expected = { scores: [0.5, 0.7, 0.9], labels: ['a', 'b', 'c'] };

      const item = await storage.addItem({
        datasetId: dataset.id,
        input: {},
        groundTruth: expected,
      });
      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched?.groundTruth).toEqual(expected);
    });

    it('metadata with complex JSON roundtrips correctly', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const metadata = { user: { id: '123', role: 'admin' }, session: { active: true } };

      const item = await storage.addItem({
        datasetId: dataset.id,
        input: {},
        metadata,
      });
      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched?.metadata).toEqual(metadata);
    });

    it('dangerouslyClearAll removes all data', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });

      await storage.dangerouslyClearAll();

      const datasets = await storage.listDatasets({ pagination: { page: 0, perPage: 100 } });
      expect(datasets.datasets).toHaveLength(0);
    });

    it('timestamps stored as ISO strings, returned as Dates', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: {} });

      // Verify they're Date objects
      expect(dataset.lastModifiedAt).toBeInstanceOf(Date);
      expect(dataset.createdAt).toBeInstanceOf(Date);
      expect(dataset.updatedAt).toBeInstanceOf(Date);
      expect(item.datasetVersion).toBeInstanceOf(Date);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify we can fetch and they're still Dates
      const fetchedDataset = await storage.getDatasetById({ id: dataset.id });
      const fetchedItem = await storage.getItemById({ id: item.id });

      expect(fetchedDataset?.lastModifiedAt).toBeInstanceOf(Date);
      expect(fetchedDataset?.createdAt).toBeInstanceOf(Date);
      expect(fetchedDataset?.updatedAt).toBeInstanceOf(Date);
      expect(fetchedItem?.datasetVersion).toBeInstanceOf(Date);
      expect(fetchedItem?.createdAt).toBeInstanceOf(Date);
      expect(fetchedItem?.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ------------- Cascade Delete -------------
  describe('cascade delete', () => {
    it('deleteDataset removes experiments and results for the dataset', async () => {
      const dataset = await storage.createDataset({ name: 'cascade-test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      // Create experiment and result via the experiments store
      const experimentsStore = new ExperimentsLibSQL({ client });
      await experimentsStore.init();
      const now = new Date();
      const experiment = await experimentsStore.createExperiment({
        datasetId: dataset.id,
        datasetVersion: now,
        targetType: 'agent',
        targetId: 'test-agent',
        totalItems: 1,
      });
      await experimentsStore.addExperimentResult({
        experimentId: experiment.id,
        itemId: item.id,
        itemVersion: item.datasetVersion,
        itemVersionNumber: 1,
        input: { n: 1 },
        output: { result: 'ok' },
        groundTruth: null,
        latency: 100,
        error: null,
        startedAt: now,
        completedAt: now,
        retryCount: 0,
      });

      // Verify experiment exists
      const expBefore = await experimentsStore.getExperimentById({ id: experiment.id });
      expect(expBefore).not.toBeNull();

      // Delete dataset — should cascade
      await storage.deleteDataset({ id: dataset.id });

      // Verify experiment and results are gone
      const expAfter = await experimentsStore.getExperimentById({ id: experiment.id });
      expect(expAfter).toBeNull();
    });
  });

  // ------------- Bulk Validation -------------
  describe('bulk validation', () => {
    it('bulkAddItems validates against inputSchema', async () => {
      const dataset = await storage.createDataset({
        name: 'schema-test',
        inputSchema: {
          type: 'object',
          properties: { prompt: { type: 'string' } },
          required: ['prompt'],
        },
      });

      // Valid items should succeed
      const validResult = await storage.bulkAddItems({
        datasetId: dataset.id,
        items: [{ input: { prompt: 'hello' } }, { input: { prompt: 'world' } }],
      });
      expect(validResult).toHaveLength(2);

      // Invalid items should throw
      await expect(
        storage.bulkAddItems({
          datasetId: dataset.id,
          items: [{ input: { notPrompt: 123 } }],
        }),
      ).rejects.toThrow();
    });
  });
});

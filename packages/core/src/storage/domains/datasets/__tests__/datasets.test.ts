import { describe, it, expect, beforeEach } from 'vitest';
import { DatasetsInMemory } from '../inmemory';
import { InMemoryDB } from '../../inmemory-db';

describe('DatasetsInMemory', () => {
  let storage: DatasetsInMemory;
  let db: InMemoryDB;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new DatasetsInMemory({ db });
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
      expect(dataset.version).toBeInstanceOf(Date);
      expect(dataset.createdAt).toBeInstanceOf(Date);
      expect(dataset.updatedAt).toBeInstanceOf(Date);
    });

    it('createDataset initializes version as Date', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      expect(dataset.version).toBeInstanceOf(Date);
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
      await expect(storage.updateDataset({ id: 'non-existent', name: 'x' })).rejects.toThrow('Dataset not found');
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
    it('addItem creates item with input, expectedOutput, context', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({
        datasetId: dataset.id,
        input: { prompt: 'hello' },
        expectedOutput: { response: 'world' },
        context: { user: 'test' },
      });

      expect(item.id).toBeDefined();
      expect(item.datasetId).toBe(dataset.id);
      expect(item.input).toEqual({ prompt: 'hello' });
      expect(item.expectedOutput).toEqual({ response: 'world' });
      expect(item.context).toEqual({ user: 'test' });
      expect(item.version).toBeInstanceOf(Date);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
    });

    it('addItem throws for non-existent dataset', async () => {
      await expect(storage.addItem({ datasetId: 'non-existent', input: {} })).rejects.toThrow('Dataset not found');
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
        expectedOutput: { b: 3 },
      });

      expect(updated.input).toEqual({ a: 2 });
      expect(updated.expectedOutput).toEqual({ b: 3 });
    });

    it('updateItem throws for non-existent item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await expect(
        storage.updateItem({ id: 'non-existent', datasetId: dataset.id, input: {} }),
      ).rejects.toThrow('Item not found');
    });

    it('updateItem throws when item does not belong to dataset', async () => {
      const dataset1 = await storage.createDataset({ name: 'ds1' });
      const dataset2 = await storage.createDataset({ name: 'ds2' });
      const item = await storage.addItem({ datasetId: dataset1.id, input: {} });

      await expect(
        storage.updateItem({ id: item.id, datasetId: dataset2.id, input: {} }),
      ).rejects.toThrow('does not belong to dataset');
    });

    it('deleteItem removes item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: {} });

      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched).toBeNull();
    });

    it('deleteItem throws for non-existent item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await expect(storage.deleteItem({ id: 'non-existent', datasetId: dataset.id })).rejects.toThrow('Item not found');
    });

    it('deleteItem throws when item does not belong to dataset', async () => {
      const dataset1 = await storage.createDataset({ name: 'ds1' });
      const dataset2 = await storage.createDataset({ name: 'ds2' });
      const item = await storage.addItem({ datasetId: dataset1.id, input: {} });

      await expect(storage.deleteItem({ id: item.id, datasetId: dataset2.id })).rejects.toThrow(
        'does not belong to dataset',
      );
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
    it('version is Date instance on create', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      expect(dataset.version).toBeInstanceOf(Date);
    });

    it('updates version timestamp on addItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const initialVersion = dataset.version;

      await new Promise(r => setTimeout(r, 10));

      await storage.addItem({ datasetId: dataset.id, input: { prompt: 'hello' } });
      const updated = await storage.getDatasetById({ id: dataset.id });
      expect(updated?.version).toBeInstanceOf(Date);
      expect(updated?.version.getTime()).toBeGreaterThan(initialVersion.getTime());
    });

    it('updates version timestamp on updateItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });
      const afterAddVersion = (await storage.getDatasetById({ id: dataset.id }))?.version;

      await new Promise(r => setTimeout(r, 10));

      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { a: 2 } });
      const updated = await storage.getDatasetById({ id: dataset.id });
      expect(updated?.version.getTime()).toBeGreaterThan(afterAddVersion!.getTime());
    });

    it('updates version timestamp on deleteItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: {} });
      const afterAddVersion = (await storage.getDatasetById({ id: dataset.id }))?.version;

      await new Promise(r => setTimeout(r, 10));

      await storage.deleteItem({ id: item.id, datasetId: dataset.id });
      const updated = await storage.getDatasetById({ id: dataset.id });
      expect(updated?.version.getTime()).toBeGreaterThan(afterAddVersion!.getTime());
    });

    it('item stores version timestamp when added', async () => {
      const dataset = await storage.createDataset({ name: 'test' });

      const item1 = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      expect(item1.version).toBeInstanceOf(Date);
      const v1 = item1.version;

      await new Promise(r => setTimeout(r, 10));

      const item2 = await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });
      expect(item2.version).toBeInstanceOf(Date);
      expect(item2.version.getTime()).toBeGreaterThan(v1.getTime());
    });

    it('item version updates on updateItem', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const originalVersion = item.version;

      await new Promise(r => setTimeout(r, 10));

      const updated = await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });
      expect(updated.version.getTime()).toBeGreaterThan(originalVersion.getTime());
    });
  });

  // ------------- Version Query Semantics -------------
  describe('version query semantics', () => {
    it('getItemsByVersion returns snapshot at timestamp', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item1 = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const item1Version = item1.version;

      await new Promise(r => setTimeout(r, 10));

      const item2 = await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });

      // Query at item1's version timestamp should only return item1
      const itemsAtV1 = await storage.getItemsByVersion({ datasetId: dataset.id, version: item1Version });
      expect(itemsAtV1).toHaveLength(1);
      expect(itemsAtV1[0].id).toBe(item1.id);

      // Query at item2's version timestamp should return both
      const itemsAtV2 = await storage.getItemsByVersion({ datasetId: dataset.id, version: item2.version });
      expect(itemsAtV2).toHaveLength(2);
    });

    it('listItems with version filter uses snapshot semantics', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item1 = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const snapshotTime = item1.version;

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

    it('updated items not included in old version snapshot', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const v1 = item.version;

      await new Promise(r => setTimeout(r, 10));

      // Update item - changes its version timestamp
      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });

      // Query at original version - item had version v1 originally, so it should be included
      // But wait - after update, the item's version changed to a newer timestamp
      // So at v1, the original item (with v1) should still appear
      const itemsAtV1 = await storage.getItemsByVersion({ datasetId: dataset.id, version: v1 });
      // After update, item's version changed, so querying at v1 won't find it anymore
      // This tests snapshot semantics: updated items have new version, old snapshot doesn't see them
      expect(itemsAtV1).toHaveLength(0);
    });
  });

  // ------------- Edge Cases -------------
  describe('edge cases', () => {
    it('getDatasetById with non-existent ID returns null', async () => {
      const result = await storage.getDatasetById({ id: 'non-existent-uuid' });
      expect(result).toBeNull();
    });

    it('deleteDataset with non-existent ID is a no-op', async () => {
      // Should not throw
      await storage.deleteDataset({ id: 'non-existent-uuid' });
    });

    it('addItem to non-existent dataset throws', async () => {
      await expect(storage.addItem({ datasetId: 'non-existent', input: {} })).rejects.toThrow('Dataset not found');
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

    it('expectedOutput with complex JSON roundtrips correctly', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const expected = { scores: [0.5, 0.7, 0.9], labels: ['a', 'b', 'c'] };

      const item = await storage.addItem({
        datasetId: dataset.id,
        input: {},
        expectedOutput: expected,
      });
      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched?.expectedOutput).toEqual(expected);
    });

    it('context with complex JSON roundtrips correctly', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const context = { user: { id: '123', role: 'admin' }, session: { active: true } };

      const item = await storage.addItem({
        datasetId: dataset.id,
        input: {},
        context,
      });
      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched?.context).toEqual(context);
    });

    it('dangerouslyClearAll removes all data', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });

      await storage.dangerouslyClearAll();

      const datasets = await storage.listDatasets({ pagination: { page: 0, perPage: 100 } });
      expect(datasets.datasets).toHaveLength(0);
    });
  });
});

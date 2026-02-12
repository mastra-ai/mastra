import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../../inmemory-db';
import { DatasetsInMemory } from '../inmemory';

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
      expect(dataset.version).toBe(0);
      expect(dataset.createdAt).toBeInstanceOf(Date);
      expect(dataset.updatedAt).toBeInstanceOf(Date);
    });

    it('createDataset initializes version as 0', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      expect(dataset.version).toBe(0);
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
    it('addItem creates item with input, groundTruth, metadata', async () => {
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
      expect(item.datasetVersion).toBe(1);
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
        groundTruth: { b: 3 },
      });

      expect(updated.input).toEqual({ a: 2 });
      expect(updated.groundTruth).toEqual({ b: 3 });
    });

    it('updateItem throws for non-existent item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await expect(storage.updateItem({ id: 'non-existent', datasetId: dataset.id, input: {} })).rejects.toThrow(
        'Item not found',
      );
    });

    it('updateItem throws when item does not belong to dataset', async () => {
      const dataset1 = await storage.createDataset({ name: 'ds1' });
      const dataset2 = await storage.createDataset({ name: 'ds2' });
      const item = await storage.addItem({ datasetId: dataset1.id, input: {} });

      await expect(storage.updateItem({ id: item.id, datasetId: dataset2.id, input: {} })).rejects.toThrow(
        'does not belong to dataset',
      );
    });

    it('deleteItem removes item (getItemById returns null)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: {} });

      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched).toBeNull();
    });

    it('deleteItem is a no-op for non-existent item', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await expect(storage.deleteItem({ id: 'non-existent', datasetId: dataset.id })).resolves.not.toThrow();
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

  // ------------- SCD-2 Versioning -------------
  describe('SCD-2 versioning', () => {
    it('addItem increments dataset.version by 1 (T3.7)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      expect(dataset.version).toBe(0);

      await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const after1 = await storage.getDatasetById({ id: dataset.id });
      expect(after1?.version).toBe(1);

      await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });
      const after2 = await storage.getDatasetById({ id: dataset.id });
      expect(after2?.version).toBe(2);
    });

    it('addItem creates row with validTo=null, isDeleted=false (T3.7)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      const history = await storage.getItemHistory(item.id);
      expect(history).toHaveLength(1);
      expect(history[0].validTo).toBeNull();
      expect(history[0].isDeleted).toBe(false);
      expect(history[0].datasetVersion).toBe(1);
    });

    it('updateItem closes old row and creates new row (T3.8)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });

      const history = await storage.getItemHistory(item.id);
      expect(history).toHaveLength(2);

      // New row current (DESC — newest first)
      expect(history[0].datasetVersion).toBe(2);
      expect(history[0].validTo).toBeNull();
      expect(history[0].isDeleted).toBe(false);
      expect(history[0].input).toEqual({ n: 2 });

      // Old row closed
      expect(history[1].datasetVersion).toBe(1);
      expect(history[1].validTo).toBe(2);
      expect(history[1].input).toEqual({ n: 1 });
    });

    it('deleteItem creates tombstone row with isDeleted=true (T3.9)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const history = await storage.getItemHistory(item.id);
      expect(history).toHaveLength(2);

      // Tombstone row (newest first)
      expect(history[0].datasetVersion).toBe(2);
      expect(history[0].validTo).toBeNull();
      expect(history[0].isDeleted).toBe(true);

      // Old row closed
      expect(history[1].validTo).toBe(2);
    });

    it('deleteItem causes getItemById to return null (T3.12)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const fetched = await storage.getItemById({ id: item.id });
      expect(fetched).toBeNull();
    });

    it('getItemById with datasetVersion returns exact row (T3.13)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });

      // Version 1 — original data
      const atV1 = await storage.getItemById({ id: item.id, datasetVersion: 1 });
      expect(atV1).not.toBeNull();
      expect(atV1?.input).toEqual({ n: 1 });

      // Version 2 — updated data
      const atV2 = await storage.getItemById({ id: item.id, datasetVersion: 2 });
      expect(atV2).not.toBeNull();
      expect(atV2?.input).toEqual({ n: 2 });

      // Version 99 — doesn't exist
      const atV99 = await storage.getItemById({ id: item.id, datasetVersion: 99 });
      expect(atV99).toBeNull();
    });

    it('every mutation inserts a dataset_version row (T3.11)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });
      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const versions = await storage.listDatasetVersions({
        datasetId: dataset.id,
        pagination: { page: 0, perPage: false },
      });
      expect(versions.versions).toHaveLength(3);
    });

    it('item mutations do NOT update dataset.updatedAt (T3.26)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const initialUpdatedAt = dataset.updatedAt;

      await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      const after = await storage.getDatasetById({ id: dataset.id });
      expect(after?.updatedAt.getTime()).toBe(initialUpdatedAt.getTime());
      expect(after?.version).toBe(1);
    });
  });

  // ------------- Version Query Semantics (SCD-2) -------------
  describe('version query semantics', () => {
    it('getItemsByVersion(1) after add(v1), update(v2) returns v1 data (T3.14)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });

      const itemsAtV1 = await storage.getItemsByVersion({ datasetId: dataset.id, version: 1 });
      expect(itemsAtV1).toHaveLength(1);
      expect(itemsAtV1[0].input).toEqual({ n: 1 });
    });

    it('getItemsByVersion(2) after add(v1), update(v2) returns v2 data (T3.14)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });

      const itemsAtV2 = await storage.getItemsByVersion({ datasetId: dataset.id, version: 2 });
      expect(itemsAtV2).toHaveLength(1);
      expect(itemsAtV2[0].input).toEqual({ n: 2 });
    });

    it('getItemsByVersion(3) after delete(v3) returns empty (T3.14)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });
      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const itemsAtV3 = await storage.getItemsByVersion({ datasetId: dataset.id, version: 3 });
      expect(itemsAtV3).toHaveLength(0);
    });

    it('getItemsByVersion at version 0 (before items) returns empty', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      const items = await storage.getItemsByVersion({ datasetId: dataset.id, version: 0 });
      expect(items).toHaveLength(0);
    });

    it('getItemHistory returns all rows including tombstones (T3.15)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.updateItem({ id: item.id, datasetId: dataset.id, input: { n: 2 } });
      await storage.deleteItem({ id: item.id, datasetId: dataset.id });

      const history = await storage.getItemHistory(item.id);
      expect(history).toHaveLength(3);
      // Ordered by datasetVersion DESC (newest first)
      expect(history[0].datasetVersion).toBe(3);
      expect(history[0].isDeleted).toBe(true);
      expect(history[1].datasetVersion).toBe(2);
      expect(history[1].isDeleted).toBe(false);
      expect(history[2].datasetVersion).toBe(1);
      expect(history[2].isDeleted).toBe(false);
    });

    it('listItems with version filter uses SCD-2 range query', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });

      // At version 1, only first item exists
      const result = await storage.listItems({
        datasetId: dataset.id,
        version: 1,
        pagination: { page: 0, perPage: 100 },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].input).toEqual({ n: 1 });

      // At version 2, both items exist
      const result2 = await storage.listItems({
        datasetId: dataset.id,
        version: 2,
        pagination: { page: 0, perPage: 100 },
      });
      expect(result2.items).toHaveLength(2);
    });

    it('default listing returns only current items (T3.16)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item1 = await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });
      await storage.addItem({ datasetId: dataset.id, input: { n: 2 } });
      await storage.deleteItem({ id: item1.id, datasetId: dataset.id });

      const result = await storage.listItems({
        datasetId: dataset.id,
        pagination: { page: 0, perPage: 100 },
      });
      // Only item2 is current; item1 is deleted
      expect(result.items).toHaveLength(1);
      expect(result.items[0].input).toEqual({ n: 2 });
    });
  });

  // ------------- Batch Operations -------------
  describe('batch operations', () => {
    it('batchInsertItems increments dataset.version once (T3.19)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await storage.batchInsertItems({
        datasetId: dataset.id,
        items: [{ input: { n: 1 } }, { input: { n: 2 } }, { input: { n: 3 } }],
      });

      const after = await storage.getDatasetById({ id: dataset.id });
      expect(after?.version).toBe(1); // Only incremented once
    });

    it('batchInsertItems — all items share the same datasetVersion', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const items = await storage.batchInsertItems({
        datasetId: dataset.id,
        items: [{ input: { n: 1 } }, { input: { n: 2 } }],
      });

      expect(items[0].datasetVersion).toBe(1);
      expect(items[1].datasetVersion).toBe(1);
    });

    it('batchDeleteItems increments dataset.version once (T3.20)', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const items = await storage.batchInsertItems({
        datasetId: dataset.id,
        items: [{ input: { n: 1 } }, { input: { n: 2 } }],
      });

      await storage.batchDeleteItems({
        datasetId: dataset.id,
        itemIds: items.map(i => i.id),
      });

      const after = await storage.getDatasetById({ id: dataset.id });
      expect(after?.version).toBe(2); // 1 for add, 1 for delete
    });
  });

  // ------------- Cascade (F3 fix) -------------
  describe('cascade delete', () => {
    it('deleteDataset detaches experiments (sets datasetId/datasetVersion to null) (T3.17)', async () => {
      const dataset = await storage.createDataset({ name: 'cascade-test' });
      await storage.addItem({ datasetId: dataset.id, input: { n: 1 } });

      // Set up an experiment in the InMemoryDB directly
      const expId = crypto.randomUUID();
      db.experiments.set(expId, {
        id: expId,
        name: 'test-exp',
        datasetId: dataset.id,
        datasetVersion: 1,
        targetType: 'agent',
        targetId: 'test-agent',
        status: 'completed',
        totalItems: 1,
        processedItems: 1,
        succeededItems: 1,
        failedItems: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await storage.deleteDataset({ id: dataset.id });

      // Experiment should still exist but with null datasetId/datasetVersion
      const exp = db.experiments.get(expId);
      expect(exp).toBeDefined();
      expect(exp?.datasetId).toBeNull();
      expect(exp?.datasetVersion).toBeNull();
    });
  });

  // ------------- Schema Validation -------------
  describe('schema validation', () => {
    it('validates input against inputSchema on addItem', async () => {
      const dataset = await storage.createDataset({
        name: 'test',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });

      // Valid item succeeds
      const item = await storage.addItem({
        datasetId: dataset.id,
        input: { name: 'Alice' },
      });
      expect(item.input).toEqual({ name: 'Alice' });

      // Invalid item throws
      await expect(
        storage.addItem({
          datasetId: dataset.id,
          input: { name: 123 }, // wrong type
        }),
      ).rejects.toThrow('Validation failed for input');
    });

    it('validates groundTruth against groundTruthSchema on addItem', async () => {
      const dataset = await storage.createDataset({
        name: 'test',
        groundTruthSchema: {
          type: 'object',
          properties: { score: { type: 'number' } },
          required: ['score'],
        },
      });

      const item = await storage.addItem({
        datasetId: dataset.id,
        input: 'prompt',
        groundTruth: { score: 0.9 },
      });
      expect(item.groundTruth).toEqual({ score: 0.9 });

      await expect(
        storage.addItem({
          datasetId: dataset.id,
          input: 'prompt',
          groundTruth: { score: 'high' },
        }),
      ).rejects.toThrow('Validation failed for groundTruth');
    });

    it('validates input on updateItem', async () => {
      const dataset = await storage.createDataset({
        name: 'test',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });

      const item = await storage.addItem({
        datasetId: dataset.id,
        input: { name: 'Alice' },
      });

      const updated = await storage.updateItem({
        id: item.id,
        datasetId: dataset.id,
        input: { name: 'Bob' },
      });
      expect(updated.input).toEqual({ name: 'Bob' });

      await expect(
        storage.updateItem({
          id: item.id,
          datasetId: dataset.id,
          input: { name: 123 },
        }),
      ).rejects.toThrow('Validation failed for input');
    });

    it('validates existing items when schema is added', async () => {
      const dataset = await storage.createDataset({ name: 'test' });

      await storage.addItem({ datasetId: dataset.id, input: { name: 'Alice' } });
      await storage.addItem({ datasetId: dataset.id, input: { name: 123 } });

      await expect(
        storage.updateDataset({
          id: dataset.id,
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        }),
      ).rejects.toThrow('Cannot update schema');
    });

    it('allows schema update when all items valid', async () => {
      const dataset = await storage.createDataset({ name: 'test' });

      await storage.addItem({ datasetId: dataset.id, input: { name: 'Alice' } });
      await storage.addItem({ datasetId: dataset.id, input: { name: 'Bob' } });

      const updated = await storage.updateDataset({
        id: dataset.id,
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });
      expect(updated.inputSchema).toBeDefined();
    });

    it('allows schema update on empty dataset', async () => {
      const dataset = await storage.createDataset({ name: 'test' });

      const updated = await storage.updateDataset({
        id: dataset.id,
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });
      expect(updated.inputSchema).toBeDefined();
    });

    it('skips validation when groundTruth is undefined', async () => {
      const dataset = await storage.createDataset({
        name: 'test',
        groundTruthSchema: {
          type: 'object',
          properties: { score: { type: 'number' } },
          required: ['score'],
        },
      });

      const item = await storage.addItem({
        datasetId: dataset.id,
        input: 'prompt',
      });
      expect(item.id).toBeDefined();
    });
  });

  // ------------- Edge Cases -------------
  describe('edge cases', () => {
    it('getDatasetById with non-existent ID returns null', async () => {
      const result = await storage.getDatasetById({ id: 'non-existent-uuid' });
      expect(result).toBeNull();
    });

    it('deleteDataset with non-existent ID is a no-op', async () => {
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
  });
});

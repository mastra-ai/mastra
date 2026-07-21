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

    it('atomically resolves a compatible caller-defined ID without mutating the dataset', async () => {
      const input = { id: 'durable-dataset', name: 'original', organizationId: 'org', projectId: null };
      const results = await Promise.all(Array.from({ length: 20 }, () => storage.createDataset(input)));

      expect(results.every(dataset => dataset.id === input.id)).toBe(true);
      expect(db.datasets.size).toBe(1);

      await storage.updateDataset({ id: input.id, name: 'updated' });
      const retried = await storage.createDataset({ ...input, name: 'ignored retry name', projectId: undefined });
      expect(retried.name).toBe('updated');
      expect(retried.version).toBe(0);
      expect(db.datasets.size).toBe(1);
    });

    it('rejects incompatible reuse of a caller-defined ID', async () => {
      await storage.createDataset({ id: 'durable-dataset', name: 'test', organizationId: 'org-a' });

      await expect(
        storage.createDataset({ id: 'durable-dataset', name: 'test', organizationId: 'org-b' }),
      ).rejects.toMatchObject({ id: 'DATASET_ID_CONFLICT' });
    });

    it('releases a caller-defined ID after deletion', async () => {
      const first = await storage.createDataset({ id: 'reusable-dataset', name: 'first' });
      await storage.deleteDataset({ id: first.id });
      const second = await storage.createDataset({ id: first.id, name: 'second' });

      expect(second.name).toBe('second');
      expect(second.version).toBe(0);
      expect(second.createdAt).not.toBe(first.createdAt);
    });

    it('rejects an empty caller-defined ID', async () => {
      await expect(storage.createDataset({ id: '', name: 'test' })).rejects.toMatchObject({
        id: 'DATASET_INVALID_ID',
      });
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

    it('addItem rejects circular payloads before idempotency comparison', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      await storage.addItem({ datasetId: dataset.id, externalId: 'cyclic-item', input: { prompt: 'safe' } });
      const input: Record<string, unknown> = { prompt: 'hello' };
      input.self = input;

      await expect(storage.addItem({ datasetId: dataset.id, externalId: 'cyclic-item', input })).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
        message: expect.stringContaining('items[0].input.self references items[0].input'),
      });
    });

    it('updateItem rejects circular payloads with the offending path', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { prompt: 'hello' } });
      const metadata: Record<string, unknown> = {};
      metadata.self = metadata;

      await expect(storage.updateItem({ id: item.id, datasetId: dataset.id, metadata })).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
        message: expect.stringContaining('item.metadata.self references item.metadata'),
      });
    });

    it('batchInsertItems rejects circular payloads before insertion', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const requestContext: Record<string, unknown> = {};
      requestContext.self = requestContext;

      await expect(
        storage.batchInsertItems({
          datasetId: dataset.id,
          items: [{ input: { prompt: 'safe' } }, { input: { prompt: 'cyclic' }, requestContext }],
        }),
      ).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
        message: expect.stringContaining('items[1].requestContext.self references items[1].requestContext'),
      });

      const items = await storage.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: 10 } });
      expect(items.items).toHaveLength(0);
    });

    it.each([
      ['a nested undefined value', { prompt: 'hello', missing: undefined }, 'undefined value at item.input.missing'],
      ['a function', { prompt: 'hello', callback: () => 'hi' }, 'function at item.input.callback'],
      ['a symbol', { prompt: 'hello', token: Symbol('token') }, 'symbol at item.input.token'],
      ['a bigint', { prompt: 'hello', count: 1n }, 'bigint at item.input.count'],
      [
        'a non-finite number',
        { prompt: 'hello', score: Number.POSITIVE_INFINITY },
        'non-finite number Infinity at item.input.score',
      ],
      [
        'an undefined array entry',
        { prompt: 'hello', steps: ['a', undefined] },
        'undefined value at item.input.steps[1]',
      ],
      [
        'a Date',
        { prompt: 'hello', createdAt: new Date('2026-01-01T00:00:00Z') },
        'non-plain object (Date) at item.input.createdAt',
      ],
      ['a Map', { prompt: 'hello', lookup: new Map([['a', 1]]) }, 'non-plain object (Map) at item.input.lookup'],
      ['a Set', { prompt: 'hello', tags: new Set(['a']) }, 'non-plain object (Set) at item.input.tags'],
      [
        'a class instance',
        { prompt: 'hello', price: new (class Money {})() },
        'non-plain object (Money) at item.input.price',
      ],
      [
        'a class instance with a custom toJSON',
        {
          prompt: 'hello',
          amount: new (class Money {
            toJSON() {
              return { cents: 100 };
            }
          })(),
        },
        'non-plain object (Money) at item.input.amount',
      ],
    ] as const)('updateItem rejects payloads containing %s', async (_label, input, expectedPath) => {
      const dataset = await storage.createDataset({ name: 'test' });
      const item = await storage.addItem({ datasetId: dataset.id, input: { prompt: 'safe' } });

      await expect(storage.updateItem({ id: item.id, datasetId: dataset.id, input })).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
        message: expect.stringContaining(expectedPath),
      });
    });

    it('addItem accepts omitted optional payload fields set to undefined', async () => {
      const dataset = await storage.createDataset({ name: 'test' });

      const item = await storage.addItem({ datasetId: dataset.id, input: { prompt: 'hello' }, groundTruth: undefined });
      expect(item.input).toEqual({ prompt: 'hello' });
    });

    it('addItem rejects lossy payloads so identical externalId retries stay idempotent', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const input = { prompt: 'hello', extra: undefined };

      // Without rejection, the first call would persist {prompt} (undefined dropped by
      // serialization) while the retry compares against {prompt, extra: undefined} in
      // memory, turning an identical retry into a spurious identity conflict.
      await expect(storage.addItem({ datasetId: dataset.id, externalId: 'lossy-item', input })).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
        message: expect.stringContaining('undefined value at items[0].input.extra'),
      });
      await expect(storage.addItem({ datasetId: dataset.id, externalId: 'lossy-item', input })).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
      });

      // A JSON-safe payload stays idempotent across identical externalId retries.
      const safeInput = { prompt: 'hello' };
      const first = await storage.addItem({ datasetId: dataset.id, externalId: 'lossy-item', input: safeInput });
      const retry = await storage.addItem({ datasetId: dataset.id, externalId: 'lossy-item', input: safeInput });
      expect(retry.id).toBe(first.id);

      const items = await storage.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: 10 } });
      expect(items.items).toHaveLength(1);
    });

    it('addItem rejects non-plain objects so identical externalId retries stay idempotent', async () => {
      const dataset = await storage.createDataset({ name: 'test' });
      const input = { prompt: 'hello', createdAt: new Date('2026-01-01T00:00:00Z') };

      // Without rejection, the first call would persist createdAt as an ISO string
      // while the retry compares against a live Date instance in memory, turning an
      // identical retry into a spurious identity conflict.
      await expect(storage.addItem({ datasetId: dataset.id, externalId: 'date-item', input })).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
        message: expect.stringContaining('non-plain object (Date) at items[0].input.createdAt'),
      });
      await expect(storage.addItem({ datasetId: dataset.id, externalId: 'date-item', input })).rejects.toMatchObject({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
      });

      // Explicitly converted, the payload stays idempotent across retries.
      const safeInput = { prompt: 'hello', createdAt: input.createdAt.toISOString() };
      const first = await storage.addItem({ datasetId: dataset.id, externalId: 'date-item', input: safeInput });
      const retry = await storage.addItem({ datasetId: dataset.id, externalId: 'date-item', input: safeInput });
      expect(retry.id).toBe(first.id);

      const items = await storage.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: 10 } });
      expect(items.items).toHaveLength(1);
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

  // ------------- Tenancy + candidate identity -------------
  describe('Tenancy + candidate identity', () => {
    it('createDataset persists organizationId/projectId/candidateKey/candidateId', async () => {
      const dataset = await storage.createDataset({
        name: 'candidates/missing-tool/abc-123',
        organizationId: 'org-1',
        projectId: 'proj-1',
        candidateKey: 'missing-tool',
        candidateId: 'abc-123',
      });

      expect(dataset.organizationId).toBe('org-1');
      expect(dataset.projectId).toBe('proj-1');
      expect(dataset.candidateKey).toBe('missing-tool');
      expect(dataset.candidateId).toBe('abc-123');
    });

    it('createDataset defaults new fields to null when omitted', async () => {
      const dataset = await storage.createDataset({ name: 'no-tenancy' });
      expect(dataset.organizationId).toBeNull();
      expect(dataset.projectId).toBeNull();
      expect(dataset.candidateKey).toBeNull();
      expect(dataset.candidateId).toBeNull();
    });

    it('updateDataset preserves tenancy + candidate identity (immutable after create)', async () => {
      const created = await storage.createDataset({
        name: 'd',
        organizationId: 'org-1',
        projectId: 'proj-1',
        candidateKey: 'k-1',
        candidateId: 'i-1',
      });
      const updated = await storage.updateDataset({
        id: created.id,
        description: 'updated description',
      });
      expect(updated.organizationId).toBe('org-1');
      expect(updated.projectId).toBe('proj-1');
      expect(updated.candidateKey).toBe('k-1');
      expect(updated.candidateId).toBe('i-1');
      expect(updated.description).toBe('updated description');
    });

    it('addItem inherits tenancy from parent dataset', async () => {
      const dataset = await storage.createDataset({
        name: 'd',
        organizationId: 'org-1',
        projectId: 'proj-1',
      });

      const item = await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });
      expect(item.organizationId).toBe('org-1');
      expect(item.projectId).toBe('proj-1');
    });

    it('batchInsertItems inherits tenancy from parent dataset', async () => {
      const dataset = await storage.createDataset({
        name: 'd',
        organizationId: 'org-2',
        projectId: 'proj-2',
      });

      const items = await storage.batchInsertItems({
        datasetId: dataset.id,
        items: [{ input: { a: 1 } }, { input: { a: 2 } }],
      });

      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.organizationId).toBe('org-2');
        expect(item.projectId).toBe('proj-2');
      }
    });

    it('updateItem re-inherits tenancy from parent dataset', async () => {
      const dataset = await storage.createDataset({
        name: 'd',
        organizationId: 'org-3',
        projectId: 'proj-3',
      });
      const item = await storage.addItem({ datasetId: dataset.id, input: { a: 1 } });

      const updated = await storage.updateItem({
        id: item.id,
        datasetId: dataset.id,
        input: { a: 2 },
      });
      expect(updated.organizationId).toBe('org-3');
      expect(updated.projectId).toBe('proj-3');
    });

    it('listDatasets filters by organizationId', async () => {
      await storage.createDataset({ name: 'a', organizationId: 'org-1' });
      await storage.createDataset({ name: 'b', organizationId: 'org-2' });
      await storage.createDataset({ name: 'c', organizationId: 'org-1' });

      const result = await storage.listDatasets({
        pagination: { page: 0, perPage: 100 },
        filters: { organizationId: 'org-1' },
      });

      expect(result.datasets).toHaveLength(2);
      expect(result.datasets.every(d => d.organizationId === 'org-1')).toBe(true);
    });

    it('listDatasets filters by projectId', async () => {
      await storage.createDataset({ name: 'a', organizationId: 'org-1', projectId: 'proj-1' });
      await storage.createDataset({ name: 'b', organizationId: 'org-1', projectId: 'proj-2' });

      const result = await storage.listDatasets({
        pagination: { page: 0, perPage: 100 },
        filters: { projectId: 'proj-2' },
      });

      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0]!.projectId).toBe('proj-2');
    });

    it('listDatasets filters by candidateKey + candidateId', async () => {
      await storage.createDataset({ name: 'a', candidateKey: 'missing-tool', candidateId: 'abc' });
      await storage.createDataset({ name: 'b', candidateKey: 'missing-tool', candidateId: 'xyz' });
      await storage.createDataset({ name: 'c', candidateKey: 'wrong-arg', candidateId: 'abc' });

      const byKey = await storage.listDatasets({
        pagination: { page: 0, perPage: 100 },
        filters: { candidateKey: 'missing-tool' },
      });
      expect(byKey.datasets).toHaveLength(2);

      const byKeyAndId = await storage.listDatasets({
        pagination: { page: 0, perPage: 100 },
        filters: { candidateKey: 'missing-tool', candidateId: 'abc' },
      });
      expect(byKeyAndId.datasets).toHaveLength(1);
      expect(byKeyAndId.datasets[0]!.name).toBe('a');
    });

    it('listItems filters by tenancy', async () => {
      const a = await storage.createDataset({ name: 'a', organizationId: 'org-1' });
      const b = await storage.createDataset({ name: 'b', organizationId: 'org-2' });
      await storage.addItem({ datasetId: a.id, input: { a: 1 } });
      await storage.addItem({ datasetId: b.id, input: { b: 1 } });

      const aItems = await storage.listItems({
        datasetId: a.id,
        pagination: { page: 0, perPage: 100 },
        filters: { organizationId: 'org-1' },
      });
      expect(aItems.items).toHaveLength(1);

      const wrongOrg = await storage.listItems({
        datasetId: a.id,
        pagination: { page: 0, perPage: 100 },
        filters: { organizationId: 'org-2' },
      });
      expect(wrongOrg.items).toHaveLength(0);
    });

    it('source.type accepts candidate-screener', async () => {
      const dataset = await storage.createDataset({ name: 'd' });
      const item = await storage.addItem({
        datasetId: dataset.id,
        input: { a: 1 },
        source: { type: 'candidate-screener', referenceId: 'verdict-123' },
      });
      expect(item.source?.type).toBe('candidate-screener');
      expect(item.source?.referenceId).toBe('verdict-123');
    });
  });
});

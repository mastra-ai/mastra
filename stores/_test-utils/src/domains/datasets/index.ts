import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { MastraStorage, DatasetsStorage, DatasetRecord, DatasetItem } from '@mastra/core/storage';

export function createDatasetsTests({ storage }: { storage: MastraStorage }) {
  // Skip tests if storage doesn't have datasets domain
  const describeDatasets = storage.stores?.datasets ? describe : describe.skip;

  let datasetsStorage: DatasetsStorage;

  describeDatasets('Datasets Storage', () => {
    beforeAll(async () => {
      const store = await storage.getStore('datasets');
      if (!store) {
        throw new Error('Datasets storage not found');
      }
      datasetsStorage = store;
    });

    // ---------------------------------------------------------------------------
    // Dataset CRUD
    // ---------------------------------------------------------------------------
    describe('Dataset CRUD', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('createDataset returns record with UUID id and version=0', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'test-ds' });

        expect(ds.id).toBeDefined();
        expect(ds.id.length).toBe(36);
        expect(ds.name).toBe('test-ds');
        expect(ds.version).toBe(0);
        expect(ds.createdAt).toBeInstanceOf(Date);
      });

      it('getDatasetById returns record or null', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'get-test' });
        const found = await datasetsStorage.getDatasetById({ id: ds.id });
        const notFound = await datasetsStorage.getDatasetById({ id: 'nonexistent' });

        expect(found).toBeDefined();
        expect(found!.id).toBe(ds.id);
        expect(notFound).toBeNull();
      });

      it('updateDataset updates fields and returns merged record', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'update-test' });
        const updated = await datasetsStorage.updateDataset({
          id: ds.id,
          name: 'updated-name',
          description: 'new desc',
        });

        expect(updated.name).toBe('updated-name');
        expect(updated.description).toBe('new desc');
        expect(updated.version).toBe(0); // version unchanged by update
      });

      it('updateDataset throws for non-existent dataset', async () => {
        await expect(datasetsStorage.updateDataset({ id: 'non-existent', name: 'x' })).rejects.toThrow();
      });

      it('deleteDataset removes dataset + items + versions', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'delete-test' });
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hello' } });
        await datasetsStorage.deleteDataset({ id: ds.id });

        expect(await datasetsStorage.getDatasetById({ id: ds.id })).toBeNull();
      });

      it('listDatasets with pagination', async () => {
        await datasetsStorage.createDataset({ name: 'ds-1' });
        await datasetsStorage.createDataset({ name: 'ds-2' });
        await datasetsStorage.createDataset({ name: 'ds-3' });

        const page0 = await datasetsStorage.listDatasets({ pagination: { page: 0, perPage: 2 } });
        expect(page0.datasets).toHaveLength(2);
        expect(page0.pagination.total).toBe(3);
        expect(page0.pagination.hasMore).toBe(true);

        const page1 = await datasetsStorage.listDatasets({ pagination: { page: 1, perPage: 2 } });
        expect(page1.datasets).toHaveLength(1);
        expect(page1.pagination.hasMore).toBe(false);
      });
    });

    // ---------------------------------------------------------------------------
    // Item CRUD
    // ---------------------------------------------------------------------------
    describe('Item CRUD', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('addItem returns item with version and id', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-add' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hello' } });

        expect(item.id).toBeDefined();
        expect(item.datasetVersion).toBe(1);
        expect(item.input).toEqual({ q: 'hello' });
      });

      it('addItem throws for non-existent dataset', async () => {
        await expect(datasetsStorage.addItem({ datasetId: 'non-existent', input: {} })).rejects.toThrow();
      });

      it('getItemById returns item or null', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-get' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'test' } });

        const found = await datasetsStorage.getItemById({ id: item.id });
        expect(found).toBeDefined();
        expect(found!.id).toBe(item.id);

        const notFound = await datasetsStorage.getItemById({ id: 'nonexistent' });
        expect(notFound).toBeNull();
      });

      it('updateItem creates new version row', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-update' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'v1' } });

        const updated = await datasetsStorage.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'v2' } });

        expect(updated.datasetVersion).toBe(2);
        expect(updated.input).toEqual({ q: 'v2' });
      });

      it('updateItem throws for non-existent item', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-update-missing' });
        await expect(datasetsStorage.updateItem({ id: 'non-existent', datasetId: ds.id, input: {} })).rejects.toThrow();
      });

      it('updateItem throws when item does not belong to dataset', async () => {
        const ds1 = await datasetsStorage.createDataset({ name: 'ds1' });
        const ds2 = await datasetsStorage.createDataset({ name: 'ds2' });
        const item = await datasetsStorage.addItem({ datasetId: ds1.id, input: {} });

        await expect(datasetsStorage.updateItem({ id: item.id, datasetId: ds2.id, input: {} })).rejects.toThrow();
      });

      it('deleteItem throws when item does not belong to dataset', async () => {
        const ds1 = await datasetsStorage.createDataset({ name: 'ds1-del' });
        const ds2 = await datasetsStorage.createDataset({ name: 'ds2-del' });
        const item = await datasetsStorage.addItem({ datasetId: ds1.id, input: {} });

        await expect(datasetsStorage.deleteItem({ id: item.id, datasetId: ds2.id })).rejects.toThrow();
      });

      it('deleteItem makes item invisible as current', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'item-delete' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'bye' } });

        await datasetsStorage.deleteItem({ id: item.id, datasetId: ds.id });

        const current = await datasetsStorage.getItemById({ id: item.id });
        expect(current).toBeNull();
      });

      it('listItems paginates current items', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'list-items' });
        await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { q: 'a' } }, { input: { q: 'b' } }, { input: { q: 'c' } }],
        });

        const page0 = await datasetsStorage.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 2 } });
        expect(page0.items).toHaveLength(2);
        expect(page0.pagination.total).toBe(3);
        expect(page0.pagination.hasMore).toBe(true);
      });
    });

    // ---------------------------------------------------------------------------
    // SCD-2 Versioning
    // ---------------------------------------------------------------------------
    describe('SCD-2 Versioning', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('addItem bumps dataset version and inserts version row', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-add' });
        expect(ds.version).toBe(0);

        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'hello' } });
        expect(item.datasetVersion).toBe(1);

        // Dataset version bumped
        const refreshed = await datasetsStorage.getDatasetById({ id: ds.id });
        expect(refreshed!.version).toBe(1);

        // dataset_version row exists
        const versions = await datasetsStorage.listDatasetVersions({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 10 },
        });
        expect(versions.versions).toHaveLength(1);
        expect(versions.versions[0]!.version).toBe(1);
      });

      it('item has validTo=NULL and isDeleted=false', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-flags' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'test' } });

        const history = await datasetsStorage.getItemHistory(item.id);
        expect(history).toHaveLength(1);
        expect(history[0]!.validTo).toBeNull();
        expect(history[0]!.isDeleted).toBe(false);
      });

      it('updateItem closes old row, inserts new row, bumps version', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-update' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'v1' } });

        const updated = await datasetsStorage.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'v2' } });

        expect(updated.datasetVersion).toBe(2);
        expect(updated.input).toEqual({ q: 'v2' });

        const history = await datasetsStorage.getItemHistory(item.id);
        expect(history).toHaveLength(2);

        const oldRow = history.find(h => h.datasetVersion === 1);
        const newRow = history.find(h => h.datasetVersion === 2);

        expect(oldRow!.validTo).toBe(2);
        expect(newRow!.validTo).toBeNull();
        expect(newRow!.isDeleted).toBe(false);
      });

      it('deleteItem closes old row and inserts tombstone', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'scd2-delete' });
        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'bye' } });

        await datasetsStorage.deleteItem({ id: item.id, datasetId: ds.id });

        const current = await datasetsStorage.getItemById({ id: item.id });
        expect(current).toBeNull();

        const history = await datasetsStorage.getItemHistory(item.id);
        expect(history).toHaveLength(2);

        const tombstone = history.find(h => h.isDeleted);
        expect(tombstone).toBeDefined();
        expect(tombstone!.validTo).toBeNull(); // tombstone is the "current" version
      });
    });

    // ---------------------------------------------------------------------------
    // Version Query Semantics
    // ---------------------------------------------------------------------------
    describe('Version Query Semantics', () => {
      let ds: DatasetRecord;
      let item1: DatasetItem;

      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
        ds = await datasetsStorage.createDataset({ name: 'scd2-queries' });
        item1 = await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'original' } });
        // version is now 1
        await datasetsStorage.updateItem({ id: item1.id, datasetId: ds.id, input: { q: 'updated' } });
        // version is now 2
      });

      it('getItemById without version returns current row', async () => {
        const current = await datasetsStorage.getItemById({ id: item1.id });
        expect(current!.input).toEqual({ q: 'updated' });
      });

      it('getItemById with version returns that exact version', async () => {
        const v1 = await datasetsStorage.getItemById({ id: item1.id, datasetVersion: 1 });
        expect(v1!.input).toEqual({ q: 'original' });

        const v2 = await datasetsStorage.getItemById({ id: item1.id, datasetVersion: 2 });
        expect(v2!.input).toEqual({ q: 'updated' });
      });

      it('getItemsByVersion returns correct snapshot', async () => {
        // Add another item at version 3 so we have 2 items
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'second' } });
        // version is now 3

        // At version 1: only item1 with original value
        const v1Items = await datasetsStorage.getItemsByVersion({ datasetId: ds.id, version: 1 });
        expect(v1Items).toHaveLength(1);
        expect(v1Items[0]!.input).toEqual({ q: 'original' });

        // At version 3: item1 (updated) + second item
        const v3Items = await datasetsStorage.getItemsByVersion({ datasetId: ds.id, version: 3 });
        expect(v3Items).toHaveLength(2);
      });

      it('getItemHistory returns all rows ordered by datasetVersion DESC', async () => {
        const history = await datasetsStorage.getItemHistory(item1.id);
        expect(history.length).toBeGreaterThanOrEqual(2);
        expect(history[0]!.datasetVersion).toBeGreaterThan(history[1]!.datasetVersion);
      });

      it('listItems supports version param for time-travel', async () => {
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'second' } });
        // v1: 1 item, v2: 1 item (updated), v3: 2 items

        const v1 = await datasetsStorage.listItems({
          datasetId: ds.id,
          version: 1,
          pagination: { page: 0, perPage: 10 },
        });
        expect(v1.items).toHaveLength(1);

        const v3 = await datasetsStorage.listItems({
          datasetId: ds.id,
          version: 3,
          pagination: { page: 0, perPage: 10 },
        });
        expect(v3.items).toHaveLength(2);
      });
    });

    // ---------------------------------------------------------------------------
    // Bulk Operations
    // ---------------------------------------------------------------------------
    describe('Bulk Operations', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('batchInsertItems uses single version bump for all items', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'bulk-add' });

        const items = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { q: 'a' } }, { input: { q: 'b' } }, { input: { q: 'c' } }],
        });

        expect(items).toHaveLength(3);
        // All items should have the same version
        const versions = new Set(items.map(i => i.datasetVersion));
        expect(versions.size).toBe(1);

        // Dataset version bumped by exactly 1
        const refreshed = await datasetsStorage.getDatasetById({ id: ds.id });
        expect(refreshed!.version).toBe(1);

        // Only 1 dataset_version row
        const dv = await datasetsStorage.listDatasetVersions({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 10 },
        });
        expect(dv.versions).toHaveLength(1);
      });

      it('batchInsertItems validates against inputSchema', async () => {
        const ds = await datasetsStorage.createDataset({
          name: 'schema-test',
          inputSchema: {
            type: 'object',
            properties: { prompt: { type: 'string' } },
            required: ['prompt'],
          },
        });

        const validResult = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { prompt: 'hello' } }, { input: { prompt: 'world' } }],
        });
        expect(validResult).toHaveLength(2);

        await expect(
          datasetsStorage.batchInsertItems({
            datasetId: ds.id,
            items: [{ input: { notPrompt: 123 } }],
          }),
        ).rejects.toThrow();
      });

      it('batchDeleteItems creates tombstones for all items', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'bulk-delete' });
        const items = await datasetsStorage.batchInsertItems({
          datasetId: ds.id,
          items: [{ input: { q: 'x' } }, { input: { q: 'y' } }],
        });

        await datasetsStorage.batchDeleteItems({
          datasetId: ds.id,
          itemIds: items.map(i => i.id),
        });

        // No current items visible
        const list = await datasetsStorage.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } });
        expect(list.items).toHaveLength(0);

        // Version bumped by 1 more (total 2: 1 for bulk add + 1 for bulk delete)
        const refreshed = await datasetsStorage.getDatasetById({ id: ds.id });
        expect(refreshed!.version).toBe(2);
      });
    });

    // ---------------------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------------------
    describe('Edge Cases', () => {
      beforeEach(async () => {
        await datasetsStorage.dangerouslyClearAll();
      });

      it('getDatasetById returns null for non-existent id', async () => {
        const result = await datasetsStorage.getDatasetById({ id: 'nonexistent-id' });
        expect(result).toBeNull();
      });

      it('getItemById returns null for non-existent id', async () => {
        const result = await datasetsStorage.getItemById({ id: 'nonexistent-id' });
        expect(result).toBeNull();
      });

      it('complex JSON roundtrips correctly', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'json-test' });
        const complexInput = {
          nested: { deeply: { value: [1, 2, 3] } },
          nullVal: null,
          boolVal: true,
          numVal: 42.5,
        };

        const item = await datasetsStorage.addItem({ datasetId: ds.id, input: complexInput });
        const retrieved = await datasetsStorage.getItemById({ id: item.id });

        expect(retrieved!.input).toEqual(complexInput);
      });

      it('dangerouslyClearAll empties all tables', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'clear-test' });
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'data' } });

        await datasetsStorage.dangerouslyClearAll();

        const list = await datasetsStorage.listDatasets({ pagination: { page: 0, perPage: 10 } });
        expect(list.datasets).toHaveLength(0);
      });

      it('dataset versions paginate and order by version DESC', async () => {
        const ds = await datasetsStorage.createDataset({ name: 'ver-list' });
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'a' } }); // v1
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'b' } }); // v2
        await datasetsStorage.addItem({ datasetId: ds.id, input: { q: 'c' } }); // v3

        const result = await datasetsStorage.listDatasetVersions({
          datasetId: ds.id,
          pagination: { page: 0, perPage: 2 },
        });

        expect(result.versions).toHaveLength(2);
        expect(result.versions[0]!.version).toBeGreaterThan(result.versions[1]!.version);
        expect(result.pagination.total).toBe(3);
        expect(result.pagination.hasMore).toBe(true);
      });
    });
  }); // describeDatasets
}

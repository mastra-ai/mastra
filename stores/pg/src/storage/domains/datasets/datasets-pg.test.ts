import { TABLE_DATASETS, TABLE_DATASET_ITEMS, TABLE_DATASET_VERSIONS } from '@mastra/core/storage';
import type { DatasetRecord, DatasetItem } from '@mastra/core/storage';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { connectionString } from '../../test-utils';

// Will import once the file exists — test file is written before implementation
import { DatasetsPG } from './index';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const TEST_SCHEMA = 'datasets_test';

describe('DatasetsPG', () => {
  let datasets: DatasetsPG;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    datasets = new DatasetsPG({ pool, schemaName: TEST_SCHEMA });
    await datasets.init();
  });

  afterAll(async () => {
    await datasets.dangerouslyClearAll();
    await pool.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await pool.end();
  });

  beforeEach(async () => {
    await datasets.dangerouslyClearAll();
  });

  // ---------------------------------------------------------------------------
  // T1.2 — Class structure
  // ---------------------------------------------------------------------------
  describe('T1.2 — Class structure', () => {
    it('has MANAGED_TABLES with 3 dataset tables', () => {
      expect(DatasetsPG.MANAGED_TABLES).toContain(TABLE_DATASETS);
      expect(DatasetsPG.MANAGED_TABLES).toContain(TABLE_DATASET_ITEMS);
      expect(DatasetsPG.MANAGED_TABLES).toContain(TABLE_DATASET_VERSIONS);
      expect(DatasetsPG.MANAGED_TABLES).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.3 — DDL export
  // ---------------------------------------------------------------------------
  describe('T1.3 — DDL export', () => {
    it('getExportDDL returns SQL containing all 3 tables', () => {
      const ddl = DatasetsPG.getExportDDL();
      const joined = ddl.join('\n');

      expect(joined).toContain(TABLE_DATASETS);
      expect(joined).toContain(TABLE_DATASET_ITEMS);
      expect(joined).toContain(TABLE_DATASET_VERSIONS);
    });

    it('dataset_items DDL includes composite PK', () => {
      const ddl = DatasetsPG.getExportDDL();
      const itemsDdl = ddl.find(s => s.includes(TABLE_DATASET_ITEMS));

      expect(itemsDdl).toBeDefined();
      expect(itemsDdl).toContain('PRIMARY KEY');
      expect(itemsDdl).toContain('"id"');
      expect(itemsDdl).toContain('"datasetVersion"');
    });
  });

  // ---------------------------------------------------------------------------
  // T1.4 — init creates tables
  // ---------------------------------------------------------------------------
  describe('T1.4 — init creates tables', () => {
    it('all 3 tables exist in PG after init', async () => {
      for (const table of [TABLE_DATASETS, TABLE_DATASET_ITEMS, TABLE_DATASET_VERSIONS]) {
        const result = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '${TEST_SCHEMA}' AND table_name = $1)`,
          [table],
        );
        expect(result.rows[0]?.exists).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // T1.5 — Default indexes
  // ---------------------------------------------------------------------------
  describe('T1.5 — Default indexes', () => {
    it('getDefaultIndexDefinitions returns 5 indexes', () => {
      const indexes = datasets.getDefaultIndexDefinitions();
      expect(indexes).toHaveLength(5);
    });

    it('all 5 indexes exist in PG after init', async () => {
      const expectedIndexes = [
        'idx_dataset_items_dataset_validto',
        'idx_dataset_items_dataset_version',
        'idx_dataset_items_dataset_validto_deleted',
        'idx_dataset_versions_dataset_version',
        'idx_dataset_versions_dataset_version_unique',
      ];

      for (const indexName of expectedIndexes) {
        const result = await pool.query(
          `SELECT 1 FROM pg_indexes WHERE indexname = $1 AND schemaname = '${TEST_SCHEMA}'`,
          [indexName],
        );
        expect(result.rowCount).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // T1.6 — Dataset CRUD
  // ---------------------------------------------------------------------------
  describe('T1.6 — Dataset CRUD', () => {
    it('createDataset returns record with UUID id and version=0', async () => {
      const ds = await datasets.createDataset({ name: 'test-ds' });

      expect(ds.id).toBeDefined();
      expect(ds.id.length).toBe(36); // UUID
      expect(ds.name).toBe('test-ds');
      expect(ds.version).toBe(0);
      expect(ds.createdAt).toBeInstanceOf(Date);
    });

    it('getDatasetById returns record or null', async () => {
      const ds = await datasets.createDataset({ name: 'get-test' });
      const found = await datasets.getDatasetById({ id: ds.id });
      const notFound = await datasets.getDatasetById({ id: 'nonexistent' });

      expect(found).toBeDefined();
      expect(found!.id).toBe(ds.id);
      expect(notFound).toBeNull();
    });

    it('updateDataset updates fields and returns merged record', async () => {
      const ds = await datasets.createDataset({ name: 'update-test' });
      const updated = await datasets.updateDataset({ id: ds.id, name: 'updated-name', description: 'new desc' });

      expect(updated.name).toBe('updated-name');
      expect(updated.description).toBe('new desc');
      expect(updated.version).toBe(0); // version unchanged by update
    });

    it('deleteDataset removes dataset + items + versions', async () => {
      const ds = await datasets.createDataset({ name: 'delete-test' });
      await datasets.addItem({ datasetId: ds.id, input: { q: 'hello' } });
      await datasets.deleteDataset({ id: ds.id });

      expect(await datasets.getDatasetById({ id: ds.id })).toBeNull();
    });

    it('listDatasets with pagination', async () => {
      await datasets.createDataset({ name: 'ds-1' });
      await datasets.createDataset({ name: 'ds-2' });
      await datasets.createDataset({ name: 'ds-3' });

      const page0 = await datasets.listDatasets({ pagination: { page: 0, perPage: 2 } });
      expect(page0.datasets).toHaveLength(2);
      expect(page0.pagination.total).toBe(3);
      expect(page0.pagination.hasMore).toBe(true);

      const page1 = await datasets.listDatasets({ pagination: { page: 1, perPage: 2 } });
      expect(page1.datasets).toHaveLength(1);
      expect(page1.pagination.hasMore).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.7 — SCD-2 addItem
  // ---------------------------------------------------------------------------
  describe('T1.7 — SCD-2 addItem', () => {
    it('addItem bumps dataset version and inserts item + dataset_version', async () => {
      const ds = await datasets.createDataset({ name: 'scd2-add' });
      expect(ds.version).toBe(0);

      const item = await datasets.addItem({ datasetId: ds.id, input: { q: 'hello' } });

      expect(item.datasetVersion).toBe(1);
      expect(item.id).toBeDefined();

      // Dataset version bumped
      const refreshed = await datasets.getDatasetById({ id: ds.id });
      expect(refreshed!.version).toBe(1);

      // dataset_version row exists
      const versions = await datasets.listDatasetVersions({
        datasetId: ds.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(versions.versions).toHaveLength(1);
      expect(versions.versions[0]!.version).toBe(1);
    });

    it('item has validTo=NULL and isDeleted=false', async () => {
      const ds = await datasets.createDataset({ name: 'scd2-flags' });
      const item = await datasets.addItem({ datasetId: ds.id, input: { q: 'test' } });

      // Fetch full history to check SCD-2 fields
      const history = await datasets.getItemHistory(item.id);
      expect(history).toHaveLength(1);
      expect(history[0]!.validTo).toBeNull();
      expect(history[0]!.isDeleted).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.8 — SCD-2 updateItem
  // ---------------------------------------------------------------------------
  describe('T1.8 — SCD-2 updateItem', () => {
    it('updateItem closes old row, inserts new row, bumps version', async () => {
      const ds = await datasets.createDataset({ name: 'scd2-update' });
      const item = await datasets.addItem({ datasetId: ds.id, input: { q: 'v1' } });

      const updated = await datasets.updateItem({ id: item.id, datasetId: ds.id, input: { q: 'v2' } });

      expect(updated.datasetVersion).toBe(2);
      expect(updated.input).toEqual({ q: 'v2' });

      // Old row closed, new row open
      const history = await datasets.getItemHistory(item.id);
      expect(history).toHaveLength(2);

      const oldRow = history.find(h => h.datasetVersion === 1);
      const newRow = history.find(h => h.datasetVersion === 2);

      expect(oldRow!.validTo).toBe(2);
      expect(newRow!.validTo).toBeNull();
      expect(newRow!.isDeleted).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.9 — SCD-2 deleteItem
  // ---------------------------------------------------------------------------
  describe('T1.9 — SCD-2 deleteItem', () => {
    it('deleteItem closes old row and inserts tombstone', async () => {
      const ds = await datasets.createDataset({ name: 'scd2-delete' });
      const item = await datasets.addItem({ datasetId: ds.id, input: { q: 'bye' } });

      await datasets.deleteItem({ id: item.id, datasetId: ds.id });

      // Item no longer visible as current
      const current = await datasets.getItemById({ id: item.id });
      expect(current).toBeNull();

      // History shows closed row + tombstone
      const history = await datasets.getItemHistory(item.id);
      expect(history).toHaveLength(2);

      const tombstone = history.find(h => h.isDeleted);
      expect(tombstone).toBeDefined();
      expect(tombstone!.validTo).toBeNull(); // tombstone is the "current" version
    });
  });

  // ---------------------------------------------------------------------------
  // T1.10 — SCD-2 queries
  // ---------------------------------------------------------------------------
  describe('T1.10 — SCD-2 queries', () => {
    let ds: DatasetRecord;
    let item1: DatasetItem;

    beforeEach(async () => {
      await datasets.dangerouslyClearAll();
      ds = await datasets.createDataset({ name: 'scd2-queries' });
      item1 = await datasets.addItem({ datasetId: ds.id, input: { q: 'original' } });
      // version is now 1
      await datasets.updateItem({ id: item1.id, datasetId: ds.id, input: { q: 'updated' } });
      // version is now 2
    });

    it('getItemById without version returns current row', async () => {
      const current = await datasets.getItemById({ id: item1.id });
      expect(current!.input).toEqual({ q: 'updated' });
    });

    it('getItemById with version returns that exact version', async () => {
      const v1 = await datasets.getItemById({ id: item1.id, datasetVersion: 1 });
      expect(v1!.input).toEqual({ q: 'original' });

      const v2 = await datasets.getItemById({ id: item1.id, datasetVersion: 2 });
      expect(v2!.input).toEqual({ q: 'updated' });
    });

    it('getItemsByVersion returns correct snapshot', async () => {
      // Add another item at version 2 so we have 2 items
      await datasets.addItem({ datasetId: ds.id, input: { q: 'second' } });
      // version is now 3

      // At version 1: only item1 with original value
      const v1Items = await datasets.getItemsByVersion({ datasetId: ds.id, version: 1 });
      expect(v1Items).toHaveLength(1);
      expect(v1Items[0]!.input).toEqual({ q: 'original' });

      // At version 3: item1 (updated) + second item
      const v3Items = await datasets.getItemsByVersion({ datasetId: ds.id, version: 3 });
      expect(v3Items).toHaveLength(2);
    });

    it('getItemHistory returns all rows ordered by datasetVersion DESC', async () => {
      const history = await datasets.getItemHistory(item1.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]!.datasetVersion).toBeGreaterThan(history[1]!.datasetVersion);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.11 — Bulk operations
  // ---------------------------------------------------------------------------
  describe('T1.11 — Bulk operations', () => {
    it('bulkAddItems uses single version bump for all items', async () => {
      const ds = await datasets.createDataset({ name: 'bulk-add' });

      const items = await datasets.bulkAddItems({
        datasetId: ds.id,
        items: [{ input: { q: 'a' } }, { input: { q: 'b' } }, { input: { q: 'c' } }],
      });

      expect(items).toHaveLength(3);
      // All items should have the same version
      const versions = new Set(items.map(i => i.datasetVersion));
      expect(versions.size).toBe(1);

      // Dataset version bumped by exactly 1
      const refreshed = await datasets.getDatasetById({ id: ds.id });
      expect(refreshed!.version).toBe(1);

      // Only 1 dataset_version row
      const dv = await datasets.listDatasetVersions({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } });
      expect(dv.versions).toHaveLength(1);
    });

    it('bulkDeleteItems creates tombstones for all items', async () => {
      const ds = await datasets.createDataset({ name: 'bulk-delete' });
      const items = await datasets.bulkAddItems({
        datasetId: ds.id,
        items: [{ input: { q: 'x' } }, { input: { q: 'y' } }],
      });

      await datasets.bulkDeleteItems({
        datasetId: ds.id,
        itemIds: items.map(i => i.id),
      });

      // No current items visible
      const list = await datasets.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 10 } });
      expect(list.items).toHaveLength(0);

      // Version bumped by 1 more (total 2: 1 for bulk add + 1 for bulk delete)
      const refreshed = await datasets.getDatasetById({ id: ds.id });
      expect(refreshed!.version).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.12 — listItems
  // ---------------------------------------------------------------------------
  describe('T1.12 — listItems', () => {
    it('paginates current items', async () => {
      const ds = await datasets.createDataset({ name: 'list-items' });
      await datasets.bulkAddItems({
        datasetId: ds.id,
        items: [{ input: { q: 'a' } }, { input: { q: 'b' } }, { input: { q: 'c' } }],
      });

      const page0 = await datasets.listItems({ datasetId: ds.id, pagination: { page: 0, perPage: 2 } });
      expect(page0.items).toHaveLength(2);
      expect(page0.pagination.total).toBe(3);
      expect(page0.pagination.hasMore).toBe(true);
    });

    it('supports version param for SCD-2 time-travel', async () => {
      const ds = await datasets.createDataset({ name: 'list-tt' });
      await datasets.addItem({ datasetId: ds.id, input: { q: 'first' } });
      // v1: 1 item
      await datasets.addItem({ datasetId: ds.id, input: { q: 'second' } });
      // v2: 2 items

      const v1 = await datasets.listItems({
        datasetId: ds.id,
        version: 1,
        pagination: { page: 0, perPage: 10 },
      });
      expect(v1.items).toHaveLength(1);

      const v2 = await datasets.listItems({
        datasetId: ds.id,
        version: 2,
        pagination: { page: 0, perPage: 10 },
      });
      expect(v2.items).toHaveLength(2);
    });

    it('supports search via ILIKE on input/groundTruth', async () => {
      const ds = await datasets.createDataset({ name: 'list-search' });
      await datasets.bulkAddItems({
        datasetId: ds.id,
        items: [
          { input: { q: 'apple pie recipe' } },
          { input: { q: 'banana bread' }, groundTruth: { answer: 'delicious apple' } },
          { input: { q: 'cherry tart' } },
        ],
      });

      const results = await datasets.listItems({
        datasetId: ds.id,
        search: 'apple',
        pagination: { page: 0, perPage: 10 },
      });
      // Should match "apple pie recipe" (input) and "delicious apple" (groundTruth)
      expect(results.items.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.13 — Dataset versions
  // ---------------------------------------------------------------------------
  describe('T1.13 — Dataset versions', () => {
    it('createDatasetVersion inserts a row', async () => {
      const ds = await datasets.createDataset({ name: 'ver-test' });
      const ver = await datasets.createDatasetVersion(ds.id, 42);

      expect(ver.datasetId).toBe(ds.id);
      expect(ver.version).toBe(42);
      expect(ver.id).toBeDefined();
    });

    it('listDatasetVersions paginates and orders by version DESC', async () => {
      const ds = await datasets.createDataset({ name: 'ver-list' });
      await datasets.addItem({ datasetId: ds.id, input: { q: 'a' } }); // v1
      await datasets.addItem({ datasetId: ds.id, input: { q: 'b' } }); // v2
      await datasets.addItem({ datasetId: ds.id, input: { q: 'c' } }); // v3

      const result = await datasets.listDatasetVersions({
        datasetId: ds.id,
        pagination: { page: 0, perPage: 2 },
      });

      expect(result.versions).toHaveLength(2);
      expect(result.versions[0]!.version).toBeGreaterThan(result.versions[1]!.version);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // T1.14 — dangerouslyClearAll
  // ---------------------------------------------------------------------------
  describe('T1.14 — dangerouslyClearAll', () => {
    it('truncates all 3 tables', async () => {
      const ds = await datasets.createDataset({ name: 'clear-test' });
      await datasets.addItem({ datasetId: ds.id, input: { q: 'data' } });

      await datasets.dangerouslyClearAll();

      const list = await datasets.listDatasets({ pagination: { page: 0, perPage: 10 } });
      expect(list.datasets).toHaveLength(0);
    });
  });
});

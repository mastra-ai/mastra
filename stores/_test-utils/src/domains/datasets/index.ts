import { describe, it, expect, beforeEach } from 'vitest';
import { isValid } from 'ulid';
import {
  TABLE_DATASET_ROWS,
  TABLE_DATASET_VERSIONS,
  TABLE_DATASETS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_ROW_RESULTS,
  type MastraStorage,
} from '@mastra/core/storage';
// import type { DatasetRecord, DatasetRow, DatasetVersion } from '@mastra/core/storage/domains';

// Helper functions for pagination tests
async function createMultipleDatasets(storage: MastraStorage, count: number): Promise<any[]> {
  const datasets: any[] = [];
  for (let i = 0; i < count; i++) {
    const dataset = await storage.createDataset({
      name: `dataset-${i}`,
      description: `Description ${i}`,
      metadata: { index: i },
    });
    datasets.push(dataset);
  }
  return datasets;
}

async function createMultipleVersions(storage: MastraStorage, datasetId: string, count: number): Promise<any[]> {
  const versions: any[] = [];
  for (let i = 0; i < count; i++) {
    const updated = await storage.updateDataset({
      id: datasetId,
      updates: { name: `updated-${i}` },
    });
    versions.push(updated.currentVersion);
  }
  return versions;
}

async function createMultipleRows(
  storage: MastraStorage,
  datasetId: string,
  count: number,
): Promise<{ rows: any[]; versionId: string }> {
  const rowsToAdd: any[] = [];
  for (let i = 0; i < count; i++) {
    rowsToAdd.push({ input: { value: i } });
  }
  const result = await storage.addDatasetRows({
    datasetId,
    rows: rowsToAdd,
  });
  return result;
}

async function createMultipleRowVersions(
  storage: MastraStorage,
  datasetId: string,
  rowId: string,
  count: number,
): Promise<any[]> {
  const versions: any[] = [];
  for (let i = 0; i < count; i++) {
    const result = await storage.updateDatasetRows({
      datasetId,
      updates: [{ rowId, input: { value: `update-${i}` } }],
    });
    versions.push(result.rows[0]);
  }
  return versions;
}

export function createDatasetsTests({ storage }: { storage: MastraStorage }) {
  describe('Dataset Operations', () => {
    // describe('Dataset Operations', () => {
    beforeEach(async () => {
      await storage.clearTable({ tableName: TABLE_DATASETS });
      await storage.clearTable({ tableName: TABLE_DATASET_ROWS });
      await storage.clearTable({ tableName: TABLE_DATASET_VERSIONS });
      await storage.clearTable({ tableName: TABLE_EXPERIMENTS });
      await storage.clearTable({ tableName: TABLE_EXPERIMENT_ROW_RESULTS });
    });

    describe('dataset management', () => {
      it('should create a dataset and automatically create a version', async () => {
        const dataset = await storage.createDataset({
          name: 'test-dataset',
          description: 'test-dataset-description',
          metadata: { test: 'test' },
        });
        expect(dataset.id).toBeDefined();
        expect(dataset.name).toBe('test-dataset');
        expect(dataset.currentVersion.id).toBeDefined();
        expect(isValid(dataset.currentVersion.id), 'Expected current version id to be a valid ULID').toBe(true);
      });

      it('should create with only required fields', async () => {
        const dataset = await storage.createDataset({
          name: 'test-dataset',
        });
        expect(dataset.id).toBeDefined();
        expect(dataset.name).toBe('test-dataset');
        expect(dataset.metadata).toBeFalsy();
        expect(dataset.description).toBeFalsy();
      });

      it('should get a dataset and its current version', async () => {
        const dataset = await storage.createDataset({
          name: 'test-dataset',
          description: 'test-dataset-description',
          metadata: { test: 'test' },
        });

        const fetchedDataset = await storage.getDataset({ id: dataset.id });
        expect(fetchedDataset.id).toBe(dataset.id);
        expect(fetchedDataset.name).toBe('test-dataset');
        expect(fetchedDataset.currentVersion.id).toBe(dataset.currentVersion.id);
      });

      it('should update a dataset and automatically create a version', async () => {
        const dataset = await storage.createDataset({
          name: 'test-dataset',
          description: 'test-dataset-description',
          metadata: { test: 'test' },
        });

        const updatedDataset = await storage.updateDataset({
          id: dataset.id,
          updates: {
            name: 'test-dataset-updated',
          },
        });

        expect(updatedDataset.id).toBe(dataset.id);
        expect(updatedDataset.name).toBe('test-dataset-updated');
        expect(updatedDataset.metadata?.test).toEqual(dataset.metadata?.test);
        expect(updatedDataset.description).toEqual(dataset.description);
        expect(updatedDataset.currentVersion.id).not.toBe(dataset.currentVersion.id);
        expect(
          updatedDataset.currentVersion.id.localeCompare(dataset.currentVersion.id) > 0,
          'Expected current version version to be greater than the previous version',
        ).toBe(true);
      });

      it('should delete a dataset', async () => {
        const dataset = await storage.createDataset({
          name: 'test-dataset-delete',
          description: 'test-dataset-description',
          metadata: { test: 'test' },
        });

        await storage.deleteDataset({ id: dataset.id });
        await expect(storage.getDataset({ id: dataset.id })).rejects.toThrow();
      });

      it('deleting a dataset should delete all dataset rows', async () => {
        const dataset = await storage.createDataset({
          name: 'test-dataset-delete-rows',
          description: 'test-dataset-description',
          metadata: { test: 'test' },
        });

        const resultAddDatasetRows = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }],
          datasetId: dataset.id,
        });

        const resultUpdateDatasetRows = await storage.updateDatasetRows({
          updates: [{ rowId: resultAddDatasetRows.rows?.[0]?.rowId!, input: { test: 'test2' } }],
          datasetId: dataset.id,
        });

        await storage.deleteDataset({ id: dataset.id });
        await expect(
          storage.getDatasetRowByRowId({
            rowId: resultAddDatasetRows.rows?.[0]?.rowId!,
            versionId: resultAddDatasetRows.versionId,
          }),
        ).rejects.toThrow();
        await expect(
          storage.getDatasetRowByRowId({
            rowId: resultUpdateDatasetRows.rows?.[0]?.rowId!,
            versionId: resultUpdateDatasetRows.versionId,
          }),
        ).rejects.toThrow();
      });

      it('should get dataset versions', async () => {
        const dataset = await storage.createDataset({
          name: 'test-dataset-versions',
          description: 'test-dataset-description',
          metadata: { test: 'test' },
        });

        const updatedDataset = await storage.updateDataset({
          id: dataset.id,
          updates: {
            name: 'test-dataset-versions-updated',
          },
        });

        const result = await storage.getDatasetVersions({
          datasetId: dataset.id,
          pagination: { page: 0, perPage: 10 },
        });
        const versions = [...result.versions].sort((a, b) => b.id.localeCompare(a.id));
        expect(result.versions.length).toBe(2);
        expect(result.versions[1]?.id).toBe(dataset.currentVersion.id);
        expect(result.versions[0]?.id).toBe(updatedDataset.currentVersion.id);
        expect(versions[0]?.id).toBe(updatedDataset.currentVersion.id);
        expect(versions[1]?.id).toBe(dataset.currentVersion.id);
      });
    });

    describe('dataset row management', () => {
      let dataset: any;
      beforeEach(async () => {
        dataset = await storage.createDataset({
          name: 'test-dataset-row-management',
        });
      });

      it('should add a dataset row and automatically create a version', async () => {
        const result = await storage.addDatasetRows({
          rows: [
            {
              input: { test: 'test' },
            },
          ],
          datasetId: dataset.id,
        });
        expect(result.rows.length).toBe(1);
        expect(result.rows[0]?.input).toEqual({ test: 'test' });
        expect(result.rows[0]?.datasetId).toBe(dataset.id);
        expect(result.rows[0]?.versionId).toBeDefined();

        const updatedDatasetVersion = await storage.getDataset({ id: dataset.id });
        expect(updatedDatasetVersion.currentVersion.id).toBe(result.rows[0]?.versionId!);
        expect(updatedDatasetVersion.currentVersion.id).not.toBe(dataset.currentVersion.id);
      });

      it('should add multiple dataset rows and they all have the same version id', async () => {
        const result = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }, { input: { test: 'test2' } }],
          datasetId: dataset.id,
        });
        expect(result.rows.length).toBe(2);
        expect(result.rows[0]?.versionId).toBe(result.rows[1]?.versionId!);
      });

      it('should get a dataset row by row id', async () => {
        const result = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }],
          datasetId: dataset.id,
        });

        const row = await storage.getDatasetRowByRowId({
          rowId: result.rows[0]?.rowId!,
          versionId: result.rows[0]?.versionId!,
        });
        expect(row.input).toEqual({ test: 'test' });
        expect(row.datasetId).toBe(dataset.id);
        expect(row.versionId).toBe(result.rows[0]?.versionId!);
      });

      it('should get dataset row without having to pass in a version id', async () => {
        const result = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }],
          datasetId: dataset.id,
        });

        const row = await storage.getDatasetRowByRowId({ rowId: result.rows[0]?.rowId! });
        expect(row.input).toEqual({ test: 'test' });
        expect(row.datasetId).toBe(dataset.id);
        expect(row.versionId).toBe(result.rows[0]?.versionId!);
      });

      it('should update a dataset row', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }],
          datasetId: dataset.id,
        });

        const updateRowsResult = await storage.updateDatasetRows({
          updates: [{ rowId: addRowsResult.rows?.[0]?.rowId!, input: { test: 'test2' } }],
          datasetId: dataset.id,
        });
        expect(updateRowsResult.rows.length).toBe(1);
        expect(updateRowsResult.rows[0]?.input).toEqual({ test: 'test2' });
        expect(updateRowsResult.rows[0]?.datasetId).toBe(dataset.id);
        expect(
          updateRowsResult.rows[0]!.versionId!.localeCompare(addRowsResult.rows[0]!.versionId!) > 0,
          'Expected current version version to be greater than the previous version',
        ).toBe(true);
        expect(updateRowsResult.versionId).toBe(updateRowsResult.rows[0]?.versionId!);
      });

      it('should create a new version when updating a dataset row', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }],
          datasetId: dataset.id,
        });

        const updateRowsResult = await storage.updateDatasetRows({
          updates: [{ rowId: addRowsResult.rows?.[0]?.rowId!, input: { test: 'test2' } }],
          datasetId: dataset.id,
        });

        const getDatasetResult = await storage.getDataset({ id: dataset.id });
        expect(getDatasetResult.currentVersion.id).not.toBe(dataset.currentVersion.id);
        expect(getDatasetResult.currentVersion.id).toBe(updateRowsResult.versionId);
      });

      it('should get dataset row by previous version id', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }],
          datasetId: dataset.id,
        });

        const updateRowsResult = await storage.updateDatasetRows({
          updates: [{ rowId: addRowsResult.rows?.[0]?.rowId!, input: { test: 'test2' } }],
          datasetId: dataset.id,
        });

        const row1 = await storage.getDatasetRowByRowId({
          rowId: addRowsResult.rows?.[0]?.rowId!,
          versionId: addRowsResult.versionId,
        });
        const row2 = await storage.getDatasetRowByRowId({
          rowId: addRowsResult.rows?.[0]?.rowId!,
          versionId: updateRowsResult.versionId,
        });
        expect(row1.input).toEqual({ test: 'test' });
        expect(row2.input).toEqual({ test: 'test2' });
      });

      it('should get dataset row versions by row id', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }, { input: { test: 'something else' } }],
          datasetId: dataset.id,
        });

        const rowToCompare = addRowsResult.rows.find(row => row.input.test === 'test')!;

        expect(rowToCompare).toBeDefined();
        const updateRowsResult = await storage.updateDatasetRows({
          updates: [{ rowId: rowToCompare.rowId, input: { test: 'test2' } }],
          datasetId: dataset.id,
        });

        const updateRowsResult2 = await storage.updateDatasetRows({
          updates: [{ rowId: rowToCompare.rowId, input: { test: 'test3' } }],
          datasetId: dataset.id,
        });

        const deleteRowsResult = await storage.deleteDatasetRows({
          rowIds: [rowToCompare.rowId],
          datasetId: dataset.id,
        });

        const result = await storage.getDatasetRowVersionsByRowId({ rowId: rowToCompare.rowId });
        expect(result.rows.length).toBe(4);
        expect(result.rows[3]?.input).toEqual({ test: 'test' });
        expect(result.rows[2]?.input).toEqual({ test: 'test2' });
        expect(result.rows[1]?.input).toEqual({ test: 'test3' });
        expect(result.rows[0]?.deleted).toEqual(true);

        expect(result.rows[3]?.versionId).toBe(addRowsResult.versionId);
        expect(result.rows[2]?.versionId).toBe(updateRowsResult.versionId);
        expect(result.rows[1]?.versionId).toBe(updateRowsResult2.versionId);
        expect(result.rows[0]?.versionId).toBe(deleteRowsResult.versionId);

        expect(result.rows.every(row => row?.datasetId === dataset.id)).toBe(true);
        expect(result.rows.every(row => row?.rowId === rowToCompare.rowId)).toBe(true);
      });

      it('should soft delete a dataset row', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [{ input: { test: 'test' } }],
          datasetId: dataset.id,
        });

        const deleteRowsResult = await storage.deleteDatasetRows({
          rowIds: [addRowsResult.rows?.[0]?.rowId!],
          datasetId: dataset.id,
        });

        await expect(
          storage.getDatasetRowByRowId({
            rowId: addRowsResult.rows?.[0]?.rowId!,
            versionId: deleteRowsResult.versionId,
          }),
        ).rejects.toThrow();

        const getPreviousVersionResult = await storage.getDatasetRowByRowId({
          rowId: addRowsResult.rows?.[0]?.rowId!,
          versionId: addRowsResult.versionId,
        });
        expect(getPreviousVersionResult.input).toEqual({ test: 'test' });
        expect(getPreviousVersionResult.datasetId).toBe(dataset.id);
        expect(getPreviousVersionResult.versionId).toBe(addRowsResult.versionId);
      });
    });

    describe('pagination', () => {
      describe('datasets', () => {
        it('should return first page with correct items when multiple pages exist', async () => {
          // Arrange: Create 25 datasets
          await createMultipleDatasets(storage, 25);

          // Act: Get first page (10 items)
          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });

          // Assert
          expect(result.datasets.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return second page correctly', async () => {
          await createMultipleDatasets(storage, 25);

          const result = await storage.getDatasets({
            pagination: { page: 1, perPage: 10 },
          });

          expect(result.datasets.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
          expect(result.pagination.page).toBe(1);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return last page with hasMore=false', async () => {
          await createMultipleDatasets(storage, 25);

          const result = await storage.getDatasets({
            pagination: { page: 2, perPage: 10 },
          });

          expect(result.datasets.length).toBe(5);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(false);
          expect(result.pagination.page).toBe(2);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return empty array when no datasets exist', async () => {
          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.datasets.length).toBe(0);
          expect(result.pagination.total).toBe(0);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle single dataset correctly', async () => {
          await createMultipleDatasets(storage, 1);

          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.datasets.length).toBe(1);
          expect(result.pagination.total).toBe(1);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle exact page boundary correctly', async () => {
          await createMultipleDatasets(storage, 10);

          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.datasets.length).toBe(10);
          expect(result.pagination.total).toBe(10);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle one item over boundary correctly', async () => {
          await createMultipleDatasets(storage, 11);

          const firstPage = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasets({
            pagination: { page: 1, perPage: 10 },
          });

          expect(firstPage.datasets.length).toBe(10);
          expect(firstPage.pagination.hasMore).toBe(true);
          expect(secondPage.datasets.length).toBe(1);
          expect(secondPage.pagination.hasMore).toBe(false);
        });

        it('should handle all results fitting on one page', async () => {
          await createMultipleDatasets(storage, 5);

          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.datasets.length).toBe(5);
          expect(result.pagination.total).toBe(5);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should default negative page to 0', async () => {
          await createMultipleDatasets(storage, 5);

          const result = await storage.getDatasets({
            pagination: { page: -1, perPage: 10 },
          });

          expect(result.pagination.page).toBe(0);
          expect(result.datasets.length).toBe(5);
        });

        it('should default zero perPage to 1', async () => {
          await createMultipleDatasets(storage, 5);

          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: 0 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.datasets.length).toBe(1);
        });

        it('should default negative perPage to 1', async () => {
          await createMultipleDatasets(storage, 5);

          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: -5 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.datasets.length).toBe(1);
        });

        it('should return empty array when page number exceeds available pages', async () => {
          await createMultipleDatasets(storage, 5);

          const result = await storage.getDatasets({
            pagination: { page: 10, perPage: 10 },
          });

          expect(result.datasets.length).toBe(0);
          expect(result.pagination.hasMore).toBe(false);
          expect(result.pagination.total).toBe(5);
        });

        it('should use defaults when pagination parameter is omitted', async () => {
          await createMultipleDatasets(storage, 15);

          const result = await storage.getDatasets();

          expect(result.datasets.length).toBe(10);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
          expect(result.pagination.hasMore).toBe(true);
        });

        it('should return datasets with name filter', async () => {
          await createMultipleDatasets(storage, 15);

          const result = await storage.getDatasets({
            filter: { name: 'dataset-1' },
          });

          expect(result.datasets.length).toBe(1);
          expect(result.datasets[0].name).toBe('dataset-1');
        });

        it('should return datasets with currentVersion attached', async () => {
          await createMultipleDatasets(storage, 3);

          const result = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.datasets.length).toBe(3);
          result.datasets.forEach(dataset => {
            expect(dataset.currentVersion).toBeDefined();
            expect(dataset.currentVersion.id).toBeDefined();
            expect(dataset.currentVersion.datasetId).toBe(dataset.id);
          });
        });

        it('should not have duplicate datasets across pages', async () => {
          await createMultipleDatasets(storage, 25);

          const firstPage = await storage.getDatasets({
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasets({
            pagination: { page: 1, perPage: 10 },
          });

          const firstPageIds = new Set(firstPage.datasets.map(d => d.id));
          const secondPageIds = new Set(secondPage.datasets.map(d => d.id));

          const intersection = [...firstPageIds].filter(id => secondPageIds.has(id));
          expect(intersection.length).toBe(0);
        });

        it('should return all datasets when fetching all pages', async () => {
          await createMultipleDatasets(storage, 25);

          const allDatasets: any[] = [];
          for (let page = 0; page < 3; page++) {
            const result = await storage.getDatasets({
              pagination: { page, perPage: 10 },
            });
            allDatasets.push(...result.datasets);
          }

          expect(allDatasets.length).toBe(25);
          const ids = new Set(allDatasets.map(d => d.id));
          expect(ids.size).toBe(25);
        });
      });

      describe('dataset versions', () => {
        let dataset: any;

        beforeEach(async () => {
          dataset = await storage.createDataset({
            name: 'test-dataset-versions-pagination',
          });
        });

        it('should return first page with correct versions when multiple pages exist', async () => {
          // Create 24 additional versions (25 total including initial)
          await createMultipleVersions(storage, dataset.id, 24);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.versions.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return versions in descending order by versionId', async () => {
          await createMultipleVersions(storage, dataset.id, 15);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 10 },
          });

          for (let i = 0; i < result.versions.length - 1; i++) {
            expect(result.versions[i]?.id?.localeCompare(result.versions[i + 1]?.id!)).toBeGreaterThan(0);
          }
        });

        it('should return second page correctly', async () => {
          await createMultipleVersions(storage, dataset.id, 24);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 1, perPage: 10 },
          });

          expect(result.versions.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
        });

        it('should return last page with hasMore=false', async () => {
          await createMultipleVersions(storage, dataset.id, 24);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 2, perPage: 10 },
          });

          expect(result.versions.length).toBe(5);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should return single version for newly created dataset', async () => {
          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.versions.length).toBe(1);
          expect(result.pagination.total).toBe(1);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle exact page boundary correctly', async () => {
          await createMultipleVersions(storage, dataset.id, 9);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.versions.length).toBe(10);
          expect(result.pagination.total).toBe(10);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle one item over boundary correctly', async () => {
          await createMultipleVersions(storage, dataset.id, 10);

          const firstPage = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 1, perPage: 10 },
          });

          expect(firstPage.versions.length).toBe(10);
          expect(firstPage.pagination.hasMore).toBe(true);
          expect(secondPage.versions.length).toBe(1);
          expect(secondPage.pagination.hasMore).toBe(false);
        });

        it('should default negative page to 0', async () => {
          await createMultipleVersions(storage, dataset.id, 5);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: -1, perPage: 10 },
          });

          expect(result.pagination.page).toBe(0);
        });

        it('should default zero perPage to 1', async () => {
          await createMultipleVersions(storage, dataset.id, 5);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 0 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.versions.length).toBe(1);
        });

        it('should default negative perPage to 1', async () => {
          await createMultipleVersions(storage, dataset.id, 5);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: -5 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.versions.length).toBe(1);
        });

        it('should return empty array when page number exceeds available pages', async () => {
          await createMultipleVersions(storage, dataset.id, 5);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 10, perPage: 10 },
          });

          expect(result.versions.length).toBe(0);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should use defaults when pagination parameter is omitted', async () => {
          await createMultipleVersions(storage, dataset.id, 15);

          const result = await storage.getDatasetVersions({
            datasetId: dataset.id,
          });

          expect(result.versions.length).toBe(10);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should not have duplicate versions across pages', async () => {
          await createMultipleVersions(storage, dataset.id, 24);

          const firstPage = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasetVersions({
            datasetId: dataset.id,
            pagination: { page: 1, perPage: 10 },
          });

          const firstPageIds = new Set(firstPage.versions.map(v => v.id));
          const secondPageIds = new Set(secondPage.versions.map(v => v.id));

          const intersection = [...firstPageIds].filter(id => secondPageIds.has(id));
          expect(intersection.length).toBe(0);
        });

        it('should return all versions when fetching all pages', async () => {
          await createMultipleVersions(storage, dataset.id, 24);

          const allVersions: any[] = [];
          for (let page = 0; page < 3; page++) {
            const result = await storage.getDatasetVersions({
              datasetId: dataset.id,
              pagination: { page, perPage: 10 },
            });
            allVersions.push(...result.versions);
          }

          expect(allVersions.length).toBe(25);
          const ids = new Set(allVersions.map(v => v.id));
          expect(ids.size).toBe(25);
        });
      });

      describe('dataset rows', () => {
        let dataset: any;
        let versionId: string;

        beforeEach(async () => {
          dataset = await storage.createDataset({
            name: 'test-dataset-rows-pagination',
          });
        });

        it('should return first page with correct rows when multiple pages exist', async () => {
          const result = await createMultipleRows(storage, dataset.id, 25);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(pageResult.rows.length).toBe(10);
          expect(pageResult.pagination.total).toBe(25);
          expect(pageResult.pagination.hasMore).toBe(true);
          expect(pageResult.pagination.page).toBe(0);
          expect(pageResult.pagination.perPage).toBe(10);
        });

        it('should return rows in descending order by versionId', async () => {
          const result = await createMultipleRows(storage, dataset.id, 15);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: 10 },
          });

          for (let i = 0; i < pageResult.rows.length - 1; i++) {
            expect(
              pageResult.rows[i]?.versionId?.localeCompare(pageResult.rows[i + 1]?.versionId!),
            ).toBeGreaterThanOrEqual(0);
          }
        });

        it('should return second page correctly', async () => {
          const result = await createMultipleRows(storage, dataset.id, 25);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 1, perPage: 10 },
          });

          expect(pageResult.rows.length).toBe(10);
          expect(pageResult.pagination.total).toBe(25);
          expect(pageResult.pagination.hasMore).toBe(true);
        });

        it('should return last page with hasMore=false', async () => {
          const result = await createMultipleRows(storage, dataset.id, 25);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 2, perPage: 10 },
          });

          expect(pageResult.rows.length).toBe(5);
          expect(pageResult.pagination.hasMore).toBe(false);
        });

        it('should return empty array when no rows exist for version', async () => {
          const result = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId: dataset.currentVersion.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.rows.length).toBe(0);
          expect(result.pagination.total).toBe(0);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle single row correctly', async () => {
          const result = await createMultipleRows(storage, dataset.id, 1);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(pageResult.rows.length).toBe(1);
          expect(pageResult.pagination.total).toBe(1);
          expect(pageResult.pagination.hasMore).toBe(false);
        });

        it('should handle exact page boundary correctly', async () => {
          const result = await createMultipleRows(storage, dataset.id, 10);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(pageResult.rows.length).toBe(10);
          expect(pageResult.pagination.total).toBe(10);
          expect(pageResult.pagination.hasMore).toBe(false);
        });

        it('should handle one item over boundary correctly', async () => {
          const result = await createMultipleRows(storage, dataset.id, 11);
          versionId = result.versionId;

          const firstPage = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 1, perPage: 10 },
          });

          expect(firstPage.rows.length).toBe(10);
          expect(firstPage.pagination.hasMore).toBe(true);
          expect(secondPage.rows.length).toBe(1);
          expect(secondPage.pagination.hasMore).toBe(false);
        });

        it('should default negative page to 0', async () => {
          const result = await createMultipleRows(storage, dataset.id, 5);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: -1, perPage: 10 },
          });

          expect(pageResult.pagination.page).toBe(0);
        });

        it('should default zero perPage to 1', async () => {
          const result = await createMultipleRows(storage, dataset.id, 5);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: 0 },
          });

          expect(pageResult.pagination.perPage).toBe(1);
          expect(pageResult.rows.length).toBe(1);
        });

        it('should default negative perPage to 1', async () => {
          const result = await createMultipleRows(storage, dataset.id, 5);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: -5 },
          });

          expect(pageResult.pagination.perPage).toBe(1);
          expect(pageResult.rows.length).toBe(1);
        });

        it('should return empty array when page number exceeds available pages', async () => {
          const result = await createMultipleRows(storage, dataset.id, 5);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 10, perPage: 10 },
          });

          expect(pageResult.rows.length).toBe(0);
          expect(pageResult.pagination.hasMore).toBe(false);
        });

        it('should use defaults when pagination parameter is omitted', async () => {
          const result = await createMultipleRows(storage, dataset.id, 15);
          versionId = result.versionId;

          const pageResult = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
          });

          expect(pageResult.rows.length).toBe(10);
          expect(pageResult.pagination.page).toBe(0);
          expect(pageResult.pagination.perPage).toBe(10);
        });

        it('should not have duplicate rows across pages', async () => {
          const result = await createMultipleRows(storage, dataset.id, 25);
          versionId = result.versionId;

          const firstPage = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId,
            pagination: { page: 1, perPage: 10 },
          });

          const firstPageIds = new Set(firstPage.rows.map(r => r.rowId));
          const secondPageIds = new Set(secondPage.rows.map(r => r.rowId));

          const intersection = [...firstPageIds].filter(id => secondPageIds.has(id));
          expect(intersection.length).toBe(0);
        });

        it('should return all rows when fetching all pages', async () => {
          const result = await createMultipleRows(storage, dataset.id, 25);
          versionId = result.versionId;

          const allRows: any[] = [];
          for (let page = 0; page < 3; page++) {
            const pageResult = await storage.getDatasetRows({
              datasetId: dataset.id,
              versionId,
              pagination: { page, perPage: 10 },
            });
            allRows.push(...pageResult.rows);
          }

          expect(allRows.length).toBe(25);
          const ids = new Set(allRows.map(r => r.rowId));
          expect(ids.size).toBe(25);
        });

        it('should return snapshot of rows at specified versionId', async () => {
          // Version 1: Add 3 rows
          const batch1 = await createMultipleRows(storage, dataset.id, 3);
          const row1Id = batch1.rows[0].rowId;
          const row2Id = batch1.rows[1].rowId;
          const row3Id = batch1.rows[2].rowId;

          // Version 2: Update row1
          const batch2 = await storage.updateDatasetRows({
            datasetId: dataset.id,
            updates: [{ rowId: row1Id, input: { value: 'updated' } }],
          });

          // Version 3: Add 2 more rows
          const batch3 = await createMultipleRows(storage, dataset.id, 2);

          // Query for version 2 snapshot - should get:
          // - row1 with version 2 (updated)
          // - row2 with version 1 (original)
          // - row3 with version 1 (original)
          // - NOT the 2 rows added in version 3
          const version2Rows = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId: batch2.versionId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(version2Rows.rows.length).toBe(3);

          const row1 = version2Rows.rows.find(r => r.rowId === row1Id);
          const row2 = version2Rows.rows.find(r => r.rowId === row2Id);
          const row3 = version2Rows.rows.find(r => r.rowId === row3Id);

          expect(row1).toBeDefined();
          expect(row1?.versionId).toBe(batch2.versionId); // Updated version
          expect(row1?.input.value).toBe('updated');

          expect(row2).toBeDefined();
          expect(row2?.versionId).toBe(batch1.versionId); // Original version

          expect(row3).toBeDefined();
          expect(row3?.versionId).toBe(batch1.versionId); // Original version

          // Query for version 3 snapshot - should get all 5 rows
          const version3Rows = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId: batch3.versionId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(version3Rows.rows.length).toBe(5);
        });

        it('should return closest earlier version when querying for non-existent version', async () => {
          // Create rows with version V1
          const batch1 = await createMultipleRows(storage, dataset.id, 2);
          const rowId = batch1.rows[0].rowId;
          const rowId2 = batch1.rows[1].rowId;

          // Update to create version V2
          const batch2 = await storage.updateDatasetRows({
            datasetId: dataset.id,
            updates: [{ rowId, input: { value: 'v2' } }],
          });

          const batch3 = await storage.updateDatasetRows({
            datasetId: dataset.id,
            updates: [{ rowId: rowId2, input: { value: 'v3' } }],
          });

          // Update again to create version V3
          const batch4 = await storage.updateDatasetRows({
            datasetId: dataset.id,
            updates: [{ rowId, input: { value: 'v4' } }],
          });

          // Query for future version - should return V3 (closest without going over)
          const futureSnapshot = await storage.getDatasetRows({
            datasetId: dataset.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(futureSnapshot.rows.length).toBe(2);
          const targetRow = futureSnapshot.rows.find(r => r.rowId === rowId);
          expect(targetRow).toBeDefined();
          expect(targetRow?.versionId).toBe(batch4.versionId);
          expect(targetRow?.input.value).toBe('v4');

          // Query for version between V2 and V3 - should return V2
          const betweenSnapshot = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId: batch3.versionId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(betweenSnapshot.rows.length).toBe(2);
          const targetRow2 = betweenSnapshot.rows.find(r => r.rowId === rowId);
          expect(targetRow2).toBeDefined();
          expect(targetRow2?.versionId).toBe(batch2.versionId);
          expect(targetRow2?.input.value).toBe('v2');
        });

        it('should not return deleted rows', async () => {
          const batch1 = await createMultipleRows(storage, dataset.id, 2);
          const rowId = batch1.rows[0].rowId;
          const rowId2 = batch1.rows[1].rowId;

          const batch2 = await storage.deleteDatasetRows({
            datasetId: dataset.id,
            rowIds: [rowId, rowId2],
          });

          const snapshot = await storage.getDatasetRows({
            datasetId: dataset.id,
            versionId: batch2.versionId,
          });

          expect(snapshot.rows.length).toBe(0);
        });
      });

      describe('dataset row versions', () => {
        let dataset: any;
        let rowId;

        beforeEach(async () => {
          dataset = await storage.createDataset({
            name: 'test-dataset-row-versions-pagination',
          });
        });

        it('should return first page with correct row versions when multiple pages exist', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;

          // Create 24 more versions (25 total)
          await createMultipleRowVersions(storage, dataset.id, rowId, 24);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.rows.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return row versions in descending order by versionId', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 15);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 10 },
          });

          for (let i = 0; i < result.rows.length - 1; i++) {
            expect(result.rows[i]?.versionId?.localeCompare(result.rows[i + 1]?.versionId!)).toBeGreaterThan(0);
          }
        });

        it('should return second page correctly', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 24);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 1, perPage: 10 },
          });

          expect(result.rows.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
        });

        it('should return last page with hasMore=false', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 24);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 2, perPage: 10 },
          });

          expect(result.rows.length).toBe(5);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle single version correctly', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.rows.length).toBe(1);
          expect(result.pagination.total).toBe(1);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle exact page boundary correctly', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 9);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.rows.length).toBe(10);
          expect(result.pagination.total).toBe(10);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle one item over boundary correctly', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 10);

          const firstPage = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 1, perPage: 10 },
          });

          expect(firstPage.rows.length).toBe(10);
          expect(firstPage.pagination.hasMore).toBe(true);
          expect(secondPage.rows.length).toBe(1);
          expect(secondPage.pagination.hasMore).toBe(false);
        });

        it('should default negative page to 0', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 5);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: -1, perPage: 10 },
          });

          expect(result.pagination.page).toBe(0);
        });

        it('should default zero perPage to 1', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 5);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 0 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.rows.length).toBe(1);
        });

        it('should default negative perPage to 1', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 5);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: -5 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.rows.length).toBe(1);
        });

        it('should return empty array when page number exceeds available pages', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 5);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 10, perPage: 10 },
          });

          expect(result.rows.length).toBe(0);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should use defaults when pagination parameter is omitted', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 15);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
          });

          expect(result.rows.length).toBe(10);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should not have duplicate versions across pages', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 24);

          const firstPage = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 1, perPage: 10 },
          });

          const firstPageVersionIds = new Set(firstPage.rows.map(r => r.versionId));
          const secondPageVersionIds = new Set(secondPage.rows.map(r => r.versionId));

          const intersection = [...firstPageVersionIds].filter(id => secondPageVersionIds.has(id));
          expect(intersection.length).toBe(0);
        });

        it('should return all versions when fetching all pages', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;
          await createMultipleRowVersions(storage, dataset.id, rowId, 24);

          const allVersions: any[] = [];
          for (let page = 0; page < 3; page++) {
            const result = await storage.getDatasetRowVersionsByRowId({
              rowId,
              pagination: { page, perPage: 10 },
            });
            allVersions.push(...result.rows);
          }

          expect(allVersions.length).toBe(25);
          const versionIds = new Set(allVersions.map(r => r.versionId));
          expect(versionIds.size).toBe(25);
        });

        it('should include deleted versions in results', async () => {
          const initialRows = await createMultipleRows(storage, dataset.id, 1);
          rowId = initialRows.rows[0].rowId;

          // Create some updates
          await createMultipleRowVersions(storage, dataset.id, rowId, 3);

          // Delete the row
          await storage.deleteDatasetRows({
            datasetId: dataset.id,
            rowIds: [rowId],
          });

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId,
            pagination: { page: 0, perPage: 10 },
          });

          // Should have: 1 initial + 3 updates + 1 delete = 5 versions
          expect(result.rows.length).toBe(5);
          expect(result.rows[0]?.deleted).toBe(true); // Most recent is the delete
        });

        it('should only return versions for the specified rowId', async () => {
          const rows = await createMultipleRows(storage, dataset.id, 2);
          const rowId1 = rows.rows[0].rowId;
          const rowId2 = rows.rows[1].rowId;

          await createMultipleRowVersions(storage, dataset.id, rowId1, 5);
          await createMultipleRowVersions(storage, dataset.id, rowId2, 3);

          const result = await storage.getDatasetRowVersionsByRowId({
            rowId: rowId1,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.rows.length).toBe(6); // 1 initial + 5 updates
          result.rows.forEach(row => {
            expect(row.rowId).toBe(rowId1);
          });
        });
      });
    });

    describe.only('experiment management', () => {
      // describe('experiment management', () => {
      let dataset: any;

      beforeEach(async () => {
        dataset = await storage.createDataset({
          name: 'test-dataset-experiments',
        });
      });

      describe('createExperiment', () => {
        it('should create an experiment with all required fields', async () => {
          const experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-123',
          });

          expect(experiment.id).toBeDefined();
          expect(experiment.datasetId).toBe(dataset.id);
          expect(experiment.datasetVersionId).toBe(dataset.currentVersion.id);
          expect(experiment.targetType).toBe('agent');
          expect(experiment.targetId).toBe('agent-123');
          expect(experiment.status).toBe('pending');
          expect(experiment.createdAt).toBeInstanceOf(Date);
        });

        it('should create an experiment with optional fields', async () => {
          const experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-789',
            concurrency: 10,
            scorers: {
              'scorer-1': { type: 'automatic' },
              'scorer-2': { type: 'manual' },
            },
          });

          expect(experiment.concurrency).toBe(10);
          expect(experiment.scorers).toEqual({
            'scorer-1': { type: 'automatic' },
            'scorer-2': { type: 'manual' },
          });
        });

        it('should create experiment with default status as pending', async () => {
          const experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-default-status',
          });

          expect(experiment.status).toBe('pending');
        });
      });

      describe('getExperiment', () => {
        it('should get an experiment by id', async () => {
          const created = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-123',
          });

          const fetched = await storage.getExperiment({ id: created.id });

          expect(fetched.id).toBe(created.id);
          expect(fetched.datasetId).toBe(dataset.id);
          expect(fetched.datasetVersionId).toBe(dataset.currentVersion.id);
          expect(fetched.targetType).toBe('agent');
          expect(fetched.targetId).toBe('agent-123');
          expect(fetched.status).toBe('pending');
          expect(fetched.createdAt).toBeInstanceOf(Date);
        });

        it('should get an experiment with all optional fields', async () => {
          const created = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'workflow',
            targetId: 'workflow-456',
            concurrency: 5,
            scorers: {
              'scorer-a': { type: 'automatic' },
              'scorer-b': { type: 'manual' },
            },
          });

          const fetched = await storage.getExperiment({ id: created.id });

          expect(fetched.id).toBe(created.id);
          expect(fetched.targetType).toBe('workflow');
          expect(fetched.targetId).toBe('workflow-456');
          expect(fetched.concurrency).toBe(5);
          expect(fetched.scorers).toEqual({
            'scorer-a': { type: 'automatic' },
            'scorer-b': { type: 'manual' },
          });
        });

        it('should throw error when experiment does not exist', async () => {
          await expect(storage.getExperiment({ id: 'non-existent-id' })).rejects.toThrow();
        });
      });

      describe('updateExperiment', () => {
        it('should update experiment status', async () => {
          const created = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-123',
          });

          const updated = await storage.updateExperiment({
            id: created.id,
            updates: {
              status: 'running',
            },
          });

          expect(updated.id).toBe(created.id);
          expect(updated.status).toBe('running');
          expect(updated.datasetId).toBe(dataset.id);
          expect(updated.targetId).toBe('agent-123');
        });

        it('should update experiment with multiple fields', async () => {
          const created = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'workflow',
            targetId: 'workflow-123',
          });

          const updated = await storage.updateExperiment({
            id: created.id,
            updates: {
              status: 'completed',
              totalItems: 100,
              averageScores: {
                accuracy: 0.95,
                relevance: 0.88,
              },
              completedAt: new Date(),
            },
          });

          expect(updated.status).toBe('completed');
          expect(updated.totalItems).toBe(100);
          expect(updated.averageScores).toEqual({
            accuracy: 0.95,
            relevance: 0.88,
          });
          expect(updated.completedAt).toBeInstanceOf(Date);
        });

        it('should update experiment scorers', async () => {
          const created = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-456',
            scorers: {
              'scorer-1': { type: 'automatic' },
            },
          });

          const updated = await storage.updateExperiment({
            id: created.id,
            updates: {
              scorers: {
                'scorer-1': { type: 'automatic' },
                'scorer-2': { type: 'manual' },
              },
            },
          });

          expect(updated.scorers).toEqual({
            'scorer-1': { type: 'automatic' },
            'scorer-2': { type: 'manual' },
          });
        });

        it('should preserve unchanged fields when updating', async () => {
          const created = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-preserve',
            concurrency: 5,
          });

          const updated = await storage.updateExperiment({
            id: created.id,
            updates: {
              status: 'running',
            },
          });

          expect(updated.id).toBe(created.id);
          expect(updated.status).toBe('running');
          expect(updated.datasetId).toBe(created.datasetId);
          expect(updated.datasetVersionId).toBe(created.datasetVersionId);
          expect(updated.targetType).toBe(created.targetType);
          expect(updated.targetId).toBe(created.targetId);
          expect(updated.concurrency).toBe(created.concurrency);
        });

        it('should throw error when updating non-existent experiment', async () => {
          await expect(
            storage.updateExperiment({
              id: 'non-existent-id',
              updates: { status: 'running' },
            }),
          ).rejects.toThrow();
        });
      });

      describe('deleteExperiment', () => {
        it('should delete an experiment', async () => {
          const experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-to-delete',
          });

          await storage.deleteExperiment({ id: experiment.id });

          await expect(storage.getExperiment({ id: experiment.id })).rejects.toThrow();
        });

        it('should delete experiment and cascade delete all experiment row results', async () => {
          const experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'agent-cascade',
          });

          // Add some dataset rows
          const { rows } = await storage.addDatasetRows({
            datasetId: dataset.id,
            rows: [{ input: { test: 1 } }, { input: { test: 2 } }],
          });

          // Add experiment row results
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: rows?.[0]!.rowId,
              input: { test: 1 },
              output: { result: 'a' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: rows?.[1]!.rowId,
              input: { test: 2 },
              output: { result: 'b' },
              status: 'success',
            },
          ]);

          // Delete the experiment
          await storage.deleteExperiment({ id: experiment.id });

          // Experiment should be deleted
          await expect(storage.getExperiment({ id: experiment.id })).rejects.toThrow();

          // Experiment row results should also be deleted
          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          expect(results.results.length).toBe(0);
        });

        it('should throw error when deleting non-existent experiment', async () => {
          await expect(storage.deleteExperiment({ id: 'non-existent-id' })).rejects.toThrow();
        });
      });

      describe('addExperimentRowResults', () => {
        let experiment: any;
        let datasetRows: any[];

        beforeEach(async () => {
          experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'test-agent',
          });

          // Add some dataset rows
          const result = await storage.addDatasetRows({
            datasetId: dataset.id,
            rows: [
              { input: { query: 'test 1' }, groundTruth: { answer: 'answer 1' } },
              { input: { query: 'test 2' }, groundTruth: { answer: 'answer 2' } },
              { input: { query: 'test 3' }, groundTruth: { answer: 'answer 3' } },
            ],
          });
          datasetRows = result.rows;
        });

        it('should add experiment row results with required fields', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });

          expect(results.results.length).toBe(1);
          expect(results.results[0]!.experimentId).toBe(experiment.id);
          expect(results.results[0]!.datasetRowId).toBe(datasetRows[0].rowId);
          expect(results.results[0]!.input).toEqual({ query: 'test 1' });
          expect(results.results[0]!.status).toBe('success');
          expect(results.results[0]!.id).toBeDefined();
          expect(results.results[0]!.createdAt).toBeInstanceOf(Date);
        });

        it('should add experiment row results with all optional fields', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              output: { response: 'output 1' },
              groundTruth: { answer: 'answer 1' },
              runtimeContext: { userId: 'user-123' },
              status: 'success',
              traceId: 'trace-abc',
              spanId: 'span-xyz',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });

          expect(results.results.length).toBe(1);
          const result = results.results[0];
          expect(result!.output).toEqual({ response: 'output 1' });
          expect(result!.groundTruth).toEqual({ answer: 'answer 1' });
          // expect(result.runtimeContext).toEqual({ userId: 'user-123' });
          expect(result!.traceId).toBe('trace-abc');
          expect(result!.spanId).toBe('span-xyz');
        });

        // it('should add experiment row result with error status and error details', async () => {
        //   await storage.addExperimentRowResults([
        //     {
        //       experimentId: experiment.id,
        //       datasetRowId: datasetRows[0].rowId,
        //       input: { query: 'test 1' },
        //       status: 'error',
        //       error: {
        //         message: 'Something went wrong',
        //         code: 'ERR_001',
        //       },
        //     },
        //   ]);

        //   const results = await storage.getExperimentRowResults({
        //     experimentId: experiment.id,
        //   });

        //   expect(results.results.length).toBe(1);
        //   expect(results.results[0].status).toBe('error');
        //   expect(results.results[0].error).toEqual({
        //     message: 'Something went wrong',
        //     code: 'ERR_001',
        //   });
        // });

        it('should add multiple experiment row results in batch', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              output: { response: 'output 1' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[1].rowId,
              input: { query: 'test 2' },
              output: { response: 'output 2' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[2].rowId,
              input: { query: 'test 3' },
              status: 'error',
              error: { message: 'Failed' },
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });

          expect(results.results.length).toBe(3);
          expect(results.results.filter(r => r.status === 'success').length).toBe(2);
          expect(results.results.filter(r => r.status === 'error').length).toBe(1);
        });

        it('should add results for multiple dataset rows across multiple calls', async () => {
          // First batch
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              status: 'success',
            },
          ]);

          // Second batch
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[1].rowId,
              input: { query: 'test 2' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });

          expect(results.results.length).toBe(2);
        });

        it('should generate unique ids for each result', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[1].rowId,
              input: { query: 'test 2' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });

          const ids = new Set(results.results.map(r => r.id));
          expect(ids.size).toBe(2); // All unique
        });
      });

      describe('getExperimentRowResults', () => {
        let experiment: any;
        let datasetRows: any[];

        beforeEach(async () => {
          experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'test-agent',
          });

          // Add some dataset rows
          const result = await storage.addDatasetRows({
            datasetId: dataset.id,
            rows: Array.from({ length: 30 }, (_, i) => ({
              input: { query: `test ${i}` },
            })),
          });
          datasetRows = result.rows;
        });

        it('should return first page with correct results when multiple pages exist', async () => {
          // Add 25 experiment row results
          const rowResults = Array.from({ length: 25 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            output: { response: `output ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.results.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return second page correctly', async () => {
          const rowResults = Array.from({ length: 25 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 1, perPage: 10 },
          });

          expect(result.results.length).toBe(10);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(true);
          expect(result.pagination.page).toBe(1);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return last page with hasMore=false', async () => {
          const rowResults = Array.from({ length: 25 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 2, perPage: 10 },
          });

          expect(result.results.length).toBe(5);
          expect(result.pagination.total).toBe(25);
          expect(result.pagination.hasMore).toBe(false);
          expect(result.pagination.page).toBe(2);
          expect(result.pagination.perPage).toBe(10);
        });

        it('should return empty array when no results exist', async () => {
          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.results.length).toBe(0);
          expect(result.pagination.total).toBe(0);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle single result correctly', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 0' },
              status: 'success',
            },
          ]);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.results.length).toBe(1);
          expect(result.pagination.total).toBe(1);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle exact page boundary correctly', async () => {
          const rowResults = Array.from({ length: 10 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: 10 },
          });

          expect(result.results.length).toBe(10);
          expect(result.pagination.total).toBe(10);
          expect(result.pagination.hasMore).toBe(false);
        });

        it('should handle one item over boundary correctly', async () => {
          const rowResults = Array.from({ length: 11 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const firstPage = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 1, perPage: 10 },
          });

          expect(firstPage.results.length).toBe(10);
          expect(firstPage.pagination.hasMore).toBe(true);
          expect(secondPage.results.length).toBe(1);
          expect(secondPage.pagination.hasMore).toBe(false);
        });

        it('should default negative page to 0', async () => {
          const rowResults = Array.from({ length: 5 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: -1, perPage: 10 },
          });

          expect(result.pagination.page).toBe(0);
          expect(result.results.length).toBe(5);
        });

        it('should default zero perPage to 1', async () => {
          const rowResults = Array.from({ length: 5 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: 0 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.results.length).toBe(1);
        });

        it('should default negative perPage to 1', async () => {
          const rowResults = Array.from({ length: 5 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: -5 },
          });

          expect(result.pagination.perPage).toBe(1);
          expect(result.results.length).toBe(1);
        });

        it('should return empty array when page number exceeds available pages', async () => {
          const rowResults = Array.from({ length: 5 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 10, perPage: 10 },
          });

          expect(result.results.length).toBe(0);
          expect(result.pagination.hasMore).toBe(false);
          expect(result.pagination.total).toBe(5);
        });

        it('should use defaults when pagination parameter is omitted', async () => {
          const rowResults = Array.from({ length: 15 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });

          expect(result.results.length).toBe(10);
          expect(result.pagination.page).toBe(0);
          expect(result.pagination.perPage).toBe(10);
          expect(result.pagination.hasMore).toBe(true);
        });

        it('should not have duplicate results across pages', async () => {
          const rowResults = Array.from({ length: 25 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const firstPage = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 0, perPage: 10 },
          });
          const secondPage = await storage.getExperimentRowResults({
            experimentId: experiment.id,
            pagination: { page: 1, perPage: 10 },
          });

          const firstPageIds = new Set(firstPage.results.map(r => r.id));
          const secondPageIds = new Set(secondPage.results.map(r => r.id));

          const intersection = [...firstPageIds].filter(id => secondPageIds.has(id));
          expect(intersection.length).toBe(0);
        });

        it('should return all results when fetching all pages', async () => {
          const rowResults = Array.from({ length: 25 }, (_, i) => ({
            experimentId: experiment.id,
            datasetRowId: datasetRows[i].rowId,
            input: { query: `test ${i}` },
            status: 'success' as const,
          }));
          await storage.addExperimentRowResults(rowResults);

          const allResults: any[] = [];
          for (let page = 0; page < 3; page++) {
            const result = await storage.getExperimentRowResults({
              experimentId: experiment.id,
              pagination: { page, perPage: 10 },
            });
            allResults.push(...result.results);
          }

          expect(allResults.length).toBe(25);
          const ids = new Set(allResults.map(r => r.id));
          expect(ids.size).toBe(25);
        });

        it('should only return results for the specified experiment', async () => {
          // Create another experiment
          const experiment2 = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'test-agent-2',
          });

          // Add results for first experiment
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 0' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[1].rowId,
              input: { query: 'test 1' },
              status: 'success',
            },
          ]);

          // Add results for second experiment
          await storage.addExperimentRowResults([
            {
              experimentId: experiment2.id,
              datasetRowId: datasetRows[2].rowId,
              input: { query: 'test 2' },
              status: 'success',
            },
          ]);

          const result = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });

          expect(result.results.length).toBe(2);
          result.results.forEach(r => {
            expect(r.experimentId).toBe(experiment.id);
          });
        });
      });

      describe('getExperimentRowResult', () => {
        let experiment: any;
        let datasetRows: any[];

        beforeEach(async () => {
          experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'test-agent',
          });

          // Add some dataset rows
          const result = await storage.addDatasetRows({
            datasetId: dataset.id,
            rows: [{ input: { query: 'test 1' } }, { input: { query: 'test 2' } }],
          });
          datasetRows = result.rows;
        });

        it('should get an experiment row result by id', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              output: { response: 'output 1' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          const resultId = results.results[0]!.id;

          const fetched = await storage.getExperimentRowResult({ id: resultId });

          expect(fetched.id).toBe(resultId);
          expect(fetched.experimentId).toBe(experiment.id);
          expect(fetched.datasetRowId).toBe(datasetRows[0].rowId);
          expect(fetched.input).toEqual({ query: 'test 1' });
          expect(fetched.output).toEqual({ response: 'output 1' });
          expect(fetched.status).toBe('success');
          expect(fetched.createdAt).toBeInstanceOf(Date);
        });

        it('should get an experiment row result with all optional fields', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              output: { response: 'output 1' },
              groundTruth: { answer: 'answer 1' },
              runtimeContext: { userId: 'user-123' },
              status: 'success',
              traceId: 'trace-abc',
              spanId: 'span-xyz',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          const resultId = results.results[0]!.id;

          const fetched = await storage.getExperimentRowResult({ id: resultId });

          expect(fetched.output).toEqual({ response: 'output 1' });
          expect(fetched.groundTruth).toEqual({ answer: 'answer 1' });
          // expect(fetched.runtimeContext).toEqual({ userId: 'user-123' });
          expect(fetched.traceId).toBe('trace-abc');
          expect(fetched.spanId).toBe('span-xyz');
        });

        it('should get an experiment row result with error status', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              status: 'error',
              error: {
                message: 'Something went wrong',
                code: 'ERR_001',
              },
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          const resultId = results.results[0]!.id;

          const fetched = await storage.getExperimentRowResult({ id: resultId });

          expect(fetched.status).toBe('error');
          expect(fetched.error).toEqual({
            message: 'Something went wrong',
            code: 'ERR_001',
          });
        });

        it('should throw error when experiment row result does not exist', async () => {
          await expect(storage.getExperimentRowResult({ id: 'non-existent-id' })).rejects.toThrow();
        });

        it('should get an experiment row result with comments', async () => {
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              output: { response: 'output 1' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          const resultId = results.results[0]!.id;

          // Add comments
          await storage.addCommentToRowResult({
            experimentRowResultId: resultId,
            comment: 'First comment',
          });

          await storage.addCommentToRowResult({
            experimentRowResultId: resultId,
            comment: 'Second comment',
          });

          // Fetch the result
          const fetched = await storage.getExperimentRowResult({ id: resultId });

          expect(fetched.id).toBe(resultId);
          expect(fetched.comments).toBeDefined();
          expect(fetched.comments!.length).toBe(2);
          expect(fetched.comments![0]!.comment).toBe('First comment');
          expect(fetched.comments![0]!.createdAt).toBeInstanceOf(Date);
          expect(fetched.comments![1]!.comment).toBe('Second comment');
          expect(fetched.comments![1]!.createdAt).toBeInstanceOf(Date);
        });
      });

      describe('updateExperimentRowResults', () => {
        let experiment: any;
        let datasetRows: any[];
        let resultIds: string[];

        beforeEach(async () => {
          experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'test-agent',
          });

          // Add some dataset rows
          const result = await storage.addDatasetRows({
            datasetId: dataset.id,
            rows: [{ input: { query: 'test 1' } }, { input: { query: 'test 2' } }, { input: { query: 'test 3' } }],
          });
          datasetRows = result.rows;

          // Add experiment row results
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[1].rowId,
              input: { query: 'test 2' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[2].rowId,
              input: { query: 'test 3' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          resultIds = results.results.map(r => r.id);
        });

        it('should update an experiment row result', async () => {
          await storage.updateExperimentRowResults([
            {
              id: resultIds[0]!,
              output: { response: 'updated output' },
              status: 'error',
              error: { message: 'Failed' },
              traceId: 'trace-123',
              spanId: 'span-456',
            },
          ]);

          const updated = await storage.getExperimentRowResult({ id: resultIds[0]! });

          expect(updated.id).toBe(resultIds[0]);
          expect(updated.output).toEqual({ response: 'updated output' });
          expect(updated.status).toBe('error');
          expect(updated.error).toEqual({ message: 'Failed' });
          expect(updated.traceId).toBe('trace-123');
          expect(updated.spanId).toBe('span-456');
          expect(updated.updatedAt).toBeInstanceOf(Date);
        });

        it('should update multiple experiment row results in batch', async () => {
          await storage.updateExperimentRowResults([
            {
              id: resultIds[0]!,
              output: { response: 'output 1' },
            },
            {
              id: resultIds[1]!,
              output: { response: 'output 2' },
            },
            {
              id: resultIds[2]!,
              output: { response: 'output 3' },
            },
          ]);

          const updated1 = await storage.getExperimentRowResult({ id: resultIds[0]! });
          const updated2 = await storage.getExperimentRowResult({ id: resultIds[1]! });
          const updated3 = await storage.getExperimentRowResult({ id: resultIds[2]! });

          expect(updated1.output).toEqual({ response: 'output 1' });
          expect(updated2.output).toEqual({ response: 'output 2' });
          expect(updated3.output).toEqual({ response: 'output 3' });
        });

        it('should preserve unchanged fields when updating', async () => {
          // First add an initial output and traceId
          await storage.updateExperimentRowResults([
            {
              id: resultIds[0]!,
              output: { response: 'initial output' },
              traceId: 'trace-initial',
            },
          ]);

          // Now update only the output
          await storage.updateExperimentRowResults([
            {
              id: resultIds[0]!,
              output: { response: 'updated output' },
            },
          ]);

          const updated = await storage.getExperimentRowResult({ id: resultIds[0]! });

          expect(updated.output).toEqual({ response: 'updated output' });
          expect(updated.traceId).toBe('trace-initial'); // Should be preserved
          expect(updated.status).toBe('success'); // Should be preserved
          expect(updated.experimentId).toBe(experiment.id); // Should be preserved
        });

        it('should throw error when updating non-existent experiment row result', async () => {
          await expect(
            storage.updateExperimentRowResults([
              {
                id: 'non-existent-id',
                output: { response: 'updated' },
              },
            ]),
          ).rejects.toThrow();
        });
      });

      describe('deleteExperimentRowResults', () => {
        let experiment: any;
        let datasetRows: any[];
        let resultIds: string[];

        beforeEach(async () => {
          experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'test-agent',
          });

          // Add some dataset rows
          const result = await storage.addDatasetRows({
            datasetId: dataset.id,
            rows: [{ input: { query: 'test 1' } }, { input: { query: 'test 2' } }, { input: { query: 'test 3' } }],
          });
          datasetRows = result.rows;

          // Add experiment row results
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[1].rowId,
              input: { query: 'test 2' },
              status: 'success',
            },
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[2].rowId,
              input: { query: 'test 3' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          resultIds = results.results.map(r => r.id);
        });

        it('should delete an experiment row result', async () => {
          await storage.deleteExperimentRowResults({
            ids: [resultIds[0]!],
          });

          await expect(storage.getExperimentRowResult({ id: resultIds[0]! })).rejects.toThrow();

          // Other results should still exist
          const remaining = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          expect(remaining.results.length).toBe(2);
        });

        it('should delete multiple experiment row results in batch', async () => {
          await storage.deleteExperimentRowResults({
            ids: [resultIds[0]!, resultIds[1]!],
          });

          await expect(storage.getExperimentRowResult({ id: resultIds[0]! })).rejects.toThrow();
          await expect(storage.getExperimentRowResult({ id: resultIds[1]! })).rejects.toThrow();

          // Only one result should remain
          const remaining = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          expect(remaining.results.length).toBe(1);
          expect(remaining.results[0]!.id).toBe(resultIds[2]!);
        });

        it('should throw error when deleting non-existent experiment row result', async () => {
          await expect(
            storage.deleteExperimentRowResults({
              ids: ['non-existent-id'],
            }),
          ).rejects.toThrow();
        });
      });

      describe('addCommentToRowResult', () => {
        let experiment: any;
        let datasetRows: any[];
        let resultId: string;

        beforeEach(async () => {
          experiment = await storage.createExperiment({
            datasetId: dataset.id,
            datasetVersionId: dataset.currentVersion.id,
            targetType: 'agent',
            targetId: 'test-agent',
          });

          // Add a dataset row
          const result = await storage.addDatasetRows({
            datasetId: dataset.id,
            rows: [{ input: { query: 'test 1' } }],
          });
          datasetRows = result.rows;

          // Add an experiment row result
          await storage.addExperimentRowResults([
            {
              experimentId: experiment.id,
              datasetRowId: datasetRows[0].rowId,
              input: { query: 'test 1' },
              output: { response: 'output 1' },
              status: 'success',
            },
          ]);

          const results = await storage.getExperimentRowResults({
            experimentId: experiment.id,
          });
          resultId = results.results[0]!.id;
        });

        it('should add a comment to an experiment row result', async () => {
          const updated = await storage.addCommentToRowResult({
            experimentRowResultId: resultId,
            comment: 'This is a great result',
          });

          expect(updated.id).toBe(resultId);
          expect(updated.comments).toBeDefined();
          expect(updated.comments!.length).toBe(1);
          expect(updated.comments![0]!.comment).toBe('This is a great result');
          expect(updated.comments![0]!.createdAt).toBeInstanceOf(Date);
        });

        it('should add multiple comments to the same result', async () => {
          await storage.addCommentToRowResult({
            experimentRowResultId: resultId,
            comment: 'First comment',
          });

          await storage.addCommentToRowResult({
            experimentRowResultId: resultId,
            comment: 'Second comment',
          });

          const updated = await storage.addCommentToRowResult({
            experimentRowResultId: resultId,
            comment: 'Third comment',
          });

          expect(updated.comments!.length).toBe(3);
          expect(updated.comments![0]!.comment).toBe('First comment');
          expect(updated.comments![1]!.comment).toBe('Second comment');
          expect(updated.comments![2]!.comment).toBe('Third comment');
        });

        it('should preserve existing data when adding a comment', async () => {
          const updated = await storage.addCommentToRowResult({
            experimentRowResultId: resultId,
            comment: 'Great result',
          });

          expect(updated.experimentId).toBe(experiment.id);
          expect(updated.datasetRowId).toBe(datasetRows[0].rowId);
          expect(updated.input).toEqual({ query: 'test 1' });
          expect(updated.output).toEqual({ response: 'output 1' });
          expect(updated.status).toBe('success');
        });

        it('should throw error when adding comment to non-existent result', async () => {
          await expect(
            storage.addCommentToRowResult({
              experimentRowResultId: 'non-existent-id',
              comment: 'This will fail',
            }),
          ).rejects.toThrow();
        });
      });
    });
  });
}

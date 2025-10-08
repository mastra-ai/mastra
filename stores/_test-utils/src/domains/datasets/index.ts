import { describe, it, expect, beforeEach } from 'vitest';
import { decodeTime, isValid } from 'ulid';
import {
  TABLE_DATASET_ROWS,
  TABLE_DATASET_VERSIONS,
  TABLE_DATASETS,
  type MastraStorage,
} from '@mastra/core/storage';

export function createDatasetsTests({ storage }: { storage: MastraStorage }) {
  describe.only('Dataset Operations', () => {
    beforeEach(async () => {
      await storage.clearTable({ tableName: TABLE_DATASETS });
      await storage.clearTable({ tableName: TABLE_DATASET_ROWS });
      await storage.clearTable({ tableName: TABLE_DATASET_VERSIONS });
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
        expect(updatedDataset.currentVersion.id.localeCompare(dataset.currentVersion.id) > 0, 'Expected current version version to be greater than the previous version').toBe(true);
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
          rows: [
            { input: { test: 'test' } },
          ],
          datasetId: dataset.id,
        });
        
        const resultUpdateDatasetRows = await storage.updateDatasetRows({
          updates: [
            { rowId: resultAddDatasetRows.rows[0].rowId, input: { test: 'test2' } },
          ],
          datasetId: dataset.id,
        });

        await storage.deleteDataset({ id: dataset.id });
        await expect(storage.getDatasetRowByRowId({ rowId: resultAddDatasetRows.rows[0].rowId, versionId: resultAddDatasetRows.versionId })).rejects.toThrow();
        await expect(storage.getDatasetRowByRowId({ rowId: resultUpdateDatasetRows.rows[0].rowId, versionId: resultUpdateDatasetRows.versionId })).rejects.toThrow();
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

        const result = await storage.getDatasetVersions({ datasetId: dataset.id, pagination: { page: 0, perPage: 10 } });
        const versions = [...result.versions].sort((a, b) => b.id.localeCompare(a.id));
        expect(result.versions.length).toBe(2);
        expect(result.versions[1].id).toBe(dataset.currentVersion.id);
        expect(result.versions[0].id).toBe(updatedDataset.currentVersion.id);
        expect(versions[0].id).toBe(updatedDataset.currentVersion.id);
        expect(versions[1].id).toBe(dataset.currentVersion.id);
      });

    });

    describe('dataset row management', () => {
      let dataset
      beforeEach(async () => {
        dataset = await storage.createDataset({
          name: 'test-dataset-row-management',
        })
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
        expect(result.rows[0].input).toEqual({ test: 'test' });
        expect(result.rows[0].datasetId).toBe(dataset.id);
        expect(result.rows[0].versionId).toBeDefined();
  
        const updatedDatasetVersion = await storage.getDataset({ id: dataset.id });
        expect(updatedDatasetVersion.currentVersion.id).toBe(result.rows[0].versionId);
        expect(updatedDatasetVersion.currentVersion.id).not.toBe(dataset.currentVersion.id);
      });
  
      it('should add multiple dataset rows and they all have the same version id', async () => {
        const result = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
            { input: { test: 'test2' } },
          ],
          datasetId: dataset.id,
        });
        expect(result.rows.length).toBe(2);
        expect(result.rows[0].versionId).toBe(result.rows[1].versionId);
      });
  
      it('should get a dataset row by row id', async () => {
        const result = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
          ],
          datasetId: dataset.id,
        });
  
        const row = await storage.getDatasetRowByRowId({ rowId: result.rows[0].rowId, versionId: result.rows[0].versionId });
        expect(row.input).toEqual({ test: 'test' });
        expect(row.datasetId).toBe(dataset.id);
        expect(row.versionId).toBe(result.rows[0].versionId);
      });
  
      it('should get dataset row without having to pass in a version id', async () => {
        const result = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
          ],
          datasetId: dataset.id,
        });
  
        const row = await storage.getDatasetRowByRowId({ rowId: result.rows[0].rowId });
        expect(row.input).toEqual({ test: 'test' });
        expect(row.datasetId).toBe(dataset.id);
        expect(row.versionId).toBe(result.rows[0].versionId);
      });
  
      it('should update a dataset row', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
          ],
          datasetId: dataset.id,
        });
  
        const updateRowsResult = await storage.updateDatasetRows({
          updates: [
            { rowId: addRowsResult.rows[0].rowId, input: { test: 'test2' } },
          ],
          datasetId: dataset.id,
        });
        expect(updateRowsResult.rows.length).toBe(1);
        expect(updateRowsResult.rows[0].input).toEqual({ test: 'test2' });
        expect(updateRowsResult.rows[0].datasetId).toBe(dataset.id);
        expect(updateRowsResult.rows[0].versionId.localeCompare(addRowsResult.rows[0].versionId) > 0, 'Expected current version version to be greater than the previous version').toBe(true);
        expect(updateRowsResult.versionId).toBe(updateRowsResult.rows[0].versionId);
      });
  
      it('should create a new version when updating a dataset row', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
          ],
          datasetId: dataset.id,
        });
  
        const updateRowsResult = await storage.updateDatasetRows({
          updates: [
            { rowId: addRowsResult.rows[0].rowId, input: { test: 'test2' } },
          ],
          datasetId: dataset.id,
        });
  
        const getDatasetResult = await storage.getDataset({ id: dataset.id });
        expect(getDatasetResult.currentVersion.id).not.toBe(dataset.currentVersion.id);
        expect(getDatasetResult.currentVersion.id).toBe(updateRowsResult.versionId);
      });
  
      it('should get dataset row by previous version id', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
          ],
          datasetId: dataset.id,
        });
  
        const updateRowsResult = await storage.updateDatasetRows({
          updates: [
            { rowId: addRowsResult.rows[0].rowId, input: { test: 'test2' } },
          ],
          datasetId: dataset.id,
        });
  
        const row1 = await storage.getDatasetRowByRowId({ rowId: addRowsResult.rows[0].rowId, versionId: addRowsResult.versionId });
        const row2 = await storage.getDatasetRowByRowId({ rowId: addRowsResult.rows[0].rowId, versionId: updateRowsResult.versionId });
        expect(row1.input).toEqual({ test: 'test' });
        expect(row2.input).toEqual({ test: 'test2' });
      });

      it('should get dataset row versions by row id', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
            { input: { test: 'something else'}}
          ],
          datasetId: dataset.id,
        });

        const rowToCompare = addRowsResult.rows.find(row => row.input.test === 'test')!;

        expect(rowToCompare).toBeDefined();
        const updateRowsResult = await storage.updateDatasetRows({
          updates: [
            { rowId: rowToCompare.rowId, input: { test: 'test2' } },
          ],
          datasetId: dataset.id,
        });
        
        const updateRowsResult2 = await storage.updateDatasetRows({
          updates: [
            { rowId: rowToCompare.rowId, input: { test: 'test3' } },
          ],
          datasetId: dataset.id,
        });

        const deleteRowsResult = await storage.deleteDatasetRows({
          rowIds: [rowToCompare.rowId],
          datasetId: dataset.id,
        });
        
        const result = await storage.getDatasetRowVersionsByRowId({ rowId: rowToCompare.rowId });
        expect(result.rows.length).toBe(4);
        expect(result.rows[3].input).toEqual({ test: 'test' });
        expect(result.rows[2].input).toEqual({ test: 'test2' });
        expect(result.rows[1].input).toEqual({ test: 'test3' });
        expect(result.rows[0].deleted).toEqual(true);

        expect(result.rows[3].versionId).toBe(addRowsResult.versionId);
        expect(result.rows[2].versionId).toBe(updateRowsResult.versionId);
        expect(result.rows[1].versionId).toBe(updateRowsResult2.versionId);
        expect(result.rows[0].versionId).toBe(deleteRowsResult.versionId);

        expect(result.rows.every(row => row.datasetId === dataset.id)).toBe(true);
        expect(result.rows.every(row => row.rowId === rowToCompare.rowId)).toBe(true);
      });
  
      it('should soft delete a dataset row', async () => {
        const addRowsResult = await storage.addDatasetRows({
          rows: [
            { input: { test: 'test' } },
          ],
          datasetId: dataset.id,
        });
  
        const deleteRowsResult = await storage.deleteDatasetRows({
          rowIds: [addRowsResult.rows[0].rowId],
          datasetId: dataset.id,
        });
  
        await expect(storage.getDatasetRowByRowId({ rowId: addRowsResult.rows[0].rowId, versionId: deleteRowsResult.versionId })).rejects.toThrow();
  
        const getPreviousVersionResult = await storage.getDatasetRowByRowId({ rowId: addRowsResult.rows[0].rowId, versionId: addRowsResult.versionId });
        expect(getPreviousVersionResult.input).toEqual({ test: 'test' });
        expect(getPreviousVersionResult.datasetId).toBe(dataset.id);
        expect(getPreviousVersionResult.versionId).toBe(addRowsResult.versionId);
      });
    });
  });

}

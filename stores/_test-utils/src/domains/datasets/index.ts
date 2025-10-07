import { describe, it, expect, beforeEach } from 'vitest';
import { decodeTime, isValid } from 'ulid';
import {
  TABLE_DATASET_ROWS,
  TABLE_DATASET_VERSIONS,
  TABLE_DATASETS,
  TABLE_SCORERS,
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
        expect(fetchedDataset.currentVersion.version).toBe(dataset.currentVersion.version);
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
        console.log(`updatedDataset.currentVersion`, {
          id: updatedDataset.currentVersion.id,
          version: updatedDataset.currentVersion.version,
          decodeTime: decodeTime(updatedDataset.currentVersion.id),
        });
        console.log(`dataset.currentVersion`, {
          id: dataset.currentVersion.id,
          version: dataset.currentVersion.version,
          decodeTime: decodeTime(dataset.currentVersion.id),
        });
        expect(updatedDataset.currentVersion.id).not.toBe(dataset.currentVersion.id);
        expect(updatedDataset.currentVersion.version.localeCompare(dataset.currentVersion.version) > 0, 'Expected current version version to be greater than the previous version').toBe(true);
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
    });
  });
}

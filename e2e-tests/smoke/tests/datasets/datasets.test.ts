import { describe, it, expect, afterAll } from 'vitest';
import { fetchJson, fetchApi } from '../utils.js';

// Track created datasets for cleanup
const createdDatasetIds: string[] = [];

async function deleteDataset(id: string) {
  await fetchApi(`/api/datasets/${id}`, { method: 'DELETE' }).catch(err => {
    console.warn(`[cleanup] Failed to delete dataset ${id}:`, err);
  });
}

afterAll(async () => {
  for (const id of createdDatasetIds.reverse()) {
    await deleteDataset(id);
  }
});

// NOTE: Test order matters — dataset/item creation tests seed data for later queries.
describe('datasets', () => {
  let datasetId: string;

  describe('POST /datasets', () => {
    it('should create a dataset', async () => {
      const { status, data } = await fetchJson<any>('/api/datasets', {
        method: 'POST',
        body: JSON.stringify({
          name: 'smoke-test-dataset',
          description: 'Dataset for smoke testing',
          metadata: { source: 'smoke' },
        }),
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({
        id: expect.any(String),
        name: 'smoke-test-dataset',
        description: 'Dataset for smoke testing',
        version: 0,
      });
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();

      datasetId = data.id;
      createdDatasetIds.push(datasetId);
    });
  });

  describe('GET /datasets', () => {
    it('should list datasets with pagination', async () => {
      const { status, data } = await fetchJson<any>('/api/datasets');

      expect(status).toBe(200);
      expect(data.pagination).toMatchObject({
        total: 1,
        page: 0,
        perPage: 10,
      });
      expect(data.datasets).toHaveLength(1);

      const found = data.datasets.find((d: any) => d.id === datasetId);
      expect(found).toMatchObject({
        name: 'smoke-test-dataset',
        description: 'Dataset for smoke testing',
      });
    });
  });

  describe('GET /datasets/:datasetId', () => {
    it('should get dataset by ID', async () => {
      const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}`);

      expect(status).toBe(200);
      expect(data).toMatchObject({
        id: datasetId,
        name: 'smoke-test-dataset',
        description: 'Dataset for smoke testing',
        version: 0,
      });
    });

    it('should return 404 for non-existent dataset', async () => {
      const res = await fetchApi('/api/datasets/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /datasets/:datasetId', () => {
    it('should update dataset metadata', async () => {
      const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: 'Updated description',
        }),
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({
        id: datasetId,
        name: 'smoke-test-dataset',
        description: 'Updated description',
      });
    });
  });

  describe('dataset items', () => {
    let itemId: string;
    let secondItemId: string;

    describe('POST /datasets/:datasetId/items', () => {
      it('should add an item to the dataset', async () => {
        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            input: { question: 'What is 2+2?' },
            groundTruth: { answer: '4' },
            metadata: { difficulty: 'easy' },
          }),
        });

        expect(status).toBe(200);
        expect(data).toMatchObject({
          id: expect.any(String),
          datasetId,
          input: { question: 'What is 2+2?' },
          groundTruth: { answer: '4' },
        });

        itemId = data.id;
      });

      it('should add a second item', async () => {
        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            input: { question: 'What is the capital of France?' },
            groundTruth: { answer: 'Paris' },
          }),
        });

        expect(status).toBe(200);
        expect(data).toMatchObject({
          id: expect.any(String),
          datasetId,
          input: { question: 'What is the capital of France?' },
        });

        secondItemId = data.id;
      });
    });

    describe('GET /datasets/:datasetId/items', () => {
      it('should list items with pagination', async () => {
        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items`);

        expect(status).toBe(200);
        expect(data.pagination).toMatchObject({
          total: 2,
          page: 0,
          perPage: 10,
        });
        expect(data.items).toHaveLength(2);
      });
    });

    describe('GET /datasets/:datasetId/items/:itemId', () => {
      it('should get item by ID', async () => {
        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items/${itemId}`);

        expect(status).toBe(200);
        expect(data).toMatchObject({
          id: itemId,
          datasetId,
          input: { question: 'What is 2+2?' },
          groundTruth: { answer: '4' },
        });
      });
    });

    describe('PATCH /datasets/:datasetId/items/:itemId', () => {
      it('should update an item', async () => {
        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            groundTruth: { answer: 'four' },
          }),
        });

        expect(status).toBe(200);
        expect(data).toMatchObject({
          id: itemId,
          groundTruth: { answer: 'four' },
        });
      });
    });

    describe('GET /datasets/:datasetId/items/:itemId/history', () => {
      it('should return SCD-2 item history after update', async () => {
        const { status, data } = await fetchJson<any>(
          `/api/datasets/${datasetId}/items/${itemId}/history`,
        );

        expect(status).toBe(200);
        expect(data.history).toBeInstanceOf(Array);
        // At least 2 versions: original + update
        expect(data.history).toHaveLength(2);

        // All history entries should reference this item
        for (const entry of data.history) {
          expect(entry.id).toBe(itemId);
        }
      });
    });

    describe('GET /datasets/:datasetId/items/:itemId/versions/:version', () => {
      it('should get item at specific dataset version', async () => {
        // Get the current dataset to find its version
        const { data: ds } = await fetchJson<any>(`/api/datasets/${datasetId}`);
        const currentVersion = ds.version;

        const { status, data } = await fetchJson<any>(
          `/api/datasets/${datasetId}/items/${itemId}/versions/${currentVersion}`,
        );

        expect(status).toBe(200);
        expect(data).toMatchObject({
          id: itemId,
          datasetId,
          // Should reflect the updated groundTruth at the current version
          groundTruth: { answer: 'four' },
        });
      });

      it('should return 404 for item at non-existent version', async () => {
        const res = await fetchApi(
          `/api/datasets/${datasetId}/items/${itemId}/versions/99999`,
        );
        expect(res.status).toBe(404);
      });
    });

    describe('POST /datasets/:datasetId/items/batch', () => {
      it('should batch insert items', async () => {
        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items/batch`, {
          method: 'POST',
          body: JSON.stringify({
            items: [
              { input: { question: 'Batch Q1' }, groundTruth: { answer: 'A1' } },
              { input: { question: 'Batch Q2' }, groundTruth: { answer: 'A2' } },
            ],
          }),
        });

        expect(status).toBe(200);
        expect(data.items).toHaveLength(2);
        expect(data.items).toContainEqual(
          expect.objectContaining({ datasetId, input: { question: 'Batch Q1' } }),
        );
        expect(data.items).toContainEqual(
          expect.objectContaining({ datasetId, input: { question: 'Batch Q2' } }),
        );
      });
    });

    describe('DELETE /datasets/:datasetId/items/batch', () => {
      it('should batch delete items', async () => {
        // Get current items to find batch-inserted ones
        const { data: before } = await fetchJson<any>(`/api/datasets/${datasetId}/items`);
        const batchIds = before.items
          .filter((i: any) => i.input?.question?.startsWith('Batch'))
          .map((i: any) => i.id);

        expect(batchIds.length).toBe(2);

        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items/batch`, {
          method: 'DELETE',
          body: JSON.stringify({ itemIds: batchIds }),
        });

        expect(status).toBe(200);
        expect(data).toMatchObject({
          success: true,
          deletedCount: 2,
        });

        // Verify items are gone
        const { data: after } = await fetchJson<any>(`/api/datasets/${datasetId}/items`);
        const remainingIds = after.items.map((i: any) => i.id);
        for (const id of batchIds) {
          expect(remainingIds).not.toContain(id);
        }
      });
    });

    describe('DELETE /datasets/:datasetId/items/:itemId', () => {
      it('should delete an item', async () => {
        const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/items/${secondItemId}`, {
          method: 'DELETE',
        });

        expect(status).toBe(200);
        expect(data).toMatchObject({ success: true });

        // Verify item is gone from the current list
        const { data: listData } = await fetchJson<any>(`/api/datasets/${datasetId}/items`);
        const ids = listData.items.map((i: any) => i.id);
        expect(ids).not.toContain(secondItemId);
      });
    });
  });

  describe('dataset versions', () => {
    it('should list versions after item mutations', async () => {
      const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/versions`);

      expect(status).toBe(200);
      expect(data.versions).toBeInstanceOf(Array);
      // add x2, update, batch insert, batch delete, single delete = at least 6 versions
      expect(data.versions.length).toBeGreaterThanOrEqual(6);

      // Each version should have expected shape
      for (const v of data.versions) {
        expect(v).toMatchObject({
          datasetId,
          version: expect.any(Number),
        });
      }
    });
  });

  describe('experiments', () => {
    it('should list experiments (empty initially)', async () => {
      const { status, data } = await fetchJson<any>(`/api/datasets/${datasetId}/experiments`);

      expect(status).toBe(200);
      expect(data.pagination).toMatchObject({
        total: 0,
        page: 0,
        perPage: 10,
      });
      expect(data.experiments).toHaveLength(0);
    });
  });

  describe('DELETE /datasets/:datasetId', () => {
    it('should delete the dataset', async () => {
      // Create a throwaway dataset to delete — track for cleanup in case test fails
      const { data: created } = await fetchJson<any>('/api/datasets', {
        method: 'POST',
        body: JSON.stringify({ name: 'to-delete' }),
      });
      createdDatasetIds.push(created.id);

      const { status } = await fetchJson<any>(`/api/datasets/${created.id}`, {
        method: 'DELETE',
      });

      expect(status).toBe(200);

      // Verify it's gone
      const res = await fetchApi(`/api/datasets/${created.id}`);
      expect(res.status).toBe(404);
    });
  });
});

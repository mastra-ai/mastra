import { describe, expect, beforeEach, it, vi } from 'vitest';
import type { ClientOptions } from '../types';
import { Dataset } from './dataset';

// Mock fetch globally
global.fetch = vi.fn();

describe.only('Dataset', () => {
  let dataset: Dataset;
  const clientOptions: ClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
    },
  };
  const datasetId = 'test-dataset-id';

  beforeEach(() => {
    vi.clearAllMocks();
    dataset = new Dataset(clientOptions, datasetId);
  });

  const mockFetchResponse = (data: any) => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => data,
      headers: new Headers({
        'content-type': 'application/json',
      }),
    });
  };

  describe('get', () => {
    it('should retrieve dataset details', async () => {
      const mockDataset = {
        id: datasetId,
        name: 'Test Dataset',
        description: 'A test dataset',
        metadata: { test: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentVersion: {
          id: 'version-1',
          datasetId,
          createdAt: new Date().toISOString(),
        },
      };

      mockFetchResponse(mockDataset);

      const result = await dataset.get();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockDataset);
    });
  });

  describe('update', () => {
    it('should update dataset properties', async () => {
      const updateParams = {
        name: 'Updated Dataset',
        description: 'Updated description',
        metadata: { updated: true },
      };

      const mockUpdatedDataset = {
        id: datasetId,
        ...updateParams,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentVersion: {
          id: 'version-1',
          datasetId,
          createdAt: new Date().toISOString(),
        },
      };

      mockFetchResponse(mockUpdatedDataset);

      const result = await dataset.update(updateParams);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateParams),
        }),
      );
      expect(result).toEqual(mockUpdatedDataset);
    });
  });

  describe('delete', () => {
    it('should delete the dataset', async () => {
      const mockResponse = { success: true, message: 'Dataset deleted' };
      mockFetchResponse(mockResponse);

      const result = await dataset.delete();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listVersions', () => {
    it('should retrieve dataset versions without pagination', async () => {
      const mockVersions = {
        versions: [
          { id: 'version-1', datasetId, createdAt: new Date().toISOString() },
          { id: 'version-2', datasetId, createdAt: new Date().toISOString() },
        ],
        pagination: {
          total: 2,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
      };

      mockFetchResponse(mockVersions);

      const result = await dataset.listVersions();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/versions`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockVersions);
    });

    it('should retrieve dataset versions with pagination', async () => {
      const mockVersions = {
        versions: [{ id: 'version-1', datasetId, createdAt: new Date().toISOString() }],
        pagination: {
          total: 10,
          page: 2,
          perPage: 5,
          hasMore: true,
        },
      };

      mockFetchResponse(mockVersions);

      const result = await dataset.listVersions({ page: 2, perPage: 5 });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/versions?page=2&perPage=5`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockVersions);
    });
  });

  describe('addRows', () => {
    it('should add rows to the dataset', async () => {
      const addParams = {
        rows: [
          { input: 'test input 1', groundTruth: 'expected 1' },
          { input: 'test input 2', groundTruth: 'expected 2', requestContext: { userId: '123' } },
        ],
      };

      const mockResponse = {
        rows: [
          {
            rowId: 'row-1',
            versionId: 'version-2',
            input: 'test input 1',
            groundTruth: 'expected 1',
            deleted: false,
            createdAt: new Date().toISOString(),
          },
          {
            rowId: 'row-2',
            versionId: 'version-2',
            input: 'test input 2',
            groundTruth: 'expected 2',
            requestContext: { userId: '123' },
            deleted: false,
            createdAt: new Date().toISOString(),
          },
        ],
        versionId: 'version-2',
      };

      mockFetchResponse(mockResponse);

      const result = await dataset.addRows(addParams);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify(addParams),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listRows', () => {
    it('should retrieve dataset rows without parameters', async () => {
      const mockRows = {
        rows: [
          {
            rowId: 'row-1',
            versionId: 'version-1',
            input: 'test input',
            groundTruth: 'expected',
            deleted: false,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
      };

      mockFetchResponse(mockRows);

      const result = await dataset.listRows();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockRows);
    });

    it('should retrieve dataset rows with versionId', async () => {
      const mockRows = {
        rows: [
          {
            rowId: 'row-1',
            versionId: 'version-2',
            input: 'test input',
            deleted: false,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
      };

      mockFetchResponse(mockRows);

      const result = await dataset.listRows({ versionId: 'version-2' });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows?versionId=version-2`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockRows);
    });

    it('should retrieve dataset rows with pagination', async () => {
      const mockRows = {
        rows: [],
        pagination: {
          total: 100,
          page: 5,
          perPage: 20,
          hasMore: true,
        },
      };

      mockFetchResponse(mockRows);

      const result = await dataset.listRows({ page: 5, perPage: 20 });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows?page=5&perPage=20`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockRows);
    });

    it('should retrieve dataset rows with all parameters', async () => {
      const mockRows = {
        rows: [],
        pagination: {
          total: 50,
          page: 2,
          perPage: 15,
          hasMore: true,
        },
      };

      mockFetchResponse(mockRows);

      const result = await dataset.listRows({
        versionId: 'version-3',
        page: 2,
        perPage: 15,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows?versionId=version-3&page=2&perPage=15`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('updateRows', () => {
    it('should update dataset rows', async () => {
      const updateParams = {
        rows: [
          { rowId: 'row-1', input: 'updated input 1' },
          { rowId: 'row-2', groundTruth: 'updated truth' },
        ],
      };

      const mockResponse = {
        rows: [
          {
            rowId: 'row-1',
            versionId: 'version-3',
            input: 'updated input 1',
            deleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            rowId: 'row-2',
            versionId: 'version-3',
            groundTruth: 'updated truth',
            deleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        versionId: 'version-3',
      };

      mockFetchResponse(mockResponse);

      const result = await dataset.updateRows(updateParams);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateParams),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteRows', () => {
    it('should delete dataset rows', async () => {
      const deleteParams = {
        rowIds: ['row-1', 'row-2', 'row-3'],
      };

      const mockResponse = {
        versionId: 'version-4',
      };

      mockFetchResponse(mockResponse);

      const result = await dataset.deleteRows(deleteParams);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows`,
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify(deleteParams),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getRowById', () => {
    it('should retrieve a specific row by ID', async () => {
      const rowId = 'row-123';
      const mockRow = {
        rowId,
        versionId: 'version-1',
        input: 'test input',
        groundTruth: 'expected output',
        deleted: false,
        createdAt: new Date().toISOString(),
      };

      mockFetchResponse(mockRow);

      const result = await dataset.getRowById(rowId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows/${rowId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockRow);
    });

    it('should retrieve a specific row by ID with versionId', async () => {
      const rowId = 'row-123';
      const mockRow = {
        rowId,
        versionId: 'version-2',
        input: 'test input v2',
        groundTruth: 'expected output v2',
        deleted: false,
        createdAt: new Date().toISOString(),
      };

      mockFetchResponse(mockRow);

      const result = await dataset.getRowById(rowId, { versionId: 'version-2' });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows/${rowId}?versionId=version-2`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockRow);
    });
  });

  describe('listRowVersions', () => {
    it('should retrieve row versions without pagination', async () => {
      const rowId = 'row-123';
      const mockVersions = {
        rows: [
          {
            rowId,
            versionId: 'version-1',
            input: 'original input',
            deleted: false,
            createdAt: new Date().toISOString(),
          },
          {
            rowId,
            versionId: 'version-2',
            input: 'updated input',
            deleted: false,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          total: 2,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
      };

      mockFetchResponse(mockVersions);

      const result = await dataset.listRowVersions(rowId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows/${rowId}/versions`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockVersions);
    });

    it('should retrieve row versions with pagination', async () => {
      const rowId = 'row-123';
      const mockVersions = {
        rows: [
          {
            rowId,
            versionId: 'version-5',
            input: 'latest input',
            deleted: false,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          total: 10,
          page: 1,
          perPage: 5,
          hasMore: true,
        },
      };

      mockFetchResponse(mockVersions);

      const result = await dataset.listRowVersions(rowId, { page: 1, perPage: 5 });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/datasets/${datasetId}/rows/${rowId}/versions?page=1&perPage=5`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockVersions);
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Dataset not found',
        headers: new Headers({
          'content-type': 'text/plain',
        }),
      });

      await expect(dataset.get()).rejects.toThrow();
    });
  });
});

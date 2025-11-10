import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from './client';

// Mock fetch globally
global.fetch = vi.fn();

describe('MastraClient', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  describe('Client Error Handling', () => {
    it('should retry failed requests', async () => {
      // Mock first two calls to fail, third to succeed
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        });

      const result = await client.request('/test-endpoint');
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(client.request('/test-endpoint')).rejects.toThrow('Network error');

      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Client Configuration', () => {
    it('should handle custom retry configuration', async () => {
      const customClient = new MastraClient({
        baseUrl: 'http://localhost:4111',
        retries: 2,
        backoffMs: 100,
        maxBackoffMs: 1000,
        headers: { 'Custom-Header': 'value' },
        credentials: 'same-origin',
      });

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        });

      const result = await customClient.request('/test');
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4111/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'value',
          }),
          credentials: 'same-origin',
        }),
      );

      // ensure custom headers and credentials are overridable per request
      const result2 = await customClient.request('/test', {
        headers: { 'Custom-Header': 'new-value' },
        credentials: 'include',
      });
      expect(result2).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4111/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'new-value',
          }),
          credentials: 'include',
        }),
      );
    });
  });

  describe('Dataset Operations', () => {
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

    describe('createDataset', () => {
      it('should create a new dataset', async () => {
        const createParams = {
          name: 'Test Dataset',
          description: 'A test dataset',
          metadata: { type: 'test' },
        };

        const mockDataset = {
          id: 'dataset-123',
          ...createParams,
          createdAt: new Date().toISOString(),
          currentVersion: {
            id: 'version-1',
            datasetId: 'dataset-123',
            createdAt: new Date().toISOString(),
          },
        };

        mockFetchResponse(mockDataset);

        const result = await client.createDataset(createParams);

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/datasets',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'content-type': 'application/json',
              Authorization: 'Bearer test-key',
            }),
            body: JSON.stringify(createParams),
          }),
        );
        expect(result).toEqual(mockDataset);
      });
    });

    describe('listDatasets', () => {
      it('should list datasets without filters', async () => {
        const mockResponse = {
          datasets: [
            {
              id: 'dataset-1',
              name: 'Dataset 1',
              createdAt: new Date().toISOString(),
              currentVersion: {
                id: 'version-1',
                datasetId: 'dataset-1',
                createdAt: new Date().toISOString(),
              },
            },
          ],
          pagination: {
            total: 1,
            page: 0,
            perPage: 10,
            hasMore: false,
          },
        };

        mockFetchResponse(mockResponse);

        const result = await client.listDatasets();

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/datasets',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should list datasets with name filter', async () => {
        const mockResponse = {
          datasets: [],
          pagination: {
            total: 0,
            page: 0,
            perPage: 10,
            hasMore: false,
          },
        };

        mockFetchResponse(mockResponse);

        const result = await client.listDatasets({ name: 'Test' });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/datasets?name=Test',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should list datasets with pagination', async () => {
        const mockResponse = {
          datasets: [],
          pagination: {
            total: 100,
            page: 2,
            perPage: 25,
            hasMore: true,
          },
        };

        mockFetchResponse(mockResponse);

        const result = await client.listDatasets({ page: 2, perPage: 25 });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/datasets?page=2&perPage=25',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should list datasets with all parameters', async () => {
        const mockResponse = {
          datasets: [],
          pagination: {
            total: 5,
            page: 1,
            perPage: 20,
            hasMore: false,
          },
        };

        mockFetchResponse(mockResponse);

        const result = await client.listDatasets({
          name: 'Production',
          page: 1,
          perPage: 20,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/datasets?name=Production&page=1&perPage=20',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getDataset', () => {
      it('should return a Dataset instance', () => {
        const dataset = client.getDataset('dataset-123');

        expect(dataset).toBeDefined();
        expect(dataset.get).toBeDefined();
        expect(dataset.update).toBeDefined();
        expect(dataset.delete).toBeDefined();
        expect(dataset.listVersions).toBeDefined();
        expect(dataset.addRows).toBeDefined();
        expect(dataset.listRows).toBeDefined();
        expect(dataset.updateRows).toBeDefined();
        expect(dataset.deleteRows).toBeDefined();
        expect(dataset.getRowById).toBeDefined();
        expect(dataset.listRowVersions).toBeDefined();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should be imported from client module', async () => {
      const { MastraClient } = await import('./client');
      const client = new MastraClient({
        baseUrl: 'http://localhost:4111',
        headers: {
          Authorization: 'Bearer test-key',
          'x-mastra-client-type': 'js',
        },
      });

      // Basic smoke test to ensure client initializes correctly
      expect(client).toBeDefined();
      expect(client.getAgent).toBeDefined();
      expect(client.getTool).toBeDefined();
      expect(client.getVector).toBeDefined();
      expect(client.getWorkflow).toBeDefined();
      expect(client.getDataset).toBeDefined();
      expect(client.createDataset).toBeDefined();
      expect(client.listDatasets).toBeDefined();
    });
  });
});

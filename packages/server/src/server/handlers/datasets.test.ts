import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import type { DatasetRecord, CreateDatasetPayload, DatasetVersion } from '@mastra/core/storage';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  createDatasetHandler,
  getDatasetsHandler,
  getDatasetByIdHandler,
  updateDatasetHandler,
  deleteDatasetHandler,
  getDatasetVersionsHandler,
  addDatasetRowsHandler,
  getDatasetRowsHandler,
  updateDatasetRowsHandler,
  deleteDatasetRowsHandler,
  getDatasetRowByIdHandler,
  getDatasetRowVersionsHandler,
} from './datasets';

type MockedDatasetFunctions = {
  createDataset: Mock;
  getDatasets: Mock;
  getDataset: Mock;
  updateDataset: Mock;
  deleteDataset: Mock;
  getDatasetVersions: Mock;
  addDatasetRows: Mock;
  getDatasetRows: Mock;
  updateDatasetRows: Mock;
  deleteDatasetRows: Mock;
  getDatasetRowByRowId: Mock;
  getDatasetRowVersionsByRowId: Mock;
};

function createMockDataset(args?: Partial<DatasetRecord>): DatasetRecord {
  const datasetVersion: DatasetVersion = {
    id: 'version-1',
    datasetId: args?.id || 'dataset-1',
    createdAt: new Date('2024-01-01'),
  };

  return {
    id: 'dataset-1',
    name: 'Test Dataset',
    description: 'Test Description',
    metadata: { key: 'value' },
    createdAt: new Date('2024-01-01'),
    currentVersion: datasetVersion,
    ...args,
  };
}

describe('Dataset Handlers', () => {
  let mockStorage: typeof MockStore & MockedDatasetFunctions;
  let mockMastra: Mastra;

  beforeEach(() => {
    // Create mock storage with dataset-specific methods
    mockStorage = new MockStore() as unknown as typeof MockStore & MockedDatasetFunctions;

    // Add mocked dataset functions
    mockStorage.createDataset = vi.fn();
    mockStorage.getDatasets = vi.fn();
    mockStorage.getDataset = vi.fn();
    mockStorage.updateDataset = vi.fn();
    mockStorage.deleteDataset = vi.fn();
    mockStorage.getDatasetVersions = vi.fn();
    mockStorage.addDatasetRows = vi.fn();
    mockStorage.getDatasetRows = vi.fn();
    mockStorage.updateDatasetRows = vi.fn();
    mockStorage.deleteDatasetRows = vi.fn();
    mockStorage.getDatasetRowByRowId = vi.fn();
    mockStorage.getDatasetRowVersionsByRowId = vi.fn();

    // Create mock Mastra instance
    mockMastra = {
      getStorage: () => mockStorage,
    } as unknown as Mastra;

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('createDatasetHandler', () => {
    it('should call storage.createDataset with correct payload', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: 'New Dataset',
        description: 'New dataset description',
        metadata: { type: 'test' },
      };
      const mockResponse = { id: 'dataset-1', ...payload } as DatasetRecord;
      mockStorage.createDataset.mockResolvedValue(mockResponse);

      // Act
      await createDatasetHandler({
        mastra: mockMastra,
        body: payload,
      });

      // Assert - Focus on what the handler should do
      expect(mockStorage.createDataset).toHaveBeenCalledTimes(1);
      expect(mockStorage.createDataset).toHaveBeenCalledWith(payload);
    });

    it('should return the storage response without modification', async () => {
      // This test verifies the handler passes through the response correctly
      const payload: CreateDatasetPayload = { name: 'Test' };
      const storageResponse = createMockDataset({ name: 'Test' });
      mockStorage.createDataset.mockResolvedValue(storageResponse);

      const result = await createDatasetHandler({
        mastra: mockMastra,
        body: payload,
      });

      expect(result).toBe(storageResponse); // Same reference, not modified
    });

    it('should handle minimal payload with only required fields', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: 'Minimal Dataset',
      };
      mockStorage.createDataset.mockResolvedValue({} as DatasetRecord);

      // Act
      await createDatasetHandler({
        mastra: mockMastra,
        body: payload,
      });

      // Assert
      expect(mockStorage.createDataset).toHaveBeenCalledWith(payload);
    });

    it('should throw HTTPException when storage is not initialized', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: 'Test Dataset',
      };
      mockMastra.getStorage = () => null as any;

      // Act & Assert
      await expect(
        createDatasetHandler({
          mastra: mockMastra,
          body: payload,
        }),
      ).rejects.toEqual(
        new HTTPException(400, {
          message: 'Storage is not initialized',
        }),
      );
    });

    it('should handle storage errors properly', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: 'Test Dataset',
      };
      const storageError = new Error('Database connection failed');
      mockStorage.createDataset.mockRejectedValue(storageError);

      // Act & Assert
      await expect(
        createDatasetHandler({
          mastra: mockMastra,
          body: payload,
        }),
      ).rejects.toEqual(
        new HTTPException(500, {
          message: 'Database connection failed',
        }),
      );
    });

    it('should handle validation errors for missing name', async () => {
      // Arrange
      const payload = {} as CreateDatasetPayload; // Missing required name field

      // Act & Assert
      await expect(
        createDatasetHandler({
          mastra: mockMastra,
          body: payload,
        }),
      ).rejects.toEqual(
        new HTTPException(400, {
          message: 'Argument "name" is required',
        }),
      );
    });

    it('should handle empty name validation', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: '',
      };

      // Act & Assert
      await expect(
        createDatasetHandler({
          mastra: mockMastra,
          body: payload,
        }),
      ).rejects.toEqual(
        new HTTPException(400, {
          message: 'Argument "name" is required',
        }),
      );
    });

    it('should create dataset with complex metadata', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: 'Complex Dataset',
        description: 'Dataset with nested metadata',
        metadata: {
          version: '1.0.0',
          tags: ['ai', 'ml', 'training'],
          config: {
            batchSize: 32,
            epochs: 100,
            optimizer: 'adam',
          },
          createdBy: 'test-user',
        },
      };
      const expectedDataset = createMockDataset({
        name: payload.name,
        description: payload.description,
        metadata: payload.metadata,
      });
      mockStorage.createDataset.mockResolvedValue(expectedDataset);

      // Act
      const result = await createDatasetHandler({
        mastra: mockMastra,
        body: payload,
      });

      // Assert
      expect(mockStorage.createDataset).toHaveBeenCalledWith(payload);
      expect(result).toEqual(expectedDataset);
      expect(result.metadata).toEqual(payload.metadata);
    });

    it('should handle duplicate name errors from storage', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: 'Existing Dataset',
      };
      const duplicateError = new Error('Dataset with name "Existing Dataset" already exists');
      mockStorage.createDataset.mockRejectedValue(duplicateError);

      // Act & Assert
      await expect(
        createDatasetHandler({
          mastra: mockMastra,
          body: payload,
        }),
      ).rejects.toEqual(
        new HTTPException(500, {
          message: 'Error creating dataset: Dataset with name "Existing Dataset" already exists',
        }),
      );
    });

    it('should return dataset with auto-generated version', async () => {
      // Arrange
      const payload: CreateDatasetPayload = {
        name: 'Dataset with Version',
      };
      const expectedDataset = createMockDataset({
        name: payload.name,
        currentVersion: {
          id: 'auto-generated-version-ulid',
          datasetId: 'dataset-id',
          createdAt: new Date(),
        },
      });
      mockStorage.createDataset.mockResolvedValue(expectedDataset);

      // Act
      const result = await createDatasetHandler({
        mastra: mockMastra,
        body: payload,
      });

      // Assert
      expect(result.currentVersion).toBeDefined();
      expect(result.currentVersion.id).toBe('auto-generated-version-ulid');
      expect(result.currentVersion.datasetId).toBe('dataset-id');
    });
  });
});

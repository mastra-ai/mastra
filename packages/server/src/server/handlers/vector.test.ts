import { Mastra } from '@mastra/core';
import { MastraVector } from '@mastra/core/vector';
import type { QueryResult, IndexStats } from '@mastra/core/vector';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { upsertVectors, createIndex, queryVectors, listIndexes, describeIndex, deleteIndex } from './vector';

vi.mock('@mastra/core/vector');

type MockMastraVector = {
  upsert: Mock<MastraVector['upsert']>;
  createIndex: Mock<MastraVector['createIndex']>;
  query: Mock<MastraVector['query']>;
  listIndexes: Mock<MastraVector['listIndexes']>;
  describeIndex: Mock<MastraVector['describeIndex']>;
  deleteIndex: Mock<MastraVector['deleteIndex']>;
};
describe('Vector Handlers', () => {
  // @ts-expect-error
  const mockVector: Omit<MastraVector, keyof MockMastraVector> & MockMastraVector = new MastraVector();
  mockVector.upsert = vi.fn();
  mockVector.createIndex = vi.fn();
  mockVector.query = vi.fn();
  mockVector.listIndexes = vi.fn();
  mockVector.describeIndex = vi.fn();
  mockVector.deleteIndex = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertVectors', () => {
    it('should throw error when vectorName is not provided', async () => {
      await expect(
        upsertVectors({
          mastra: new Mastra(),
          index: {
            indexName: 'test-index',
            vectors: [[1, 2, 3]],
          },
        }),
      ).rejects.toThrow('Vector name is required');
    });

    it('should throw error when vector store is not found', async () => {
      await expect(
        upsertVectors({
          mastra: new Mastra(),
          vectorName: 'test-vector',
          index: {
            indexName: 'test-index',
            vectors: [[1, 2, 3]],
          },
        }),
      ).rejects.toThrow('Vector with name test-vector not found');
    });

    it('should throw error when request body is invalid', async () => {
      await expect(
        upsertVectors({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          vectorName: 'test-vector',
          index: {
            indexName: 'test-index',
          },
        }),
      ).rejects.toThrow('Invalid request index. indexName and vectors array are required.');
    });

    it('should upsert vectors successfully', async () => {
      const mockIds = ['id1', 'id2'];
      mockVector.upsert.mockResolvedValue(mockIds);

      const result = await upsertVectors({
        mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
        vectorName: 'test-vector',
        index: {
          indexName: 'test-index',
          vectors: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          metadata: [{ key: 'value' }, { key: 'value2' }],
          ids: mockIds,
        },
      });

      expect(result).toEqual({ ids: mockIds });
      expect(mockVector.upsert).toHaveBeenCalledWith({
        indexName: 'test-index',
        vectors: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        metadata: [{ key: 'value' }, { key: 'value2' }],
        ids: mockIds,
      });
    });
  });

  describe('createIndex', () => {
    it('should throw error when vectorName is not provided', async () => {
      await expect(
        createIndex({
          mastra: new Mastra(),
          index: {
            indexName: 'test-index',
            dimension: 3,
          },
        }),
      ).rejects.toThrow('Vector name is required');
    });

    it('should throw error when request body is invalid', async () => {
      await expect(
        createIndex({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          vectorName: 'test-vector',
          index: {
            indexName: 'test-index',
            dimension: -1,
          },
        }),
      ).rejects.toThrow(
        new HTTPException(400, {
          message: 'Invalid request index, indexName and positive dimension number are required.',
        }),
      );
    });

    it('should throw error when metric is invalid', async () => {
      await expect(
        createIndex({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          vectorName: 'test-vector',
          index: {
            indexName: 'test-index',
            dimension: 3,
            metric: 'invalid' as any,
          },
        }),
      ).rejects.toThrow('Invalid metric');
    });

    it('should create index successfully', async () => {
      mockVector.createIndex.mockResolvedValue(undefined);

      const result = await createIndex({
        mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
        vectorName: 'test-vector',
        index: {
          indexName: 'test-index',
          dimension: 3,
          metric: 'cosine',
        },
      });

      expect(result).toEqual({ success: true });
      expect(mockVector.createIndex).toHaveBeenCalledWith({
        indexName: 'test-index',
        dimension: 3,
        metric: 'cosine',
      });
    });
  });

  describe('queryVectors', () => {
    it('should throw error when vectorName is not provided', async () => {
      await expect(
        queryVectors({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          query: {
            indexName: 'test-index',
            queryVector: [1, 2, 3],
          },
        }),
      ).rejects.toThrow('Vector name is required');
    });

    it('should throw error when request body is invalid', async () => {
      mockVector.query.mockResolvedValue([]);
      await expect(
        queryVectors({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          vectorName: 'test-vector',
          query: {
            indexName: 'test-index',
          },
        }),
      ).rejects.toThrow('Invalid request query. indexName and queryVector array are required.');
    });

    it('should query vectors successfully', async () => {
      const mockResults: QueryResult[] = [
        { id: '1', score: 0.9, vector: [1, 2, 3] },
        { id: '2', score: 0.8, vector: [4, 5, 6] },
      ];
      mockVector.query.mockResolvedValue(mockResults);

      const result = await queryVectors({
        mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
        vectorName: 'test-vector',
        query: {
          indexName: 'test-index',
          queryVector: [1, 2, 3],
          topK: 2,
          filter: { key: 'value' },
          includeVector: true,
        },
      });

      expect(result).toEqual({ results: mockResults });
      expect(mockVector.query).toHaveBeenCalledWith({
        indexName: 'test-index',
        queryVector: [1, 2, 3],
        topK: 2,
        filter: { key: 'value' },
        includeVector: true,
      });
    });
  });

  describe('listIndexes', () => {
    it('should throw error when vectorName is not provided', async () => {
      await expect(
        listIndexes({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
        }),
      ).rejects.toThrow('Vector name is required');
    });

    it('should list indexes successfully', async () => {
      const mockIndexes = ['index1', 'index2'];
      mockVector.listIndexes.mockResolvedValue(mockIndexes);

      const result = await listIndexes({
        mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
        vectorName: 'test-vector',
      });

      expect(result).toEqual({ indexes: mockIndexes });
      expect(mockVector.listIndexes).toHaveBeenCalled();
    });
  });

  describe('describeIndex', () => {
    it('should throw error when vectorName is not provided', async () => {
      await expect(
        describeIndex({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          indexName: 'test-index',
        }),
      ).rejects.toThrow('Vector name is required');
    });

    it('should throw error when indexName is not provided', async () => {
      await expect(
        describeIndex({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          vectorName: 'test-vector',
        }),
      ).rejects.toThrow('Index name is required');
    });

    it('should describe index successfully', async () => {
      const mockStats: IndexStats = {
        dimension: 3,
        count: 100,
        metric: 'cosine',
      };
      mockVector.describeIndex.mockResolvedValue(mockStats);

      const result = await describeIndex({
        mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
        vectorName: 'test-vector',
        indexName: 'test-index',
      });

      expect(result).toEqual({
        dimension: 3,
        count: 100,
        metric: 'cosine',
      });
      expect(mockVector.describeIndex).toHaveBeenCalledWith('test-index');
    });
  });

  describe('deleteIndex', () => {
    it('should throw error when vectorName is not provided', async () => {
      await expect(
        deleteIndex({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          indexName: 'test-index',
        }),
      ).rejects.toThrow('Vector name is required');
    });

    it('should throw error when indexName is not provided', async () => {
      await expect(
        deleteIndex({
          mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
          vectorName: 'test-vector',
        }),
      ).rejects.toThrow('Index name is required');
    });

    it('should delete index successfully', async () => {
      mockVector.deleteIndex.mockResolvedValue(undefined);

      const result = await deleteIndex({
        mastra: new Mastra({ logger: false, vectors: { 'test-vector': mockVector as unknown as MastraVector } }),
        vectorName: 'test-vector',
        indexName: 'test-index',
      });

      expect(result).toEqual({ success: true });
      expect(mockVector.deleteIndex).toHaveBeenCalledWith('test-index');
    });
  });
});

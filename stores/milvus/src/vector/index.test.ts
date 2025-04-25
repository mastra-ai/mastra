import type { FieldType } from '@zilliz/milvus2-sdk-node';
import { DataType, IndexType, MetricType } from '@zilliz/milvus2-sdk-node';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MilvusVectorStore } from './index';

describe('Milvus Vector tests', () => {
  let milvusClient: MilvusVectorStore;

  beforeAll(async () => {
    // for running the tests, you need to have a local milvus instance running
    // start the milvus db server by running `docker-compose up -d` in the root directory
    // if the milvus standalone server is crashing continuously, then delete the volumes directory and restart the server
    milvusClient = new MilvusVectorStore({
      address: '127.0.0.1:19530',
      username: 'milvus-username',
      password: 'milvus-password',
      ssl: false,
    });

    expect(milvusClient).toBeDefined();
  });

  describe('Schema operations', () => {
    const collection_name = `book`;
    afterAll(async () => {
      await milvusClient.dropCollection(collection_name);
    });

    it('should create collection', async () => {
      const dim = 128;
      const schema: FieldType[] = [
        {
          name: `book_id`,
          description: `customized primary id`,
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: `word_count`,
          description: `word count`,
          data_type: DataType.Int64,
        },
        {
          name: `book_intro`,
          description: `word count`,
          data_type: DataType.FloatVector,
          dim: dim,
        },
      ];

      const results = await milvusClient.createCollection(collection_name, schema);
      expect(results).toBeDefined();
      expect(results.error_code).toBe('Success');
    });

    it('should throw error when creating collection with dynamic field', async () => {
      const dim = 128;
      const schema: FieldType[] = [
        {
          name: `book_id`,
          description: `customized primary id`,
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: `word_count`,
          description: `word count`,
          data_type: DataType.Int64,
        },
        {
          name: `book_intro`,
          description: `word count`,
          data_type: DataType.FloatVector,
          dim: dim,
        },
      ];

      await expect(
        milvusClient.createCollection(collection_name, schema, { enable_dynamic_field: true }),
      ).rejects.toThrowError();
    });

    it('should describe collection', async () => {
      const results = await milvusClient.describeCollection(collection_name);
      expect(results).toBeDefined();
      expect(results.status.error_code).toBe('Success');
      expect(results.schema.name).toBe(collection_name);
      expect(results.schema.fields.length).toBe(3);
      expect(results.schema.fields[0].name).toBe('book_id');
      expect(results.schema.fields[1].name).toBe('word_count');
      expect(results.schema.fields[2].name).toBe('book_intro');
      expect(results.schema.enable_dynamic_field).toBe(false);
      expect(results.schema.autoID).toBe(false);
      expect(results.shards_num).toBe(1);
      expect(results.num_partitions).toBe('1');
    });

    it('should drop collection', async () => {
      const results = await milvusClient.dropCollection(collection_name);
      expect(results).toBeDefined();
      expect(results.error_code).toBe('Success');
    });

    it('should not return error response when dropping non-existent collection', async () => {
      const response = await milvusClient.dropCollection(collection_name);
      expect(response).toBeDefined();
      expect(response.error_code).toBe('Success');
      expect(response.reason).toBe('');
    });

    it('should create collection with all options', async () => {
      const dim = 128;
      const schema: FieldType[] = [
        {
          name: `book_id`,
          description: `customized primary id`,
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: `word_count`,
          description: `word count`,
          data_type: DataType.Int64,
        },
        {
          name: `book_intro`,
          description: `word count`,
          data_type: DataType.FloatVector,
          dim: dim,
        },
      ];

      const results = await milvusClient.createCollection(collection_name, schema, {
        enable_dynamic_field: false,
        consistency_level: 'Eventually',
        description: 'test collection',
        timeout: 10000,
      });

      expect(results).toBeDefined();
      expect(results.error_code).toBe('Success');

      const describeResults = await milvusClient.describeCollection(collection_name);
      expect(describeResults).toBeDefined();
      expect(describeResults.status.error_code).toBe('Success');
      expect(describeResults.schema.name).toBe(collection_name);
      expect(describeResults.schema.fields.length).toBe(3);
      expect(describeResults.schema.fields[0].name).toBe('book_id');
      expect(describeResults.schema.fields[1].name).toBe('word_count');
      expect(describeResults.schema.fields[2].name).toBe('book_intro');
      expect(describeResults.schema.enable_dynamic_field).toBe(false);
      expect(describeResults.schema.autoID).toBe(false);
      expect(describeResults.schema.description).toBe('test collection');
      expect(describeResults.shards_num).toBe(1);
      expect(describeResults.num_partitions).toBe('1');
      expect(describeResults.consistency_level).toBe('Eventually');
    });

    it('should list collections', async () => {
      const collections = await milvusClient.listCollections();
      expect(collections).toBeDefined();
      expect(collections.length).toBeGreaterThan(0);
      expect(collections.includes('new_book_collection')).toBe(true);
    });
  });

  describe('Index operations', () => {
    const collectionName = `book`;
    const indexName = `book_intro`;

    beforeAll(async () => {
      await milvusClient.createCollection(collectionName, [
        {
          name: `book_id`,
          description: `customized primary id`,
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: `word_count`,
          description: `word count`,
          data_type: DataType.Int64,
        },
        {
          name: `book_intro`,
          description: `word count`,
          data_type: DataType.FloatVector,
          dim: 128,
        },
      ]);
    });

    afterAll(async () => {
      await milvusClient.dropCollection(collectionName);
    });

    beforeEach(async () => {
      await milvusClient.dropIndex(collectionName, indexName);
    });

    it('should create index', async () => {
      await milvusClient.createIndex({
        collectionName: collectionName,
        fieldName: 'book_intro',
        indexName: indexName,
        indexConfig: {
          type: IndexType.IVF_FLAT,
        },
        metricType: MetricType.L2,
        dimension: 128,
      });

      const describeResult = await milvusClient.describeIndex(collectionName);

      expect(describeResult).toBeDefined();
      expect(describeResult.indexDescription).toBeDefined();
      expect(describeResult.indexDescription.status.error_code).toBe('Success');
      expect(describeResult.indexDescription.index_descriptions[0].field_name).toBe('book_intro');
      expect(describeResult.indexDescription.index_descriptions[0].index_name).toBe(indexName);
      expect(describeResult.indexDescription.index_descriptions[0].indexID).toBeDefined();
      expect(describeResult.indexDescription.index_descriptions[0].params).toBeDefined();
      expect(describeResult.indexDescription.index_descriptions[0].params).toHaveLength(3);
    });

    it('should not throw exception while creating two indexes on the same field', async () => {
      await milvusClient.createIndex({
        collectionName: collectionName,
        fieldName: 'book_intro',
        indexName: indexName,
        indexConfig: {
          type: IndexType.IVF_FLAT,
        },
        metricType: MetricType.L2,
        dimension: 128,
      });

      expect(
        milvusClient.createIndex({
          collectionName: collectionName,
          fieldName: 'book_intro',
          indexName: indexName,
          indexConfig: {
            type: IndexType.IVF_FLAT,
          },
          metricType: MetricType.L2,
          dimension: 128,
        }),
      ).resolves.not.toThrowError();
    });

    it('should create index with HNSW', async () => {
      await milvusClient.createIndex({
        collectionName: collectionName,
        fieldName: 'book_intro',
        indexName: indexName,
        indexConfig: {
          type: IndexType.IVF_FLAT,
        },
        dimension: 128,
      });

      const describeResult = await milvusClient.describeIndex(collectionName);

      expect(describeResult).toBeDefined();
      expect(describeResult.indexDescription).toBeDefined();
      expect(describeResult.indexDescription.status.error_code).toBe('Success');
      expect(describeResult.indexDescription.index_descriptions[0].field_name).toBe('book_intro');
      expect(describeResult.indexDescription.index_descriptions[0].indexID).toBeDefined();
      expect(describeResult.indexDescription.index_descriptions[0].params).toBeDefined();
      expect(describeResult.indexDescription.index_descriptions[0].params).toHaveLength(3);

      const listIndexes = await milvusClient.listIndexes();
      expect(listIndexes).toBeDefined();
      expect(listIndexes.length).toBe(1);
      expect(listIndexes.includes(indexName)).toBe(true);
    });

    it('should drop index', async () => {
      const collectionName = `new_book_collection`;
      const indexName = `book_intro_idx`;

      // drop existing collection
      await milvusClient.dropCollection(collectionName);

      // create collection
      await milvusClient.createCollection(collectionName, [
        {
          name: `book_id`,
          description: `customized primary id`,
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: `word_count`,
          description: `word count`,
          data_type: DataType.Int64,
        },
        {
          name: `book_intro`,
          description: `word count`,
          data_type: DataType.FloatVector,
          dim: 128,
        },
      ]);

      await milvusClient.createIndex({
        collectionName: collectionName,
        fieldName: 'book_intro',
        indexName: indexName,
        indexConfig: {
          type: IndexType.IVF_FLAT,
        },
        dimension: 128,
      });

      await milvusClient.dropIndex(collectionName, indexName);

      // describe index
      const describeResult = await milvusClient.describeIndex(collectionName);
      expect(describeResult).toBeDefined();
      expect(describeResult.indexDescription).toBeDefined();
      expect(describeResult.indexDescription.status.error_code).toBe('IndexNotExist');
      expect(describeResult.indexDescription.index_descriptions.length).toBe(0);
    });
  });

  describe('Upsert operations', () => {
    const collectionName = `new_book_collection_upserts`;

    beforeAll(async () => {
      await milvusClient.createCollection(collectionName, [
        {
          name: `id`,
          description: `customized primary id`,
          data_type: DataType.VarChar,
          max_length: 256,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: `vector`,
          description: `word count`,
          data_type: DataType.FloatVector,
          dim: 8,
        },
        {
          name: `metadata`,
          description: `metadata`,
          data_type: DataType.JSON,
        },
      ]);
    });

    afterAll(async () => {
      await milvusClient.dropCollection(collectionName);
    });

    it('should upsert vectors', async () => {
      const vectors = [
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8],
      ];
      const ids = [1, 2];
      const metadata = [{ title: 'Book 1' }, { title: 'Book 2' }];
      const insertedIds = await milvusClient.upsert({
        collectionName,
        vectors,
        ids: ids.map(id => String(id)),
        metadata,
        indexName: 'vector_idx',
      });
      expect(insertedIds).toBeDefined();
      expect(insertedIds.length).toBe(2);
      expect(insertedIds[0]).toBe('1');
      expect(insertedIds[1]).toBe('2');
    });

    it('should upsert vectors without providing IDs', async () => {
      const vectors = [
        [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9],
      ];
      const metadata = [{ title: 'Auto ID Book 1' }, { title: 'Auto ID Book 2' }];

      const insertedIds = await milvusClient.upsert({
        collectionName,
        vectors,
        metadata,
        indexName: 'vector_idx',
      });

      expect(insertedIds).toBeDefined();
      expect(insertedIds.length).toBe(2);
      // Auto-generated IDs should be UUIDs
      expect(insertedIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(insertedIds[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should update existing vectors when using the same IDs', async () => {
      // First insert
      const initialVectors = [[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]];
      const id = '999';
      const initialMetadata = [{ title: 'Initial Book' }];

      await milvusClient.upsert({
        collectionName,
        vectors: initialVectors,
        ids: [id],
        metadata: initialMetadata,
        indexName: 'vector_idx',
      });

      // Then update with the same ID
      const updatedVectors = [[0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]];
      const updatedMetadata = [{ title: 'Updated Book', author: 'Test Author' }];

      const updatedIds = await milvusClient.upsert({
        collectionName,
        vectors: updatedVectors,
        ids: [id],
        metadata: updatedMetadata,
        indexName: 'vector_idx',
      });

      expect(updatedIds).toBeDefined();
      expect(updatedIds.length).toBe(1);
      expect(updatedIds[0]).toBe(id);

      // TODO: Verify the update by querying
    });

    it('should upsert vectors with partial IDs provided', async () => {
      const vectors = [
        [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
        [1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1],
        [2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1],
      ];
      const partialIds = ['100']; // Only one ID provided for three vectors
      const metadata = [{ title: 'Partial ID Book 1' }, { title: 'Partial ID Book 2' }, { title: 'Partial ID Book 3' }];

      const insertedIds = await milvusClient.upsert({
        collectionName,
        vectors,
        ids: partialIds,
        metadata,
        indexName: 'vector_idx',
      });

      expect(insertedIds).toBeDefined();
      expect(insertedIds.length).toBe(3);
      expect(insertedIds[0]).toBe('100'); // Should use the provided ID
      // Other IDs should be auto-generated
      expect(insertedIds[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(insertedIds[2]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should upsert vectors with complex metadata', async () => {
      const vectors = [[0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2]];
      const ids = ['200'];
      const complexMetadata = [
        {
          title: 'Complex Metadata Book',
          author: 'Test Author',
          publication: {
            year: 2023,
            publisher: 'Test Publisher',
            edition: 1,
          },
          tags: ['fiction', 'sci-fi', 'bestseller'],
          rating: 4.7,
          inStock: true,
          dimensions: {
            height: 9.5,
            width: 6.2,
            depth: 1.0,
          },
        },
      ];

      const insertedIds = await milvusClient.upsert({
        collectionName,
        vectors,
        ids,
        metadata: complexMetadata,
        indexName: 'vector_idx',
      });

      expect(insertedIds).toBeDefined();
      expect(insertedIds.length).toBe(1);
      expect(insertedIds[0]).toBe('200');
    });

    it('should upsert a large batch of vectors', async () => {
      // Create a larger batch of 10 vectors
      const vectors = Array.from({ length: 10 }, (_, i) =>
        Array.from({ length: 8 }, (_, j) => (i + 1) * 0.1 + j * 0.01),
      );

      const ids = Array.from({ length: 10 }, (_, i) => String(300 + i));
      const metadata = Array.from({ length: 10 }, (_, i) => ({ title: `Batch Book ${i + 1}`, index: i }));

      const insertedIds = await milvusClient.upsert({
        collectionName,
        vectors,
        ids,
        metadata,
        indexName: 'vector_idx',
      });

      expect(insertedIds).toBeDefined();
      expect(insertedIds.length).toBe(10);

      // Check that all IDs match the expected values
      for (let i = 0; i < 10; i++) {
        expect(insertedIds[i]).toBe(String(300 + i));
      }
    });

    it('should throw an error when no vectors are provided', async () => {
      await expect(
        milvusClient.upsert({
          collectionName,
          vectors: [],
          ids: [],
          metadata: [],
          indexName: 'vector_idx',
        }),
      ).rejects.toThrow('vectors array is required and must not be empty');
    });

    it('should throw an error when collectionName is missing', async () => {
      const vectors = [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]];

      await expect(
        milvusClient.upsert({
          collectionName: '',
          vectors,
          indexName: 'vector_idx',
        }),
      ).rejects.toThrow('Missing required parameter: collectionName');
    });
  });

  describe('Simple Query operations', () => {
    const collectionName = `new_book_collection_query`;
    const indexName = 'vector_idx';

    beforeAll(async () => {
      await milvusClient.createCollection(collectionName, [
        {
          name: `id`,
          description: `customized primary id`,
          data_type: DataType.VarChar,
          max_length: 256,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: `vector`,
          description: `word count`,
          data_type: DataType.FloatVector,
          dim: 8,
        },
        {
          name: `metadata`,
          description: `metadata`,
          data_type: DataType.JSON,
        },
      ]);

      // create index
      await milvusClient.createIndex({
        collectionName: collectionName,
        fieldName: 'vector',
        indexName: indexName,
        indexConfig: {
          type: IndexType.IVF_FLAT,
        },
        metricType: MetricType.L2,
        dimension: 8,
      });
    });

    afterAll(async () => {
      await milvusClient.dropCollection(collectionName);
    });

    it('should query vectors', async () => {
      const vectors = [
        [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
        [1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1],
        [2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1],
      ];

      const insertedIds = await milvusClient.upsert({
        collectionName,
        vectors,
        ids: ['1', '2', '3'],
        metadata: [{ title: 'Book 1' }, { title: 'Book 2' }, { title: 'Book 3' }],
        indexName,
      });

      const queryResult = await milvusClient.query({
        collectionName,
        indexName,
        queryVector: vectors[0],
        topK: 3,
      });

      expect(queryResult).toBeDefined();
      expect(queryResult.length).toBe(3);
      expect(queryResult[0].id).toBe(insertedIds[0]);
      expect(queryResult[1].id).toBe(insertedIds[1]);
      expect(queryResult[2].id).toBe(insertedIds[2]);
      expect(queryResult[0].score).toBeDefined();
      expect(queryResult[1].score).toBeDefined();
      expect(queryResult[2].score).toBeDefined();
      expect(queryResult[0].metadata).toBeDefined();
      expect(queryResult[1].metadata).toBeDefined();
      expect(queryResult[2].metadata).toBeDefined();
      expect(queryResult[0].vector).toBeDefined();
      expect(queryResult[1].vector).toBeDefined();
      expect(queryResult[2].vector).toBeDefined();

      // Check that the scores are within a reasonable range
      expect(queryResult[0].score).toBeLessThanOrEqual(1);
      expect(queryResult[1].score).toBeLessThanOrEqual(1);
      expect(queryResult[2].score).toBeLessThanOrEqual(1);

      // Check that the metadata is correct
      expect(queryResult[0].metadata).toEqual({ title: 'Book 1' });
      expect(queryResult[1].metadata).toEqual({ title: 'Book 2' });
      expect(queryResult[2].metadata).toEqual({ title: 'Book 3' });

      // Check that the vectors are correct
      expect(queryResult[0].vector).toEqual(vectors[0]);
      expect(queryResult[1].vector).toEqual(vectors[1]);
      expect(queryResult[2].vector).toEqual(vectors[2]);
    });
  });
});

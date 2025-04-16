import type { FieldType } from '@zilliz/milvus2-sdk-node';
import { DataType, IndexType } from '@zilliz/milvus2-sdk-node';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MilvusVectorStore } from './index';

describe('Milvus Vector tests', () => {
  let milvusClient: MilvusVectorStore;

  beforeAll(async () => {
    // for running the tests, you need to have a local milvus instance running
    // start the milvus db server by running `docker-compose up -d` in the root directory
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
      expect(results.shards_num).toBe(2);
      expect(results.num_partitions).toBe('0');
    });

    it('should drop collection', async () => {
      const results = await milvusClient.dropCollection(collection_name);
      expect(results).toBeDefined();
      expect(results.error_code).toBe('Success');
    });

    it('should return error response when dropping non-existent collection', async () => {
      const response = await milvusClient.dropCollection(collection_name);
      expect(response).toBeDefined();
      expect(response.error_code).toBe('UnexpectedError');
      expect(response.reason).toBe("DescribeCollection failed: can't find collection: book");
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
        num_partitions: 2,
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
      expect(describeResults.shards_num).toBe(2);
      expect(describeResults.num_partitions).toBe('0');
      expect(describeResults.consistency_level).toBe('Eventually');
    });

    it('should list collections', async () => {
      const collections = await milvusClient.listCollections();
      expect(collections).toBeDefined();
      expect(collections.length).toBeGreaterThan(0);
      expect(collections.includes(collection_name)).toBe(true);
    });
  });

  describe('Index operations', () => {
    const collection_name = `book`;

    beforeAll(async () => {
      await milvusClient.createCollection(collection_name, [
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
      await milvusClient.dropCollection(collection_name);
    });

    it('should create index', async () => {
      await milvusClient.createIndex({
        collectionName: collection_name,
        fieldName: 'book_intro',
        indexName: 'book_intro_idx',
        indexConfig: {
          type: IndexType.IVF_FLAT,
        },
        dimension: 128,
      });

      const describeResult = await milvusClient.describeIndex(collection_name);

      expect(describeResult).toBeDefined();
      expect(describeResult.indexDescription).toBeDefined();
      expect(describeResult.indexDescription.status.error_code).toBe('Success');
      expect(describeResult.indexDescription.index_descriptions[0].field_name).toBe('book_intro');
      expect(describeResult.indexDescription.index_descriptions[0].indexID).toBeDefined();
      expect(describeResult.indexDescription.index_descriptions[0].params).toBeDefined();
      expect(describeResult.indexDescription.index_descriptions[0].params).toHaveLength(3);
    });

    it('should list indexes', async () => {
      // const indexes = await milvusClient.listIndexes(collection_name);
      // expect(indexes).toBeDefined();
      // expect(indexes.length).toBeGreaterThan(0);
      // expect(indexes.includes('book_intro')).toBe(true);
    });
  });
});

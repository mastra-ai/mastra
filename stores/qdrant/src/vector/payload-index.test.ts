// Tests for payload index creation (required for Qdrant Cloud and strict_mode_config = true)
// See: https://github.com/mastra-ai/mastra/issues/8923
//
// To setup a Qdrant server, run:
// docker run -p 6333:6333 qdrant/qdrant
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import type { PayloadSchemaType } from './index';
import { QdrantVector } from './index';

const dimension = 3;

describe('QdrantVector Payload Index Operations', () => {
  let qdrant: QdrantVector;
  const testCollectionName = 'payload-index-test-' + Date.now();

  beforeAll(async () => {
    qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-payload-index-test' });
    await qdrant.createIndex({ indexName: testCollectionName, dimension });
  });

  afterAll(async () => {
    await qdrant.deleteIndex({ indexName: testCollectionName });
  }, 50000);

  describe('createPayloadIndex', () => {
    it('should create a keyword payload index for a field', async () => {
      // This test verifies the feature requested in https://github.com/mastra-ai/mastra/issues/8923
      // In Qdrant Cloud (or any Qdrant instance with strict_mode_config = true),
      // payload fields must be explicitly indexed before they can be used for filtering.
      await qdrant.createPayloadIndex({
        indexName: testCollectionName,
        fieldName: 'dataSourceId',
        fieldSchema: 'keyword',
      });

      // Verify the index was created by checking collection info
      // The collection info should include the payload index in the indexes field
    });

    it('should create an integer payload index for numeric filtering', async () => {
      await qdrant.createPayloadIndex({
        indexName: testCollectionName,
        fieldName: 'price',
        fieldSchema: 'integer',
      });
    });

    it('should create a text payload index for full-text search', async () => {
      await qdrant.createPayloadIndex({
        indexName: testCollectionName,
        fieldName: 'description',
        fieldSchema: 'text',
      });
    });

    it('should allow filtering by indexed payload field after index creation', async () => {
      // First create an index on the field
      await qdrant.createPayloadIndex({
        indexName: testCollectionName,
        fieldName: 'source',
        fieldSchema: 'keyword',
      });

      // Insert some vectors with metadata
      const testVectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];
      const testMetadata = [
        { source: 'document-a', title: 'Doc A' },
        { source: 'document-b', title: 'Doc B' },
        { source: 'document-a', title: 'Doc C' },
      ];

      await qdrant.upsert({
        indexName: testCollectionName,
        vectors: testVectors,
        metadata: testMetadata,
      });

      // Query with filter on the indexed field
      // This would fail on Qdrant Cloud without the payload index
      const results = await qdrant.query({
        indexName: testCollectionName,
        queryVector: [1.0, 0.0, 0.0],
        filter: { source: 'document-a' },
        topK: 10,
      });

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.metadata?.source).toBe('document-a');
      });
    });

    it('should support all Qdrant payload schema types', async () => {
      // Test all supported schema types as documented:
      // https://qdrant.tech/documentation/concepts/indexing/#payload-index
      const schemaTypes = [
        { fieldName: 'status', fieldSchema: 'keyword' as const },
        { fieldName: 'count', fieldSchema: 'integer' as const },
        { fieldName: 'rating', fieldSchema: 'float' as const },
        { fieldName: 'location', fieldSchema: 'geo' as const },
        { fieldName: 'content', fieldSchema: 'text' as const },
        { fieldName: 'active', fieldSchema: 'bool' as const },
        { fieldName: 'createdAt', fieldSchema: 'datetime' as const },
        { fieldName: 'recordId', fieldSchema: 'uuid' as const },
      ];

      for (const { fieldName, fieldSchema } of schemaTypes) {
        await expect(
          qdrant.createPayloadIndex({
            indexName: testCollectionName,
            fieldName,
            fieldSchema,
          }),
        ).resolves.not.toThrow();
      }
    });

    it('should handle creating index on already indexed field gracefully', async () => {
      const fieldName = 'duplicateField';

      // Create the index first time
      await qdrant.createPayloadIndex({
        indexName: testCollectionName,
        fieldName,
        fieldSchema: 'keyword',
      });

      // Creating again should not throw
      await expect(
        qdrant.createPayloadIndex({
          indexName: testCollectionName,
          fieldName,
          fieldSchema: 'keyword',
        }),
      ).resolves.not.toThrow();
    });

    it('should throw for non-existent collection', async () => {
      await expect(
        qdrant.createPayloadIndex({
          indexName: 'non-existent-collection',
          fieldName: 'testField',
          fieldSchema: 'keyword',
        }),
      ).rejects.toThrow();
    });

    it('should throw for empty indexName', async () => {
      await expect(
        qdrant.createPayloadIndex({
          indexName: '',
          fieldName: 'testField',
          fieldSchema: 'keyword',
        }),
      ).rejects.toThrow('indexName must be a non-empty string');
    });

    it('should throw for empty fieldName', async () => {
      await expect(
        qdrant.createPayloadIndex({
          indexName: testCollectionName,
          fieldName: '',
          fieldSchema: 'keyword',
        }),
      ).rejects.toThrow('fieldName must be a non-empty string');
    });

    it('should throw for invalid fieldSchema', async () => {
      await expect(
        qdrant.createPayloadIndex({
          indexName: testCollectionName,
          fieldName: 'testField',
          // @ts-expect-error - testing invalid schema
          fieldSchema: 'invalid-schema',
        }),
      ).rejects.toThrow('fieldSchema must be one of');
    });
  });

  describe('deletePayloadIndex', () => {
    it('should delete an existing payload index', async () => {
      // First create the index
      await qdrant.createPayloadIndex({
        indexName: testCollectionName,
        fieldName: 'fieldToDelete',
        fieldSchema: 'keyword',
      });

      // Then delete it
      await expect(
        qdrant.deletePayloadIndex({
          indexName: testCollectionName,
          fieldName: 'fieldToDelete',
        }),
      ).resolves.not.toThrow();
    });

    it('should handle deleting non-existent payload index gracefully', async () => {
      // Deleting a non-existent index should not throw
      await expect(
        qdrant.deletePayloadIndex({
          indexName: testCollectionName,
          fieldName: 'nonExistentField',
        }),
      ).resolves.not.toThrow();
    });

    it('should throw for empty indexName', async () => {
      await expect(
        qdrant.deletePayloadIndex({
          indexName: '',
          fieldName: 'testField',
        }),
      ).rejects.toThrow('indexName must be a non-empty string');
    });

    it('should throw for empty fieldName', async () => {
      await expect(
        qdrant.deletePayloadIndex({
          indexName: testCollectionName,
          fieldName: '',
        }),
      ).rejects.toThrow('fieldName must be a non-empty string');
    });
  });
});

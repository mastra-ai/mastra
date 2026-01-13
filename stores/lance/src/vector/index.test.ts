import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LanceVectorStore } from './index';

describe('Lance vector store tests', () => {
  let vectorDB: LanceVectorStore;
  const connectionString = process.env.DB_URL || 'lancedb-vector';

  beforeAll(async () => {
    // Giving directory path to connect to in memory db
    // Give remote db url to connect to remote db such as s3 or lancedb cloud
    vectorDB = await LanceVectorStore.create(connectionString);
  });

  afterAll(async () => {
    try {
      await vectorDB.deleteAllTables();
      console.log('All tables have been deleted');
    } catch (error) {
      console.warn('Failed to delete tables during cleanup:', error);
    } finally {
      vectorDB.close();
    }
  });

  describe('Index operations', () => {
    const testTableName = 'test-table' + Date.now();
    const indexOnColumn = 'vector';

    beforeAll(async () => {
      const generateTableData = (numRows: number) => {
        return Array.from({ length: numRows }, (_, i) => ({
          id: String(i + 1),
          vector: Array.from({ length: 3 }, () => Math.random()),
        }));
      };

      // lancedb requires to create more than 256 rows for index creation
      // otherwise it will throw an error
      await vectorDB.createTable(testTableName, generateTableData(300));
    });

    describe('create index', () => {
      it('should create an index with specified dimensions', async () => {
        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: indexOnColumn,
          dimension: 2,
          tableName: testTableName,
        });

        const stats = await vectorDB.describeIndex({ indexName: indexOnColumn + '_idx' });

        expect(stats?.dimension).toBe(3);
        expect(stats?.count).toBe(300);
      });

      it('should create an index for hnsw', async () => {
        await vectorDB.createIndex({
          indexConfig: {
            type: 'hnsw',
            hnsw: {
              m: 16,
              efConstruction: 100,
            },
          },
          indexName: indexOnColumn,
          metric: 'euclidean',
          dimension: 2,
          tableName: testTableName,
        });

        const stats = await vectorDB.describeIndex({ indexName: indexOnColumn + '_idx' });

        expect(stats?.metric).toBe('l2');
      });

      it('should default tableName to indexName when tableName is not provided', async () => {
        const tableName = 'vector';

        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
          }));
        };

        const existingTables = await vectorDB.listTables();
        if (existingTables.includes(tableName)) {
          await vectorDB.deleteTable(tableName);
        }

        await vectorDB.createTable(tableName, generateTableData(300));

        // Call createIndex without tableName - it should default to indexName
        await vectorDB.createIndex({
          indexName: 'vector',
          dimension: 3,
          metric: 'cosine',
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
        } as any);

        const stats = await vectorDB.describeIndex({ indexName: 'vector_idx' });
        expect(stats).toBeDefined();
        expect(stats?.dimension).toBe(3);

        await vectorDB.deleteTable(tableName);
      });
    });

    describe('list indexes', () => {
      const listIndexTestTable = 'list-index-test-table' + Date.now();
      const indexColumnName = 'vector';

      afterAll(async () => {
        try {
          await vectorDB.deleteIndex({ indexName: indexColumnName + '_idx' });
        } catch (error) {
          console.warn('Failed to delete index during cleanup:', error);
        }
      });

      it('should list available indexes', async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
          }));
        };

        await vectorDB.createTable(listIndexTestTable, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: indexColumnName,
          dimension: 3,
          tableName: listIndexTestTable,
        });

        const indexes = await vectorDB.listIndexes();

        expect(indexes).toContain(indexColumnName + '_idx');
      });
    });

    describe('describe index', () => {
      const describeIndexTestTable = 'describe-index-test-table' + Date.now();
      const indexColumnName = 'vector';

      afterAll(async () => {
        try {
          await vectorDB.deleteIndex({ indexName: indexColumnName + '_idx' });
        } catch (error) {
          console.warn('Failed to delete index during cleanup:', error);
        }
      });
      it('should describe an existing index', async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
          }));
        };

        await vectorDB.createTable(describeIndexTestTable, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: indexColumnName,
          dimension: 3,
          metric: 'euclidean',
          tableName: describeIndexTestTable,
        });

        const stats = await vectorDB.describeIndex({ indexName: indexColumnName + '_idx' });

        expect(stats).toBeDefined();
        expect(stats?.dimension).toBe(3);
        expect(stats?.count).toBe(300);
        expect(stats?.metric).toBe('l2');
      });

      it('should throw error for non-existent index', async () => {
        const nonExistentIndex = 'non-existent-index-' + Date.now();

        await expect(vectorDB.describeIndex({ indexName: nonExistentIndex })).rejects.toThrow('not found');
      });
    });

    describe('delete index', () => {
      const deleteIndexTestTable = 'delete-index-test-table' + Date.now();
      const indexColumnName = 'vector';

      beforeAll(async () => {
        await vectorDB.deleteAllTables();
      });

      it('should delete an existing index', async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
          }));
        };

        await vectorDB.createTable(deleteIndexTestTable, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: indexColumnName,
          dimension: 3,
          tableName: deleteIndexTestTable,
        });

        const indexesBefore = await vectorDB.listIndexes();
        expect(indexesBefore).toContain(indexColumnName + '_idx');

        await vectorDB.deleteIndex({ indexName: indexColumnName + '_idx' });

        const indexesAfter = await vectorDB.listIndexes();
        expect(indexesAfter).not.toContain(indexColumnName + '_idx');
      });

      it('should throw error when deleting non-existent index', async () => {
        const nonExistentIndex = 'non-existent-index-' + Date.now();

        await expect(vectorDB.deleteIndex({ indexName: nonExistentIndex })).rejects.toThrow('not found');
      });
    });
  });

  describe('Create table operations', () => {
    const testTableName = 'test-table' + Date.now();

    beforeAll(async () => {
      await vectorDB.deleteAllTables();
    });

    it('should throw error when no data is provided', async () => {
      await expect(vectorDB.createTable(testTableName, [])).rejects.toThrowError(
        /At least one record or a schema needs/,
      );
    });

    it('should create a new table', async () => {
      await vectorDB.createTable(testTableName, [{ id: '1', vector: [0.1, 0.2, 0.3] }]);

      const tables = await vectorDB.listTables();
      expect(tables).toContain(testTableName);

      const schema = await vectorDB.getTableSchema(testTableName);
      expect(schema.fields.map(field => field.name)).toEqual(['id', 'vector']);
    });

    it('should throw error when creating existing table', async () => {
      const tableName = 'test-table' + Date.now();
      await vectorDB.createTable(tableName, [{ id: '1', vector: [0.1, 0.2, 0.3] }]);

      await expect(vectorDB.createTable(tableName, [{ id: '1', vector: [0.1, 0.2, 0.3] }])).rejects.toThrow(
        'already exists',
      );
    });

    it('should create a table with single level nested metadata object by flattening it', async () => {
      const tableName = 'test-table' + Date.now();
      await vectorDB.createTable(tableName, [{ id: '1', vector: [0.1, 0.2, 0.3], metadata_text: 'test' }]);

      const schema = await vectorDB.getTableSchema(tableName);
      expect(schema.fields.map((field: any) => field.name)).toEqual(['id', 'vector', 'metadata_text']);
    });

    it('should create a table with multi level nested metadata object by flattening it', async () => {
      const tableName = 'test-table' + Date.now();
      await vectorDB.createTable(tableName, [
        { id: '1', vector: [0.1, 0.2, 0.3], metadata: { text: 'test', newText: 'test' } },
      ]);

      const schema = await vectorDB.getTableSchema(tableName);
      expect(schema.fields.map((field: any) => field.name)).toEqual([
        'id',
        'vector',
        'metadata_text',
        'metadata_newText',
      ]);
    });
  });

  describe('Vector operations', () => {
    describe('upsert operations', () => {
      const testTableName = 'test-table-test' + Date.now();
      const testTableIndexColumn = 'vector';

      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { text: 'test' },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should upsert vectors in an existing table', async () => {
        // Table starts with 300 background rows (metadata.text = 'test')
        // Verify background rows exist before upsert
        const backgroundResults = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundResults.length).toBeGreaterThan(0);
        const initialBackgroundCount = backgroundResults.length;

        const testVectors = [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ];

        const testMetadata = [
          { text: 'upsert-test-first' },
          { text: 'upsert-test-second' },
          { text: 'upsert-test-third' },
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: testMetadata,
        });

        expect(ids).toHaveLength(3);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        // Verify our new data exists using filter
        let newResults = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: testVectors[0],
          topK: 500,
          filter: { text: { $like: 'upsert-test-%' } },
        });
        expect(newResults).toHaveLength(3);

        // Verify background rows STILL exist (upsert should ADD, not REPLACE)
        const backgroundAfterUpsert = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundAfterUpsert.length).toBe(initialBackgroundCount);

        // Test upsert with provided IDs (update existing vectors)
        const updatedVectors = [
          [1.1, 1.2, 1.3],
          [1.4, 1.5, 1.6],
          [1.7, 1.8, 1.9],
        ];

        const updatedMetadata = [
          { text: 'upsert-test-first-updated' },
          { text: 'upsert-test-second-updated' },
          { text: 'upsert-test-third-updated' },
        ];

        const updatedIds = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: updatedVectors,
          metadata: updatedMetadata,
          ids,
        });

        expect(updatedIds).toEqual(ids);

        // Verify background rows still exist after update
        const backgroundAfterUpdate = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundAfterUpdate.length).toBe(initialBackgroundCount);

        // Verify original test rows are gone (replaced by updated ones)
        const originalResults = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: testVectors[0],
          topK: 500,
          filter: { text: { $like: 'upsert-test-%' } },
        });
        // Should only find the updated rows, not the original ones
        expect(originalResults.every(r => r.metadata?.text?.includes('-updated'))).toBe(true);

        // Verify updated data exists
        newResults = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: updatedVectors[0],
          topK: 500,
          filter: { text: { $like: 'upsert-test-%-updated' } },
        });
        expect(newResults).toHaveLength(3);
        expect(newResults.some(r => r.metadata?.text === 'upsert-test-first-updated')).toBe(true);
      });

      it('should auto-create table when upserting to non-existent table', async () => {
        const nonExistentTable = 'non-existent-table-' + Date.now();

        // Upsert should auto-create the table
        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: nonExistentTable,
          vectors: [[0.1, 0.2, 0.3]],
        });

        expect(ids).toHaveLength(1);

        // Verify table was created
        const tables = await vectorDB.listTables();
        expect(tables).toContain(nonExistentTable);

        // Cleanup
        await vectorDB.deleteTable(nonExistentTable);
      });
    });

    describe('query operations', () => {
      const testTableName = 'test-table-query' + Date.now();
      const testTableIndexColumn = 'vector';

      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { text: 'test' },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should query vectors from an existing table', async () => {
        // Verify background rows exist before upsert
        const backgroundBefore = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundBefore.length).toBeGreaterThan(0);
        const initialBackgroundCount = backgroundBefore.length;

        const testVectors = [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ];

        const testMetadata = [
          { text: 'query-test-first' },
          { text: 'query-test-second' },
          { text: 'query-test-third' },
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: testMetadata,
        });

        expect(ids).toHaveLength(3);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        // Use filter to isolate our test data from background rows
        const results = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: testVectors[0],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 10,
          includeVector: true,
          filter: { text: { $like: 'query-test-%' } },
        });

        expect(results).toHaveLength(3);
        const sortedResultIds = results.map(res => res.id).sort();
        const sortedIds = [...ids].sort();
        expect(sortedResultIds).to.deep.equal(sortedIds);

        // Verify metadata (results are sorted by similarity, not insertion order)
        const texts = results.map(r => r.metadata?.text).sort();
        expect(texts).to.deep.equal(['query-test-first', 'query-test-second', 'query-test-third']);

        // Verify background rows are preserved after upsert
        const backgroundAfter = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundAfter.length).toBe(initialBackgroundCount);
      });

      it('should return empty array when querying from non-existent table', async () => {
        const nonExistentTable = 'non-existent-table-' + Date.now();

        // Query should return empty array, not throw
        const results = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: nonExistentTable,
          columns: ['id', 'vector', 'metadata'],
          queryVector: [0.1, 0.2, 0.3],
        });

        expect(results).toEqual([]);
      });
    });

    describe('update operations', () => {
      const testTableName = 'test-table-updates' + Date.now();
      const testTableIndexColumn = 'vector';

      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { text: 'test' },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should update vector and metadata by id', async () => {
        // Verify background rows exist before upsert
        const backgroundBefore = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundBefore.length).toBeGreaterThan(0);
        const initialBackgroundCount = backgroundBefore.length;

        // Use unique metadata to identify this test's data
        const uniquePrefix = 'update-both-test-' + Date.now();

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ text: uniquePrefix }],
        });

        expect(ids).toHaveLength(1);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        // Verify background rows are preserved after upsert
        const backgroundAfterUpsert = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundAfterUpsert.length).toBe(initialBackgroundCount);

        const updatedText = uniquePrefix + '-updated';
        await vectorDB.updateVector({
          indexName: testTableIndexColumn,
          id: ids[0],
          update: {
            vector: [0.4, 0.5, 0.6],
            metadata: { text: updatedText },
          },
        });

        // Use filter to isolate our test data from background rows
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.4, 0.5, 0.6],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 10,
          includeVector: true,
          filter: { text: { $like: uniquePrefix + '%' } },
        });

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe(ids[0]);
        expect(res[0].metadata?.text).to.equal(updatedText);

        // Fix decimal points in the response vector
        const fixedVector = res[0].vector?.map(num => Number(num.toFixed(1)));
        expect(fixedVector).toEqual([0.4, 0.5, 0.6]);
      });

      it('should only update existing vector', async () => {
        // Verify background rows exist before upsert
        const backgroundBefore = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundBefore.length).toBeGreaterThan(0);
        const initialBackgroundCount = backgroundBefore.length;

        // Use unique metadata to identify this test's data
        const uniqueMetadata = 'vector-only-update-test-' + Date.now();

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ text: uniqueMetadata }],
        });

        expect(ids).toHaveLength(1);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        // Verify background rows are preserved after upsert
        const backgroundAfterUpsert = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundAfterUpsert.length).toBe(initialBackgroundCount);

        // Update only the vector, not the metadata
        await vectorDB.updateVector({
          indexName: testTableIndexColumn,
          id: ids[0],
          update: {
            vector: [0.4, 0.5, 0.6],
          },
        });

        // Use filter to isolate our test data from background rows
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.4, 0.5, 0.6],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 10,
          includeVector: true,
          filter: { text: uniqueMetadata },
        });

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe(ids[0]);
        // Metadata should be unchanged
        expect(res[0].metadata?.text).to.equal(uniqueMetadata);

        // Fix decimal points in the response vector
        const fixedVector = res[0].vector?.map(num => Number(num.toFixed(1)));
        expect(fixedVector).toEqual([0.4, 0.5, 0.6]);
      });

      it('should only update existing vector metadata', async () => {
        // Verify background rows exist before upsert
        const backgroundBefore = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundBefore.length).toBeGreaterThan(0);
        const initialBackgroundCount = backgroundBefore.length;

        // Use unique metadata prefix to identify this test's data
        const uniquePrefix = 'metadata-only-update-test-' + Date.now();

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ text: uniquePrefix }],
        });

        expect(ids).toHaveLength(1);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        // Verify background rows are preserved after upsert
        const backgroundAfterUpsert = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 500,
          filter: { text: 'test' },
        });
        expect(backgroundAfterUpsert.length).toBe(initialBackgroundCount);

        // Update only metadata, not the vector
        const updatedText = uniquePrefix + '-updated';
        await vectorDB.updateVector({
          indexName: testTableIndexColumn,
          id: ids[0],
          update: {
            metadata: { text: updatedText },
          },
        });

        // Use filter to isolate our test data from background rows
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 10,
          includeVector: true,
          filter: { text: { $like: uniquePrefix + '%' } },
        });

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe(ids[0]);
        expect(res[0].metadata?.text).to.equal(updatedText);

        // Vector should be unchanged
        const fixedVector = res[0].vector?.map(num => Number(num.toFixed(1)));
        expect(fixedVector).toEqual([0.1, 0.2, 0.3]);
      });
    });

    describe('delete operations', () => {
      const testTableName = 'test-table-delete' + Date.now();
      const testTableIndexColumn = 'vector';

      beforeAll(async () => {
        await vectorDB.deleteAllTables();

        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { text: 'test' },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should delete vector and metadata by id', async () => {
        const testVectors = [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: [{ text: 'delete-test-first' }, { text: 'delete-test-second' }],
        });

        expect(ids).toHaveLength(2);

        // Query with filter to find our specific vectors (table has 300+ background rows)
        let results = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 500,
          includeVector: true,
          filter: { text: { $like: 'delete-test-%' } },
        });

        // Verify both our vectors exist
        expect(results.some(r => r.id === ids[0])).toBe(true);
        expect(results.some(r => r.id === ids[1])).toBe(true);

        await vectorDB.deleteVector({
          indexName: testTableIndexColumn,
          id: ids[0],
        });

        results = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 500,
          includeVector: true,
          filter: { text: { $like: 'delete-test-%' } },
        });

        // Verify first vector is gone, second still exists
        expect(results.some(r => r.id === ids[0])).toBe(false);
        expect(results.some(r => r.id === ids[1])).toBe(true);
      });
    });
  });

  describe('Basic query operations', () => {
    const testTableName = 'test-table-basic' + Date.now();
    const testTableIndexColumn = 'vector';

    beforeAll(async () => {
      const generateTableData = (numRows: number) => {
        return Array.from({ length: numRows }, (_, i) => ({
          id: String(i + 1),
          vector: Array.from({ length: 3 }, () => Math.random()),
          metadata_text: 'test',
          metadata_newText: 'test',
        }));
      };

      await vectorDB.createTable(testTableName, generateTableData(300));

      await vectorDB.createIndex({
        indexConfig: {
          type: 'ivfflat',
          numPartitions: 1,
          numSubVectors: 1,
        },
        indexName: testTableIndexColumn,
        dimension: 3,
        tableName: testTableName,
      });
    });

    afterAll(async () => {
      vectorDB.deleteTable(testTableName);
    });

    it('should query vectors with metadata', async () => {
      // Verify background rows exist before upsert
      const backgroundBefore = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 500,
        filter: { text: 'test' },
      });
      expect(backgroundBefore.length).toBeGreaterThan(0);
      const initialBackgroundCount = backgroundBefore.length;

      // Use unique metadata to identify this test's data
      const uniqueText = 'query-metadata-test-' + Date.now();
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: uniqueText, newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      // Use filter to isolate our test data from background rows
      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        columns: ['id', 'metadata_text', 'metadata_newText', 'vector'],
        topK: 10,
        includeVector: true,
        filter: { text: uniqueText },
      });

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      expect(res[0].metadata?.text).to.equal(uniqueText);
      expect(res[0].metadata?.newText).to.equal('hi');

      // Verify background rows are preserved after upsert
      const backgroundAfter = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 500,
        filter: { text: 'test' },
      });
      expect(backgroundAfter.length).toBe(initialBackgroundCount);
    });

    it('should query vectors with filter', async () => {
      // Verify background rows exist before upsert
      const backgroundBefore = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 500,
        filter: { text: 'test' },
      });
      expect(backgroundBefore.length).toBeGreaterThan(0);
      const initialBackgroundCount = backgroundBefore.length;

      // Use unique metadata to identify this test's data
      const uniqueText = 'query-filter-test-' + Date.now();
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: uniqueText, newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        columns: ['id', 'metadata_text', 'metadata_newText', 'vector'],
        topK: 10,
        includeVector: true,
        filter: { text: uniqueText },
      });

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      expect(res[0].metadata?.text).to.equal(uniqueText);
      expect(res[0].metadata?.newText).to.equal('hi');

      // Verify background rows are preserved after upsert
      const backgroundAfter = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 500,
        filter: { text: 'test' },
      });
      expect(backgroundAfter.length).toBe(initialBackgroundCount);
    });

    it('should query vectors if filter columns array is not provided', async () => {
      // Use unique metadata to identify this test's data
      const uniqueText = 'query-no-columns-test-' + Date.now();
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: uniqueText, newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      // Query without specifying columns - should return all columns including metadata
      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        topK: 10,
        includeVector: true,
        filter: { text: uniqueText },
      });

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      // When columns are not specified, all columns including metadata should be returned
      expect(res[0].metadata?.text).toBe(uniqueText);
      expect(res[0].metadata?.newText).toBe('hi');
    });

    it('should query vectors with all columns when the include all columns flag is true', async () => {
      // Use unique metadata to identify this test's data
      const uniqueText = 'query-all-columns-test-' + Date.now();
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: uniqueText, newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        topK: 10,
        includeVector: true,
        filter: { text: uniqueText },
        includeAllColumns: true,
      });

      const tableSchema = await vectorDB.getTableSchema(testTableName);
      const expectedColumns = tableSchema.fields.map((column: any) => column.name);
      expect(['id', 'vector', 'metadata_text', 'metadata_newText']).toEqual(expectedColumns);

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      expect(res[0].metadata?.text).toBe(uniqueText);
      expect(res[0].metadata?.newText).toBe('hi');
    });
  });

  describe('Advanced query operations', () => {
    const testTableName = 'test-table-advanced' + Date.now();
    const testTableIndexColumn = 'vector';

    beforeAll(async () => {
      const generateTableData = (numRows: number) => {
        return Array.from({ length: numRows }, (_, i) => ({
          id: String(i + 1),
          vector: Array.from({ length: 3 }, () => Math.random()),
          metadata: { name: 'test', details: { text: 'test' } },
        }));
      };

      await vectorDB.createTable(testTableName, generateTableData(300));

      await vectorDB.createIndex({
        indexConfig: {
          type: 'ivfflat',
          numPartitions: 1,
          numSubVectors: 1,
        },
        indexName: testTableIndexColumn,
        dimension: 3,
        tableName: testTableName,
      });
    });

    afterAll(async () => {
      vectorDB.deleteTable(testTableName);
    });

    describe('Simple queries', () => {
      it('should query vectors with nested metadata filter', async () => {
        const testVectors = [[0.1, 0.2, 0.3]];
        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: [{ name: 'test2', details: { text: 'test2' } }],
        });

        expect(ids).toHaveLength(1);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: testVectors[0],
          columns: ['id', 'metadata_name', 'metadata_details_text', 'vector'],
          topK: 3,
          includeVector: true,
          filter: { name: 'test2' },
        });

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe(ids[0]);
        expect(res[0].metadata?.name).to.equal('test2');
        expect(res[0].metadata?.details?.text).to.equal('test2');
      });

      it('should not throw error when filter is not provided', async () => {
        // Query without filter - should return topK results from the table
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 3,
          includeVector: true,
          includeAllColumns: true,
        });

        // Should return up to topK results (3) from the background rows
        expect(res.length).toBeGreaterThan(0);
        expect(res.length).toBeLessThanOrEqual(3);
      });
    });

    describe('Query with $ne operator', () => {
      const testTableName = 'test-ne-operator';

      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: {
              category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
              count: i + 1,
              active: i % 2 === 0,
            },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should filter with negated equality (equivalent to $not)', async () => {
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 30,
          includeAllColumns: true,
          filter: {
            category: { $ne: 'A' },
          },
        });

        // Should only include categories B and C
        expect(res.length).toBeGreaterThan(0);
        res.forEach(item => {
          expect(item.metadata?.category).not.toBe('A');
        });
      });

      it('should filter with negated comparison (equivalent to $not $gt)', async () => {
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 30,
          includeAllColumns: true,
          filter: {
            count: { $lte: 15 },
          },
        });

        // Should only include counts <= 15
        expect(res.length).toBeGreaterThan(0);
        res.forEach(item => {
          expect(Number(item.metadata?.count)).toBeLessThanOrEqual(15);
        });
      });

      it('should combine negated filters with other operators in complex queries', async () => {
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 30,
          includeAllColumns: true,
          filter: {
            $and: [{ category: { $ne: 'A' } }, { active: true }],
          },
        });

        // Should only include active items with categories B and C
        expect(res.length).toBeGreaterThan(0);
        res.forEach(item => {
          expect(item.metadata?.category).not.toBe('A');
          expect(item.metadata?.active).toBe(true);
        });
      });
    });

    describe('Query with $or operator', () => {
      const testTableName = 'test-or-operator';
      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { name: 'category_test', tag: 'important' },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should query with logical $or operator for metadata filtering', async () => {
        const testVectors = [
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: [
            { name: 'category_a', tag: 'important' },
            { name: 'category_b', tag: 'urgent' },
          ],
        });

        expect(ids).toHaveLength(2);

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.6, 0.7],
          topK: 5,
          includeVector: true,
          includeAllColumns: true,
          filter: {
            $or: [{ name: 'category_a' }, { name: 'category_b' }],
          },
        });

        expect(res.length).toBeGreaterThanOrEqual(2);
        const foundIds = res.map(item => item.id);
        expect(foundIds).toContain(ids[0]);
        expect(foundIds).toContain(ids[1]);
      });
    });

    describe('Query with $and operator', () => {
      const testTableName = 'test-and-operator';
      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { score: 10, dateAdded: Date.now() },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should query with $and operator using comparison operators', async () => {
        const testVectors = [
          [0.1, 0.1, 0.1],
          [0.2, 0.2, 0.2],
          [0.3, 0.3, 0.3],
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: [
            { score: 85, dateAdded: new Date('2023-01-15') },
            { score: 92, dateAdded: new Date('2023-02-20') },
            { score: 78, dateAdded: new Date('2023-03-10') },
          ],
        });

        expect(ids).toHaveLength(3);

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.2, 0.2, 0.2],
          topK: 10,
          includeAllColumns: true,
          includeVector: true,
          filter: {
            $and: [{ score: { $gte: 80 } }, { score: { $lte: 95 } }],
          },
        });

        // should find the score between 80 and 95
        expect(res.length).toBeGreaterThanOrEqual(2);

        const scoresFound = res.map(item => item.metadata?.score);
        expect(scoresFound).toContain(85);
        expect(scoresFound).toContain(92);
        expect(scoresFound).not.toContain(78);
      });
    });

    describe('Query with $in operator', () => {
      const testTableName = 'test-in-operator';
      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { region: 'north', status: 'active' },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should query with array $in operator', async () => {
        const testVectors = [
          [0.4, 0.4, 0.4],
          [0.5, 0.5, 0.5],
          [0.6, 0.6, 0.6],
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: [
            { region: 'north', status: 'active' },
            { region: 'south', status: 'pending' },
            { region: 'east', status: 'inactive' },
          ],
        });

        expect(ids).toHaveLength(3);

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 10,
          includeAllColumns: true,
          includeVector: true,
          filter: {
            region: { $in: ['north', 'south'] },
          },
        });

        expect(res.length).toBeGreaterThanOrEqual(2);

        const regionsFound = res.map(item => item.metadata?.region);
        expect(regionsFound).toContain('north');
        expect(regionsFound).toContain('south');
        expect(regionsFound).not.toContain('east');

        const statusFound = res.map(item => item.metadata?.status);
        expect(statusFound).toContain('active');
        expect(statusFound).toContain('pending');
        expect(statusFound).not.toContain('inactive');
      });
    });

    describe('Query with nested comparison', () => {
      const testTableName = 'test-nested-table';

      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: {
              profile: {
                username: 'john_doe',
                email: 'john@example.com',
                metrics: { visits: 42, likes: 156 },
              },
            },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should query with nested comparison and pattern matching', async () => {
        const testTableName = 'test-nested-table';

        const testVectors = [
          [0.7, 0.7, 0.7],
          [0.8, 0.8, 0.8],
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: [
            {
              profile: {
                username: 'john_doe',
                email: 'john@example.com',
                metrics: { visits: 42, likes: 156 },
              },
            },
            {
              profile: {
                username: 'jane_smith',
                email: 'jane@example.com',
                metrics: { visits: 64, likes: 89 },
              },
            },
          ],
        });

        expect(ids).toHaveLength(2);

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.75, 0.75, 0.75],
          topK: 10,
          includeAllColumns: true,
          includeVector: true,
          filter: {
            $and: [{ 'profile.metrics.visits': { $gt: 40 } }, { 'profile.email': { $like: '%example.com' } }],
          },
        });

        expect(res.length).toBeGreaterThanOrEqual(2);

        const usernamesFound = res.map(item => item.metadata?.profile?.username);
        expect(usernamesFound).toContain('john_doe');
        expect(usernamesFound).toContain('jane_smith');
      });
    });

    describe('Query with regex matching', () => {
      const testTableName = 'test-regex-table';

      beforeAll(async () => {
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
            metadata: { code: 'US-CA-123', description: 'California office' },
          }));
        };

        await vectorDB.createTable(testTableName, generateTableData(300));

        await vectorDB.createIndex({
          indexConfig: {
            type: 'ivfflat',
            numPartitions: 1,
            numSubVectors: 1,
          },
          indexName: testTableIndexColumn,
          dimension: 3,
          tableName: testTableName,
        });
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should query with regex pattern matching', async () => {
        const testVectors = [
          [0.9, 0.9, 0.9],
          [1.0, 1.0, 1.0],
          [1.1, 1.1, 1.1],
        ];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: [
            { code: 'US-CA-123', description: 'California office' },
            { code: 'UK-LN-456', description: 'London office' },
            { code: 'US-NY-789', description: 'New York office' },
          ],
        });

        expect(ids).toHaveLength(3);

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [1.0, 1.0, 1.0],
          topK: 10,
          includeAllColumns: true,
          includeVector: true,
          filter: {
            code: { $regex: '^US-' },
          },
        });

        expect(res.length).toBeGreaterThanOrEqual(2);

        const codesFound = res.map(item => item.metadata?.code);
        expect(codesFound).toContain('US-CA-123');
        expect(codesFound).toContain('US-NY-789');
        expect(codesFound).not.toContain('UK-LN-456');
      });
    });

    describe('Queries to check null fields', () => {
      const testTableName = 'test-null-fields-table';

      beforeAll(async () => {
        // Create data with some null fields for testing
        const data = [
          {
            id: '1',
            vector: [0.1, 0.2, 0.3],
            metadata: {
              title: 'Document with all fields',
              description: 'This document has all fields populated',
              status: 'active',
              tags: ['important', 'reviewed'],
            },
          },
          {
            id: '2',
            vector: [0.4, 0.5, 0.6],
            metadata: {
              title: 'Document with null description',
              description: null,
              status: 'active',
              tags: ['draft'],
            },
          },
          {
            id: '3',
            vector: [0.7, 0.8, 0.9],
            metadata: {
              title: 'Document with null status',
              description: 'This document has a null status field',
              status: null,
              tags: ['important'],
            },
          },
          {
            id: '4',
            vector: [0.2, 0.3, 0.4],
            metadata: {
              title: 'Document with empty tags',
              description: 'This document has empty tags array',
              status: 'inactive',
              tags: [],
            },
          },
          {
            id: '5',
            vector: [0.5, 0.6, 0.7],
            metadata: {
              title: 'Document with null tags',
              description: 'This document has null tags',
              status: 'pending',
              tags: null,
            },
          },
        ];

        await vectorDB.createTable(testTableName, data);
      });

      afterAll(async () => {
        vectorDB.deleteTable(testTableName);
      });

      it('should find documents with null fields using direct null comparison', async () => {
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 10,
          includeAllColumns: true,
          filter: {
            description: null,
          },
        });

        // Should find documents where description is null
        expect(res.length).toBeGreaterThan(0);
        res.forEach(item => {
          expect(item.metadata?.description).toBeNull();
        });
      });

      it('should find documents with non-null fields using $ne null comparison', async () => {
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 10,
          includeAllColumns: true,
          filter: {
            status: { $ne: null },
          },
        });

        // Should find documents where status is not null
        expect(res.length).toBeGreaterThan(0);
        res.forEach(item => {
          expect(item.metadata?.status).not.toBeNull();
        });
      });

      it('should find documents with null fields in complex queries', async () => {
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 10,
          includeAllColumns: true,
          filter: {
            $and: [{ description: { $ne: null } }, { status: null }],
          },
        });

        // Should find documents where description is not null and status is null
        expect(res.length).toBeGreaterThan(0);
        res.forEach(item => {
          expect(item.metadata?.description).not.toBeNull();
          expect(item.metadata?.status).toBeNull();
        });
      });

      it('should combine null checks with other operators', async () => {
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.5, 0.5, 0.5],
          topK: 10,
          includeAllColumns: true,
          filter: {
            $or: [{ status: 'active' }, { tags: null }],
          },
        });

        // Should find documents where either status is active or tags is null
        expect(res.length).toBeGreaterThan(0);
        res.forEach(item => {
          const isMatch = item.metadata?.status === 'active' || item.metadata?.tags === null;
          expect(isMatch).toBe(true);
        });
      });
    });
  });

  describe('Memory integration compatibility', () => {
    // These tests verify that LanceVectorStore works with Memory's calling pattern:
    // 1. createIndex (without tableName, only indexName)
    // 2. upsert (without tableName, only indexName)
    // 3. query (without tableName, only indexName)

    describe('createIndex without tableName', () => {
      it('should create table and index when table does not exist', async () => {
        const indexName = 'memory_compat_create_' + Date.now();

        // Call createIndex without tableName (like Memory does)
        // Should create the table automatically
        await vectorDB.createIndex({
          indexName,
          dimension: 3,
          metric: 'cosine',
        } as any);

        // Verify table was created
        const tables = await vectorDB.listTables();
        expect(tables).toContain(indexName);

        // Cleanup
        await vectorDB.deleteTable(indexName);
      });

      it('should work when table already exists', async () => {
        const tableName = 'memory_compat_existing_' + Date.now();

        // Create table with data first
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
          }));
        };
        await vectorDB.createTable(tableName, generateTableData(300));

        // Call createIndex with tableName explicitly (for existing tables)
        await vectorDB.createIndex({
          tableName,
          indexName: 'vector',
          dimension: 3,
          metric: 'cosine',
          indexConfig: { type: 'ivfflat', numPartitions: 1, numSubVectors: 1 },
        } as any);

        // Should not throw - index created on existing table
        const tables = await vectorDB.listTables();
        expect(tables).toContain(tableName);

        // Cleanup
        await vectorDB.deleteTable(tableName);
      });
    });

    describe('query without tableName', () => {
      it('should return empty array when table does not exist', async () => {
        const indexName = 'memory_compat_query_nonexistent_' + Date.now();

        // Query without tableName on non-existent table
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 5,
        } as any);

        // Should return empty array, not throw
        expect(results).toEqual([]);
      });

      it('should return results when table exists with data', async () => {
        const indexName = 'memory_compat_query_existing_' + Date.now();

        // Create table with data
        const generateTableData = (numRows: number) => {
          return Array.from({ length: numRows }, (_, i) => ({
            id: String(i + 1),
            vector: Array.from({ length: 3 }, () => Math.random()),
          }));
        };
        await vectorDB.createTable(indexName, generateTableData(10));

        // Query without tableName - should default to indexName
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 5,
        } as any);

        expect(results.length).toBeGreaterThan(0);

        // Cleanup
        await vectorDB.deleteTable(indexName);
      });
    });

    describe('upsert without tableName', () => {
      it('should add vectors to existing table', async () => {
        const indexName = 'memory_compat_upsert_' + Date.now();

        // First create table via createIndex (like Memory does)
        await vectorDB.createIndex({
          indexName,
          dimension: 3,
          metric: 'cosine',
        } as any);

        // Then upsert without tableName
        const ids = await vectorDB.upsert({
          indexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
          ],
          metadata: [{ message_id: 'msg1' }, { message_id: 'msg2' }],
        } as any);

        expect(ids).toHaveLength(2);

        // Verify data was added by querying
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 5,
        } as any);

        expect(results.length).toBe(2);

        // Cleanup
        await vectorDB.deleteTable(indexName);
      });
    });

    describe('full Memory-like flow', () => {
      it('should handle empty recall (query before any upsert)', async () => {
        const indexName = 'memory_flow_empty_' + Date.now();

        // Memory flow: createIndex first
        await vectorDB.createIndex({
          indexName,
          dimension: 3,
          metric: 'cosine',
        } as any);

        // Then query (recall) - should return empty, not throw
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 5,
        } as any);

        expect(results).toEqual([]);

        // Cleanup
        await vectorDB.deleteTable(indexName);
      });

      it('should handle save then recall flow', async () => {
        const indexName = 'memory_flow_save_recall_' + Date.now();

        // 1. createIndex (Memory does this first)
        await vectorDB.createIndex({
          indexName,
          dimension: 3,
          metric: 'cosine',
        } as any);

        // 2. upsert (Memory saves messages)
        await vectorDB.upsert({
          indexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
          metadata: [
            { message_id: 'msg1', thread_id: 'thread1' },
            { message_id: 'msg2', thread_id: 'thread1' },
            { message_id: 'msg3', thread_id: 'thread1' },
          ],
        } as any);

        // 3. query (Memory recalls similar messages)
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 2,
        } as any);

        expect(results.length).toBe(2);
        expect(results[0].id).toBeDefined();

        // Cleanup
        await vectorDB.deleteTable(indexName);
      });
    });

    describe('schema mismatch handling', () => {
      it('should filter extra columns when upserting to non-empty table with different schema', async () => {
        const tableName = 'schema_mismatch_extra_cols_' + Date.now();

        // Create table with initial data (establishes schema with metadata_field1)
        await vectorDB.createTable(tableName, [{ id: '1', vector: [0.1, 0.2, 0.3], metadata_field1: 'value1' }]);

        // Upsert with different metadata fields (metadata_field2 not in schema)
        // The extra column should be filtered out
        const ids = await vectorDB.upsert({
          tableName,
          indexName: 'vector',
          vectors: [[0.4, 0.5, 0.6]],
          metadata: [{ field2: 'value2' }], // Different field than schema - will be dropped
        });

        expect(ids).toHaveLength(1);

        // Query to verify data was added
        const results = await vectorDB.query({
          tableName,
          indexName: 'vector',
          queryVector: [0.4, 0.5, 0.6],
          topK: 5,
          includeAllColumns: true,
        });

        expect(results.length).toBe(2); // Original + new row
        // New row should have metadata_field1 as null (from schema), not field2
        const newRow = results.find(r => r.id === ids[0]);
        expect(newRow).toBeDefined();
        expect(newRow?.metadata?.field2).toBeUndefined(); // Dropped
        expect(newRow?.metadata?.field1).toBeNull(); // Set to null for schema column

        // Cleanup
        await vectorDB.deleteTable(tableName);
      });

      it('should set missing schema columns to null when upserting partial data', async () => {
        const tableName = 'schema_mismatch_missing_cols_' + Date.now();

        // Create table with schema including metadata_field1 and metadata_field2
        await vectorDB.createTable(tableName, [
          { id: '1', vector: [0.1, 0.2, 0.3], metadata_field1: 'value1', metadata_field2: 'value2' },
        ]);

        // Upsert with only field1 (field2 missing from incoming data)
        const ids = await vectorDB.upsert({
          tableName,
          indexName: 'vector',
          vectors: [[0.4, 0.5, 0.6]],
          metadata: [{ field1: 'new_value1' }], // field2 not provided
        });

        expect(ids).toHaveLength(1);

        // Query to verify data - field2 should be null for new row
        const results = await vectorDB.query({
          tableName,
          indexName: 'vector',
          queryVector: [0.4, 0.5, 0.6],
          topK: 5,
          includeAllColumns: true,
        });

        const newRow = results.find(r => r.id === ids[0]);
        expect(newRow).toBeDefined();
        expect(newRow?.metadata?.field1).toBe('new_value1');
        // field2 should be null (not undefined) since it's in schema but not in data
        expect(newRow?.metadata?.field2).toBeNull();

        // Cleanup
        await vectorDB.deleteTable(tableName);
      });
    });
  });
});

// Note: Lance's architecture (tables + column names + index names) doesn't align cleanly
// with the shared test suite's expectations. Lance-specific tests are above.

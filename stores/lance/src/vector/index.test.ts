import { createVectorTestSuite } from '@internal/storage-test-utils';
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
        });

        const stats = await vectorDB.describeIndex({ indexName: 'vector_idx' });
        expect(stats).toBeDefined();
        expect(stats?.dimension).toBe(3);

        await vectorDB.deleteTable(tableName);
      });
    });

    describe('delete index', () => {
      // Clean up tables from previous test runs to ensure isolation
      beforeAll(async () => {
        await vectorDB.deleteAllTables();
      });
    });
  });

  describe('Create table operations', () => {
    const testTableName = 'test-table' + Date.now();

    // Clean up tables from previous test runs to ensure isolation
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
        // Clean up tables from previous test runs to ensure isolation
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
        });

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
        });

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
        });

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
        });

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
        });

        // Then upsert without tableName
        const ids = await vectorDB.upsert({
          indexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
          ],
          metadata: [{ message_id: 'msg1' }, { message_id: 'msg2' }],
        });

        expect(ids).toHaveLength(2);

        // Verify data was added by querying
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 5,
        });

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
        });

        // Then query (recall) - should return empty, not throw
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 5,
        });

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
        });

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
        });

        // 3. query (Memory recalls similar messages)
        const results = await vectorDB.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 2,
        });

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

/**
 * Shared Test Suite Integration
 *
 * Lance has a unique table-based architecture that differs from most vector stores:
 * - Requires tables to be created before indexes
 * - Uses tableName parameter throughout operations
 * - Has schema evolution and column management
 *
 * We integrate the shared suite with selective test domain opt-outs to handle
 * Lance's architectural differences while still testing common vector operations.
 */
describe('Lance Shared Test Suite', () => {
  let vectorDB: LanceVectorStore;
  const connectionString = process.env.DB_URL || 'lancedb-vector';

  beforeAll(async () => {
    if (!connectionString) {
      console.warn(
        'Skipping Lance shared test suite: DB_URL environment variable not set. Set DB_URL to a LanceDB connection string (local directory or remote S3/cloud URL).',
      );
      return;
    }

    vectorDB = await LanceVectorStore.create(connectionString);
  });

  afterAll(async () => {
    if (vectorDB) {
      try {
        await vectorDB.deleteAllTables();
      } catch (error) {
        console.warn('Failed to cleanup tables:', error);
      } finally {
        vectorDB.close();
      }
    }
  });

  // Helper function to generate test data for Lance (requires 256+ rows for index creation)
  const generateTableData = (numRows: number, dimension: number = 1536) => {
    return Array.from({ length: numRows }, (_, i) => ({
      id: String(i + 1),
      vector: Array.from({ length: dimension }, () => Math.random()),
      metadata: {},
    }));
  };

  // Use Object.defineProperty with a getter to ensure vectorDB is resolved dynamically
  // This allows createVectorTestSuite to be called at module scope while vectorDB
  // is initialized asynchronously in beforeAll
  const config: any = {
    createIndex: async (indexName: string) => {
      // Lance requires table to exist before creating index
      // Create table with 300 rows (Lance requires 256+ for index creation)
      const tableName = indexName;
      await vectorDB.createTable(tableName, generateTableData(300, 1536));

      // Create index on the 'vector' column
      await vectorDB.createIndex({
        indexName: 'vector',
        dimension: 1536,
        metric: 'cosine',
        tableName: tableName,
        indexConfig: {
          type: 'ivfflat',
          numPartitions: 2,
          numSubVectors: 1,
        },
      });
    },
    deleteIndex: async (indexName: string) => {
      // Lance uses deleteTable instead of deleteIndex
      const tableName = indexName;
      try {
        await vectorDB.deleteTable(tableName);
      } catch {
        // Ignore errors if table doesn't exist
      }
    },
    waitForIndexing: async () => {
      // Lance operations are synchronous, no need to wait
      return;
    },
    testDomains: {
      // Enable basic operations (createIndex, upsert, query, listIndexes, describeIndex)
      basicOps: true,

      // Enable filter operators ($gt, $lt, $in, $and, $or, etc.)
      filterOps: true,

      // Disable edge cases - Lance's table-based architecture handles these differently
      // (e.g., dimension mismatch, large batches, concurrent ops have Lance-specific behavior)
      edgeCases: false,

      // Enable error handling tests
      errorHandling: true,

      // Enable metadata filtering (Memory system compatibility)
      metadataFiltering: true,

      // Disable advanced operations - Lance's architecture differs significantly
      // (deleteVectors/updateVector work differently with tableName parameter)
      advancedOps: false,
    },
  };

  // Define vector as a getter that resolves to vectorDB when accessed
  Object.defineProperty(config, 'vector', {
    get() {
      return vectorDB;
    },
    enumerable: true,
    configurable: true,
  });

  createVectorTestSuite(config);
});

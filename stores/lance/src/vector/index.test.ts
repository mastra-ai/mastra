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
        vectorDB.deleteAllTables();
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
      vectorDB.deleteAllTables();
    });

    it('should throw error when no data is provided', async () => {
      await expect(vectorDB.createTable(testTableName, [])).rejects.toThrow(
        'Failed to create table: At least one record or a schema needs to be provided',
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
        const testVectors = [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ];

        const testMetadata = [{ text: 'First vector' }, { text: 'Second vector' }, { text: 'Third vector' }];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: testMetadata,
        });

        expect(ids).toHaveLength(3);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        // Test upsert with provided IDs (update existing vectors)
        const updatedVectors = [
          [1.1, 1.2, 1.3],
          [1.4, 1.5, 1.6],
          [1.7, 1.8, 1.9],
        ];

        const updatedMetadata = [
          { text: 'First vector updated' },
          { text: 'Second vector updated' },
          { text: 'Third vector updated' },
        ];

        const updatedIds = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: updatedVectors,
          metadata: updatedMetadata,
          ids,
        });

        expect(updatedIds).toEqual(ids);
      });

      it('should throw error when upserting to non-existent table', async () => {
        const nonExistentTable = 'non-existent-table-' + Date.now();

        await expect(
          vectorDB.upsert({
            indexName: testTableIndexColumn,
            tableName: nonExistentTable,
            vectors: [[0.1, 0.2, 0.3]],
          }),
        ).rejects.toThrow('does not exist');
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
        const testVectors = [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ];

        const testMetadata = [{ text: 'First vector' }, { text: 'Second vector' }, { text: 'Third vector' }];

        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: testVectors,
          metadata: testMetadata,
        });

        expect(ids).toHaveLength(3);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        const results = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: testVectors[0],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 3,
          includeVector: true,
        });

        expect(results).toHaveLength(3);
        const sortedResultIds = results.map(res => res.id).sort();
        const sortedIds = ids.sort();
        expect(sortedResultIds).to.deep.equal(sortedIds);
        expect(results[0].metadata?.text).toBe('First vector');
        expect(results[1].metadata?.text).toBe('Second vector');
        expect(results[2].metadata?.text).toBe('Third vector');
      });

      it('should throw error when querying from non-existent table', async () => {
        const nonExistentTable = 'non-existent-table-' + Date.now();

        await expect(
          vectorDB.query({
            indexName: testTableIndexColumn,
            tableName: nonExistentTable,
            columns: ['id', 'vector', 'metadata'],
            queryVector: [0.1, 0.2, 0.3],
          }),
        ).rejects.toThrow(`Failed to query vectors: Table '${nonExistentTable}' was not found`);
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
        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ text: 'First vector' }],
        });

        expect(ids).toHaveLength(1);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        await vectorDB.updateVector({
          indexName: testTableIndexColumn,
          id: ids[0],
          update: {
            vector: [0.4, 0.5, 0.6],
            metadata: { text: 'Updated vector' },
          },
        });

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.4, 0.5, 0.6],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 3,
          includeVector: true,
        });

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe(ids[0]);
        expect(res[0].metadata?.text).to.equal('Updated vector');

        // Fix decimal points in the response vector
        const fixedVector = res[0].vector?.map(num => Number(num.toFixed(1)));
        expect(fixedVector).toEqual([0.4, 0.5, 0.6]);
      });

      it('should only update existing vector', async () => {
        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ text: 'Vector only update test' }],
        });

        expect(ids).toHaveLength(1);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        await vectorDB.updateVector({
          indexName: testTableIndexColumn,
          id: ids[0],
          update: {
            vector: [0.4, 0.5, 0.6],
          },
        });

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.4, 0.5, 0.6],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 3,
          includeVector: true,
        });

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe(ids[0]);
        expect(res[0].metadata?.text).to.equal('Vector only update test');

        // Fix decimal points in the response vector
        const fixedVector = res[0].vector?.map(num => Number(num.toFixed(1)));
        expect(fixedVector).toEqual([0.4, 0.5, 0.6]);
      });

      it('should only update existing vector metadata', async () => {
        const ids = await vectorDB.upsert({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ text: 'Metadata only update test' }],
        });

        expect(ids).toHaveLength(1);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        await vectorDB.updateVector({
          indexName: testTableIndexColumn,
          id: ids[0],
          update: {
            metadata: { text: 'Updated metadata' },
          },
        });

        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          columns: ['id', 'metadata_text', 'vector'],
          topK: 3,
          includeVector: true,
        });

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe(ids[0]);
        expect(res[0].metadata?.text).to.equal('Updated metadata');

        // Fix decimal points in the response vector
        const fixedVector = res[0].vector?.map(num => Number(num.toFixed(1)));
        expect(fixedVector).toEqual([0.1, 0.2, 0.3]);
      });
    });

    describe('delete operations', () => {
      const testTableName = 'test-table-delete' + Date.now();
      const testTableIndexColumn = 'vector';

      beforeAll(async () => {
        vectorDB.deleteAllTables();

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
          metadata: [{ text: 'First vector' }, { text: 'Second vector' }],
        });

        expect(ids).toHaveLength(2);

        let results = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          columns: ['id', 'metadata_text'],
          topK: 3,
          includeVector: true,
        });

        expect(results).toHaveLength(2);

        await vectorDB.deleteVector({
          indexName: testTableIndexColumn,
          id: ids[0],
        });

        results = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          columns: ['id', 'metadata_text'],
          topK: 3,
          includeVector: true,
        });

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe(ids[1]);
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
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: 'First vector', newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        columns: ['id', 'metadata_text', 'metadata_newText', 'vector'],
        topK: 3,
        includeVector: true,
      });

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      expect(res[0].metadata?.text).to.equal('First vector');
      expect(res[0].metadata?.newText).to.equal('hi');
    });

    it('should query vectors with filter', async () => {
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: 'First vector', newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        columns: ['id', 'metadata_text', 'metadata_newText', 'vector'],
        topK: 3,
        includeVector: true,
        filter: { text: 'First vector' },
      });

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      expect(res[0].metadata?.text).to.equal('First vector');
      expect(res[0].metadata?.newText).to.equal('hi');
    });

    it('should query vectors if filter columns array is not provided', async () => {
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: 'First vector', newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        topK: 3,
        includeVector: true,
        filter: { text: 'First vector' },
      });

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      expect(res[0].metadata?.text).toBeUndefined();
      expect(res[0].metadata?.newText).toBeUndefined();
    });

    it('should query vectors with all columns when the include all columns flag is true', async () => {
      const testVectors = [[0.1, 0.2, 0.3]];
      const ids = await vectorDB.upsert({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        vectors: testVectors,
        metadata: [{ text: 'First vector', newText: 'hi' }],
      });

      expect(ids).toHaveLength(1);
      expect(ids.every(id => typeof id === 'string')).toBe(true);

      const res = await vectorDB.query({
        indexName: testTableIndexColumn,
        tableName: testTableName,
        queryVector: testVectors[0],
        topK: 3,
        includeVector: true,
        filter: { text: 'First vector' },
        includeAllColumns: true,
      });

      const tableSchema = await vectorDB.getTableSchema(testTableName);
      const expectedColumns = tableSchema.fields.map((column: any) => column.name);
      expect(['id', 'vector', 'metadata_text', 'metadata_newText']).toEqual(expectedColumns);

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(ids[0]);
      expect(res[0].metadata?.text).toBe('First vector');
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
        const res = await vectorDB.query({
          indexName: testTableIndexColumn,
          tableName: testTableName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 3,
          includeVector: true,
          includeAllColumns: true,
        });

        expect(res).toHaveLength(1);
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
});

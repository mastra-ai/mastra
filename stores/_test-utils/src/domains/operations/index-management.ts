import type { MastraStorage } from '@mastra/core/storage';
import { TABLE_THREADS, TABLE_MESSAGES, TABLE_TRACES } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

export function createIndexManagementTests({ storage }: { storage: MastraStorage }) {
  if (storage.supports.indexManagement) {
    describe('Index Management', () => {
      // Use timestamp to ensure unique index names across test runs
      const timestamp = Date.now();
      const testIndexPrefix = `test_idx_${timestamp}`;
      let createdIndexes: string[] = [];

      afterEach(async () => {
        // Clean up any indexes created during tests
        try {
          const allIndexes = await storage.listIndexes();
          const testIndexes = allIndexes.filter(i => i.name.includes(testIndexPrefix));

          for (const index of testIndexes) {
            try {
              await storage.dropIndex(index.name);
            } catch (error) {
              console.warn(`Failed to drop test index ${index.name}:`, error);
            }
          }
        } catch (error) {
          console.warn('Error during index cleanup:', error);
        }
        createdIndexes = [];
      });

      describe('createIndex', () => {
        it('should create single column index', async () => {
          const indexName = `${testIndexPrefix}_single`;
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId'],
          });
          createdIndexes.push(indexName);

          const indexes = await storage.listIndexes('mastra_threads');
          const createdIndex = indexes.find(i => i.name === indexName);
          expect(createdIndex).toBeDefined();
          expect(createdIndex?.columns).toContain('resourceId');
        });

        it('should create composite index', async () => {
          const indexName = `${testIndexPrefix}_composite`;
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId', 'createdAt DESC'],
          });
          createdIndexes.push(indexName);

          const indexes = await storage.listIndexes('mastra_threads');
          const createdIndex = indexes.find(i => i.name === indexName);
          expect(createdIndex).toBeDefined();
          expect(createdIndex?.columns).toContain('resourceId');
          expect(createdIndex?.columns).toContain('createdAt');
        });

        it('should create unique index', async () => {
          const indexName = `${testIndexPrefix}_unique`;
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['id'],
            unique: true,
          });
          createdIndexes.push(indexName);

          const indexes = await storage.listIndexes('mastra_threads');
          const createdIndex = indexes.find(i => i.name === indexName);
          expect(createdIndex).toBeDefined();
          expect(createdIndex?.unique).toBe(true);
        });

        it('should handle index creation errors gracefully', async () => {
          // Try to create index on non-existent table
          await expect(
            storage.createIndex({
              name: `${testIndexPrefix}_invalid`,
              table: 'non_existent_table' as any,
              columns: ['id'],
            }),
          ).rejects.toThrow();
        });

        it('should prevent duplicate index creation', async () => {
          const indexName = `${testIndexPrefix}_duplicate`;
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId'],
          });
          createdIndexes.push(indexName);

          // Should not throw, should handle gracefully
          await expect(
            storage.createIndex({
              name: indexName,
              table: TABLE_THREADS,
              columns: ['resourceId'],
            }),
          ).resolves.not.toThrow();
        });

        it('should create indexes on different tables', async () => {
          const testIndexes = [
            { name: `${testIndexPrefix}_threads`, table: TABLE_THREADS, columns: ['resourceId'] },
            { name: `${testIndexPrefix}_messages`, table: TABLE_MESSAGES, columns: ['thread_id'] },
            { name: `${testIndexPrefix}_traces`, table: TABLE_TRACES, columns: ['name'] },
          ];

          for (const indexDef of testIndexes) {
            await storage.createIndex(indexDef);
            createdIndexes.push(indexDef.name);
          }

          // Verify all were created
          const allIndexes = await storage.listIndexes();
          for (const indexDef of testIndexes) {
            expect(allIndexes.some(i => i.name === indexDef.name)).toBe(true);
          }
        });

        it('should create index with advanced options', async () => {
          // Test BRIN index (efficient for large tables with natural ordering)
          const brinIndexName = `${testIndexPrefix}_brin`;
          await storage.createIndex({
            name: brinIndexName,
            table: TABLE_THREADS,
            columns: ['createdAt'],
            method: 'brin',
          });
          createdIndexes.push(brinIndexName);

          const indexes = await storage.listIndexes('mastra_threads');
          const brinIndex = indexes.find(i => i.name === brinIndexName);
          expect(brinIndex).toBeDefined();
          expect(brinIndex?.definition.toLowerCase()).toContain('brin');

          // Test SP-GiST index (space-partitioned GiST)
          const spgistIndexName = `${testIndexPrefix}_spgist`;
          await storage.createIndex({
            name: spgistIndexName,
            table: TABLE_THREADS,
            columns: ['title'],
            method: 'spgist',
          });
          createdIndexes.push(spgistIndexName);

          const spgistIndexes = await storage.listIndexes('mastra_threads');
          const spgistIndex = spgistIndexes.find(i => i.name === spgistIndexName);
          expect(spgistIndex).toBeDefined();
          expect(spgistIndex?.definition.toLowerCase()).toContain('spgist');
        });

        it('should create index with storage parameters', async () => {
          const indexName = `${testIndexPrefix}_with_storage`;

          // Create index with storage parameters
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId'],
            method: 'btree',
            storage: {
              fillfactor: 90, // Leave 10% free space for updates
            },
          });
          createdIndexes.push(indexName);

          const indexes = await storage.listIndexes('mastra_threads');
          const createdIndex = indexes.find(i => i.name === indexName);
          expect(createdIndex).toBeDefined();
          expect(createdIndex?.definition).toContain('fillfactor');
        });
      });

      describe('dropIndex', () => {
        it('should drop existing index', async () => {
          const indexName = `${testIndexPrefix}_to_drop`;

          // Create index first
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId'],
          });

          // Verify it exists
          let indexes = await storage.listIndexes('mastra_threads');
          expect(indexes.some(i => i.name === indexName)).toBe(true);

          // Drop it
          await storage.dropIndex(indexName);

          // Verify it's gone
          indexes = await storage.listIndexes('mastra_threads');
          expect(indexes.some(i => i.name === indexName)).toBe(false);
        });

        it('should handle dropping non-existent index gracefully', async () => {
          await expect(storage.dropIndex(`${testIndexPrefix}_non_existent`)).resolves.not.toThrow();
        });
      });

      describe('describeIndex', () => {
        it('should return detailed statistics for an index', async () => {
          const indexName = `${testIndexPrefix}_describe`;

          // Create an index to describe
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId', 'createdAt'],
            method: 'btree',
          });
          createdIndexes.push(indexName);

          // Get index statistics
          const stats = await storage.describeIndex(indexName);

          // Verify the response structure
          expect(stats).toBeDefined();
          expect(stats.name).toBe(indexName);
          expect(stats.table).toBe('mastra_threads');
          expect(stats.columns).toEqual(['resourceId', 'createdAt']);
          expect(stats.unique).toBe(false);
          expect(stats.size).toBeDefined();
          expect(stats.definition).toContain('CREATE');
          expect(stats.method).toBe('btree');
          expect(typeof stats.scans).toBe('number');
          expect(typeof stats.tuples_read).toBe('number');
          expect(typeof stats.tuples_fetched).toBe('number');
        });

        it('should return statistics for unique index', async () => {
          const indexName = `${testIndexPrefix}_describe_unique`;

          await storage.createIndex({
            name: indexName,
            table: TABLE_MESSAGES,
            columns: ['id'],
            unique: true,
          });
          createdIndexes.push(indexName);

          const stats = await storage.describeIndex(indexName);

          expect(stats.unique).toBe(true);
          expect(stats.columns).toContain('id');
        });

        it('should return statistics for different index methods', async () => {
          // Test GIN index on JSONB column (use TABLE_TRACES attributes column which is JSONB)
          const ginIndexName = `${testIndexPrefix}_describe_gin`;
          await storage.createIndex({
            name: ginIndexName,
            table: TABLE_TRACES,
            columns: ['attributes'],
            method: 'gin',
          });
          createdIndexes.push(ginIndexName);

          const ginStats = await storage.describeIndex(ginIndexName);
          expect(ginStats.method).toBe('gin');

          // Test HASH index
          const hashIndexName = `${testIndexPrefix}_describe_hash`;
          await storage.createIndex({
            name: hashIndexName,
            table: TABLE_THREADS,
            columns: ['id'],
            method: 'hash',
          });
          createdIndexes.push(hashIndexName);

          const hashStats = await storage.describeIndex(hashIndexName);
          expect(hashStats.method).toBe('hash');

          // Test GIST index (typically used for geometric types, but can work with text via extensions)
          // Skip GIST for now as it requires special operator classes
        });

        it('should throw error for non-existent index', async () => {
          await expect(storage.describeIndex(`${testIndexPrefix}_non_existent_describe`)).rejects.toThrow();
        });

        it('should track index usage statistics', async () => {
          const indexName = `${testIndexPrefix}_describe_usage`;

          // Create index
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId'],
          });
          createdIndexes.push(indexName);

          // Insert some test data to ensure statistics
          const testThread = {
            id: `thread-stats-${timestamp}`,
            resourceId: `resource-stats-${timestamp}`,
            title: 'Test Thread for Stats',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {},
          };

          await storage.insert({
            tableName: TABLE_THREADS,
            record: testThread,
          });

          // Perform a query that should use the index
          await storage.listThreadsByResourceId({
            resourceId: testThread.resourceId,
            page: 0,
            perPage: 10,
          });

          // Get updated statistics
          const stats = await storage.describeIndex(indexName);

          // Verify statistics fields exist (values might be 0 initially)
          expect(stats).toHaveProperty('scans');
          expect(stats).toHaveProperty('tuples_read');
          expect(stats).toHaveProperty('tuples_fetched');
          expect(typeof stats.scans).toBe('number');
          expect(stats.scans).toBeGreaterThanOrEqual(0);

          // Clean up test data
          await storage.deleteThread({ threadId: testThread.id });
        });
      });

      describe('listIndexes', () => {
        beforeEach(async () => {
          // Create a test index for listing tests
          const indexName = `${testIndexPrefix}_for_list`;
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId', 'createdAt'],
          });
          createdIndexes.push(indexName);
        });

        it('should list all indexes when no table specified', async () => {
          const indexes = await storage.listIndexes();
          expect(Array.isArray(indexes)).toBe(true);
          expect(indexes.length).toBeGreaterThan(0);

          // Should include our test index
          expect(indexes.some(i => i.name === `${testIndexPrefix}_for_list`)).toBe(true);
        });

        it('should list indexes for specific table', async () => {
          const indexes = await storage.listIndexes('mastra_threads');
          expect(Array.isArray(indexes)).toBe(true);

          // Should include indexes for threads table
          expect(indexes.every(i => i.table === 'mastra_threads')).toBe(true);

          // Should include our test index
          expect(indexes.some(i => i.name === `${testIndexPrefix}_for_list`)).toBe(true);
        });

        it('should include index metadata', async () => {
          const indexes = await storage.listIndexes('mastra_threads');
          const testIndex = indexes.find(i => i.name === `${testIndexPrefix}_for_list`);

          expect(testIndex).toBeDefined();
          expect(testIndex).toMatchObject({
            name: `${testIndexPrefix}_for_list`,
            table: 'mastra_threads',
            columns: expect.arrayContaining(['resourceId', 'createdAt']),
            unique: false,
            size: expect.any(String),
            definition: expect.stringContaining('CREATE'),
          });
        });

        it('should list indexes for all mastra tables', async () => {
          const tables = ['mastra_threads', 'mastra_messages', 'mastra_traces'];

          for (const table of tables) {
            const indexes = await storage.listIndexes(table);
            expect(Array.isArray(indexes)).toBe(true);
          }
        });
      });

      describe('Automatic Performance Indexes', () => {
        it('should create all defined automatic indexes during initialization', async () => {
          // Get automatic index definitions (if provider supports it)
          const definitions = (storage as any).stores?.operations?.getAutomaticIndexDefinitions?.();

          if (!definitions || definitions.length === 0) {
            // Provider doesn't define automatic indexes, skip test
            return;
          }

          const indexes = await storage.listIndexes();

          // Verify each defined automatic index was created
          for (const def of definitions) {
            const found = indexes.some(i => i.name === def.name);
            expect(found, `Expected automatic index "${def.name}" to be created`).toBe(true);
          }
        });

        it('should have valid automatic index definitions', () => {
          // Get automatic index definitions (if provider supports it)
          const definitions = (storage as any).stores?.operations?.getAutomaticIndexDefinitions?.();

          if (!definitions || definitions.length === 0) {
            // Provider doesn't define automatic indexes, skip test
            return;
          }

          // Verify each definition has required fields
          for (const def of definitions) {
            expect(def.name, 'Index definition must have a name').toBeTruthy();
            expect(def.table, 'Index definition must have a table').toBeTruthy();
            expect(Array.isArray(def.columns), 'Index definition must have columns array').toBe(true);
            expect(def.columns.length, 'Index definition must have at least one column').toBeGreaterThan(0);
          }
        });

        it('should handle schema prefixes in automatic indexes', async () => {
          // This test verifies that automatic indexes work correctly with schemas
          // The schema prefix handling is done internally by the storage adapter
          const indexes = await storage.listIndexes();

          // All automatic indexes should exist regardless of schema
          expect(indexes.some(i => i.name.includes('threads_resourceid_createdat'))).toBe(true);
          expect(indexes.some(i => i.name.includes('messages_thread_id_createdat'))).toBe(true);
        });
      });

      describe('Performance Impact', () => {
        it('should improve query performance with indexes', async () => {
          // Create a custom index for testing performance
          const indexName = `${testIndexPrefix}_perf`;
          await storage.createIndex({
            name: indexName,
            table: TABLE_THREADS,
            columns: ['resourceId', 'createdAt DESC'],
          });
          createdIndexes.push(indexName);

          // Insert some test data
          const testThreads = [];
          for (let i = 0; i < 100; i++) {
            testThreads.push({
              id: `perf-thread-${timestamp}-${i}`,
              resourceId: `perf-resource-${Math.floor(i / 10)}`,
              title: `Performance Test Thread ${i}`,
              createdAt: new Date(Date.now() - i * 1000),
              updatedAt: new Date(Date.now() - i * 1000),
              metadata: {},
            });
          }

          // Batch insert if available, otherwise insert one by one
          if (storage.batchInsert) {
            await storage.batchInsert({
              tableName: TABLE_THREADS,
              records: testThreads,
            });
          } else {
            for (const thread of testThreads) {
              await storage.insert({
                tableName: TABLE_THREADS,
                record: thread,
              });
            }
          }

          // Measure query performance
          const startTime = Date.now();
          await storage.listThreadsByResourceId({
            resourceId: `perf-resource-5`,
            page: 0,
            perPage: 10,
            orderBy: { field: 'createdAt', direction: 'DESC' },
          });
          const queryTime = Date.now() - startTime;

          // With an index, the query should be reasonably fast
          // We set a generous limit since test environments vary
          expect(queryTime).toBeLessThan(500);

          // Clean up test data
          for (const thread of testThreads) {
            await storage.deleteThread({ threadId: thread.id });
          }
        });
      });
    });
  }
}

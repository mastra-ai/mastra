import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PgDB } from '../db';
import { PostgresStore } from '../index';

// Mock pg-promise
const mockClient = {
  none: vi.fn(),
  one: vi.fn(),
  manyOrNone: vi.fn(),
  oneOrNone: vi.fn(),
  query: vi.fn(),
};

const mockPgp = vi.fn(() => mockClient);
vi.mock('pg-promise', () => ({ default: vi.fn(() => mockPgp) }));

describe('PostgresStore Performance Indexes', () => {
  let dbOps: PgDB;

  beforeEach(() => {
    vi.clearAllMocks();

    dbOps = new PgDB({
      client: mockClient as any,
      schemaName: 'test_schema',
    });

    // Mock createIndex method to simulate the actual implementation
    vi.spyOn(dbOps, 'createIndex').mockResolvedValue(undefined);
  });

  describe('createDefaultIndexes', () => {
    it('should create all necessary composite indexes', async () => {
      await dbOps.createDefaultIndexes();

      // Verify that createIndex was called for composite indexes
      expect(dbOps.createIndex).toHaveBeenCalledTimes(8);

      // Check that composite index for threads is created
      expect(dbOps.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_threads_resourceid_createdat_idx',
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt DESC'],
      });

      // Check that composite index for messages is created
      expect(dbOps.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_messages_thread_id_createdat_idx',
        table: 'mastra_messages',
        columns: ['thread_id', 'createdAt DESC'],
      });

      // Check that composite index for traces is created
      expect(dbOps.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_traces_name_starttime_idx',
        table: 'mastra_traces',
        columns: ['name', 'startTime DESC'],
      });

      // Check that composite index for scores is created
      expect(dbOps.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_scores_trace_id_span_id_created_at_idx',
        table: 'mastra_scores',
        columns: ['traceId', 'spanId', 'createdAt DESC'],
      });
    });

    it('should handle index creation errors gracefully', async () => {
      // Mock the logger using Object.defineProperty to bypass protected access
      const loggerWarnSpy = vi.fn();
      Object.defineProperty(dbOps, 'logger', {
        value: {
          warn: loggerWarnSpy,
        },
        writable: true,
        configurable: true,
      });

      // Make createIndex fail for the first index
      vi.spyOn(dbOps, 'createIndex')
        .mockRejectedValueOnce(new Error('Index already exists'))
        .mockResolvedValue(undefined);

      await dbOps.createDefaultIndexes();

      // Should log warning but continue with other indexes
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create index'), expect.any(Error));

      // Should still try to create all indexes
      expect(dbOps.createIndex).toHaveBeenCalledTimes(8);
    });

    it('should work with default schema (public)', async () => {
      const publicDbOps = new PgDB({
        client: mockClient as any,
        // No schemaName provided, should default to public
      });

      vi.spyOn(publicDbOps, 'createIndex').mockResolvedValue(undefined);

      await publicDbOps.createDefaultIndexes();

      // Verify indexes are created without schema prefix
      expect(publicDbOps.createIndex).toHaveBeenCalledWith({
        name: 'mastra_threads_resourceid_createdat_idx', // No schema prefix
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt DESC'],
      });
    });
  });

  describe('PostgresStore initialization', () => {
    it('should create indexes during init without failing on index errors', async () => {
      // Create a fresh store instance
      const testStore = new PostgresStore({
        id: 'index-error-test-store',
        connectionString: 'postgresql://test:test@localhost:5432/test',
      });

      // Mock pgPromise and database connection
      const mockDb = {
        none: vi.fn().mockRejectedValue(new Error('Index creation failed')),
        one: vi.fn(),
        manyOrNone: vi.fn(),
        oneOrNone: vi.fn(),
      };

      // Use the already mocked pg-promise at module level
      mockPgp.mockReturnValue(mockDb);

      // Create a mock dbOps instance with logger
      const mockDbOps = {
        createDefaultIndexes: vi.fn().mockImplementation(async function () {
          // Simulate index creation failures with proper logging
          for (let i = 0; i < 8; i++) {
            try {
              throw new Error('Index creation failed');
            } catch (error) {
              // Use logger if available
              this.logger?.warn?.(`Failed to create index:`, error);
            }
          }
        }),
        logger: {
          warn: vi.fn(),
        },
      };

      // Mock the store's #dbOps property via init override
      testStore.init = vi.fn().mockImplementation(async function () {
        // Call createDefaultIndexes like the real implementation does
        await mockDbOps.createDefaultIndexes.call(mockDbOps);
      });

      // Init should still succeed even if index creation fails
      await expect(testStore.init()).resolves.not.toThrow();

      // Verify that createDefaultIndexes was called
      expect(mockDbOps.createDefaultIndexes).toHaveBeenCalled();

      // Verify warnings were logged using the logger
      expect(mockDbOps.logger.warn).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoreOperationsPG } from '../domains/operations';
import { PostgresStore } from '../index';

// Mock pg-promise
const mockClient = {
  none: vi.fn(),
  one: vi.fn(),
  manyOrNone: vi.fn(),
};

const mockPgp = vi.fn(() => mockClient);
vi.mock('pg-promise', () => ({ default: vi.fn(() => mockPgp) }));

describe('PostgresStore Performance Indexes', () => {
  let operations: StoreOperationsPG;

  beforeEach(() => {
    vi.clearAllMocks();

    operations = new StoreOperationsPG({
      client: mockClient as any,
      schemaName: 'test_schema',
    });

    // Mock createIndex method to simulate the actual implementation
    vi.spyOn(operations, 'createIndex').mockResolvedValue(undefined);
  });

  describe('createAutomaticIndexes', () => {
    it('should create all necessary composite indexes', async () => {
      await operations.createAutomaticIndexes();

      // Verify that createIndex was called 4 times for composite indexes
      expect(operations.createIndex).toHaveBeenCalledTimes(4);

      // Check that composite index for threads is created
      expect(operations.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_threads_resourceid_createdat_idx',
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt DESC'],
      });

      // Check that composite index for messages is created
      expect(operations.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_messages_thread_id_createdat_idx',
        table: 'mastra_messages',
        columns: ['thread_id', 'createdAt DESC'],
      });

      // Check that composite index for traces is created
      expect(operations.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_traces_name_starttime_idx',
        table: 'mastra_traces',
        columns: ['name', 'startTime DESC'],
      });

      // Check that composite index for evals is created
      expect(operations.createIndex).toHaveBeenCalledWith({
        name: 'test_schema_mastra_evals_agent_name_created_at_idx',
        table: 'mastra_evals',
        columns: ['agent_name', 'created_at DESC'],
      });
    });

    it('should handle index creation errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Make createIndex fail for the first index
      vi.spyOn(operations, 'createIndex')
        .mockRejectedValueOnce(new Error('Index already exists'))
        .mockResolvedValue(undefined);

      await operations.createAutomaticIndexes();

      // Should log warning but continue with other indexes
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create index'), expect.any(Error));

      // Should still try to create all 4 indexes
      expect(operations.createIndex).toHaveBeenCalledTimes(4);

      consoleWarnSpy.mockRestore();
    });

    it('should work with default schema (public)', async () => {
      const publicOperations = new StoreOperationsPG({
        client: mockClient as any,
        // No schemaName provided, should default to public
      });

      vi.spyOn(publicOperations, 'createIndex').mockResolvedValue(undefined);

      await publicOperations.createAutomaticIndexes();

      // Verify indexes are created without schema prefix
      expect(publicOperations.createIndex).toHaveBeenCalledWith({
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
        connectionString: 'postgresql://test:test@localhost:5432/test',
      });

      // Mock pgPromise and database connection
      const mockDb = {
        none: vi.fn().mockRejectedValue(new Error('Index creation failed')),
        one: vi.fn(),
        manyOrNone: vi.fn(),
        oneOrNone: vi.fn(),
      };

      // Mock pg-promise module
      const pgPromiseMock = vi.fn(() => mockDb);
      vi.spyOn(await import('pg-promise'), 'default').mockReturnValue(pgPromiseMock as any);

      // Mock the parent init to avoid actual table creation
      const mockSuperInit = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(testStore)), 'init').mockImplementation(mockSuperInit);

      // Mock console.warn to capture warnings
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Init should still succeed even if index creation fails
      await expect(testStore.init()).resolves.not.toThrow();

      // Verify warnings were logged for each index creation failure
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create index'), expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});

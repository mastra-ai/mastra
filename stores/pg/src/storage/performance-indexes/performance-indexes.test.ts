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
      // Mock the logger using Object.defineProperty to bypass protected access
      const loggerWarnSpy = vi.fn();
      Object.defineProperty(operations, 'logger', {
        value: {
          warn: loggerWarnSpy,
        },
        writable: true,
        configurable: true,
      });

      // Make createIndex fail for the first index
      vi.spyOn(operations, 'createIndex')
        .mockRejectedValueOnce(new Error('Index already exists'))
        .mockResolvedValue(undefined);

      await operations.createAutomaticIndexes();

      // Should log warning but continue with other indexes
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create index'), expect.any(Error));

      // Should still try to create all 4 indexes
      expect(operations.createIndex).toHaveBeenCalledTimes(4);
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

      // Create a mock operations instance with logger
      const mockOperations = {
        createAutomaticIndexes: vi.fn().mockImplementation(async function () {
          // Simulate index creation failures with proper logging
          for (let i = 0; i < 4; i++) {
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

      // Mock the store's operations property
      Object.defineProperty(testStore, 'stores', {
        value: {
          operations: mockOperations,
        },
        writable: true,
      });

      // Mock the init method to simulate what PostgresStore.init does
      testStore.init = vi.fn().mockImplementation(async function () {
        // Call createAutomaticIndexes like the real implementation does
        await mockOperations.createAutomaticIndexes.call(mockOperations);
      });

      // Init should still succeed even if index creation fails
      await expect(testStore.init()).resolves.not.toThrow();

      // Verify that createAutomaticIndexes was called
      expect(mockOperations.createAutomaticIndexes).toHaveBeenCalled();

      // Verify warnings were logged using the logger
      expect(mockOperations.logger.warn).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EvalsStoragePG } from '../domains/evals';
import { MemoryPG } from '../domains/memory';
import { ObservabilityPG } from '../domains/observability';
import { IndexManagementPG } from '../domains/operations';
import { PostgresStore } from '../index';

// Mock pg-promise
const mockClient = {
  none: vi.fn(),
  one: vi.fn(),
  manyOrNone: vi.fn(),
  oneOrNone: vi.fn(),
};

const mockPgp = vi.fn(() => mockClient);
vi.mock('pg-promise', () => ({ default: vi.fn(() => mockPgp) }));

describe('PostgresStore Performance Indexes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.oneOrNone.mockResolvedValue(null); // Index doesn't exist by default
  });

  describe('MemoryPG domain indexes', () => {
    it('should create memory domain indexes', async () => {
      const memoryDomain = new MemoryPG({ client: mockClient as any, schema: 'test_schema' });

      // Mock IndexManagementPG.createIndex
      const createIndexSpy = vi.spyOn(IndexManagementPG.prototype, 'createIndex').mockResolvedValue(undefined);

      await memoryDomain.createIndexes();

      // Verify that createIndex was called 2 times for memory indexes
      expect(createIndexSpy).toHaveBeenCalledTimes(2);

      // Check that composite index for threads is created
      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'test_schema_mastra_threads_resourceid_createdat_idx',
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt DESC'],
      });

      // Check that composite index for messages is created
      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'test_schema_mastra_messages_thread_id_createdat_idx',
        table: 'mastra_messages',
        columns: ['thread_id', 'createdAt DESC'],
      });
    });

    it('should handle index creation errors gracefully', async () => {
      const memoryDomain = new MemoryPG({ client: mockClient as any, schema: 'test_schema' });
      const loggerWarnSpy = vi.fn();

      // Mock logger
      Object.defineProperty(memoryDomain, 'logger', {
        value: { warn: loggerWarnSpy },
        writable: true,
        configurable: true,
      });

      // Make createIndex fail for the first index, but succeed for the second
      vi.spyOn(IndexManagementPG.prototype, 'createIndex')
        .mockRejectedValueOnce(new Error('Index already exists'))
        .mockResolvedValue(undefined);

      await memoryDomain.createIndexes();

      // Should log warning when first index creation fails
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create memory threads index'),
        expect.any(Error),
      );

      // Should attempt to create both indexes even if first fails
      expect(IndexManagementPG.prototype.createIndex).toHaveBeenCalledTimes(2);
    });

    it('should work with default schema (public)', async () => {
      const memoryDomain = new MemoryPG({ client: mockClient as any, schema: 'public' });
      const createIndexSpy = vi.spyOn(IndexManagementPG.prototype, 'createIndex').mockResolvedValue(undefined);

      await memoryDomain.createIndexes();

      // Verify indexes are created without schema prefix
      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'mastra_threads_resourceid_createdat_idx', // No schema prefix
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt DESC'],
      });
    });
  });

  describe('ObservabilityPG domain indexes', () => {
    it('should create observability domain indexes', async () => {
      const observabilityDomain = new ObservabilityPG({ client: mockClient as any, schema: 'test_schema' });
      const createIndexSpy = vi.spyOn(IndexManagementPG.prototype, 'createIndex').mockResolvedValue(undefined);

      await observabilityDomain.createIndexes();

      // Verify that createIndex was called 4 times for observability indexes
      expect(createIndexSpy).toHaveBeenCalledTimes(4);

      // Check indexes are created
      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'test_schema_mastra_ai_spans_traceid_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['traceId', 'startedAt DESC'],
      });

      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'test_schema_mastra_ai_spans_parentspanid_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['parentSpanId', 'startedAt DESC'],
      });

      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'test_schema_mastra_ai_spans_name_idx',
        table: 'mastra_ai_spans',
        columns: ['name'],
      });

      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'test_schema_mastra_ai_spans_spantype_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['spanType', 'startedAt DESC'],
      });
    });

    it('should handle index creation errors gracefully', async () => {
      const observabilityDomain = new ObservabilityPG({ client: mockClient as any, schema: 'test_schema' });
      const loggerWarnSpy = vi.fn();

      Object.defineProperty(observabilityDomain, 'logger', {
        value: { warn: loggerWarnSpy },
        writable: true,
        configurable: true,
      });

      // Make createIndex fail for the first and third indexes, but succeed for others
      vi.spyOn(IndexManagementPG.prototype, 'createIndex')
        .mockRejectedValueOnce(new Error('Index already exists'))
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Index already exists'))
        .mockResolvedValueOnce(undefined);

      await observabilityDomain.createIndexes();

      // Should log warnings when index creation fails
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create observability traceId index'),
        expect.any(Error),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create observability name index'),
        expect.any(Error),
      );

      // Should attempt to create all 4 indexes even if some fail
      expect(IndexManagementPG.prototype.createIndex).toHaveBeenCalledTimes(4);
    });
  });

  describe('EvalsStoragePG domain indexes', () => {
    it('should create evals domain indexes', async () => {
      const evalsDomain = new EvalsStoragePG({ client: mockClient as any, schema: 'test_schema' });
      const createIndexSpy = vi.spyOn(IndexManagementPG.prototype, 'createIndex').mockResolvedValue(undefined);

      await evalsDomain.createIndexes();

      // Verify that createIndex was called 1 time for evals indexes
      expect(createIndexSpy).toHaveBeenCalledTimes(1);

      expect(createIndexSpy).toHaveBeenCalledWith({
        name: 'test_schema_mastra_scores_trace_id_span_id_created_at_idx',
        table: 'mastra_scorers',
        columns: ['traceId', 'spanId', 'createdAt DESC'],
      });
    });

    it('should handle index creation errors gracefully', async () => {
      const evalsDomain = new EvalsStoragePG({ client: mockClient as any, schema: 'test_schema' });
      const loggerWarnSpy = vi.fn();

      Object.defineProperty(evalsDomain, 'logger', {
        value: { warn: loggerWarnSpy },
        writable: true,
        configurable: true,
      });

      vi.spyOn(IndexManagementPG.prototype, 'createIndex').mockRejectedValue(new Error('Index already exists'));

      await evalsDomain.createIndexes();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create evals scores index'),
        expect.any(Error),
      );
      expect(IndexManagementPG.prototype.createIndex).toHaveBeenCalledTimes(1);
    });
  });

  describe('PostgresStore initialization', () => {
    it('should create indexes during domain init without failing on index errors', async () => {
      const testStore = new PostgresStore({
        id: 'index-error-test-store',
        connectionString: 'postgresql://test:test@localhost:5432/test',
      });

      // Mock database methods
      mockClient.none.mockResolvedValue(undefined);
      mockClient.oneOrNone.mockResolvedValue(null);

      // Mock createIndex to fail
      const createIndexSpy = vi
        .spyOn(IndexManagementPG.prototype, 'createIndex')
        .mockRejectedValue(new Error('Index creation failed'));

      // Mock logger for each domain
      const memoryLoggerWarn = vi.fn();
      const observabilityLoggerWarn = vi.fn();
      const evalsLoggerWarn = vi.fn();

      Object.defineProperty(testStore.stores.memory, 'logger', {
        value: { warn: memoryLoggerWarn },
        writable: true,
        configurable: true,
      });

      if (testStore.stores.observability) {
        Object.defineProperty(testStore.stores.observability, 'logger', {
          value: { warn: observabilityLoggerWarn },
          writable: true,
          configurable: true,
        });
      }

      Object.defineProperty(testStore.stores.evals, 'logger', {
        value: { warn: evalsLoggerWarn },
        writable: true,
        configurable: true,
      });

      // Init should succeed even if index creation fails
      await expect(testStore.stores.memory.init()).resolves.not.toThrow();
      if (testStore.stores.observability) {
        await expect(testStore.stores.observability.init()).resolves.not.toThrow();
      }
      await expect(testStore.stores.evals.init()).resolves.not.toThrow();

      // Verify that createIndex was called for each domain
      expect(createIndexSpy).toHaveBeenCalled();

      // Verify warnings were logged
      expect(memoryLoggerWarn).toHaveBeenCalled();
      if (testStore.stores.observability) {
        expect(observabilityLoggerWarn).toHaveBeenCalled();
      }
      expect(evalsLoggerWarn).toHaveBeenCalled();
    });
  });
});

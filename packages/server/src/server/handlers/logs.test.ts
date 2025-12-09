import { LogLevel } from '@mastra/core/logger';
import type { BaseLogMessage, IMastraLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { LIST_LOGS_ROUTE, LIST_LOGS_BY_RUN_ID_ROUTE, LIST_LOG_TRANSPORTS_ROUTE } from './logs';
import { createTestServerContext } from './test-utils';

type MockedLogger = {
  listLogsByRunId: Mock<IMastraLogger['listLogsByRunId']>;
  listLogs: Mock<IMastraLogger['listLogs']>;
};

function createLog(args: Partial<BaseLogMessage>): BaseLogMessage {
  return {
    msg: 'test log',
    level: LogLevel.INFO,
    time: new Date(),
    ...args,
    pid: 1,
    hostname: 'test-host',
    name: 'test-name',
    runId: 'test-run',
  };
}

describe('Logs Handlers', () => {
  let mockLogger: Omit<IMastraLogger, keyof MockedLogger> &
    MockedLogger & {
      transports: Record<string, unknown>;
    };
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - mockLogger is not typed
    mockLogger = {
      listLogsByRunId: vi.fn(),
      listLogs: vi.fn(),
      transports: new Map<string, unknown>(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      cleanup: vi.fn(),
      trackException: vi.fn(),
      getTransports: vi.fn(() => mockLogger.transports ?? new Map<string, unknown>()),
    } as unknown as MockedLogger & {
      transports: Record<string, unknown>;
      getTransports: () => Map<string, unknown>;
    };

    mastra = new Mastra({
      logger: mockLogger as unknown as IMastraLogger,
    });
  });

  describe('listLogsHandler', () => {
    it('should throw error when transportId is not provided', async () => {
      await expect(
        LIST_LOGS_ROUTE.handler({ ...createTestServerContext({ mastra }), page: 1, transportId: undefined as any }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "transportId" is required' }));
    });

    it('should get logs successfully', async () => {
      const mockLogs: BaseLogMessage[] = [createLog({})];

      mockLogger.listLogs.mockResolvedValue({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      const result = await LIST_LOGS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        page: 0,
        transportId: 'test-transport',
      });

      expect(result).toEqual({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      expect(mockLogger.listLogs).toHaveBeenCalledWith('test-transport', {});
    });

    it('should get logs successfully with params', async () => {
      const mockLogs: BaseLogMessage[] = [createLog({})];

      mockLogger.listLogs.mockResolvedValue({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      const result = await LIST_LOGS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        transportId: 'test-transport',
        logLevel: LogLevel.INFO,
        page: 0,
      });

      expect(result).toEqual({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      expect(mockLogger.listLogs).toHaveBeenCalledWith('test-transport', {
        logLevel: LogLevel.INFO,
      });
    });

    it('should handle filters with colons in values correctly', async () => {
      const mockLogs: BaseLogMessage[] = [createLog({})];

      mockLogger.listLogs.mockResolvedValue({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      const result = await LIST_LOGS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        transportId: 'test-transport',
        filters: ['timestamp:2024-01-01T10:30:00', 'url:https://example.com'],
        page: 0,
      });

      expect(result).toEqual({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      expect(mockLogger.listLogs).toHaveBeenCalledWith('test-transport', {
        filters: {
          timestamp: '2024-01-01T10:30:00',
          url: 'https://example.com',
        },
      });
    });
  });

  describe('listLogsByRunIdHandler', () => {
    it('should throw error when runId is not provided', async () => {
      await expect(
        LIST_LOGS_BY_RUN_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          runId: undefined as any,
          transportId: 'test-transport',
          page: 1,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "runId" is required' }));
    });

    it('should throw error when transportId is not provided', async () => {
      await expect(
        LIST_LOGS_BY_RUN_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          runId: 'test-run',
          page: 1,
          transportId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "transportId" is required' }));
    });

    it('should get logs by run ID successfully', async () => {
      const mockLogs: BaseLogMessage[] = [createLog({})];

      mockLogger.listLogsByRunId.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        page: 1,
        perPage: 100,
        hasMore: false,
      });
      const result = await LIST_LOGS_BY_RUN_ID_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        runId: 'test-run',
        transportId: 'test-transport',
        page: 0,
      });

      expect(result).toEqual({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      expect(mockLogger.listLogsByRunId).toHaveBeenCalledWith({
        runId: 'test-run',
        transportId: 'test-transport',
      });
    });
  });

  describe('listLogTransports', () => {
    it('should get log transports successfully', async () => {
      mockLogger.transports = new Map([
        ['console', {}],
        ['file', {}],
      ]) as unknown as Record<string, unknown>;

      const result = await LIST_LOG_TRANSPORTS_ROUTE.handler({ ...createTestServerContext({ mastra }) });

      expect(result).toEqual({
        transports: ['console', 'file'],
      });
    });

    it('should handle empty transports', async () => {
      mockLogger.transports = new Map<string, unknown>() as unknown as Record<string, unknown>;

      const result = await LIST_LOG_TRANSPORTS_ROUTE.handler({ ...createTestServerContext({ mastra }) });

      expect(result).toEqual({
        transports: [],
      });
    });
  });
});

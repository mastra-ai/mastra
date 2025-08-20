import { LogLevel } from '@mastra/core/logger';
import type { BaseLogMessage, IMastraLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { getLogsHandler, getLogsByRunIdHandler, getLogTransports } from './logs';

type MockedLogger = {
  getLogsByRunId: Mock<IMastraLogger['getLogsByRunId']>;
  getLogs: Mock<IMastraLogger['getLogs']>;
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
      getLogsByRunId: vi.fn(),
      getLogs: vi.fn(),
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

  describe('getLogsHandler', () => {
    it('should throw error when transportId is not provided', async () => {
      await expect(getLogsHandler({ mastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "transportId" is required' }),
      );
    });

    it('should get logs successfully', async () => {
      const mockLogs: BaseLogMessage[] = [createLog({})];

      mockLogger.getLogs.mockResolvedValue({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      const result = await getLogsHandler({
        mastra,
        transportId: 'test-transport',
      });

      expect(result).toEqual({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      expect(mockLogger.getLogs).toHaveBeenCalledWith('test-transport', {
        filters: undefined,
        fromDate: undefined,
        logLevel: undefined,
        toDate: undefined,
      });
    });

    it('should get logs successfully with params', async () => {
      const mockLogs: BaseLogMessage[] = [createLog({})];

      mockLogger.getLogs.mockResolvedValue({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      const result = await getLogsHandler({
        mastra,
        transportId: 'test-transport',
        params: {
          logLevel: LogLevel.INFO,
        },
      });

      expect(result).toEqual({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      expect(mockLogger.getLogs).toHaveBeenCalledWith('test-transport', {
        logLevel: LogLevel.INFO,
      });
    });
  });

  describe('getLogsByRunIdHandler', () => {
    it('should throw error when runId is not provided', async () => {
      await expect(
        getLogsByRunIdHandler({
          mastra,
          transportId: 'test-transport',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "runId" is required' }));
    });

    it('should throw error when transportId is not provided', async () => {
      await expect(
        getLogsByRunIdHandler({
          mastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "transportId" is required' }));
    });

    it('should get logs by run ID successfully', async () => {
      const mockLogs: BaseLogMessage[] = [createLog({})];

      mockLogger.getLogsByRunId.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        page: 1,
        perPage: 100,
        hasMore: false,
      });
      const result = await getLogsByRunIdHandler({
        mastra,
        runId: 'test-run',
        transportId: 'test-transport',
      });

      expect(result).toEqual({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });
      expect(mockLogger.getLogsByRunId).toHaveBeenCalledWith({
        runId: 'test-run',
        transportId: 'test-transport',
      });
    });
  });

  describe('getLogTransports', () => {
    it('should get log transports successfully', async () => {
      mockLogger.transports = new Map([
        ['console', {}],
        ['file', {}],
      ]) as unknown as Record<string, unknown>;

      const result = await getLogTransports({ mastra });

      expect(result).toEqual({
        transports: ['console', 'file'],
      });
    });

    it('should handle empty transports', async () => {
      mockLogger.transports = new Map<string, unknown>();

      const result = await getLogTransports({ mastra });

      expect(result).toEqual({
        transports: [],
      });
    });
  });
});

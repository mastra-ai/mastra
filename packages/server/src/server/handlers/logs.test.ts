import type { BaseLogMessage } from '@mastra/core/logger';
import { Logger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { getLogsHandler, getLogsByRunIdHandler, getLogTransports } from './logs';

vi.mock('@mastra/core/logger');

type MockedLogger = {
  getLogsByRunId: Mock<Logger['getLogsByRunId']>;
  getLogs: Mock<Logger['getLogs']>;
};

function createLog(args: Partial<BaseLogMessage>): BaseLogMessage {
  return {
    message: 'test log',
    level: 0,
    time: new Date(),
    ...args,
  };
}

describe('Logs Handlers', () => {
  let mockLogger: Omit<Logger, keyof MockedLogger> &
    MockedLogger & {
      transports: Record<string, unknown>;
    };
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = new Logger() as any;

    mastra = new Mastra({
      logger: mockLogger as unknown as Logger,
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

      mockLogger.getLogs.mockResolvedValue(mockLogs);
      const result = await getLogsHandler({
        mastra,
        transportId: 'test-transport',
      });

      expect(result).toEqual(mockLogs);
      expect(mockLogger.getLogs).toHaveBeenCalledWith('test-transport');
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
      const mockLogs = [createLog({})];

      mockLogger.getLogsByRunId.mockResolvedValue(mockLogs);
      const result = await getLogsByRunIdHandler({
        mastra,
        runId: 'test-run',
        transportId: 'test-transport',
      });

      expect(result).toEqual(mockLogs);
      expect(mockLogger.getLogsByRunId).toHaveBeenCalledWith({
        runId: 'test-run',
        transportId: 'test-transport',
      });
    });
  });

  describe('getLogTransports', () => {
    it('should get log transports successfully', async () => {
      mockLogger.transports = {
        console: {},
        file: {},
      } as any;

      const result = await getLogTransports({ mastra });

      expect(result).toEqual({
        transports: ['console', 'file'],
      });
    });

    it('should handle empty transports', async () => {
      mockLogger.transports = {};

      const result = await getLogTransports({ mastra });

      expect(result).toEqual({
        transports: [],
      });
    });
  });
});

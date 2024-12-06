import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { BaseLogMessage, createLogger, createMultiLogger, Logger, LogLevel, RegisteredLogger } from './';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockRedisInstance = {
  lpush: jest.fn<() => Promise<undefined>>().mockResolvedValue(undefined),
  lrange: jest.fn<() => Promise<string[]>>().mockResolvedValue(['log1', 'log2']),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedisInstance),
}));

describe('Logger Utilities', () => {
  const testDir = path.join(__dirname, 'test-logs');

  beforeEach(() => {
    jest.clearAllMocks();
    (mockRedisInstance.lpush as jest.Mock).mockClear();
    (mockRedisInstance.lrange as jest.Mock).mockClear();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createTestMessage = (message = 'Test message') => ({
    message,
    destinationPath: 'test',
    type: RegisteredLogger.AGENT,
  });

  describe('ConsoleLogger', () => {
    it('should log messages to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ type: 'CONSOLE', level: LogLevel.DEBUG });

      logger.info('Test info message');
      logger.error('Test error message');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy.mock.calls[0]![0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test info message/,
      );
      expect(consoleSpy.mock.calls[1]![0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Test error message/,
      );

      consoleSpy.mockRestore();
    });

    it('should not log messages below the configured level', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const logger = createLogger({ type: 'CONSOLE', level: LogLevel.WARN });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]![0]).toMatch(/\[WARN\] Warn message/);

      consoleSpy.mockRestore();
    });

    it('should handle structured log messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const logger = createLogger({ type: 'CONSOLE' });
      const logMessage = createTestMessage();

      logger.info(logMessage);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(logMessage)));

      consoleSpy.mockRestore();
    });
  });

  describe.skip('FileLogger', () => {
    it('should log messages to file', () => {
      const logger = createLogger({
        type: 'FILE',
        dirPath: testDir,
      });

      const logMessage = createTestMessage();

      logger.info(logMessage);
      logger.error(logMessage);

      const logContent = fs.readFileSync(path.join(testDir, 'test.json'), 'utf-8');
      const logs = JSON.parse(logContent);

      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Test message');
      expect(logs[1].message).toBe('Test message');
      expect(logs[0].level).toBe('INFO');
      expect(logs[1].level).toBe('ERROR');
    });

    it('should not log messages below the configured level', () => {
      const logger = createLogger({
        type: 'FILE',
        dirPath: testDir,
        level: LogLevel.WARN,
      });

      const logMessage = createTestMessage();

      logger.debug(logMessage);
      logger.info(logMessage);
      logger.warn(logMessage);
      logger.error(logMessage);

      const logContent = fs.readFileSync(path.join(testDir, 'test.json'), 'utf-8');
      const logs = JSON.parse(logContent);

      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('WARN');
      expect(logs[1].level).toBe('ERROR');
    });

    it('should create directory if it does not exist', () => {
      const nestedDir = path.join(testDir, 'nested', 'logs');
      const logger = createLogger({
        type: 'FILE',
        dirPath: nestedDir,
      });

      const logMessage = createTestMessage();
      logger.info(logMessage);

      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.existsSync(path.join(nestedDir, 'test.json'))).toBe(true);
    });

    it('should throw error for string messages', () => {
      const logger = createLogger({
        type: 'FILE',
        dirPath: testDir,
      });

      expect(() => logger.info('string message')).toThrow('FileLogger requires a BaseLogMessage object');
    });
  });

  describe.skip('UpstashRedisLogger', () => {
    it('should log messages to Redis', async () => {
      const logger = createLogger({
        type: 'UPSTASH',
        url: 'https://test-url',
        token: 'test-token',
        key: 'test-logs',
      });

      const logMessage = createTestMessage();

      await logger.info(logMessage);
      await logger.error(logMessage);

      const lpushMock = mockRedisInstance.lpush as jest.Mock;
      expect(lpushMock).toHaveBeenCalledTimes(2);
      expect(lpushMock.mock.calls[0]![0]).toBe('test-logs');

      const firstLog = JSON.parse(lpushMock.mock.calls[0]![1] as string);
      expect(firstLog).toMatchObject({
        message: 'Test message',
        level: 'INFO',
      });
    });

    it('should not log messages below the configured level', async () => {
      const logger = createLogger({
        type: 'UPSTASH',
        url: 'https://test-url',
        token: 'test-token',
        key: 'test-logs',
        level: LogLevel.WARN,
      });

      const logMessage = createTestMessage();

      await logger.debug(logMessage);
      await logger.info(logMessage);
      await logger.warn(logMessage);
      await logger.error(logMessage);

      const lpushMock = mockRedisInstance.lpush as jest.Mock;
      expect(lpushMock).toHaveBeenCalledTimes(2);

      const calls = lpushMock.mock.calls.map(call => JSON.parse(call[1] as string));
      expect(calls[0].level).toBe('WARN');
      expect(calls[1].level).toBe('ERROR');
    });

    it('should throw error for string messages', async () => {
      const logger = createLogger({
        type: 'UPSTASH',
        url: 'https://test-url',
        token: 'test-token',
      });

      await expect(logger.info('string message')).rejects.toThrow(
        'UpstashRedisLogger requires a BaseLogMessage object',
      );
    });

    it('should use default key if not provided', async () => {
      const logger = createLogger({
        type: 'UPSTASH',
        url: 'https://test-url',
        token: 'test-token',
      });

      const logMessage = createTestMessage();
      await logger.info(logMessage);

      const lpushMock = mockRedisInstance.lpush as jest.Mock;
      expect(lpushMock.mock.calls[0]![0]).toBe('logs');
    });
  });

  describe.skip('MultiLogger', () => {
    it('should log to multiple loggers', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const multiLogger = createMultiLogger([
        createLogger({ type: 'CONSOLE' }),
        createLogger({ type: 'FILE', dirPath: testDir }),
      ]);

      const logMessage = createTestMessage();
      await multiLogger.info(logMessage);

      // Check console logger
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]![0]).toMatch(/\[INFO\]/);

      // Check file logger
      const logContent = fs.readFileSync(path.join(testDir, 'test.json'), 'utf-8');
      const logs = JSON.parse(logContent);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].level).toBe('INFO');

      consoleSpy.mockRestore();
    });

    it('should respect individual logger levels', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const multiLogger = createMultiLogger([
        createLogger({ type: 'CONSOLE', level: LogLevel.ERROR }),
        createLogger({ type: 'FILE', dirPath: testDir, level: LogLevel.INFO }),
      ]);

      const logMessage = createTestMessage();
      await multiLogger.info(logMessage);
      await multiLogger.error(logMessage);

      // Console logger should only have ERROR message
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));

      // File logger should have both messages
      const logContent = fs.readFileSync(path.join(testDir, 'test.json'), 'utf-8');
      const logs = JSON.parse(logContent);
      expect(logs).toHaveLength(2);
      expect(logs.map((l: any) => l.level)).toEqual(['INFO', 'ERROR']);

      consoleSpy.mockRestore();
    });

    it('should handle cleanup of all loggers', async () => {
      const mockCleanup = jest.fn();
      const customLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        cleanup: mockCleanup,
      } as Logger<BaseLogMessage>;

      const multiLogger = createMultiLogger([createLogger({ type: 'CONSOLE' }), customLogger]);

      await (multiLogger as any).cleanup();
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('createLogger', () => {
    it('should throw error for invalid logger type', () => {
      expect(() => createLogger({ type: 'invalid' as any })).toThrow('Unsupported logger type');
    });

    it('should create logger with default level', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ type: 'CONSOLE' });

      logger.debug('Debug message');
      logger.info('Info message');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]![0]).toMatch(/\[INFO\]/);

      consoleSpy.mockRestore();
    });
  });
});

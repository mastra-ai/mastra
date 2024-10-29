import { createLogger, LogLevel, RegisteredLogger } from './logger';
import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

describe('Logger Utilities', () => {
  const testDir = path.join(__dirname, 'test-logs');
  const testFile = path.join(testDir, 'test.json');
  const redisKey = 'test-logs';
  let mockRedisClient: jest.Mocked<Redis>;

  beforeAll(() => {
    // Setup mock Redis client
    mockRedisClient = {
      lpush: jest.fn(),
      lrange: jest.fn(),
    } as unknown as jest.Mocked<Redis>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('ConsoleLogger', () => {
    it('should log messages to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = createLogger({
        provider: 'CONSOLE',
        options: { level: LogLevel.DEBUG },
      });

      logger.info('Test info message');
      logger.error('Test error message');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[${LogLevel.INFO}] Test info message`)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[${LogLevel.ERROR}] Test error message`)
      );

      consoleSpy.mockRestore();
    });

    it('should not log messages below the configured level', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = createLogger({
        provider: 'CONSOLE',
        options: { level: LogLevel.WARN },
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(LogLevel.WARN.toString())
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(LogLevel.ERROR.toString())
      );

      consoleSpy.mockRestore();
    });
  });

  describe('FileLogger', () => {
    it('should log messages to file', () => {
      const logger = createLogger({
        provider: 'FILE',
        options: { dirPath: testDir },
      });

      logger.info({
        message: 'Test info message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.error({
        message: 'Test error message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });

      const logContent = fs.readFileSync(testFile, 'utf-8');
      const logs = JSON.parse(logContent);

      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Test info message');
      expect(logs[1].message).toBe('Test error message');
    });

    it('should not log messages below the configured level', () => {
      const logger = createLogger({
        provider: 'FILE',
        options: { dirPath: testDir, level: LogLevel.WARN },
      });

      logger.debug({
        message: 'Debug message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.info({
        message: 'Info message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.warn({
        message: 'Warn message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.error({
        message: 'Error message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });

      const logContent = fs.readFileSync(testFile, 'utf-8');
      const logs = JSON.parse(logContent);

      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Warn message');
      expect(logs[1].message).toBe('Error message');
    });
  });

  describe('UpstashRedisLogger', () => {
    it('should log messages to Redis', async () => {
      const logger = createLogger({
        provider: 'UPSTASH',
        options: { redisClient: mockRedisClient, key: redisKey },
      });

      logger.info({
        message: 'Test info message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.error({
        message: 'Test error message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });

      expect(mockRedisClient.lpush).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        `${redisKey}`,
        expect.stringContaining('Test info message')
      );
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        `${redisKey}`,
        expect.stringContaining('Test error message')
      );
    });

    it('should retrieve logs from Redis', async () => {
      const logger = createLogger({
        provider: 'UPSTASH',
        options: { redisClient: mockRedisClient, key: redisKey },
      });

      mockRedisClient.lrange.mockResolvedValue(['log1', 'log2']);

      const logs = await logger.getLogs(`${redisKey}`);

      expect(mockRedisClient.lrange).toHaveBeenCalledWith(`${redisKey}`, 0, -1);
      expect(logs).toEqual(['log1', 'log2']);
    });

    it('should not log messages below the configured level', async () => {
      const logger = createLogger({
        provider: 'UPSTASH',
        options: {
          redisClient: mockRedisClient,
          key: redisKey,
          level: LogLevel.WARN,
        },
      });

      logger.debug({
        message: 'Debug message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.info({
        message: 'Info message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.warn({
        message: 'Warn message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });
      logger.error({
        message: 'Error message',
        destinationPath: 'test',
        type: RegisteredLogger.AGENT,
      });

      expect(mockRedisClient.lpush).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.lpush).not.toHaveBeenCalledWith(
        `${redisKey}`,
        expect.stringContaining('Debug message')
      );
      expect(mockRedisClient.lpush).not.toHaveBeenCalledWith(
        `${redisKey}`,
        expect.stringContaining('Info message')
      );
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        `${redisKey}`,
        expect.stringContaining('Warn message')
      );
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        `${redisKey}`,
        expect.stringContaining('Error message')
      );
    });
  });

  describe('createLogger', () => {
    it('should throw an error for unsupported logger type', () => {
      expect(() => createLogger({ provider: 'INVALID' as any })).toThrow(
        'Unsupported logger type: INVALID'
      );
    });

    it('should create loggers with custom log levels', () => {
      const consoleLogger = createLogger({
        provider: 'CONSOLE',
        options: { level: LogLevel.DEBUG },
      });
      const fileLogger = createLogger({
        provider: 'FILE',
        options: { dirPath: testDir, level: LogLevel.WARN },
      });
      const redisLogger = createLogger({
        provider: 'UPSTASH',
        options: {
          redisClient: mockRedisClient,
          key: redisKey,
          level: LogLevel.ERROR,
        },
      });

      expect(consoleLogger).toBeDefined();
      expect(fileLogger).toBeDefined();
      expect(redisLogger).toBeDefined();
    });
  });
});

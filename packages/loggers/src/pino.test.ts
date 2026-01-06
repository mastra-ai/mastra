import { LogLevel, LoggerTransport, MultiLogger } from '@mastra/core/logger';
import { describe, it, expect, beforeEach } from 'vitest';

import { PinoLogger } from './pino';

// Helper to create a memory stream that captures log output
class MemoryStream extends LoggerTransport {
  chunks: any[] = [];

  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: any, _encoding: string, callback: (error: Error | null, chunk: any) => void) {
    try {
      // Handle both string and object chunks
      const logEntry = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
      this.chunks.push(logEntry);
    } catch (error) {
      console.error('Error parsing log entry:', error);
    }
    callback(null, chunk);
  }

  async listLogs() {
    return this.chunks;
  }

  clear() {
    this.chunks = [];
  }
}

describe('Logger', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  describe('Logging Methods', () => {
    let logger: PinoLogger;

    beforeEach(() => {
      logger = new PinoLogger({
        transports: {
          memory: memoryStream,
        },
      });
    });

    it('should log info messages correctly', async () => {
      logger.info('test info message');

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = await memoryStream.listLogs();

      expect(logs[0]).toMatchObject({
        level: 30, // pino uses numeric levels: info = 30
        msg: 'test info message',
      });
    });
  });
});

describe('MultiLogger', () => {
  let memoryStream1: MemoryStream;
  let memoryStream2: MemoryStream;
  let logger1: PinoLogger;
  let logger2: PinoLogger;

  beforeEach(() => {
    memoryStream1 = new MemoryStream();
    memoryStream2 = new MemoryStream();
    logger1 = new PinoLogger({ transports: { memory: memoryStream1 } });
    logger2 = new PinoLogger({ transports: { memory: memoryStream2 } });
  });

  it('should forward log calls to all loggers', async () => {
    const multiLogger = new MultiLogger([logger1, logger2]);
    const testMessage = 'test message';

    multiLogger.info(testMessage);

    await new Promise(resolve => setTimeout(resolve, 100));

    const logs1 = await memoryStream1.listLogs();
    const logs2 = await memoryStream2.listLogs();

    expect(logs1[0]).toMatchObject({ msg: testMessage });
    expect(logs2[0]).toMatchObject({ msg: testMessage });
  });
});

describe('createLogger', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should create a logger instance', () => {
    const logger = new PinoLogger({
      transports: {
        memory: memoryStream,
      },
    });
    expect(logger).toBeInstanceOf(PinoLogger);
  });

  it('should create a logger with custom options and capture output', async () => {
    const customStream = new MemoryStream();

    const logger = new PinoLogger({
      name: 'custom',
      level: LogLevel.DEBUG,
      transports: {
        custom: customStream,
      },
    });

    logger.debug('test message');

    // Increase wait time to ensure logs are processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    const logs = await customStream.listLogs();

    expect(logs[0]).toMatchObject({
      level: 20, // pino uses numeric levels: debug = 20
      msg: 'test message',
      name: 'custom',
    });
  });
});

describe('PinoLogger redact option', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should redact sensitive data from logs using paths array', async () => {
    const logger = new PinoLogger({
      name: 'SecureApp',
      level: LogLevel.INFO,
      transports: {
        memory: memoryStream,
      },
      redact: ['password', 'token', 'apiKey'],
    });

    logger.info('User login', {
      username: 'john',
      password: 'secret123',
      token: 'abc-xyz-123',
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      msg: 'User login',
      username: 'john',
      password: '[Redacted]',
      token: '[Redacted]',
    });
  });

  it('should redact sensitive data with custom censor value', async () => {
    const logger = new PinoLogger({
      name: 'SecureApp',
      level: LogLevel.INFO,
      transports: {
        memory: memoryStream,
      },
      redact: {
        paths: ['password', 'apiKey'],
        censor: '[REDACTED]',
      },
    });

    logger.info('API call', {
      endpoint: '/api/data',
      apiKey: 'sk-12345',
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      msg: 'API call',
      endpoint: '/api/data',
      apiKey: '[REDACTED]',
    });
  });

  it('should redact nested paths with wildcards', async () => {
    const logger = new PinoLogger({
      name: 'SecureApp',
      level: LogLevel.INFO,
      transports: {
        memory: memoryStream,
      },
      redact: ['*.password', 'user.email'],
    });

    logger.info('User data', {
      user: {
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
      },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const logs = await memoryStream.listLogs();

    expect(logs[0].user).toMatchObject({
      name: 'John',
      email: '[Redacted]',
      password: '[Redacted]',
    });
  });
});

describe('PinoLogger.child()', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should create a child logger with bound context', async () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      level: LogLevel.DEBUG,
      transports: {
        memory: memoryStream,
      },
    });

    // Create module-scoped logger
    const serviceLogger = baseLogger.child({ module: 'UserService' });
    serviceLogger.info('User created', { userId: '123' });

    // Wait for async logging
    await new Promise(resolve => setTimeout(resolve, 100));

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      level: 30, // pino uses numeric levels: info = 30
      msg: 'User created',
      module: 'UserService',
      userId: '123',
    });
  });

  it('should return a PinoLogger instance', () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      transports: {
        memory: memoryStream,
      },
    });

    const childLogger = baseLogger.child({ module: 'TestModule' });

    expect(childLogger).toBeInstanceOf(PinoLogger);
  });

  it('should allow nested child loggers', async () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      level: LogLevel.DEBUG,
      transports: {
        memory: memoryStream,
      },
    });

    // Create module-scoped logger
    const moduleLogger = baseLogger.child({ module: 'UserService' });
    // Create request-scoped logger from module logger
    const requestLogger = moduleLogger.child({ requestId: 'req-456' });

    requestLogger.info('Processing request', { action: 'create' });

    // Wait for async logging
    await new Promise(resolve => setTimeout(resolve, 100));

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      level: 30, // pino uses numeric levels: info = 30
      msg: 'Processing request',
      module: 'UserService',
      requestId: 'req-456',
      action: 'create',
    });
  });

  it('should support all log levels in child logger', async () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      level: LogLevel.DEBUG,
      transports: {
        memory: memoryStream,
      },
    });

    const childLogger = baseLogger.child({ component: 'TestComponent' });

    childLogger.debug('Debug message');
    childLogger.info('Info message');
    childLogger.warn('Warn message');
    childLogger.error('Error message');

    // Wait for async logging
    await new Promise(resolve => setTimeout(resolve, 100));

    const logs = await memoryStream.listLogs();

    expect(logs).toHaveLength(4);
    // pino uses numeric levels: debug=20, info=30, warn=40, error=50
    expect(logs[0]).toMatchObject({ level: 20, component: 'TestComponent' });
    expect(logs[1]).toMatchObject({ level: 30, component: 'TestComponent' });
    expect(logs[2]).toMatchObject({ level: 40, component: 'TestComponent' });
    expect(logs[3]).toMatchObject({ level: 50, component: 'TestComponent' });
  });

  it('should inherit transports from parent logger', () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      transports: {
        memory: memoryStream,
      },
    });

    const childLogger = baseLogger.child({ module: 'TestModule' });

    // Child logger should have access to the same transports
    expect(childLogger.getTransports()).toEqual(baseLogger.getTransports());
  });
});

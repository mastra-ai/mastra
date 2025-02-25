import { Transform } from 'stream';
import { describe, it, expect, beforeEach } from 'vitest';

import { Logger, LogLevel, createLogger, combineLoggers, LoggerTransport } from './index.js';

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

  async getLogs() {
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
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({
        transports: {
          memory: memoryStream,
        },
      });
    });

    it('should log info messages correctly', async () => {
      logger.info('test info message');

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = await memoryStream.getLogs();

      expect(logs[0]).toMatchObject({
        level: 30, // info level
        msg: 'test info message',
      });
    });
  });

  describe('Stream Creation', () => {
    it('should create a transform stream', () => {
      const logger = new Logger();
      const stream = logger.createStream();
      expect(stream).toBeInstanceOf(Transform);
    });

    it('should process chunks correctly in stream', async () => {
      const logger = new Logger({
        transports: { memory: memoryStream },
      });
      const stream = logger.createStream();

      const testData = 'test data';

      stream.write(testData);

      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = await memoryStream.getLogs();

      expect(logs[0]).toMatchObject({
        msg: testData,
        level: 30, // info level
      });
    });
  });
});

describe('MultiLogger', () => {
  let memoryStream1: MemoryStream;
  let memoryStream2: MemoryStream;
  let logger1: Logger;
  let logger2: Logger;

  beforeEach(() => {
    memoryStream1 = new MemoryStream();
    memoryStream2 = new MemoryStream();
    logger1 = createLogger({ transports: { memory: memoryStream1 } });
    logger2 = createLogger({ transports: { memory: memoryStream2 } });
  });

  it('should forward log calls to all loggers', async () => {
    const multiLogger = combineLoggers([logger1, logger2]);
    const testMessage = 'test message';

    multiLogger.info(testMessage);

    await new Promise(resolve => setTimeout(resolve, 100));

    const logs1 = await memoryStream1.getLogs();
    const logs2 = await memoryStream2.getLogs();

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
    const logger = createLogger({
      transports: {
        memory: memoryStream,
      },
    });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should create a logger with custom options and capture output', async () => {
    const customStream = new MemoryStream();

    const logger = createLogger({
      name: 'custom',
      level: LogLevel.DEBUG,
      transports: {
        custom: customStream,
      },
    });

    logger.debug('test message');

    // Increase wait time to ensure logs are processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    const logs = await customStream.getLogs();

    expect(logs[0]).toMatchObject({
      level: 20,
      msg: 'test message',
      name: 'custom',
    });
  });
});

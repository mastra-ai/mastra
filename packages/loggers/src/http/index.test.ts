import { LogLevel } from '@mastra/core/logger';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PinoLogger } from '../pino';
import { HttpTransport } from './index.js';

describe('HttpTransport', () => {
  const defaultOptions = {
    url: 'https://api.example.com/logs',
    method: 'POST' as const,
    headers: { Authorization: 'Bearer test-token' },
    batchSize: 10,
    flushInterval: 1000,
    timeout: 5000,
    retryOptions: {
      maxRetries: 2,
      retryDelay: 500,
      exponentialBackoff: true,
    },
    logFormat: 'json' as const,
  };

  let transport: HttpTransport;
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }),
    );
    global.fetch = fetchMock;

    vi.useFakeTimers();
    transport = new HttpTransport(defaultOptions);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with correct options', () => {
      expect(transport['url']).toBe(defaultOptions.url);
      expect(transport['method']).toBe(defaultOptions.method);
      expect(transport['batchSize']).toBe(defaultOptions.batchSize);
      expect(transport['logBuffer']).toEqual([]);
    });

    it('should throw error if URL is not provided', () => {
      expect(() => new HttpTransport({} as any)).toThrow('HTTP URL is required');
    });

    it('should use default values for optional parameters', () => {
      const minimalTransport = new HttpTransport({ url: 'https://example.com' });
      expect(minimalTransport['method']).toBe('POST');
      expect(minimalTransport['batchSize']).toBe(100);
      expect(minimalTransport['flushInterval']).toBe(10000);
      expect(minimalTransport['timeout']).toBe(30000);
    });
  });

  describe('logging functionality', () => {
    it('should work with PinoLogger', async () => {
      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      const testMessage = 'test info message';
      logger.info(testMessage);

      // Trigger flush
      await transport._flush();

      expect(fetchMock).toHaveBeenCalledWith(
        defaultOptions.url,
        expect.objectContaining({
          method: defaultOptions.method,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: expect.stringContaining(testMessage),
        }),
      );
    });

    it('should handle multiple log messages in batches', async () => {
      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      const messages = ['message1', 'message2', 'message3'];
      messages.forEach(msg => logger.info(msg));

      // Trigger flush
      await transport._flush();

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.logs).toHaveLength(3);
      messages.forEach(msg => {
        expect(body.logs.some((log: any) => log.msg?.includes(msg))).toBe(true);
      });
    });

    it('should automatically flush when batch size is reached', async () => {
      const smallBatchTransport = new HttpTransport({
        ...defaultOptions,
        batchSize: 2,
      });

      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: smallBatchTransport,
        },
      });

      logger.info('message1');
      logger.info('message2'); // Should trigger flush

      await Promise.resolve(); // Allow async flush to complete

      expect(fetchMock).toHaveBeenCalled();
    });

    it('should automatically flush on interval', async () => {
      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      logger.info('test message');

      // Advance timer by flush interval
      vi.advanceTimersByTime(defaultOptions.flushInterval);
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('error handling and retries', () => {
    it('should retry on HTTP errors', async () => {
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          }),
        );

      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      logger.info('test message');

      // Use real timers for this test to handle retry delays
      vi.useRealTimers();
      await transport._flush();
      vi.useFakeTimers();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should retry on network errors', async () => {
      fetchMock
        .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          }),
        );

      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      logger.info('test message');

      // Use real timers for this test to handle retry delays
      vi.useRealTimers();
      await transport._flush();
      vi.useFakeTimers();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      logger.info('test message');

      // Use real timers for this test to handle retry delays
      vi.useRealTimers();
      await expect(transport._flush()).rejects.toThrow('HTTP 500: Internal Server Error');
      vi.useFakeTimers();

      expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(transport.getBufferedLogs().length).toBeGreaterThan(0); // Logs should be back in buffer
    });

    it('should handle timeout errors', async () => {
      // Use real timers for timeout test
      vi.useRealTimers();

      const timeoutTransport = new HttpTransport({
        ...defaultOptions,
        timeout: 50, // Very short timeout
        retryOptions: {
          maxRetries: 0, // No retries for this test
          retryDelay: 100,
          exponentialBackoff: false,
        },
      });

      // Mock fetch to simulate a hanging request that respects abort signal
      fetchMock.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          // If there's an abort signal, listen for it
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('The operation was aborted'));
            });
          }
          // Never resolve otherwise (simulating a hanging request)
        });
      });

      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: timeoutTransport,
        },
      });

      logger.info('test message');

      await expect(timeoutTransport._flush()).rejects.toThrow();

      vi.useFakeTimers();
    });
  });

  describe('cleanup and resource management', () => {
    it('should properly clean up resources on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const flushSpy = vi.spyOn(transport, '_flush').mockImplementation(() => Promise.resolve());

      transport._destroy(new Error('test'), () => {
        expect(clearIntervalSpy).toHaveBeenCalled();
        if (transport.getBufferedLogs().length > 0) {
          expect(flushSpy).toHaveBeenCalled();
        }
      });
    });

    it('should handle final flush errors gracefully', () => {
      vi.spyOn(transport, '_flush').mockImplementation(() => Promise.reject(new Error('Flush error')));

      const callback = vi.fn();
      transport._destroy(new Error('original error'), callback);

      // Should call callback even if flush fails
      setTimeout(() => {
        expect(callback).toHaveBeenCalled();
      }, 100);
    });
  });

  describe('utility methods', () => {
    it('should provide access to buffered logs', () => {
      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      logger.info('test message');

      const bufferedLogs = transport.getBufferedLogs();
      expect(bufferedLogs.length).toBe(1);
      expect(bufferedLogs[0]).toMatchObject(expect.objectContaining({ msg: 'test message' }));
    });

    it('should allow clearing the buffer', () => {
      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          http: transport,
        },
      });

      logger.info('test message');
      expect(transport.getBufferedLogs().length).toBe(1);

      transport.clearBuffer();
      expect(transport.getBufferedLogs().length).toBe(0);
    });

    it('should provide last flush time', () => {
      const beforeFlush = Date.now();
      transport._flush();
      const afterFlush = Date.now();

      const lastFlushTime = transport.getLastFlushTime();
      expect(lastFlushTime).toBeGreaterThanOrEqual(beforeFlush);
      expect(lastFlushTime).toBeLessThanOrEqual(afterFlush);
    });
  });

  describe('getLogs and getLogsByRunId', () => {
    it('should return empty results for getLogs with warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await transport.getLogs();

      expect(result).toEqual({
        logs: [],
        total: 0,
        page: 1,
        perPage: 100,
        hasMore: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'HttpTransport.getLogs: This transport is write-only. Override this method to implement log retrieval.',
      );

      consoleSpy.mockRestore();
    });

    it('should return empty results for getLogsByRunId with warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await transport.getLogsByRunId({ runId: 'test-run-id' });

      expect(result).toEqual({
        logs: [],
        total: 0,
        page: 1,
        perPage: 100,
        hasMore: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'HttpTransport.getLogsByRunId: This transport is write-only. Override this method to implement log retrieval.',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('_transform error handling', () => {
    it('should handle JSON parse errors', () => {
      const callback = vi.fn();

      transport._transform('invalid json', 'utf8', callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should add timestamp to logs without time property', () => {
      const callback = vi.fn();
      const testLog = { message: 'test', level: 'info' };

      transport._transform(JSON.stringify(testLog), 'utf8', callback);

      const bufferedLogs = transport.getBufferedLogs();
      expect(bufferedLogs[0]).toMatchObject({
        ...testLog,
        time: expect.any(Number),
      });
    });
  });
});

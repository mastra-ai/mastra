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
      expect(fetchMock).toHaveBeenCalledTimes(1);

      timeoutTransport.clearBuffer();
      timeoutTransport.destroy();
      vi.useFakeTimers();
    });

    it('should preserve explicit zero and false retry options', () => {
      const t = new HttpTransport({
        ...defaultOptions,
        retryOptions: { maxRetries: 0, retryDelay: 0, exponentialBackoff: false },
      });
      expect((t as any).retryOptions).toEqual({ maxRetries: 0, retryDelay: 0, exponentialBackoff: false });
    });

    it('should make a single request when maxRetries is 0', async () => {
      fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 500, statusText: 'Error' }));
      const t = new HttpTransport({
        ...defaultOptions,
        retryOptions: { maxRetries: 0, retryDelay: 0, exponentialBackoff: false },
      });
      await expect((t as any).makeHttpRequest({ logs: [] })).rejects.toThrow('HTTP 500');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should use a constant delay when exponentialBackoff is false', async () => {
      fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 500, statusText: 'Error' }));
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const t = new HttpTransport({
        ...defaultOptions,
        retryOptions: { maxRetries: 2, retryDelay: 10, exponentialBackoff: false },
      });
      const promise = (t as any).makeHttpRequest({ logs: [] });
      const assertion = expect(promise).rejects.toThrow('HTTP 500');
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const retryDelays = setTimeoutSpy.mock.calls.map(c => c[1]).filter(d => d === 10 || d === 20);
      expect(retryDelays).toEqual([10, 10]);
      setTimeoutSpy.mockRestore();
    });
  });

  describe('buffer limits', () => {
    const outageOptions = {
      url: 'https://api.example.com/logs',
      batchSize: 2,
      flushInterval: 60_000,
      retryOptions: { maxRetries: 0 },
    };

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetchMock.mockImplementation(() => Promise.reject(new Error('endpoint down')));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('defaults to a finite cap of 10,000 entries', () => {
      const capped = new HttpTransport({ url: 'https://api.example.com/logs', flushInterval: 60_000 });
      vi.spyOn(capped, '_flush').mockImplementation(() => Promise.resolve());

      for (let i = 0; i < 10_005; i++) {
        capped._transform({ msg: `m${i}` } as any, 'utf8', () => {});
      }

      expect(capped.getBufferedLogs()).toHaveLength(10_000);
      expect(capped.getDroppedLogCount()).toBe(5);
      capped.clearBuffer();
      capped.destroy();
    });

    it('drops the oldest entries when new writes exceed maxBufferSize during an outage', async () => {
      const capped = new HttpTransport({ ...outageOptions, maxBufferSize: 5 });

      for (let i = 0; i < 10; i++) {
        capped._transform({ msg: `m${i}` } as any, 'utf8', () => {});
        await vi.advanceTimersByTimeAsync(0);
      }

      const buffered = capped.getBufferedLogs();
      expect(buffered.length).toBeLessThanOrEqual(5);
      expect(buffered.at(-1)?.msg).toBe('m9');
      expect(buffered.map(log => log.msg)).not.toContain('m0');
      expect(capped.getDroppedLogCount()).toBe(10 - buffered.length);
      expect(console.warn).toHaveBeenCalledTimes(1);
      capped.clearBuffer();
      capped.destroy();
    });

    it('enforces the cap when a failed batch is restored to the buffer', async () => {
      const capped = new HttpTransport({ ...outageOptions, batchSize: 3, maxBufferSize: 5 });
      const flushSpy = vi.spyOn(capped, '_flush').mockImplementation(() => Promise.resolve());
      for (let i = 0; i < 5; i++) {
        capped._transform({ msg: `m${i}` } as any, 'utf8', () => {});
      }
      flushSpy.mockRestore();

      const flush = capped._flush();
      // A write lands while the failing request is in flight.
      capped._transform({ msg: 'm5' } as any, 'utf8', () => {});
      await expect(flush).rejects.toThrow('endpoint down');

      const buffered = capped.getBufferedLogs();
      expect(buffered).toHaveLength(5);
      expect(buffered.map(log => log.msg)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
      expect(capped.getDroppedLogCount()).toBe(1);
      capped.clearBuffer();
      capped.destroy();
    });

    it('never caps the buffer below batchSize', () => {
      const capped = new HttpTransport({ ...outageOptions, batchSize: 4, maxBufferSize: 1 });
      vi.spyOn(capped, '_flush').mockImplementation(() => Promise.resolve());

      for (let i = 0; i < 4; i++) {
        capped._transform({ msg: `m${i}` } as any, 'utf8', () => {});
      }

      expect(capped.getBufferedLogs()).toHaveLength(4);
      expect(capped.getDroppedLogCount()).toBe(0);
      capped.clearBuffer();
      capped.destroy();
    });

    it('keeps only one flush request in flight at a time', async () => {
      let resolveRequest!: (value: unknown) => void;
      fetchMock.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveRequest = resolve;
          }),
      );
      const guarded = new HttpTransport({ ...outageOptions });

      for (let i = 0; i < 6; i++) {
        guarded._transform({ msg: `m${i}` } as any, 'utf8', () => {});
      }
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // A successful request immediately sends the next full batch that queued up behind it.
      resolveRequest({ ok: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(guarded.getBufferedLogs()).toHaveLength(2);

      resolveRequest({ ok: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      resolveRequest({ ok: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(guarded.getBufferedLogs()).toHaveLength(0);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      guarded.destroy();
    });

    it('sends a partial batch after a successful request when a flush was requested meanwhile', async () => {
      let resolveRequest!: (value: unknown) => void;
      fetchMock.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveRequest = resolve;
          }),
      );
      const guarded = new HttpTransport({ ...outageOptions });
      guarded._transform({ msg: 'm0' } as any, 'utf8', () => {});
      guarded._transform({ msg: 'm1' } as any, 'utf8', () => {});
      guarded._transform({ msg: 'm2' } as any, 'utf8', () => {});
      void guarded._flush();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      resolveRequest({ ok: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[1]![1].body).logs.map((log: any) => log.msg)).toEqual(['m2']);

      resolveRequest({ ok: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(guarded.getBufferedLogs()).toHaveLength(0);
      guarded.destroy();
    });

    it('waits for the next interval instead of retrying straight away after a failed flush', async () => {
      const capped = new HttpTransport({ ...outageOptions });
      for (let i = 0; i < 4; i++) {
        capped._transform({ msg: `m${i}` } as any, 'utf8', () => {});
      }
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(capped.getBufferedLogs()).toHaveLength(4);
      capped.clearBuffer();
      capped.destroy();
    });

    it.each([Number.POSITIVE_INFINITY, 2.5, -1])('rejects batchSize %s', batchSize => {
      expect(() => new HttpTransport({ ...outageOptions, batchSize })).toThrow(
        'HttpTransport batchSize must be a positive integer',
      );
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, 2.5, 0, -1])('rejects maxBufferSize %s', maxBufferSize => {
      expect(() => new HttpTransport({ ...outageOptions, maxBufferSize })).toThrow(
        'HttpTransport maxBufferSize must be a positive integer',
      );
    });

    it('returns the in-flight flush even after it has taken the last buffered batch', async () => {
      const capped = new HttpTransport({ ...outageOptions });
      vi.spyOn(capped, '_flush').mockImplementation(() => Promise.resolve());
      capped._transform({ msg: 'm0' } as any, 'utf8', () => {});
      capped._transform({ msg: 'm1' } as any, 'utf8', () => {});
      vi.mocked(capped._flush).mockRestore();

      const first = capped._flush();
      expect(capped.getBufferedLogs()).toHaveLength(0);
      const second = capped._flush();

      expect(second).toBe(first);
      await expect(second).rejects.toThrow('endpoint down');
      capped.clearBuffer();
      capped.destroy();
    });

    it('sends logs queued behind an in-flight request on destroy', async () => {
      const resolvers: Array<(value: unknown) => void> = [];
      fetchMock.mockImplementation(() => new Promise(resolve => resolvers.push(resolve)));
      const guarded = new HttpTransport({ ...outageOptions });

      guarded._transform({ msg: 'm0' } as any, 'utf8', () => {});
      guarded._transform({ msg: 'm1' } as any, 'utf8', () => {});
      guarded._transform({ msg: 'm2' } as any, 'utf8', () => {});
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const callback = vi.fn();
      guarded._destroy(null as any, callback);
      resolvers[0]!({ ok: true });
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[1]![1].body).logs.map((log: any) => log.msg)).toEqual(['m2']);
      expect(callback).not.toHaveBeenCalled();

      resolvers[1]!({ ok: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(callback).toHaveBeenCalledWith(null);
      expect(guarded.getBufferedLogs()).toHaveLength(0);
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

  describe('listLogs and listLogsByRunId', () => {
    it('should return empty results for listLogs with warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await transport.listLogs();

      expect(result).toEqual({
        logs: [],
        total: 0,
        page: 1,
        perPage: 100,
        hasMore: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'HttpTransport.listLogs: This transport is write-only. Override this method to implement log retrieval.',
      );

      consoleSpy.mockRestore();
    });

    it('should return empty results for listLogsByRunId with warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await transport.listLogsByRunId({ runId: 'test-run-id' });

      expect(result).toEqual({
        logs: [],
        total: 0,
        page: 1,
        perPage: 100,
        hasMore: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'HttpTransport.listLogsByRunId: This transport is write-only. Override this method to implement log retrieval.',
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

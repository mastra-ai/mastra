import { createLogger, LogLevel } from '@mastra/core/logger';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { UpstashTransport } from './index.js';

describe('UpstashTransport', () => {
  const defaultOptions = {
    upstashUrl: 'https://test-url.upstash.io',
    upstashToken: 'test-token',
    listName: 'test-logs',
    maxListLength: 1000,
    batchSize: 10,
    flushInterval: 1000,
  };

  let transport: UpstashTransport;
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: 'success' }),
      }),
    );
    global.fetch = fetchMock;

    vi.useFakeTimers();
    transport = new UpstashTransport(defaultOptions);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with correct options', () => {
    expect(transport.upstashUrl).toBe(defaultOptions.upstashUrl);
    expect(transport.upstashToken).toBe(defaultOptions.upstashToken);
    expect(transport.listName).toBe(defaultOptions.listName);
    expect(transport.logBuffer).toEqual([]);
  });

  it('should work with createLogger', async () => {
    const logger = createLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        upstash: transport,
      },
    });

    const testMessage = 'test info message';
    logger.info(testMessage);

    // Trigger flush
    await transport._flush();

    expect(fetchMock).toHaveBeenCalledWith(
      defaultOptions.upstashUrl,
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: `Bearer ${defaultOptions.upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining(testMessage),
      }),
    );
  });

  it('should handle multiple log messages', async () => {
    const logger = createLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        upstash: transport,
      },
    });

    const messages = ['message1', 'message2', 'message3'];
    messages.forEach(msg => logger.info(msg));

    // Trigger flush
    await transport._flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    messages.forEach(msg => {
      expect(body.pipeline[0].some((cmd: string) => cmd.includes(msg))).toBe(true);
    });
  });

  it('should properly clean up resources on destroy', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const flushSpy = vi.spyOn(transport, '_flush').mockImplementation(() => Promise.resolve());

    transport._destroy(new Error('test'), () => {
      expect(clearIntervalSpy).toHaveBeenCalled();
      if (transport.logBuffer.length > 0) {
        expect(flushSpy).toHaveBeenCalled();
      }
    });
  });

  it('should handle errors in _transform', () => {
    const callback = vi.fn();

    transport._transform('invalid json', 'utf8', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should automatically flush on interval', async () => {
    const logger = createLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        upstash: transport,
      },
    });

    logger.info('test message');

    // Advance timer by flush interval
    vi.advanceTimersByTime(defaultOptions.flushInterval);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalled();
  });

  describe('error handling', () => {
    it('should handle Upstash API errors', async () => {
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: 'Test Error',
        }),
      );

      const logger = createLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          upstash: transport,
        },
      });

      logger.info('test message');

      await expect(transport._flush()).rejects.toThrow('Failed to execute Upstash command: Test Error');
      expect(transport.logBuffer.length).toBeGreaterThan(0);
    });

    it('should handle network errors', async () => {
      fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      const logger = createLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          upstash: transport,
        },
      });

      logger.info('test message');

      await expect(transport._flush()).rejects.toThrow('Network error');
      expect(transport.logBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('getLogs and getLogsByRunId', () => {
    it('should return empty array for getLogs', async () => {
      const logs = await transport.getLogs();
      expect(logs).toEqual([]);
    });

    it('should return empty array for getLogsByRunId', async () => {
      const logs = await transport.getLogsByRunId({ runId: 'test-run-id' });
      expect(logs).toEqual([]);
    });
  });
});

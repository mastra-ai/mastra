import { LogLevel } from '@mastra/core/logger';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PinoLogger } from '../pino';
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

  it('should work with PinoLogger', async () => {
    const logger = new PinoLogger({
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
      `${defaultOptions.upstashUrl}/pipeline`,
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
    const logger = new PinoLogger({
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
      expect(body[0].some((cmd: string) => cmd.includes(msg))).toBe(true);
    });
  });

  it('should send LPUSH and LTRIM as separate pipeline commands', async () => {
    transport.logBuffer.push({ msg: 'hello', time: 1 } as any);

    await transport._flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual([
      ['LPUSH', 'test-logs', JSON.stringify({ msg: 'hello', time: 1 })],
      ['LTRIM', 'test-logs', 0, 999],
    ]);
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

  it('should flush every remaining batch before destroy completes', async () => {
    const batchTransport = new UpstashTransport({
      ...defaultOptions,
      batchSize: 2,
    });
    batchTransport.logBuffer = Array.from({ length: 5 }, (_, index) => ({ msg: `message${index + 1}` }));

    await new Promise<void>((resolve, reject) => {
      batchTransport._destroy(null as any, (error?: Error | null) => {
        if (error) reject(error);
        else resolve();
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, request]: any[]) => JSON.parse(request.body)[0].length - 2)).toEqual([2, 2, 1]);
    expect(batchTransport.logBuffer).toEqual([]);
  });

  it('should handle errors in _transform', () => {
    const callback = vi.fn();

    transport._transform('invalid json', 'utf8', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should automatically flush on interval', async () => {
    const logger = new PinoLogger({
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

      const logger = new PinoLogger({
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

      const logger = new PinoLogger({
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

  describe('listLogs and listLogsByRunId', () => {
    it('should fetch only the requested page for unfiltered queries', async () => {
      const logs = Array.from({ length: 2 }, (_, index) =>
        JSON.stringify({ msg: `message${index + 3}`, time: index + 3 }),
      );
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ result: 5 }, { result: logs }]),
        }),
      );

      const result = await transport.listLogs({ page: 2, perPage: 2 });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([
        ['LLEN', 'test-logs'],
        ['LRANGE', 'test-logs', 2, 3],
      ]);
      expect(result).toMatchObject({ total: 5, page: 2, perPage: 2, hasMore: true });
      expect(result.logs.map(log => log.msg)).toEqual(['message3', 'message4']);
    });

    it('should scan run ID queries in bounded ranges', async () => {
      const firstChunk = Array.from({ length: 1000 }, (_, index) =>
        JSON.stringify({
          msg: index === 999 ? 'wanted1' : `other${index}`,
          runId: index === 999 ? 'test-run-id' : 'other-run-id',
          time: index,
        }),
      );
      fetchMock
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ result: firstChunk }]),
          }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ result: [JSON.stringify({ msg: 'wanted2', runId: 'test-run-id', time: 1000 })] }]),
          }),
        );

      const result = await transport.listLogsByRunId({ runId: 'test-run-id', page: 2, perPage: 1 });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'test-logs', 0, 999]]);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual([['LRANGE', 'test-logs', 1000, 1999]]);
      expect(result).toMatchObject({ total: 2, page: 2, perPage: 1, hasMore: false });
      expect(result.logs[0]?.msg).toBe('wanted2');
    });

    it('should return empty array for listLogs', async () => {
      const logs = await transport.listLogs();
      expect(logs).toEqual({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false });
    });

    it('should return empty array for listLogsByRunId', async () => {
      const logs = await transport.listLogsByRunId({ runId: 'test-run-id' });
      expect(logs).toEqual({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false });
    });
  });
});

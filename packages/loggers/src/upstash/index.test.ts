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
    describe('with a simulated Redis list', () => {
      let list: string[];
      const sentCommands = () =>
        fetchMock.mock.calls.flatMap((call: any[]) => JSON.parse(call[1].body) as (string | number)[][]);
      const lrangeWindows = () => sentCommands().filter(command => command[0] === 'LRANGE');

      beforeEach(() => {
        list = [];
        fetchMock.mockImplementation((_url: string, init: { body: string }) => {
          const commands = JSON.parse(init.body) as [string, string, number?, number?][];
          const results = commands.map(([name, , start, stop]) => {
            if (name === 'LLEN') return { result: list.length };
            const from = start!;
            const to = stop! < 0 ? list.length + stop! : stop!;
            return { result: list.slice(from, to + 1) };
          });
          return Promise.resolve({ ok: true, json: () => Promise.resolve(results) });
        });
      });

      it('should never request the full list', async () => {
        list = Array.from({ length: 3 }, (_, i) => JSON.stringify({ msg: `m${i}`, level: LogLevel.INFO }));

        await transport.listLogs();
        await transport.listLogs({ logLevel: LogLevel.INFO });
        await transport.listLogs({ returnPaginationResults: false });
        await transport.listLogsByRunId({ runId: 'run' });

        expect(lrangeWindows()).toContainEqual(['LRANGE', 'test-logs', 0, 99]);
        for (const [, , start, stop] of lrangeWindows()) {
          expect(stop).toBeGreaterThanOrEqual(0);
          expect((stop as number) - (start as number) + 1).toBeLessThanOrEqual(1000);
        }
      });

      it('should page unfiltered queries with LLEN and an exact LRANGE', async () => {
        list = Array.from({ length: 5 }, (_, i) => JSON.stringify({ msg: `m${i}` }));

        const last = await transport.listLogs({ page: 3, perPage: 2 });

        expect(sentCommands()).toEqual([
          ['LLEN', 'test-logs'],
          ['LRANGE', 'test-logs', 4, 5],
        ]);
        expect(last).toEqual({ logs: [{ msg: 'm4' }], total: 5, page: 3, perPage: 2, hasMore: false });
      });

      it('should scan filtered queries in bounded windows and count every match', async () => {
        list = Array.from({ length: 2500 }, (_, i) =>
          JSON.stringify({ msg: `m${i}`, level: i % 3 === 0 ? LogLevel.ERROR : LogLevel.INFO }),
        );
        const errorMessages = list.map(raw => JSON.parse(raw)).filter(log => log.level === LogLevel.ERROR);

        const result = await transport.listLogs({ logLevel: LogLevel.ERROR, page: 400, perPage: 2 });

        expect(lrangeWindows()).toEqual([
          ['LRANGE', 'test-logs', 0, 999],
          ['LRANGE', 'test-logs', 1000, 1999],
          ['LRANGE', 'test-logs', 2000, 2999],
        ]);
        expect(result.total).toBe(errorMessages.length);
        expect(result.logs).toEqual(errorMessages.slice(798, 800));
        expect(result.hasMore).toBe(true);
      });

      it('should request the next window only after a full chunk', async () => {
        list = Array.from({ length: 1000 }, (_, i) => JSON.stringify({ msg: `m${i}`, level: LogLevel.INFO }));

        const result = await transport.listLogs({ logLevel: LogLevel.INFO, page: 1, perPage: 1 });

        expect(lrangeWindows()).toEqual([
          ['LRANGE', 'test-logs', 0, 999],
          ['LRANGE', 'test-logs', 1000, 1999],
        ]);
        expect(result).toMatchObject({ total: 1000, hasMore: true });
      });

      it('should page run ID queries from bounded windows', async () => {
        list = [
          JSON.stringify({ msg: 'other', runId: 'other-run-id' }),
          JSON.stringify({ msg: 'wanted1', runId: 'test-run-id' }),
          JSON.stringify({ msg: 'wanted2', runId: 'test-run-id' }),
          JSON.stringify({ msg: 'wanted3', runId: 'test-run-id' }),
        ];

        const result = await transport.listLogsByRunId({ runId: 'test-run-id', page: 2, perPage: 2 });

        expect(lrangeWindows()).toEqual([['LRANGE', 'test-logs', 0, 999]]);
        expect(result).toEqual({
          logs: [{ msg: 'wanted3', runId: 'test-run-id' }],
          total: 3,
          page: 2,
          perPage: 2,
          hasMore: false,
        });
      });

      it('should return every match when pagination results are disabled', async () => {
        list = Array.from({ length: 1500 }, (_, i) => JSON.stringify({ msg: `m${i}` }));

        const result = await transport.listLogs({ returnPaginationResults: false, page: 2, perPage: 1 });

        expect(lrangeWindows()).toEqual([
          ['LRANGE', 'test-logs', 0, 999],
          ['LRANGE', 'test-logs', 1000, 1999],
        ]);
        expect(result).toMatchObject({ total: 1500, page: 2, perPage: 1500, hasMore: false });
        expect(result.logs).toHaveLength(1500);
      });

      it('should keep handling malformed and non-object entries as before', async () => {
        list = ['not-json', JSON.stringify(null), JSON.stringify({ msg: 'ok', level: LogLevel.INFO })];

        const result = await transport.listLogs({ returnPaginationResults: false });

        expect(result.logs).toEqual([{}, { msg: 'ok', level: LogLevel.INFO }]);
      });
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

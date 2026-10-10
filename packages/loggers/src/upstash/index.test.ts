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

  describe('outage buffering', () => {
    const write = (target: UpstashTransport, count: number) => {
      for (let i = 1; i <= count; i++) {
        target._transform(JSON.stringify({ msg: `message${i}` }), 'utf8', () => {});
      }
    };

    const deferred = () => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should cap the buffer and drop the oldest records while Upstash is down', async () => {
      fetchMock.mockImplementation(() => Promise.reject(new Error('Upstash down')));
      const outageTransport = new UpstashTransport({ ...defaultOptions, batchSize: 2, maxBufferSize: 10 });

      write(outageTransport, 100);
      await expect(outageTransport._flush()).rejects.toThrow('Upstash down');

      expect(outageTransport.logBuffer).toHaveLength(10);
      expect(outageTransport.droppedRecords).toBe(90);
      expect(outageTransport.logBuffer.map(log => log.msg)).toEqual(
        Array.from({ length: 10 }, (_, index) => `message${index + 91}`),
      );
    });

    it('should default the buffer limit to maxListLength', () => {
      expect(transport.maxBufferSize).toBe(defaultOptions.maxListLength);
      expect(new UpstashTransport({ ...defaultOptions, maxBufferSize: 5 }).maxBufferSize).toBe(5);
    });

    it('should flush instead of dropping when maxBufferSize is smaller than batchSize', async () => {
      const smallBufferTransport = new UpstashTransport({ ...defaultOptions, batchSize: 100, maxBufferSize: 5 });

      // Six writes per round: the fifth must trigger a flush so the sixth does not evict the oldest record
      for (let round = 0; round < 4; round++) {
        for (let i = 1; i <= 6; i++) {
          smallBufferTransport._transform(JSON.stringify({ msg: `message${round * 6 + i}` }), 'utf8', () => {});
        }
        while (smallBufferTransport.logBuffer.length > 0) {
          await smallBufferTransport._flush();
        }
      }

      expect(smallBufferTransport.logBuffer).toHaveLength(0);

      expect(smallBufferTransport.droppedRecords).toBe(0);
      const sent = fetchMock.mock.calls.flatMap(([, request]: any[]) =>
        JSON.parse(request.body)[0]
          .slice(2)
          .map((log: string) => JSON.parse(log).msg),
      );
      expect(sent).toEqual(Array.from({ length: 24 }, (_, index) => `message${index + 1}`));
    });

    it('should use a positive buffer limit when maxListLength disables trimming', async () => {
      const untrimmedTransport = new UpstashTransport({ ...defaultOptions, maxListLength: -1, batchSize: 2 });

      expect(untrimmedTransport.maxBufferSize).toBe(10000);
      write(untrimmedTransport, 10);
      while (untrimmedTransport.logBuffer.length > 0) {
        await untrimmedTransport._flush();
      }

      expect(untrimmedTransport.droppedRecords).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it('should reject a maxBufferSize that is not a positive integer', () => {
      for (const maxBufferSize of [0, -1, 1.5]) {
        expect(() => new UpstashTransport({ ...defaultOptions, maxBufferSize })).toThrow(
          'maxBufferSize must be a positive integer',
        );
      }
    });

    it('should not drop records when flushes succeed', async () => {
      write(transport, 50);
      await transport._flush();
      await transport._flush();

      expect(transport.droppedRecords).toBe(0);
    });

    it('should keep only one flush request in flight', async () => {
      const pending = deferred();
      fetchMock.mockImplementationOnce(() => pending.promise);
      const batchTransport = new UpstashTransport({ ...defaultOptions, batchSize: 2 });

      write(batchTransport, 50);
      const inFlight = batchTransport._flush();
      vi.advanceTimersByTime(defaultOptions.flushInterval);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      pending.resolve({ ok: true, json: () => Promise.resolve({ result: 'success' }) });
      await inFlight;

      await Promise.all([batchTransport._flush(), batchTransport._flush()]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should resend failed records before newer ones', async () => {
      fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Upstash down')));
      const batchTransport = new UpstashTransport({ ...defaultOptions, batchSize: 2 });

      write(batchTransport, 3);
      await expect(batchTransport._flush()).rejects.toThrow('Upstash down');
      await batchTransport._flush();

      const [, request] = fetchMock.mock.calls[1];
      const [lpush] = JSON.parse(request.body);
      expect(lpush.slice(2).map((log: string) => JSON.parse(log).msg)).toEqual(['message1', 'message2']);
    });

    it('should wait for an in-flight flush and drain the rest on destroy', async () => {
      const pending = deferred();
      fetchMock.mockImplementationOnce(() => pending.promise);
      const batchTransport = new UpstashTransport({ ...defaultOptions, batchSize: 2 });

      write(batchTransport, 5);
      const destroyed = new Promise<void>((resolve, reject) => {
        batchTransport._destroy(null as any, (error?: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
      pending.resolve({ ok: true, json: () => Promise.resolve({ result: 'success' }) });
      await destroyed;

      expect(fetchMock.mock.calls.map(([, request]: any[]) => JSON.parse(request.body)[0].length - 2)).toEqual([
        2, 2, 1,
      ]);
      expect(batchTransport.logBuffer).toEqual([]);
    });

    it('should resend the batch from a failed in-flight flush on destroy', async () => {
      const pending = deferred();
      fetchMock.mockImplementationOnce(() => pending.promise);
      const batchTransport = new UpstashTransport({ ...defaultOptions, batchSize: 2 });

      write(batchTransport, 5);
      const destroyed = new Promise<void>((resolve, reject) => {
        batchTransport._destroy(null as any, (error?: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
      pending.reject(new Error('Upstash down'));
      await destroyed;

      const sent = fetchMock.mock.calls.map(([, request]: any[]) =>
        JSON.parse(request.body)[0]
          .slice(2)
          .map((log: string) => JSON.parse(log).msg),
      );
      expect(sent).toEqual([
        ['message1', 'message2'],
        ['message1', 'message2'],
        ['message3', 'message4'],
        ['message5'],
      ]);
      expect(batchTransport.logBuffer).toEqual([]);
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

    it('should read run ID queries from a single snapshot', async () => {
      const logs = [
        JSON.stringify({ msg: 'other', runId: 'other-run-id', time: 1 }),
        JSON.stringify({ msg: 'wanted1', runId: 'test-run-id', time: 2 }),
        JSON.stringify({ msg: 'wanted2', runId: 'test-run-id', time: 3 }),
      ];
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ result: logs }]),
        }),
      );

      const result = await transport.listLogsByRunId({ runId: 'test-run-id', page: 2, perPage: 1 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'test-logs', 0, -1]]);
      expect(result).toMatchObject({ total: 2, page: 2, perPage: 1, hasMore: false });
      expect(result.logs[0]?.msg).toBe('wanted2');
    });

    it('should read filtered queries from a single snapshot', async () => {
      const logs = [
        JSON.stringify({ msg: 'info', level: LogLevel.INFO, time: 1 }),
        JSON.stringify({ msg: 'error', level: LogLevel.ERROR, time: 2 }),
      ];
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ result: logs }]),
        }),
      );

      const result = await transport.listLogs({ logLevel: LogLevel.ERROR, page: 1, perPage: 1 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'test-logs', 0, -1]]);
      expect(result).toMatchObject({ total: 1, page: 1, perPage: 1, hasMore: false });
      expect(result.logs.map(log => log.msg)).toEqual(['error']);
    });

    it('should return every log when pagination results are disabled', async () => {
      const logs = [JSON.stringify({ msg: 'message1', time: 1 }), JSON.stringify({ msg: 'message2', time: 2 })];
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ result: logs }]),
        }),
      );

      const result = await transport.listLogs({ returnPaginationResults: false, page: 2, perPage: 1 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'test-logs', 0, -1]]);
      expect(result).toEqual({
        logs: [
          { msg: 'message1', time: 1 },
          { msg: 'message2', time: 2 },
        ],
        total: 2,
        page: 2,
        perPage: 2,
        hasMore: false,
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

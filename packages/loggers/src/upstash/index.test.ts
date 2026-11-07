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

  describe('timestamp handling', () => {
    const now = 1_700_000_000_000;

    const getPushedLog = () => {
      const commands = JSON.parse(fetchMock.mock.calls[0][1].body);
      return JSON.parse(commands[0][2]);
    };

    beforeEach(() => {
      vi.setSystemTime(now);
    });

    it('should preserve a zero timestamp from object input', async () => {
      transport.write({ msg: 'epoch record', time: 0 } as any);
      await transport._flush();

      expect(getPushedLog().time).toBe(0);
    });

    it('should preserve a zero timestamp from JSON string input', async () => {
      transport.write(JSON.stringify({ msg: 'epoch record', time: 0 }));
      await transport._flush();

      expect(getPushedLog().time).toBe(0);
    });

    it('should add the current time when time is null', async () => {
      transport.write(JSON.stringify({ msg: 'null time', time: null }));
      await transport._flush();

      expect(getPushedLog().time).toBe(now);
    });

    it('should add the current time when time is missing', async () => {
      transport.write(JSON.stringify({ msg: 'no time' }));
      await transport._flush();

      expect(getPushedLog().time).toBe(now);
    });

    it('should not mutate object input when adding a timestamp', async () => {
      const record = { msg: 'caller-owned' };
      transport.write(record as any);
      await transport._flush();

      expect(record).toEqual({ msg: 'caller-owned' });
      expect(getPushedLog()).toEqual({ msg: 'caller-owned', time: now });
    });

    it('should not mutate object input with a null timestamp', async () => {
      const record = { msg: 'null time', time: null };
      transport.write(record as any);
      await transport._flush();

      expect(record.time).toBeNull();
      expect(getPushedLog().time).toBe(now);
    });

    it('should send frozen records and pass the original chunk through', async () => {
      const record = Object.freeze({ msg: 'frozen' });
      const callback = vi.fn();
      transport._transform(record as any, 'utf8', callback);
      await transport._flush();

      expect(callback).toHaveBeenCalledWith(null, record);
      expect(getPushedLog()).toEqual({ msg: 'frozen', time: now });
    });
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

  describe('pipeline command errors', () => {
    const wrongType = 'WRONGTYPE Operation against a key holding the wrong kind of value';
    const pipelineResponse = (results: unknown[]) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(results) });

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should keep the batch when Redis rejects LPUSH', async () => {
      fetchMock.mockImplementationOnce(() => pipelineResponse([{ error: wrongType }, { error: wrongType }]));
      transport.logBuffer.push({ msg: 'hello', time: 1 } as any);
      const lastFlush = transport.lastFlush;
      vi.advanceTimersByTime(5);

      await expect(transport._flush()).rejects.toThrow(wrongType);

      expect(transport.logBuffer).toEqual([{ msg: 'hello', time: 1 }]);
      expect(transport.lastFlush).toBe(lastFlush);
    });

    it('should resend a rejected batch before newer records', async () => {
      fetchMock.mockImplementationOnce(() => pipelineResponse([{ error: wrongType }, { error: wrongType }]));
      const batchTransport = new UpstashTransport({ ...defaultOptions, batchSize: 2 });
      batchTransport.logBuffer.push({ msg: 'message1' } as any, { msg: 'message2' } as any, { msg: 'message3' } as any);

      await expect(batchTransport._flush()).rejects.toThrow(wrongType);
      await batchTransport._flush();

      const [lpush] = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(lpush.slice(2).map((log: string) => JSON.parse(log).msg)).toEqual(['message1', 'message2']);
    });

    it('should report a rejected LTRIM without resending the pushed batch', async () => {
      fetchMock.mockImplementationOnce(() => pipelineResponse([{ result: 1 }, { error: wrongType }]));
      transport.logBuffer.push({ msg: 'hello', time: 1 } as any);
      const lastFlush = transport.lastFlush;
      vi.advanceTimersByTime(5);

      await expect(transport._flush()).rejects.toThrow(`Failed to trim Upstash log list: ${wrongType}`);

      expect(transport.logBuffer).toEqual([]);
      expect(transport.lastFlush).toBeGreaterThan(lastFlush);
    });

    it('should keep the batch when LPUSH is rejected without an LTRIM command', async () => {
      fetchMock.mockImplementationOnce(() => pipelineResponse([{ error: wrongType }]));
      const untrimmedTransport = new UpstashTransport({ ...defaultOptions, maxListLength: -1 });
      untrimmedTransport.logBuffer.push({ msg: 'hello', time: 1 } as any);

      await expect(untrimmedTransport._flush()).rejects.toThrow(wrongType);

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toHaveLength(1);
      expect(untrimmedTransport.logBuffer).toEqual([{ msg: 'hello', time: 1 }]);
    });

    it('should pass a rejected final push to the destroy callback', async () => {
      fetchMock.mockImplementationOnce(() => pipelineResponse([{ error: wrongType }, { error: wrongType }]));
      transport.logBuffer.push({ msg: 'hello', time: 1 } as any);

      const error = await new Promise<Error | null | undefined>(resolve => {
        transport._destroy(null as any, (err?: Error | null) => resolve(err));
      });

      expect(error?.message).toContain(wrongType);
      expect(transport.logBuffer).toEqual([{ msg: 'hello', time: 1 }]);
    });

    it('should keep draining on destroy after a rejected LTRIM and report the trim error', async () => {
      const noPerm = "NOPERM this user has no permissions to run the 'ltrim' command";
      fetchMock.mockImplementationOnce(() => pipelineResponse([{ result: 2 }, { error: noPerm }]));
      const batchTransport = new UpstashTransport({ ...defaultOptions, batchSize: 2 });
      batchTransport.logBuffer.push(
        { msg: 'message1' } as any,
        { msg: 'message2' } as any,
        { msg: 'message3' } as any,
        { msg: 'message4' } as any,
      );

      const error = await new Promise<Error | null | undefined>(resolve => {
        batchTransport._destroy(null as any, (err?: Error | null) => resolve(err));
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const pushed = fetchMock.mock.calls.flatMap(([, init]) =>
        JSON.parse(init.body)[0]
          .slice(2)
          .map((log: string) => JSON.parse(log).msg),
      );
      expect(pushed).toEqual(['message1', 'message2', 'message3', 'message4']);
      expect(batchTransport.logBuffer).toEqual([]);
      expect(error?.message).toBe(`Failed to trim Upstash log list: ${noPerm}`);
    });

    it('should resolve when every pipeline command succeeds', async () => {
      fetchMock.mockImplementationOnce(() => pipelineResponse([{ result: 1 }, { result: 'OK' }]));
      transport.logBuffer.push({ msg: 'hello', time: 1 } as any);

      await expect(transport._flush()).resolves.toBeUndefined();
      expect(transport.logBuffer).toEqual([]);
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
    it('should normalize page 0 to page 1 when listLogs fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockImplementation(() => Promise.reject(new Error('Upstash down')));

      expect(await transport.listLogs({ page: 0 })).toEqual({
        logs: [],
        total: 0,
        page: 1,
        perPage: 100,
        hasMore: false,
      });

      consoleSpy.mockRestore();
    });

    it('should normalize page 0 to page 1 when listLogsByRunId fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(transport, 'listLogs').mockRejectedValueOnce(new Error('Upstash down'));

      expect(await transport.listLogsByRunId({ runId: 'run-1', page: 0 })).toEqual({
        logs: [],
        total: 0,
        page: 1,
        perPage: 100,
        hasMore: false,
      });

      consoleSpy.mockRestore();
    });

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

    it('should skip malformed entries in snapshot queries', async () => {
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ result: [JSON.stringify({ msg: 'valid', time: 1 }), 'invalid json'] }]),
        }),
      );

      const result = await transport.listLogs({ returnPaginationResults: false });

      expect(result.logs).toEqual([{ msg: 'valid', time: 1 }]);
      expect(result).toMatchObject({ total: 1, perPage: 1, hasMore: false });
    });

    it('should return no logs when every snapshot entry is malformed', async () => {
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ result: ['nope', '{bad'] }]),
        }),
      );

      const result = await transport.listLogs({ returnPaginationResults: false });

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should skip malformed entries in unfiltered pages without changing the request', async () => {
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ result: 5 }, { result: [JSON.stringify({ msg: 'm3', time: 3 }), 'bad'] }]),
        }),
      );

      const result = await transport.listLogs({ page: 2, perPage: 2 });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([
        ['LLEN', 'test-logs'],
        ['LRANGE', 'test-logs', 2, 3],
      ]);
      expect(result).toMatchObject({ total: 5, page: 2, perPage: 2, hasMore: true });
      expect(result.logs.map(log => log.msg)).toEqual(['m3']);
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
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'test-logs', 0, 999]]);
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
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'test-logs', 0, 999]]);
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
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'test-logs', 0, 999]]);
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

    it('should never issue a full-range LRANGE for filtered, unpaginated, or run ID reads', async () => {
      const bigTransport = new UpstashTransport({ ...defaultOptions, maxListLength: 50000 });
      const logs = Array.from({ length: 50000 }, (_, index) =>
        JSON.stringify({ msg: `m${index}`, level: LogLevel.INFO, runId: 'r', time: index }),
      );
      fetchMock.mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve([{ result: logs }]) }),
      );

      await bigTransport.listLogs({ logLevel: LogLevel.INFO });
      await bigTransport.listLogs({ returnPaginationResults: false });
      const byRun = await bigTransport.listLogsByRunId({ runId: 'r', perPage: 10 });

      const commands = fetchMock.mock.calls.map((call: any[]) => JSON.parse(call[1].body)).flat();
      const lranges = commands.filter((command: any[]) => command[0] === 'LRANGE');
      expect(lranges).toHaveLength(3);
      for (const command of lranges) {
        expect(command).toEqual(['LRANGE', 'test-logs', 0, 49999]);
      }
      expect(byRun.total).toBe(50000);
      clearInterval(bigTransport.flushIntervalId);
    });

    it('should bound snapshot reads by the default retention length', async () => {
      const defaultTransport = new UpstashTransport({ upstashUrl: 'https://x', upstashToken: 't' });
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve([{ result: [] }]) }),
      );

      await defaultTransport.listLogs({ returnPaginationResults: false });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([['LRANGE', 'application-logs', 0, 9999]]);
      clearInterval(defaultTransport.flushIntervalId);
    });

    it('should return the same filtered results as a full read for small lists', async () => {
      const logs = [
        JSON.stringify({ msg: 'a', level: LogLevel.ERROR, runId: 'x', time: 1 }),
        JSON.stringify({ msg: 'b', level: LogLevel.INFO, runId: 'x', time: 2 }),
        JSON.stringify({ msg: 'c', level: LogLevel.ERROR, runId: 'y', time: 3 }),
      ];
      fetchMock.mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve([{ result: logs }]) }),
      );

      const errors = await transport.listLogs({ logLevel: LogLevel.ERROR });
      const byRun = await transport.listLogsByRunId({ runId: 'x' });

      expect(errors).toEqual({
        logs: [
          { msg: 'a', level: LogLevel.ERROR, runId: 'x', time: 1 },
          { msg: 'c', level: LogLevel.ERROR, runId: 'y', time: 3 },
        ],
        total: 2,
        page: 1,
        perPage: 100,
        hasMore: false,
      });
      expect(byRun.logs.map(log => log.msg)).toEqual(['a', 'b']);
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

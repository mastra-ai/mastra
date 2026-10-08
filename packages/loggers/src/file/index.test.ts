import fs from 'node:fs';
import path from 'node:path';
import { LogLevel } from '@mastra/core/logger';
import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { PinoLogger } from '../pino.js';

import { FileTransport } from './index.js';

describe('FileTransport', () => {
  const testDir = __dirname + '/fixtures';
  const testFile = 'test.log';
  const testPath = path.join(testDir, testFile);
  let fileLogger: FileTransport;

  beforeEach(async () => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    fileLogger = new FileTransport({ path: testPath });
  });

  afterAll(async () => {
    // Cleanup test directory
    fs.writeFileSync(testPath, ``);
  });

  it('should reject a directory path', () => {
    expect(() => new FileTransport({ path: testDir })).toThrow(/must point to a file/);
  });

  it('should create a file stream when instantiated', () => {
    expect(fileLogger.fileStream).toBeDefined();
    expect(fileLogger.path).toBe(testPath);
  });

  it('should work with PinoLogger', async () => {
    const logger = new PinoLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        file: fileLogger,
      },
    });

    const testMessage = 'test info message';
    logger.info(testMessage);

    // Wait for file write to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const fileContent = fs.readFileSync(testPath, 'utf8');
    expect(fileContent).toContain(testMessage);
  });

  it('should handle multiple log messages', async () => {
    const logger = new PinoLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        file: fileLogger,
      },
    });

    const messages = ['message1', 'message2', 'message3'];
    messages.forEach(msg => logger.info(msg));

    // Wait for file writes to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const fileContent = fs.readFileSync(testPath, 'utf8');
    messages.forEach(msg => {
      expect(fileContent).toContain(msg);
    });
  });

  it('should properly clean up resources on destroy', async () => {
    const destroySpy = vi.spyOn(fileLogger.fileStream, 'destroy');
    expect.assertions(1);

    await new Promise<void>(resolve => {
      try {
        fileLogger._destroy(null, () => {
          expect(destroySpy).toHaveBeenCalled();
        });
      } catch {
        // nothing
      } finally {
        resolve();
      }
    });
  });

  it('should propagate synchronous write errors from _transform', async () => {
    const errorObj = new Error('Test error');
    vi.spyOn(fileLogger.fileStream, 'write').mockImplementationOnce(() => {
      throw errorObj;
    });

    const error = await new Promise(resolve => fileLogger._transform('test', 'utf8', err => resolve(err)));
    expect(error).toBe(errorObj);
  });

  it('should propagate asynchronous write errors from _transform', async () => {
    const errorObj = Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
    vi.spyOn(fileLogger.fileStream, 'write').mockImplementationOnce(((_chunk: any, cb: (err?: Error) => void) => {
      setImmediate(() => cb(errorObj));
      return true;
    }) as any);

    const callback = vi.fn();
    const done = new Promise<void>(resolve =>
      fileLogger._transform('test', 'utf8', (err, chunk) => {
        callback(err, chunk);
        resolve();
      }),
    );
    expect(callback).not.toHaveBeenCalled();
    await done;
    expect(callback).toHaveBeenCalledWith(errorObj, undefined);
  });

  it('should return the chunk after a successful write in _transform', async () => {
    const result = await new Promise<[Error | null, any]>(resolve =>
      fileLogger._transform('ok\n', 'utf8', (err, chunk) => resolve([err, chunk])),
    );
    expect(result).toEqual([null, 'ok\n']);
  });

  it('should surface real filesystem errors on the transport instead of crashing', async () => {
    const transport = new FileTransport({ path: testDir });
    const writeError = new Promise<Error | null | undefined>(resolve => transport.write('line\n', resolve));
    const transportError = new Promise<Error>(resolve => transport.once('error', resolve));

    expect((await writeError)?.message).toMatch(/EISDIR/);
    expect((await transportError).message).toMatch(/EISDIR/);
  });

  it('should flush remaining data when stream ends', () => {
    const endSpy = vi.spyOn(fileLogger.fileStream, 'end');

    fileLogger._flush(() => {
      expect(endSpy).toHaveBeenCalled();
    });
  });

  describe('listLogs and listLogsByRunId', () => {
    it('should return empty array for listLogs', async () => {
      const logs = await fileLogger.listLogs();
      expect(logs.total).toBeGreaterThan(0);
    });

    it('should return empty array for listLogsByRunId', async () => {
      const logger = new PinoLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          file: fileLogger,
        },
      });

      let logs = await fileLogger.listLogsByRunId({ runId: 'test-run-id' });
      expect(logs.total).toBe(0);

      logger.info('test info message', {
        runId: 'test-run-id',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      logs = await fileLogger.listLogsByRunId({ runId: 'test-run-id' });
      expect(logs.total).toBe(1);
    });

    it('should skip malformed lines and return valid logs', async () => {
      fs.writeFileSync(testPath, '{"msg":"before","time":1}\n{"msg":\n{"msg":"after","time":2}\n');

      const all = await fileLogger.listLogs({ returnPaginationResults: false });
      expect(all.total).toBe(2);
      expect(all.logs.map(log => log.msg)).toEqual(['before', 'after']);

      const paged = await fileLogger.listLogs({ page: 1, perPage: 1 });
      expect(paged.total).toBe(2);
      expect(paged.logs).toHaveLength(1);
      expect(paged.hasMore).toBe(true);
    });

    it('should stream the file and retain only the requested page', async () => {
      const lines = Array.from({ length: 250 }, (_, i) => JSON.stringify({ msg: `m${i + 1}`, time: i }));
      fs.writeFileSync(testPath, lines.join('\n') + '\n');
      const readFileSyncSpy = vi.spyOn(fs, 'readFileSync');

      const result = await fileLogger.listLogs({ page: 2, perPage: 10 });

      expect(result.logs.map(log => log.msg)).toEqual(Array.from({ length: 10 }, (_, i) => `m${i + 11}`));
      expect(result.total).toBe(250);
      expect(result.perPage).toBe(10);
      expect(result.hasMore).toBe(true);
      expect(readFileSyncSpy).not.toHaveBeenCalled();
      readFileSyncSpy.mockRestore();
    });

    it('should skip non-object records and apply filters while streaming', async () => {
      fs.writeFileSync(
        testPath,
        ['null', '42', '"str"', '{"msg":"a","level":"info"}', '{"msg":"b","level":"error"}', ''].join('\r\n'),
      );

      const result = await fileLogger.listLogs({ logLevel: LogLevel.ERROR });
      expect(result.logs.map(log => log.msg)).toEqual(['b']);
      expect(result.total).toBe(1);
    });

    it('should find runId matches beyond the first 100 records', async () => {
      const lines = Array.from({ length: 150 }, (_, i) => JSON.stringify({ msg: `m${i}`, runId: 'other' }));
      lines.push(
        JSON.stringify({ msg: 'target-1', runId: 'run-x' }),
        JSON.stringify({ msg: 'target-2', runId: 'run-x' }),
      );
      fs.writeFileSync(testPath, lines.join('\n') + '\n');

      const result = await fileLogger.listLogsByRunId({ runId: 'run-x', perPage: 1, page: 2 });
      expect(result.logs.map(log => log.msg)).toEqual(['target-2']);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });
  });
});

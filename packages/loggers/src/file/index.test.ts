import fs from 'fs';
import path from 'path';
import { createLogger, LogLevel } from '@mastra/core/logger';
import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';

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

  it('should create a file stream when instantiated', () => {
    expect(fileLogger.fileStream).toBeDefined();
    expect(fileLogger.path).toBe(testPath);
  });

  it('should work with createLogger', async () => {
    const logger = createLogger({
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
    const logger = createLogger({
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

  it('should properly clean up resources on destroy', () => {
    const destroySpy = vi.spyOn(fileLogger.fileStream, 'destroy');

    fileLogger._destroy(new Error('test'), () => {
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  it('should handle errors in _transform', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorObj = new Error('Test error');

    vi.spyOn(fileLogger.fileStream, 'write').mockImplementationOnce(() => {
      throw errorObj;
    });

    fileLogger._transform('test', 'utf8', error => {
      expect(consoleSpy).toHaveBeenCalledWith('Error parsing log entry:', errorObj);
      expect(error).toBeNull(); // Should not propagate error
    });
  });

  it('should flush remaining data when stream ends', () => {
    const endSpy = vi.spyOn(fileLogger.fileStream, 'end');

    fileLogger._flush(() => {
      expect(endSpy).toHaveBeenCalled();
    });
  });

  describe('getLogs and getLogsByRunId', () => {
    it('should return empty array for getLogs', async () => {
      const logs = await fileLogger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should return empty array for getLogsByRunId', async () => {
      const logger = createLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          file: fileLogger,
        },
      });

      let logs = await fileLogger.getLogsByRunId({ runId: 'test-run-id' });
      expect(logs.length).toBe(0);

      logger.info('test info message', {
        runId: 'test-run-id',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      logs = await fileLogger.getLogsByRunId({ runId: 'test-run-id' });
      expect(logs.length).toBe(1);
    });
  });
});

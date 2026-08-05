import { execFile } from 'node:child_process';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { isStreamDestroyedError } from '../error-classification.js';

type ErrorWithCode = Error & { code?: string; cause?: unknown; errors?: unknown[] };

describe('isStreamDestroyedError', () => {
  it('should detect a real ERR_STREAM_DESTROYED from a destroyed writable stream', async () => {
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    writable.destroy();

    const error = await new Promise<Error>(resolve => {
      writable.write('data', err => {
        resolve(err as Error);
      });
    });

    expect(error).toBeDefined();
    expect(isStreamDestroyedError(error)).toBe(true);
  });

  it('should detect ERR_STREAM_DESTROYED by error code', () => {
    const error: ErrorWithCode = new Error('write EPIPE');
    error.code = 'ERR_STREAM_DESTROYED';
    expect(isStreamDestroyedError(error)).toBe(true);
  });

  it('should detect ERR_STREAM_DESTROYED by message', () => {
    const error = new Error('Cannot call write after a stream was destroyed');
    expect(isStreamDestroyedError(error)).toBe(true);
  });

  it('should detect ERR_STREAM_DESTROYED in nested cause', () => {
    const inner: ErrorWithCode = new Error('stream was destroyed');
    inner.code = 'ERR_STREAM_DESTROYED';
    const outer: ErrorWithCode = new Error('write failed');
    outer.cause = inner;
    expect(isStreamDestroyedError(outer)).toBe(true);
  });

  it('should NOT match unrelated errors', () => {
    expect(isStreamDestroyedError(new Error('Something else went wrong'))).toBe(false);
  });

  it('should NOT match ECONNREFUSED errors', () => {
    const error: ErrorWithCode = new Error('connect ECONNREFUSED');
    error.code = 'ECONNREFUSED';
    expect(isStreamDestroyedError(error)).toBe(false);
  });

  it('should handle non-Error values', () => {
    expect(isStreamDestroyedError(null)).toBe(false);
    expect(isStreamDestroyedError(undefined)).toBe(false);
    expect(isStreamDestroyedError('some string')).toBe(false);
    expect(isStreamDestroyedError(42)).toBe(false);
  });

  it('should detect ERR_STREAM_DESTROYED in AggregateError.errors', () => {
    const streamError: ErrorWithCode = new Error('stream was destroyed');
    streamError.code = 'ERR_STREAM_DESTROYED';
    const otherError = new Error('unrelated error');
    const aggregate = new AggregateError([otherError, streamError], 'Multiple errors');
    expect(isStreamDestroyedError(aggregate)).toBe(true);
  });

  it('should return false for AggregateError without stream destroyed errors', () => {
    const aggregate = new AggregateError([new Error('error 1'), new Error('error 2')], 'Multiple errors');
    expect(isStreamDestroyedError(aggregate)).toBe(false);
  });

  it('should check .errors even when .cause exists and does not match', () => {
    const streamError: ErrorWithCode = new Error('stream was destroyed');
    streamError.code = 'ERR_STREAM_DESTROYED';
    const error: ErrorWithCode = new Error('wrapper');
    error.cause = new Error('unrelated cause');
    error.errors = [streamError];
    expect(isStreamDestroyedError(error)).toBe(true);
  });

  it('should handle deeply nested causes with depth limit', () => {
    let error: ErrorWithCode = new Error('stream was destroyed');
    error.code = 'ERR_STREAM_DESTROYED';
    for (let i = 0; i < 10; i++) {
      const wrapper: ErrorWithCode = new Error(`wrapper ${i}`);
      wrapper.cause = error;
      error = wrapper;
    }
    // Should stop searching after reasonable depth and return false
    expect(isStreamDestroyedError(error)).toBe(false);
  });
});

// Inline JS detector shared by both integration test suites.
// Must be kept in sync with isStreamDestroyedError in error-classification.ts.
const detectorScript = `
  function isStreamDestroyedError(err, depth) {
    depth = depth || 0;
    if (!err || depth > 5) return false;
    if (err.code === 'ERR_STREAM_DESTROYED') return true;
    if (typeof err.message === 'string' && err.message.includes('stream was destroyed')) return true;
    if (err.cause && isStreamDestroyedError(err.cause, depth + 1)) return true;
    if (Array.isArray(err.errors) && err.errors.some(function(inner) { return isStreamDestroyedError(inner, depth + 1); })) return true;
    return false;
  }
`;

function spawnScript(script: string): Promise<{ code: number | null; stderr: string }> {
  return new Promise(resolve => {
    execFile('node', ['-e', script], { timeout: 5000 }, (err, _stdout, stderr) => {
      const code =
        err && typeof (err as NodeJS.ErrnoException).code === 'number'
          ? (err as NodeJS.ErrnoException).code
          : err
            ? 1
            : 0;
      resolve({ code: code as number | null, stderr });
    });
  });
}

describe('uncaughtException handler integration', () => {
  function buildScript(useFilter: boolean): string {
    return `
      const { Writable } = require('node:stream');
      ${detectorScript}

      process.on('uncaughtException', (error) => {
        ${useFilter ? 'if (isStreamDestroyedError(error)) return;' : ''}
        process.exit(1);
      });

      // Trigger a real uncaught ERR_STREAM_DESTROYED:
      // Emitting 'error' on a destroyed stream with no error listener causes
      // the error to bubble up as an uncaughtException — this is the same
      // mechanism that crashes mastracode in issues #13548 and #13549.
      const w = new Writable({ write(c, e, cb) { cb(); } });
      w.destroy();
      const err = new Error('Cannot call write after a stream was destroyed');
      err.code = 'ERR_STREAM_DESTROYED';
      w.emit('error', err);

      // If we survive the uncaught exception, exit cleanly
      setTimeout(() => process.exit(0), 50);
    `;
  }

  it('should crash without the ERR_STREAM_DESTROYED filter (reproduces the bug)', async () => {
    const result = await spawnScript(buildScript(false));
    expect(result.code).not.toBe(0);
  });

  it('should survive with the ERR_STREAM_DESTROYED filter (the fix)', async () => {
    const result = await spawnScript(buildScript(true));
    expect(result.code).toBe(0);
  });
});

describe('unhandledRejection handler integration', () => {
  function buildScript(useFilter: boolean): string {
    return `
      ${detectorScript}

      process.on('unhandledRejection', (reason) => {
        ${useFilter ? 'if (isStreamDestroyedError(reason)) return;' : ''}
        process.exit(1);
      });

      const err = new Error('Cannot call write after a stream was destroyed');
      err.code = 'ERR_STREAM_DESTROYED';
      Promise.reject(err);

      setTimeout(() => process.exit(0), 50);
    `;
  }

  it('should crash without the ERR_STREAM_DESTROYED filter', async () => {
    const result = await spawnScript(buildScript(false));
    expect(result.code).not.toBe(0);
  });

  it('should survive with the ERR_STREAM_DESTROYED filter', async () => {
    const result = await spawnScript(buildScript(true));
    expect(result.code).toBe(0);
  });
});

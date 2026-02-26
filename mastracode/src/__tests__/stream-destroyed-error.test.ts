import { execFile } from 'node:child_process';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { isStreamDestroyedError } from '../error-classification.js';

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
    const error = new Error('write EPIPE');
    (error as any).code = 'ERR_STREAM_DESTROYED';
    expect(isStreamDestroyedError(error)).toBe(true);
  });

  it('should detect ERR_STREAM_DESTROYED by message', () => {
    const error = new Error('Cannot call write after a stream was destroyed');
    expect(isStreamDestroyedError(error)).toBe(true);
  });

  it('should detect ERR_STREAM_DESTROYED in nested cause', () => {
    const inner = new Error('stream was destroyed');
    (inner as any).code = 'ERR_STREAM_DESTROYED';
    const outer = new Error('write failed');
    (outer as any).cause = inner;
    expect(isStreamDestroyedError(outer)).toBe(true);
  });

  it('should NOT match unrelated errors', () => {
    expect(isStreamDestroyedError(new Error('Something else went wrong'))).toBe(false);
  });

  it('should NOT match ECONNREFUSED errors', () => {
    const error = new Error('connect ECONNREFUSED');
    (error as any).code = 'ECONNREFUSED';
    expect(isStreamDestroyedError(error)).toBe(false);
  });

  it('should handle non-Error values', () => {
    expect(isStreamDestroyedError(null)).toBe(false);
    expect(isStreamDestroyedError(undefined)).toBe(false);
    expect(isStreamDestroyedError('some string')).toBe(false);
    expect(isStreamDestroyedError(42)).toBe(false);
  });

  it('should handle deeply nested causes with depth limit', () => {
    // Build a chain deeper than the depth limit
    let error: any = new Error('stream was destroyed');
    error.code = 'ERR_STREAM_DESTROYED';
    for (let i = 0; i < 10; i++) {
      const wrapper = new Error(`wrapper ${i}`);
      (wrapper as any).cause = error;
      error = wrapper;
    }
    // Should stop searching after reasonable depth and return false
    expect(isStreamDestroyedError(error)).toBe(false);
  });
});

describe('uncaughtException handler integration', () => {
  function spawnWithHandler(useFilter: boolean): Promise<{ code: number | null; stderr: string }> {
    return new Promise(resolve => {
      // Spawn a Node process that reproduces the exact main.ts pattern:
      // - Sets up uncaughtException handler (with or without the filter)
      // - Triggers an uncaught ERR_STREAM_DESTROYED via a destroyed stream's error event
      // - If the handler filters correctly, the process exits 0
      // - If not, it calls process.exit(1) like handleFatalError does
      const script = `
        const { Writable } = require('node:stream');

        function isStreamDestroyedError(err, depth = 0) {
          if (!err || depth > 5) return false;
          if (err.code === 'ERR_STREAM_DESTROYED') return true;
          if (typeof err.message === 'string' && err.message.includes('stream was destroyed')) return true;
          if (err.cause) return isStreamDestroyedError(err.cause, depth + 1);
          if (Array.isArray(err.errors)) return err.errors.some(inner => isStreamDestroyedError(inner, depth + 1));
          return false;
        }

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

      execFile('node', ['-e', script], { timeout: 5000 }, (err, _stdout, stderr) => {
        resolve({ code: err ? (err as any).code ?? 1 : 0, stderr });
      });
    });
  }

  it('should crash without the ERR_STREAM_DESTROYED filter (reproduces the bug)', async () => {
    const result = await spawnWithHandler(false);
    expect(result.code).not.toBe(0);
  });

  it('should survive with the ERR_STREAM_DESTROYED filter (the fix)', async () => {
    const result = await spawnWithHandler(true);
    expect(result.code).toBe(0);
  });
});

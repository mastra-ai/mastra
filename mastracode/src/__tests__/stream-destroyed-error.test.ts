import { describe, expect, it } from 'vitest';

import { isStreamDestroyedError } from '../error-classification.js';

describe('isStreamDestroyedError', () => {
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

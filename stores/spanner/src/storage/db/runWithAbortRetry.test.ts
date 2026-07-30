import { describe, expect, it } from 'vitest';

import { SpannerDB } from './index';

/**
 * Unit tests for runWithAbortRetry's AggregateError handling.
 *
 * These tests verify that when a transaction fails with an ABORTED error and the
 * subsequent rollback also fails, the AggregateError wrapping both errors is
 * correctly unwrapped so the retry mechanism still recognises the original
 * ABORTED signal and retries the operation.
 *
 * No Spanner emulator is required — we instantiate SpannerDB with a dummy
 * database reference and only exercise the public `runWithAbortRetry` method
 * with plain async functions.
 */

// Minimal stub: runWithAbortRetry only uses `this` for MastraBase fields and
// the `database` property. We pass an empty object as the database handle since
// the retry loop never touches it.
function makeDb(): SpannerDB {
  return new SpannerDB({ database: {} as any });
}

describe('runWithAbortRetry – AggregateError handling', () => {
  it('retries when fn throws a plain ABORTED error (baseline)', async () => {
    const db = makeDb();
    let calls = 0;

    const result = await db.runWithAbortRetry(async () => {
      calls++;
      if (calls < 3) {
        const err: any = new Error('ABORTED');
        err.code = 10;
        throw err;
      }
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('retries when fn throws an AggregateError whose first error is ABORTED', async () => {
    const db = makeDb();
    let calls = 0;

    const result = await db.runWithAbortRetry(async () => {
      calls++;
      if (calls < 3) {
        const abortedErr: any = new Error('ABORTED');
        abortedErr.code = 10;
        const rollbackErr = new Error('Rollback failed: session not found');
        throw new AggregateError([abortedErr, rollbackErr], 'Transaction and rollback both failed');
      }
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws the full AggregateError after exhausting retries', async () => {
    const db = makeDb();
    let calls = 0;

    await expect(
      db.runWithAbortRetry(async () => {
        calls++;
        const abortedErr: any = new Error('ABORTED');
        abortedErr.code = 10;
        const rollbackErr = new Error('Rollback also failed');
        throw new AggregateError([abortedErr, rollbackErr], 'Transaction and rollback both failed');
      }),
    ).rejects.toBeInstanceOf(AggregateError);

    // maxAttempts is 5
    expect(calls).toBe(5);
  });

  it('does NOT retry a non-ABORTED AggregateError', async () => {
    const db = makeDb();
    let calls = 0;

    await expect(
      db.runWithAbortRetry(async () => {
        calls++;
        const originalErr = new Error('UNIQUE constraint violated');
        const rollbackErr = new Error('Rollback failed');
        throw new AggregateError([originalErr, rollbackErr], 'Transaction and rollback both failed');
      }),
    ).rejects.toBeInstanceOf(AggregateError);

    // Should NOT retry — only 1 call
    expect(calls).toBe(1);
  });

  it('preserves both errors inside the AggregateError', async () => {
    const db = makeDb();

    try {
      await db.runWithAbortRetry(async () => {
        const abortedErr: any = new Error('ABORTED');
        abortedErr.code = 10;
        const rollbackErr = new Error('Session expired');
        throw new AggregateError([abortedErr, rollbackErr], 'Transaction and rollback both failed');
      });
      // Should not reach here
      expect.unreachable('Expected an AggregateError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      const agg = error as AggregateError;
      expect(agg.errors).toHaveLength(2);
      expect(agg.errors[0].message).toBe('ABORTED');
      expect(agg.errors[1].message).toBe('Session expired');
      expect(agg.message).toBe('Transaction and rollback both failed');
    }
  });
});

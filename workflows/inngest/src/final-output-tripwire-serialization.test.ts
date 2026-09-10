import { TripWire } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';
import { InngestExecutionEngine } from './execution-engine';

describe('native final-output TripWire serialization', () => {
  it.each([false, true])('preserves the guard payload through memoized step failure: retry=%s', async retry => {
    const guard = {
      reason: 'Final output rejected',
      retry,
      metadata: { policy: 'serialized-output-guard', evidence: ['test'] },
      processorId: 'final-output-guard',
    };
    let retainedFailure: string | undefined;
    const operation = vi.fn(async () => {
      throw new TripWire(guard.reason, { retry: guard.retry, metadata: guard.metadata }, guard.processorId);
    });
    const step = {
      run: vi.fn(async (_id: string, fn: () => Promise<unknown>) => {
        if (!retainedFailure) {
          try {
            return await fn();
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            // The SDK serialization boundary retains standard Error fields
            // and cause, not arbitrary custom class properties. Replaying
            // the stored failure must not execute the operation again.
            retainedFailure = JSON.stringify({
              name: error.name,
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            });
          }
        }
        throw Object.assign(new Error(), JSON.parse(retainedFailure));
      }),
      sleep: vi.fn(),
      sleepUntil: vi.fn(),
    };
    const engine = new InngestExecutionEngine(undefined as any, step as any, 0, {});
    const params = { retries: 0, delay: 0, workflowId: 'final-output', runId: 'serialized-guard' };
    const first = await engine.executeStepWithRetry('final-output', operation, params);
    const replayed = await engine.executeStepWithRetry('final-output', operation, params);
    expect(operation).toHaveBeenCalledOnce();
    expect(step.run).toHaveBeenCalledTimes(2);
    for (const result of [first, replayed]) {
      expect(result).toMatchObject({ ok: false, error: { status: 'failed', tripwire: guard } });
    }
  });
});

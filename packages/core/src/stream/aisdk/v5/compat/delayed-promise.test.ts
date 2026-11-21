import { describe, expect, it } from 'vitest';
import { DelayedPromise } from './delayed-promise';

describe('DelayedPromise', () => {
  it('replaces a settled value for a caller that already awaited the provisional one', async () => {
    const delayed = new DelayedPromise<number>();
    const first = delayed.promise;

    delayed.resolve(100);
    expect(await first).toBe(100);

    delayed.resolve(150);
    expect(await delayed.promise).toBe(150);
    expect(await first).toBe(100);
  });

  it('does not keep a resolver for a promise created after it already settled', async () => {
    const delayed = new DelayedPromise<number>();
    delayed.resolve(100);

    const settled = delayed.promise;
    expect(await settled).toBe(100);

    delayed.resolve(150);
    expect(await delayed.promise).toBe(150);
  });

  it('keeps each resumed value for callers holding successive usage promises', async () => {
    const delayed = new DelayedPromise<number>();
    delayed.resolve(100);

    const suspended = delayed.promise;
    delayed.resolve(150);
    const firstResume = delayed.promise;
    delayed.resolve(200);

    expect(await suspended).toBe(100);
    expect(await firstResume).toBe(150);
    expect(await delayed.promise).toBe(200);
  });

  it('does not raise an unhandled rejection when resolved after it was rejected', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const delayed = new DelayedPromise<number>();
      const error = new Error('provider connection reset');

      // A durable stream rejects the pending key when its model call fails
      // before anything has read the promise.
      delayed.reject(error);

      // The consumer then reads the value (e.g. `withBufferedStepResponses`
      // awaiting `output.steps`), which builds the already-rejected promise.
      await delayed.promise.catch(observed => {
        expect(observed).toBe(error);
      });

      // The closing `resolvePromises` resolves the same key afterwards.
      delayed.resolve(42);

      // Let microtasks flush: before the fix this chained a fresh rejected
      // promise off the settled one with nothing awaiting it.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

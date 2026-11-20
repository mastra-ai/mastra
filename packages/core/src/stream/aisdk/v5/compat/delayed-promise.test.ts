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
});

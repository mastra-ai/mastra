import { describe, expect, it } from 'vitest';
import { DelayedPromise } from './delayed-promise';

describe('DelayedPromise', () => {
  describe('reset', () => {
    it('returns a settled but never-materialized promise to pending', () => {
      const delayed = new DelayedPromise<string>();
      delayed.resolve('stale');
      expect(delayed.status).toEqual({ type: 'resolved', value: 'stale' });

      expect(delayed.reset()).toBe(true);
      expect(delayed.status).toEqual({ type: 'pending' });
    });

    it('lets a superseding value settle the promise after a reset', async () => {
      const delayed = new DelayedPromise<string>();
      delayed.resolve('stale');
      delayed.reset();
      delayed.resolve('fresh');

      await expect(delayed.promise).resolves.toBe('fresh');
    });

    it('resets a rejected promise that was never materialized', () => {
      const delayed = new DelayedPromise<string>();
      delayed.reject(new Error('stale failure'));

      expect(delayed.reset()).toBe(true);
      expect(delayed.status).toEqual({ type: 'pending' });
    });

    it('refuses to reset once the promise has been materialized', async () => {
      const delayed = new DelayedPromise<string>();
      const observed = delayed.promise;
      delayed.resolve('stale');

      // A settled JS promise cannot be un-settled, so reset must report failure
      // rather than leave the status and the promise disagreeing.
      expect(delayed.reset()).toBe(false);
      expect(delayed.status).toEqual({ type: 'resolved', value: 'stale' });
      await expect(observed).resolves.toBe('stale');
    });

    it('is a no-op signal for a promise that is still pending', () => {
      const delayed = new DelayedPromise<string>();

      expect(delayed.reset()).toBe(true);
      expect(delayed.status).toEqual({ type: 'pending' });
    });
  });
});

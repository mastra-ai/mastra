import { describe, expect, it } from 'vitest';

import { waitWithAbort } from '../wait-with-abort';

describe('waitWithAbort', () => {
  it('handles a later rejection of work when the signal was already aborted', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const controller = new AbortController();
      controller.abort();
      let fail!: (error: Error) => void;
      const work = new Promise<never>((_, reject) => (fail = reject));
      await expect(waitWithAbort(work, controller.signal)).rejects.toHaveProperty('name', 'AbortError');
      fail(new Error('work failed'));
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('stops waiting on abort while the work keeps its own result', async () => {
    const controller = new AbortController();
    let finish!: (value: string) => void;
    const work = new Promise<string>(resolve => (finish = resolve));
    const waiting = waitWithAbort(work, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toHaveProperty('name', 'AbortError');
    finish('done');
    await expect(work).resolves.toBe('done');
  });
});

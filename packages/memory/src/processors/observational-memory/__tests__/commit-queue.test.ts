import { AsyncLocalStorage } from 'node:async_hooks';

import { describe, expect, it, vi } from 'vitest';

import { activeOMCommitKeys, isInOMCommit, OM_COMMIT_STALL_MS, runOMCommit } from '../commit-queue';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('runOMCommit', () => {
  it('runs ops on one key one at a time, in order', async () => {
    const order: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const op = (name: string) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      order.push(`start ${name}`);
      await tick();
      order.push(`end ${name}`);
      running--;
      return name;
    };

    const results = await Promise.all([
      runOMCommit('thread:fifo', op('a')),
      runOMCommit('thread:fifo', op('b')),
      runOMCommit('thread:fifo', op('c')),
    ]);

    expect(results).toEqual(['a', 'b', 'c']);
    expect(maxRunning).toBe(1);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('releases a key held past the stall limit so later ops run, without settling the stalled op', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const hung = deferred<string>();
      let stalledSettled = false;
      const stalled = runOMCommit('thread:stall', () => hung.promise).then(value => {
        stalledSettled = true;
        return value;
      });
      let laterRan = false;
      const later = runOMCommit('thread:stall', async () => {
        laterRan = true;
        return 'later';
      });
      let afterRan = false;
      const after = runOMCommit('thread:stall', async () => {
        afterRan = true;
      });

      await vi.advanceTimersByTimeAsync(OM_COMMIT_STALL_MS - 1);
      expect(laterRan).toBe(false);
      expect(warn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(await later).toBe('later');
      await after;
      expect(afterRan).toBe(true);
      expect(stalledSettled).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain('thread:stall');

      // The late settle must not start another op or touch the key's newer state.
      let nextRan = 0;
      const gate = deferred();
      const next = runOMCommit('thread:stall', async () => {
        nextRan++;
        await gate.promise;
      });
      const queued = runOMCommit('thread:stall', async () => {
        nextRan++;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(nextRan).toBe(1);
      hung.resolve('stalled');
      expect(await stalled).toBe('stalled');
      await vi.advanceTimersByTimeAsync(0);
      expect(nextRan).toBe(1);
      gate.resolve();
      await Promise.all([next, queued]);
      expect(nextRan).toBe(2);
      expect(activeOMCommitKeys()).toBe(0);
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it('clears the stall timer when an op settles in time', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await runOMCommit('thread:quick', async () => 'done');
      expect(vi.getTimerCount()).toBe(0);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it('runs ops on different keys concurrently', async () => {
    const gate = deferred();
    const started: string[] = [];
    const first = runOMCommit('thread:one', async () => {
      started.push('one');
      await gate.promise;
    });
    const second = runOMCommit('thread:two', async () => {
      started.push('two');
    });

    await second;
    expect(started).toEqual(['one', 'two']);
    gate.resolve();
    await first;
  });

  it('runs a waiting reflection op before waiting normal ops without preempting the running op', async () => {
    const gate = deferred();
    const order: string[] = [];
    const record = (name: string) => async () => {
      order.push(name);
    };

    const running = runOMCommit('thread:priority', async () => {
      order.push('running');
      await gate.promise;
      order.push('running done');
    });
    const normalA = runOMCommit('thread:priority', record('normal a'));
    const normalB = runOMCommit('thread:priority', record('normal b'));
    const reflection = runOMCommit('thread:priority', record('reflection'), { priority: 'reflection' });

    await tick();
    expect(order).toEqual(['running']);
    gate.resolve();
    await Promise.all([running, normalA, normalB, reflection]);

    expect(order).toEqual(['running', 'running done', 'reflection', 'normal a', 'normal b']);
  });

  it('rejects only the failing caller and keeps the queue going', async () => {
    const failing = runOMCommit('thread:errors', async () => {
      throw new Error('boom');
    });
    const after = runOMCommit('thread:errors', async () => 'still runs');

    await expect(failing).rejects.toThrow('boom');
    await expect(after).resolves.toBe('still runs');
  });

  it('removes idle keys', async () => {
    const before = activeOMCommitKeys();
    const gate = deferred();
    const op = runOMCommit('thread:cleanup', () => gate.promise);
    expect(activeOMCommitKeys()).toBe(before + 1);
    gate.resolve();
    await op;
    expect(activeOMCommitKeys()).toBe(before);
  });

  it('rejects a re-entrant op on the held key instead of deadlocking', async () => {
    const result = await runOMCommit('thread:reentrant', async () => {
      const inner = runOMCommit('thread:reentrant', async () => 'never');
      return inner.then(
        () => 'resolved',
        (error: Error) => error.message,
      );
    });

    expect(result).toMatch(/Re-entrant observational memory commit on "thread:reentrant"/);
  });

  it('allows an op to enqueue on a different key', async () => {
    const result = await runOMCommit('thread:outer', () => runOMCommit('thread:inner', async () => 'inner ran'));
    expect(result).toBe('inner ran');
  });

  it('reports whether the current context holds a key', async () => {
    expect(isInOMCommit('thread:held')).toBe(false);
    let inside = false;
    let other = true;
    let detached: Promise<boolean> | undefined;
    const release = deferred();

    await runOMCommit('thread:held', async () => {
      inside = isInOMCommit('thread:held');
      other = isInOMCommit('thread:not-held');
      // A task started inside the op but checked after it finished no longer holds the key.
      detached = release.promise.then(() => isInOMCommit('thread:held'));
    });
    release.resolve();

    expect(inside).toBe(true);
    expect(other).toBe(false);
    expect(await detached).toBe(false);
    expect(isInOMCommit('thread:held')).toBe(false);
  });

  it("runs each op in its own caller's async context, not the context of the op it waited behind", async () => {
    const request = new AsyncLocalStorage<string>();
    const gate = deferred();
    const seen: string[] = [];
    const first = request.run('request-a', () =>
      runOMCommit('thread:context', async () => {
        seen.push(request.getStore()!);
        await gate.promise;
      }),
    );
    const second = request.run('request-b', () =>
      runOMCommit('thread:context', async () => {
        seen.push(request.getStore()!);
      }),
    );
    await tick();
    gate.resolve();
    await Promise.all([first, second]);
    expect(seen).toEqual(['request-a', 'request-b']);
  });

  it('rejects a nested op that comes back to a key an outer op holds (A -> B -> A)', async () => {
    const result = await runOMCommit('thread:outer', () =>
      runOMCommit('thread:inner', () => runOMCommit('thread:outer', async () => 'deadlock').catch(e => e as Error)),
    );
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain('Re-entrant observational memory commit on "thread:outer"');
  });

  it('shares one queue between two loaded copies of the module', async () => {
    vi.resetModules();
    const copy = await import('../commit-queue');
    expect(copy.runOMCommit).not.toBe(runOMCommit);
    const gate = deferred();
    const order: string[] = [];
    const first = runOMCommit('thread:copies', async () => {
      await gate.promise;
      order.push('first');
    });
    const second = copy.runOMCommit('thread:copies', async () => {
      order.push('second');
    });
    await tick();
    expect(order).toEqual([]);
    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
  });
});

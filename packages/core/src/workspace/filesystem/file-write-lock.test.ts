import { describe, it, expect } from 'vitest';

import { InMemoryFileWriteLock } from './file-write-lock';

describe('InMemoryFileWriteLock', () => {
  it('should serialize operations on the same path (FIFO order)', async () => {
    const lock = new InMemoryFileWriteLock();
    const order: number[] = [];

    // Create three operations that resolve in reverse order without locking,
    // but should execute in FIFO order with locking.
    const op1 = lock.withLock('/file.txt', async () => {
      await delay(30);
      order.push(1);
      return 'a';
    });
    const op2 = lock.withLock('/file.txt', async () => {
      await delay(10);
      order.push(2);
      return 'b';
    });
    const op3 = lock.withLock('/file.txt', async () => {
      order.push(3);
      return 'c';
    });

    const results = await Promise.all([op1, op2, op3]);

    expect(order).toEqual([1, 2, 3]);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('should allow parallel operations on different paths', async () => {
    const lock = new InMemoryFileWriteLock();
    const running: string[] = [];
    const completed: string[] = [];

    const opA = lock.withLock('/a.txt', async () => {
      running.push('a');
      await delay(100);
      completed.push('a');
    });
    const opB = lock.withLock('/b.txt', async () => {
      running.push('b');
      await delay(5);
      completed.push('b');
    });

    await Promise.all([opA, opB]);

    // Both should have started before either completed
    expect(running).toEqual(['a', 'b']);
    // b finishes first because it has a shorter delay and runs in parallel
    expect(completed).toEqual(['b', 'a']);
  });

  it('should isolate errors — a failed op does not block the next', async () => {
    const lock = new InMemoryFileWriteLock();

    const op1 = lock.withLock('/file.txt', async () => {
      throw new Error('boom');
    });
    const op2 = lock.withLock('/file.txt', async () => {
      return 'ok';
    });

    await expect(op1).rejects.toThrow('boom');
    await expect(op2).resolves.toBe('ok');
  });

  it('should clean up the queue after all operations complete', async () => {
    const lock = new InMemoryFileWriteLock();

    expect(lock.size).toBe(0);

    await lock.withLock('/file.txt', async () => 'done');

    // Allow microtask (finally handler) to run
    await delay(0);
    expect(lock.size).toBe(0);
  });

  it('should normalize paths (double slashes, dot segments)', async () => {
    const lock = new InMemoryFileWriteLock();
    const order: number[] = [];

    // These paths should all normalize to /test/file.txt
    const op1 = lock.withLock('//test//file.txt', async () => {
      await delay(20);
      order.push(1);
    });
    const op2 = lock.withLock('/test/./file.txt', async () => {
      order.push(2);
    });

    await Promise.all([op1, op2]);

    // Serialized because they map to the same normalized path
    expect(order).toEqual([1, 2]);
  });

  it('should normalize leading double-slash to single slash', async () => {
    const lock = new InMemoryFileWriteLock();
    const order: number[] = [];

    const op1 = lock.withLock('//file.txt', async () => {
      await delay(20);
      order.push(1);
    });
    const op2 = lock.withLock('/file.txt', async () => {
      order.push(2);
    });

    await Promise.all([op1, op2]);

    // Serialized because //file.txt normalizes to /file.txt
    expect(order).toEqual([1, 2]);
  });

  it('should reject with timeout when fn hangs', async () => {
    const lock = new InMemoryFileWriteLock({ timeoutMs: 50 });

    const hung = lock.withLock('/file.txt', () => new Promise<string>(() => {})); // never resolves

    await expect(hung).rejects.toThrow('write-lock timeout');

    // Queue should clean up after timeout
    await delay(0);
    expect(lock.size).toBe(0);
  });

  it('should not block next operation after timeout', async () => {
    const lock = new InMemoryFileWriteLock({ timeoutMs: 50 });

    const hung = lock.withLock('/file.txt', () => new Promise<string>(() => {}));
    const next = lock.withLock('/file.txt', async () => 'recovered');

    await expect(hung).rejects.toThrow('write-lock timeout');
    await expect(next).resolves.toBe('recovered');
  });

  it('should normalize backslash paths to match posix paths', async () => {
    const lock = new InMemoryFileWriteLock();
    const order: number[] = [];

    const op1 = lock.withLock('\\test\\file.txt', async () => {
      await delay(20);
      order.push(1);
    });
    const op2 = lock.withLock('/test/file.txt', async () => {
      order.push(2);
    });

    await Promise.all([op1, op2]);

    expect(order).toEqual([1, 2]);
  });
});

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LockClient, LockLogger, LockPool } from './project-lock.js';
import {
  __resetProjectLocksForTests,
  DEFAULT_PROJECT_LOCK_SLOW_WARN_MS,
  hashKey,
  ProjectLockTimeoutError,
  withDbAdvisoryLock,
  withProjectLock,
} from './project-lock.js';

// ── Phase 5 distributed project-lock scenario tests ──────────────────────
// These prove cross-replica serialization on the same key using a fake pg
// client that faithfully models transaction-scoped advisory-lock semantics:
//   - pg_advisory_xact_lock(k1, k2) blocks while another transaction holds the
//     same key,
//   - the lock auto-releases when the holding transaction COMMITs or ROLLBACKs.
// Two `withProjectLock` callers sharing one fake pool model two replicas
// pointed at one Postgres.

/**
 * A fake Postgres modeling per-key advisory-lock queues. A key is "held" by at
 * most one transaction at a time; `pg_advisory_xact_lock` waits for the holder
 * to COMMIT/ROLLBACK before resolving.
 */
class FakePg implements LockPool {
  /** key -> currently-holding client (or undefined when free). */
  private held = new Map<string, FakeClient>();
  /** key -> FIFO queue of waiters resolved when the lock frees. */
  private waiters = new Map<string, Array<() => void>>();

  connect(): Promise<LockClient> {
    return Promise.resolve(new FakeClient(this));
  }

  async acquire(key: string, client: FakeClient): Promise<void> {
    if (!this.held.has(key)) {
      this.held.set(key, client);
      return;
    }
    await new Promise<void>(resolve => {
      const q = this.waiters.get(key) ?? [];
      q.push(resolve);
      this.waiters.set(key, q);
    });
    this.held.set(key, client);
  }

  releaseAll(client: FakeClient): void {
    for (const [key, holder] of [...this.held.entries()]) {
      if (holder !== client) continue;
      this.held.delete(key);
      const q = this.waiters.get(key);
      const next = q?.shift();
      if (next) next();
    }
  }

  isHeld(key: string): boolean {
    return this.held.has(key);
  }
}

class FakeClient implements LockClient {
  private heldKeys: string[] = [];
  constructor(private readonly pg: FakePg) {}

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    if (sql === 'BEGIN') return undefined;
    if (sql === 'COMMIT' || sql === 'ROLLBACK') {
      this.pg.releaseAll(this);
      this.heldKeys = [];
      return undefined;
    }
    if (sql.includes('pg_advisory_xact_lock')) {
      const [k1, k2] = params as [number, number];
      const key = `${k1}:${k2}`;
      this.heldKeys.push(key);
      await this.pg.acquire(key, this);
      return undefined;
    }
    return undefined;
  }

  release(): void {
    // Connection back to the pool; any held advisory locks would have been
    // released by COMMIT/ROLLBACK already. Defensive cleanup mirrors pg.
    this.pg.releaseAll(this);
  }
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => {
  __resetProjectLocksForTests();
  process.env.MASTRACODE_DISTRIBUTED_LOCK = '1';
});
afterEach(() => {
  delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
  __resetProjectLocksForTests();
});

// Two replicas share one Postgres but have *independent* in-process lock
// chains. We model each replica's call as a direct advisory-lock acquisition
// (`withDbAdvisoryLock`), since that is the only layer that serializes across
// replicas; the in-process mutex only serializes within a single replica.
describe('cross-replica serialization via advisory locks', () => {
  it('serializes overlapping critical sections on the same key across two replicas', async () => {
    const pg = new FakePg(); // one shared Postgres
    const [k1, k2] = hashKey('proj1:user1');
    const key = `${k1}:${k2}`;

    const order: string[] = [];
    const gateA = deferred();

    // Replica A acquires the advisory lock first.
    const a = withDbAdvisoryLock({
      key: 'proj1:user1',
      fn: async () => {
        order.push('A:start');
        await gateA.promise;
        order.push('A:end');
      },
      pool: pg,
    });
    // Let A's BEGIN + advisory-lock acquisition settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Replica B (separate process → no shared in-process chain) tries the same
    // key and must block on the Postgres advisory lock.
    const b = withDbAdvisoryLock({
      key: 'proj1:user1',
      fn: async () => {
        order.push('B:start');
        order.push('B:end');
      },
      pool: pg,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['A:start']);

    gateA.resolve();
    await Promise.all([a, b]);

    expect(order).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
    expect(pg.isHeld(key)).toBe(false);
  });

  it('lets different keys interleave', async () => {
    const pg = new FakePg();
    const order: string[] = [];
    const gate1 = deferred();

    const [k1a, k1b] = hashKey('proj1:user1');
    const key1 = `${k1a}:${k1b}`;

    const op1 = withDbAdvisoryLock({
      key: 'proj1:user1',
      fn: async () => {
        order.push('1:start');
        await gate1.promise;
        order.push('1:end');
      },
      pool: pg,
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // A different key should not be blocked by op1 holding key1.
    const op2 = withDbAdvisoryLock({
      key: 'proj2:user1',
      fn: async () => {
        order.push('2:start');
        order.push('2:end');
      },
      pool: pg,
    });

    await op2;
    // op2 finished while op1 is still holding its lock.
    expect(order).toEqual(['1:start', '2:start', '2:end']);
    expect(pg.isHeld(key1)).toBe(true);

    gate1.resolve();
    await op1;
    expect(order).toEqual(['1:start', '2:start', '2:end', '1:end']);
    expect(pg.isHeld(key1)).toBe(false);
  });
});

describe('lock released on failure', () => {
  it('rolls back and frees the key so the next caller acquires (no deadlock)', async () => {
    const pg = new FakePg();
    __resetProjectLocksForTests();
    const [k1, k2] = hashKey('proj1:user1');
    const key = `${k1}:${k2}`;

    await expect(
      withProjectLock({
        key: 'proj1:user1',
        fn: async () => {
          throw new Error('boom');
        },
        pool: pg,
      }),
    ).rejects.toThrow('boom');

    // Lock must be free after the failed (rolled-back) transaction.
    expect(pg.isHeld(key)).toBe(false);

    let ran = false;
    await withProjectLock({
      key: 'proj1:user1',
      fn: async () => {
        ran = true;
      },
      pool: pg,
    });
    expect(ran).toBe(true);
    expect(pg.isHeld(key)).toBe(false);
  });
});

describe('disabled distributed lock falls back to in-process only', () => {
  it('does not touch the pg pool when MASTRACODE_DISTRIBUTED_LOCK=0', async () => {
    process.env.MASTRACODE_DISTRIBUTED_LOCK = '0';
    let connects = 0;
    const pg: LockPool = {
      connect: () => {
        connects++;
        return Promise.resolve({ query: async () => undefined, release: () => {} });
      },
    };
    let ran = false;
    await withProjectLock({
      key: 'proj1:user1',
      fn: async () => {
        ran = true;
      },
      pool: pg,
    });
    expect(ran).toBe(true);
    expect(connects).toBe(0);
  });
});

// The 2025-07-23 shipyard incident: an untimed outbound call inside `fn` left
// the advisory-lock transaction open in `idle in transaction` for up to
// 5 minutes (Neon's IIT killer), pinning the pool connection and the lock. The
// timeout is the belt-and-suspenders fix: even if `fn` hangs forever, the
// wrapper aborts, rolls back, releases the connection, and surfaces
// `ProjectLockTimeoutError` to the caller.
describe('critical section timeout', () => {
  it('aborts the fn signal and rolls back when fn exceeds timeoutMs', async () => {
    const pg = new FakePg();
    const [k1, k2] = hashKey('proj1:user1');
    const key = `${k1}:${k2}`;

    let sawAbort = false;
    const rejected = withProjectLock({
      key: 'proj1:user1',
      timeoutMs: 20,
      fn: signal =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              sawAbort = true;
              // Model an outbound call that eventually reports the abort
              // back to the caller. The wrapper does not wait for us.
              reject(new Error('aborted'));
            },
            { once: true },
          );
          // Never resolves on its own.
        }),
      pool: pg,
    });

    await expect(rejected).rejects.toBeInstanceOf(ProjectLockTimeoutError);
    expect(sawAbort).toBe(true);
    // ROLLBACK ran and released the advisory lock.
    expect(pg.isHeld(key)).toBe(false);

    // A follow-up caller acquires the same key without waiting.
    let ran = false;
    await withProjectLock({
      key: 'proj1:user1',
      fn: async () => {
        ran = true;
      },
      pool: pg,
    });
    expect(ran).toBe(true);
    expect(pg.isHeld(key)).toBe(false);
  });

  it('leaves a well-behaved fast fn completely alone', async () => {
    const pg = new FakePg();
    const [k1, k2] = hashKey('proj1:user1');
    const key = `${k1}:${k2}`;

    const result = await withProjectLock({
      key: 'proj1:user1',
      timeoutMs: 1_000,
      fn: async () => 'ok',
      pool: pg,
    });
    expect(result).toBe('ok');
    expect(pg.isHeld(key)).toBe(false);
  });

  it('does not fire when fn ignores the signal but completes in time', async () => {
    const pg = new FakePg();
    const value = await withProjectLock({
      key: 'proj1:user1',
      timeoutMs: 200,
      fn: async () => {
        await new Promise(r => setTimeout(r, 20));
        return 42;
      },
      pool: pg,
    });
    expect(value).toBe(42);
  });

  it('also applies to withDbAdvisoryLock invoked directly', async () => {
    const pg = new FakePg();
    const [k1, k2] = hashKey('proj1:user1');
    const key = `${k1}:${k2}`;

    await expect(
      withDbAdvisoryLock({
        key: 'proj1:user1',
        timeoutMs: 20,
        // Callback ignores the signal — the timeout still fires and the
        // wrapper resolves before `fn` ever settles.
        fn: () => new Promise<never>(() => {}),
        pool: pg,
      }),
    ).rejects.toBeInstanceOf(ProjectLockTimeoutError);

    // Lock released even though fn never returned.
    expect(pg.isHeld(key)).toBe(false);
  });
});

// When a critical section runs long or times out, we need to know which
// named platform-call boundary was in flight — otherwise the timeout error
// only tells us "60s elapsed" and we have to guess. The step recorder
// records those boundaries; on timeout they're attached to
// `ProjectLockTimeoutError.steps` / `.currentStep`; on non-timeout slow
// completions they're emitted as a `warn`.
describe('lock step recorder', () => {
  function collectingLogger(): LockLogger & { warnings: Array<{ message: string; meta?: Record<string, unknown> }> } {
    const warnings: Array<{ message: string; meta?: Record<string, unknown> }> = [];
    return {
      warnings,
      warn(message, meta) {
        warnings.push({ message, meta });
      },
    };
  }

  it('records completed steps in order with durations and ok outcomes', async () => {
    const pg = new FakePg();
    const captured: { steps: readonly unknown[] } = { steps: [] };
    await withProjectLock({
      key: 'proj1:user1',
      fn: async (_signal, recorder) => {
        await recorder.step('fleet.resolveSandbox', () => new Promise(r => setTimeout(r, 5)));
        await recorder.step('sandbox.commitAll', () => Promise.resolve('ok'));
        captured.steps = recorder.entries;
      },
      pool: pg,
    });
    expect(captured.steps).toHaveLength(2);
    expect(captured.steps[0]).toMatchObject({ name: 'fleet.resolveSandbox', outcome: 'ok' });
    expect(captured.steps[1]).toMatchObject({ name: 'sandbox.commitAll', outcome: 'ok' });
  });

  it('records an error outcome for a failing step and rethrows', async () => {
    const pg = new FakePg();
    let capturedEntries: readonly { name: string; outcome: string }[] = [];
    await expect(
      withProjectLock({
        key: 'proj1:user1',
        fn: async (_signal, recorder) => {
          await recorder.step('ok.step', () => Promise.resolve());
          try {
            await recorder.step('bad.step', () => Promise.reject(new Error('boom')));
          } finally {
            capturedEntries = recorder.entries.map(e => ({ name: e.name, outcome: e.outcome }));
          }
        },
        pool: pg,
      }),
    ).rejects.toThrow('boom');
    expect(capturedEntries).toEqual([
      { name: 'ok.step', outcome: 'ok' },
      { name: 'bad.step', outcome: 'error' },
    ]);
  });

  it('attaches step history and currentStep to ProjectLockTimeoutError', async () => {
    const pg = new FakePg();
    let caught: ProjectLockTimeoutError | undefined;
    try {
      await withProjectLock({
        key: 'proj1:user1',
        timeoutMs: 30,
        fn: async (_signal, recorder) => {
          await recorder.step('step.fast', () => Promise.resolve());
          await recorder.step('step.hanging', () => new Promise<void>(() => {}));
        },
        pool: pg,
      });
    } catch (err) {
      caught = err as ProjectLockTimeoutError;
    }
    expect(caught).toBeInstanceOf(ProjectLockTimeoutError);
    expect(caught?.currentStep).toBe('step.hanging');
    expect(caught?.steps.map(s => s.name)).toEqual(['step.fast', 'step.hanging']);
    const hanging = caught?.steps.find(s => s.name === 'step.hanging');
    expect(hanging?.outcome).toBe('running');
    expect(hanging?.durationMs).toBeGreaterThan(0);
    // Error message surfaces the currentStep for quick log-scanning.
    expect(caught?.message).toContain('step.hanging');
  });

  it('emits a slow-lock warn when total exceeds the threshold', async () => {
    const pg = new FakePg();
    process.env.MASTRACODE_PROJECT_LOCK_SLOW_WARN_MS = '10';
    const logger = collectingLogger();
    try {
      await withProjectLock({
        key: 'proj1:user1',
        logger,
        fn: async (_signal, recorder) => {
          await recorder.step('slow.thing', () => new Promise(r => setTimeout(r, 25)));
        },
        pool: pg,
      });
    } finally {
      delete process.env.MASTRACODE_PROJECT_LOCK_SLOW_WARN_MS;
    }
    expect(logger.warnings).toHaveLength(1);
    const warning = logger.warnings[0]!;
    expect(warning.message).toContain('slow critical section');
    expect(warning.meta).toMatchObject({
      key: 'proj1:user1',
      thresholdMs: 10,
    });
    const steps = warning.meta?.steps as Array<{ name: string; outcome: string }>;
    expect(steps.map(s => s.name)).toEqual(['slow.thing']);
    expect(steps[0]?.outcome).toBe('ok');
  });

  it('does not warn when the critical section stays under the threshold', async () => {
    const pg = new FakePg();
    // Explicitly raise the threshold so the test is deterministic
    // regardless of the default.
    process.env.MASTRACODE_PROJECT_LOCK_SLOW_WARN_MS = String(DEFAULT_PROJECT_LOCK_SLOW_WARN_MS);
    const logger = collectingLogger();
    try {
      await withProjectLock({
        key: 'proj1:user1',
        logger,
        fn: async (_signal, recorder) => {
          await recorder.step('quick.thing', () => Promise.resolve());
        },
        pool: pg,
      });
    } finally {
      delete process.env.MASTRACODE_PROJECT_LOCK_SLOW_WARN_MS;
    }
    expect(logger.warnings).toHaveLength(0);
  });
});

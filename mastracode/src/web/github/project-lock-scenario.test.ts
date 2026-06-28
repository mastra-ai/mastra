import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LockClient, LockPool } from './project-lock';
import { __resetProjectLocksForTests, hashKey, withDbAdvisoryLock, withProjectLock } from './project-lock';

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
    const a = withDbAdvisoryLock(
      'proj1:user1',
      async () => {
        order.push('A:start');
        await gateA.promise;
        order.push('A:end');
      },
      pg,
    );
    // Let A's BEGIN + advisory-lock acquisition settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Replica B (separate process → no shared in-process chain) tries the same
    // key and must block on the Postgres advisory lock.
    const b = withDbAdvisoryLock(
      'proj1:user1',
      async () => {
        order.push('B:start');
        order.push('B:end');
      },
      pg,
    );

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

    const op1 = withDbAdvisoryLock(
      'proj1:user1',
      async () => {
        order.push('1:start');
        await gate1.promise;
        order.push('1:end');
      },
      pg,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // A different key should not be blocked by op1 holding key1.
    const op2 = withDbAdvisoryLock(
      'proj2:user1',
      async () => {
        order.push('2:start');
        order.push('2:end');
      },
      pg,
    );

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
      withProjectLock(
        'proj1:user1',
        async () => {
          throw new Error('boom');
        },
        pg,
      ),
    ).rejects.toThrow('boom');

    // Lock must be free after the failed (rolled-back) transaction.
    expect(pg.isHeld(key)).toBe(false);

    let ran = false;
    await withProjectLock(
      'proj1:user1',
      async () => {
        ran = true;
      },
      pg,
    );
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
    await withProjectLock(
      'proj1:user1',
      async () => {
        ran = true;
      },
      pg,
    );
    expect(ran).toBe(true);
    expect(connects).toBe(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { MastraCompositeStore } from './base';
import type { StorageDomains, StorageMastraRef } from './base';
import { InMemoryStore } from './mock';

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/16782
 *
 * When a user passes `default: someStore` to MastraCompositeStore, the outer
 * composite extracts the inner domain instances at construction time (via the
 * `resolve()` helper) and exposes them directly as `this.stores`. The outer
 * composite's `init()` then iterates those domains and calls each domain's
 * `init()` in parallel — but it never calls `default.init()`.
 *
 * That's wrong for every adapter: a store's own `init()` is where it owns
 * connection setup, migrations, DDL ordering, and coalescing of concurrent
 * callers. Bypassing it silently skips that work.
 *
 * The loud failure happens with LibSQLStore on a local file: the parent
 * `init()` is where pragmas (`busy_timeout`, WAL) get applied and where local
 * DBs init their domains sequentially. Skipping it makes 17 parallel
 * `CREATE TABLE IF NOT EXISTS` statements race on the same SQLite file, hit
 * SQLITE_BUSY, and leave tables uncreated — which the scheduler then trips
 * over with `no such table: mastra_schedules`.
 */
describe('MastraCompositeStore — default delegation (issue #16782)', () => {
  it('delegates init() to the underlying `default` store', async () => {
    // The inner store stands in for any real adapter that does work in its
    // own init() (setup, migrations, sequencing). The composite must call
    // that init(), not iterate the inner domains itself.
    const inner = new InMemoryStore({ id: 'inner' });
    const innerInitSpy = vi.spyOn(inner, 'init');

    const composite = new MastraCompositeStore({
      id: 'outer',
      default: inner,
    });

    await composite.init();

    expect(innerInitSpy).toHaveBeenCalledTimes(1);
  });

  it('delegates init() to the underlying `editor` store', async () => {
    const inner = new InMemoryStore({ id: 'editor-inner' });
    const innerInitSpy = vi.spyOn(inner, 'init');

    const composite = new MastraCompositeStore({
      id: 'outer-editor',
      editor: inner,
    });

    await composite.init();

    expect(innerInitSpy).toHaveBeenCalledTimes(1);
  });

  it('delegates to both default and editor when both are provided', async () => {
    const defaultStore = new InMemoryStore({ id: 'default-inner' });
    const editorStore = new InMemoryStore({ id: 'editor-inner' });
    const defaultInitSpy = vi.spyOn(defaultStore, 'init');
    const editorInitSpy = vi.spyOn(editorStore, 'init');

    const composite = new MastraCompositeStore({
      id: 'outer-both',
      default: defaultStore,
      editor: editorStore,
    });

    await composite.init();

    expect(defaultInitSpy).toHaveBeenCalledTimes(1);
    expect(editorInitSpy).toHaveBeenCalledTimes(1);
  });

  it('only init()s a shared parent once when used as both default and editor', async () => {
    // Defensive: if the same instance is passed as both `default` and
    // `editor`, dedupe by identity so we don't double-init it.
    const shared = new InMemoryStore({ id: 'shared-inner' });
    const sharedInitSpy = vi.spyOn(shared, 'init');

    const composite = new MastraCompositeStore({
      id: 'outer-shared',
      default: shared,
      editor: shared,
    });

    await composite.init();

    expect(sharedInitSpy).toHaveBeenCalledTimes(1);
  });

  it("treats the inner store's init() as authoritative (failure surfaces)", async () => {
    // If the composite bypasses the inner's init(), a thrown error from the
    // inner's init() would never surface. We must see it.
    const inner = new InMemoryStore({ id: 'failing-inner' });
    const failure = new Error('inner init failed');
    vi.spyOn(inner, 'init').mockRejectedValueOnce(failure);

    const composite = new MastraCompositeStore({
      id: 'outer-failing',
      default: inner,
    });

    await expect(composite.init()).rejects.toThrow('inner init failed');
  });
});

describe('MastraCompositeStore.__registerMastra', () => {
  const mastra: StorageMastraRef = { getAgentById: () => undefined };

  const getMastra = (store: MastraCompositeStore) => (store as unknown as { mastra?: StorageMastraRef }).mastra;
  const setParent = (store: MastraCompositeStore, parent: MastraCompositeStore) =>
    ((store as unknown as { parentDefault?: MastraCompositeStore }).parentDefault = parent);

  it('cascades the reference to a parent composite', () => {
    const parent = new MastraCompositeStore({ id: 'parent', default: new InMemoryStore({ id: 'parent-inner' }) });
    const child = new MastraCompositeStore({ id: 'child', default: new InMemoryStore({ id: 'child-inner' }) });
    setParent(child, parent);

    child.__registerMastra(mastra);

    expect(getMastra(child)).toBe(mastra);
    expect(getMastra(parent)).toBe(mastra);
  });

  it('terminates on a parent cycle (A -> B -> A) without stack overflow', () => {
    const a = new MastraCompositeStore({ id: 'a', default: new InMemoryStore({ id: 'a-inner' }) });
    const b = new MastraCompositeStore({ id: 'b', default: new InMemoryStore({ id: 'b-inner' }) });
    setParent(a, b);
    setParent(b, a);

    // Would recurse forever if `seen` were not shared across the cascade.
    expect(() => a.__registerMastra(mastra)).not.toThrow();
    expect(getMastra(a)).toBe(mastra);
    expect(getMastra(b)).toBe(mastra);
  });

  it('terminates on a self-cycle', () => {
    const a = new MastraCompositeStore({ id: 'a', default: new InMemoryStore({ id: 'a-inner' }) });
    setParent(a, a);

    expect(() => a.__registerMastra(mastra)).not.toThrow();
    expect(getMastra(a)).toBe(mastra);
  });
});

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/17679
 *
 * Reporter: Supabase transaction-pooler users intermittently see
 *   "canceling statement due to statement timeout"
 * thrown from `_ObservabilityPG.init` → `createTable` → `alterTable`
 * with the stack ending in `Promise.all (index 3)` inside
 * `PostgresStore.init` (which delegates to `MastraCompositeStore.init`).
 *
 * Root cause (verified against the real code):
 *   1. `MastraCompositeStore.#runInit()` collects every domain's
 *      `init()` into `initTasks` and awaits them with `Promise.all`,
 *      so ~20 domain init chains start concurrently.
 *   2. `PoolAdapter.none()` (stores/pg/src/storage/client.ts) calls
 *      `this.$pool.query(...)` directly, which means **every DDL
 *      statement checks out a fresh connection** and there is no
 *      init-time transaction holding a connection for the chain.
 *   3. `_ObservabilityPG.init` issues ~12 statements (createTable,
 *      alterTable, ~10 createIndex) all against `mastra_ai_spans`. With
 *      fan-out, observability's own statements end up on different
 *      backends and contend for the table's AccessExclusiveLock with
 *      each other, while other domains' DDL hogs the remaining pool
 *      slots. Whoever loses the lock race burns through Supabase's
 *      `statement_timeout` waiting.
 *
 * These tests model the failure mode against pure in-memory stubs:
 *
 *   - A `FakePool` enforces a bounded number of concurrent in-flight
 *     statements (pgBouncer's transaction-mode budget), a per-statement
 *     `statement_timeout` that begins as soon as the statement gets a
 *     pool slot (Postgres semantics — the timer counts lock-wait), and
 *     a per-relation AccessExclusiveLock.
 *   - Each `FakeDomain` runs a serial DDL chain, but **each statement
 *     takes a fresh pool slot** (matching `PoolAdapter.none()`), so
 *     statements from different domains interleave on the pool exactly
 *     the way they do in production.
 *
 * The tests intentionally drive `MastraCompositeStore` directly so the
 * regression is anchored at the layer that does the fan-out, not at the
 * `@mastra/pg` adapter that merely inherits it. They are framed as
 * **post-fix assertions**: red against the current implementation,
 * green once `#runInit()` no longer broadcasts DDL across the pool.
 */
describe('MastraCompositeStore.init() — parallel DDL fan-out (issue #17679)', () => {
  /**
   * Faithful model of stores/pg's `PoolAdapter.none()`:
   *   - Every statement checks out a fresh pool slot, runs, then
   *     releases. There is NO long-lived per-domain connection.
   *   - `statement_timeout` begins when the slot is acquired (when the
   *     server-side transaction begins) and counts time spent waiting
   *     on an AccessExclusiveLock on the target relation.
   *   - DDL on the same relation is serialized across statements (this
   *     is what `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` do under
   *     the hood in Postgres).
   */
  class FakePool {
    inFlight = 0;
    peakInFlight = 0;
    totalStatements = 0;
    timeouts: { domain: string; statement: string; relation: string }[] = [];
    completedStatements: { domain: string; statement: string; relation: string }[] = [];
    private waitingForSlot: Array<() => void> = [];
    /** Resolves when the current holder of a relation lock releases it. */
    private relationLocks = new Map<string, Promise<void>>();

    constructor(
      readonly maxConcurrent: number,
      readonly statementTimeoutMs: number,
    ) {}

    /**
     * Mirrors a single `pool.query(...)` call: acquire a slot, run one
     * statement against `relation`, release the slot. The domain does
     * NOT hold the slot across statements — each statement in its chain
     * makes its own checkout.
     */
    async runStatement(opts: { domain: string; statement: string; relation: string; workMs: number }): Promise<void> {
      this.totalStatements++;
      await this.acquireSlot();

      // The statement_timeout starts now (this is the realistic
      // Postgres semantics — once the server has accepted the statement,
      // its clock is ticking even while it waits on a relation lock).
      let timedOut = false;
      const deadline = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timedOut = true;
          this.timeouts.push({ domain: opts.domain, statement: opts.statement, relation: opts.relation });
          reject(new Error('canceling statement due to statement timeout'));
        }, this.statementTimeoutMs);
      });

      const work = (async () => {
        const release = await this.acquireRelationLock(opts.relation);
        try {
          await new Promise<void>(resolve => setTimeout(resolve, opts.workMs));
          if (!timedOut) {
            this.completedStatements.push({ domain: opts.domain, statement: opts.statement, relation: opts.relation });
          }
        } finally {
          release();
        }
      })();

      try {
        await Promise.race([work, deadline]);
      } finally {
        this.releaseSlot();
      }
    }

    private acquireSlot(): Promise<void> {
      if (this.inFlight < this.maxConcurrent) {
        this.inFlight++;
        this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
        return Promise.resolve();
      }
      return new Promise(resolve => {
        this.waitingForSlot.push(() => {
          this.inFlight++;
          this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
          resolve();
        });
      });
    }

    private releaseSlot() {
      this.inFlight--;
      const next = this.waitingForSlot.shift();
      if (next) next();
    }

    private async acquireRelationLock(relation: string): Promise<() => void> {
      const prev = this.relationLocks.get(relation);
      let resolveLock!: () => void;
      const lock = new Promise<void>(r => {
        resolveLock = r;
      });
      this.relationLocks.set(relation, lock);
      if (prev) await prev;
      return () => {
        resolveLock();
        if (this.relationLocks.get(relation) === lock) {
          this.relationLocks.delete(relation);
        }
      };
    }
  }

  /**
   * Stand-in for a single PG-backed storage domain. Its `init()` is a
   * SERIAL chain of N statements all targeting the same logical
   * relation — this matches `_ObservabilityPG.init`, which issues
   * createTable + alterTable + ~10 createIndex statements, all on
   * `mastra_ai_spans`. Each `runStatement` checks out its own slot,
   * so the chain naturally interleaves with other domains' statements
   * on the shared pool.
   */
  class FakeDomain {
    initCount = 0;
    constructor(
      readonly name: string,
      readonly pool: FakePool,
      readonly relation: string,
      readonly statementCount: number,
      readonly workMs: number,
    ) {}

    async init(): Promise<void> {
      this.initCount++;
      for (let i = 0; i < this.statementCount; i++) {
        await this.pool.runStatement({
          domain: this.name,
          statement: `stmt-${i}`,
          relation: this.relation,
          workMs: this.workMs,
        });
      }
    }
  }

  /**
   * Wires up FakeDomains as the composite's `stores`. We monkey-patch
   * after construction because the public API takes a single `default`
   * store, but the bug we're chasing is in the path where `this.stores`
   * is populated directly by subclasses like `PostgresStore`.
   */
  function buildComposite(domains: Partial<Record<keyof StorageDomains, FakeDomain>>) {
    const composite = new MastraCompositeStore({ id: 'pg-like' });
    (composite as unknown as { stores: Record<string, FakeDomain> }).stores = domains as Record<string, FakeDomain>;
    return composite;
  }

  it('init() must NOT trigger statement_timeout under a Supabase-shaped pool budget', async () => {
    // Production shape:
    //   - Supabase transaction pooler with a small connection budget.
    //   - statement_timeout starts when the statement gets a backend.
    //   - ObservabilityPG.init runs ~12 statements all targeting
    //     `mastra_ai_spans`. Each is a separate pool checkout via
    //     PoolAdapter.none(), so they contend with each other for the
    //     table's AccessExclusiveLock, AND with the other ~7 domains'
    //     DDL chains that are racing in parallel via Promise.all.
    //
    // BEFORE THE FIX: Promise.all fan-out → observability's later
    //   statements get queued behind an unrelated domain's checkout
    //   while their own relation lock is held by an earlier
    //   observability statement → statement_timeout fires.
    //
    // AFTER THE FIX: init() serializes per-domain DDL so each
    //   observability statement runs to completion before the next one
    //   asks for a slot → no lock-wait → no timeout.
    const pool = new FakePool(/* maxConcurrent */ 4, /* statementTimeoutMs */ 30);

    // Observability mirrors _ObservabilityPG.init: many statements on
    // ONE table. Other domains keep the pool busy so observability's
    // own chain doesn't get back-to-back slots.
    const observability = new FakeDomain('observability', pool, 'mastra_ai_spans', /* statements */ 12, /* workMs */ 12);
    const memory = new FakeDomain('memory', pool, 'mastra_messages', 6, 12);
    const workflows = new FakeDomain('workflows', pool, 'mastra_workflow_snapshot', 6, 12);
    const scores = new FakeDomain('scores', pool, 'mastra_scores', 4, 12);
    const agents = new FakeDomain('agents', pool, 'mastra_agents', 4, 12);
    const notifications = new FakeDomain('notifications', pool, 'mastra_notifications', 4, 12);

    const composite = buildComposite({ observability, memory, workflows, scores, agents, notifications });

    await expect(composite.init()).resolves.toBeUndefined();
    expect(pool.timeouts).toEqual([]);
  });

  it('init() must serialize DDL — peak concurrent in-flight statements stays at 1', async () => {
    // The bug is fundamentally that Promise.all over every domain
    // broadcasts DDL across the pool. The shape of the fix is to
    // serialize that DDL.
    //
    // BEFORE THE FIX: peakInFlight equals the number of domains that
    //   start at once (here, 8), so this assertion fails with 8 vs 1.
    //
    // AFTER THE FIX: only one DDL statement is in flight at a time,
    //   so peakInFlight === 1.
    const pool = new FakePool(/* maxConcurrent */ 100, /* statementTimeoutMs */ 10_000);

    const domains: Partial<Record<keyof StorageDomains, FakeDomain>> = {
      observability: new FakeDomain('observability', pool, 't_obs', 3, 5),
      memory: new FakeDomain('memory', pool, 't_mem', 3, 5),
      workflows: new FakeDomain('workflows', pool, 't_wf', 3, 5),
      scores: new FakeDomain('scores', pool, 't_sc', 3, 5),
      agents: new FakeDomain('agents', pool, 't_ag', 3, 5),
      notifications: new FakeDomain('notifications', pool, 't_no', 3, 5),
      datasets: new FakeDomain('datasets', pool, 't_ds', 3, 5),
      experiments: new FakeDomain('experiments', pool, 't_ex', 3, 5),
    };

    const composite = buildComposite(domains);
    await composite.init();

    expect(pool.peakInFlight).toBe(1);
  });

  it('each domain init() is still invoked exactly once after the fix', async () => {
    // Guards against a fix that accidentally double-inits or skips a
    // domain (e.g. a serialization refactor that breaks dedup, or a
    // single-connection refactor that swallows an awaited promise).
    // This test should be green both before and after the fix — its
    // job is to catch the *wrong* fix, not the bug itself.
    const pool = new FakePool(50, 10_000);
    const observability = new FakeDomain('observability', pool, 't_obs', 1, 1);
    const memory = new FakeDomain('memory', pool, 't_mem', 1, 1);
    const workflows = new FakeDomain('workflows', pool, 't_wf', 1, 1);

    const composite = buildComposite({ observability, memory, workflows });
    await composite.init();

    expect(observability.initCount).toBe(1);
    expect(memory.initCount).toBe(1);
    expect(workflows.initCount).toBe(1);
  });
});

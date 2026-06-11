import { describe, it, expect, vi } from 'vitest';
import { MastraCompositeStore } from './base';
import type { StorageMastraRef } from './base';
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

describe('MastraCompositeStore.close', () => {
  const setParent = (store: MastraCompositeStore, parent: MastraCompositeStore) =>
    ((store as unknown as { parentDefault?: MastraCompositeStore }).parentDefault = parent);

  it('closes the underlying `default` store', async () => {
    const inner = new InMemoryStore({ id: 'close-inner' });
    const innerCloseSpy = vi.spyOn(inner, 'close').mockResolvedValue(undefined);

    const composite = new MastraCompositeStore({ id: 'close-outer', default: inner });

    await composite.close();

    expect(innerCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('closes domain overrides that expose their own close()', async () => {
    // Stands in for e.g. @mastra/duckdb's observability store, which holds
    // its own native connection independent of the `default` store.
    const domainClose = vi.fn().mockResolvedValue(undefined);
    const observability = { close: domainClose } as unknown as NonNullable<
      ConstructorParameters<typeof MastraCompositeStore>[0]['domains']
    >['observability'];

    const composite = new MastraCompositeStore({
      id: 'close-domains',
      default: new InMemoryStore({ id: 'close-domains-inner' }),
      domains: { observability },
    });

    await composite.close();

    expect(domainClose).toHaveBeenCalledTimes(1);
  });

  it('only closes a shared parent once when used as both default and editor', async () => {
    const shared = new InMemoryStore({ id: 'close-shared' });
    const sharedCloseSpy = vi.spyOn(shared, 'close').mockResolvedValue(undefined);

    const composite = new MastraCompositeStore({ id: 'close-outer-shared', default: shared, editor: shared });

    await composite.close();

    expect(sharedCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('traverses through plain composite parents to reach adapters with close()', async () => {
    const adapter = new InMemoryStore({ id: 'close-adapter' });
    const adapterCloseSpy = vi.spyOn(adapter, 'close').mockResolvedValue(undefined);

    const middle = new MastraCompositeStore({ id: 'close-middle', default: adapter });
    const outer = new MastraCompositeStore({ id: 'close-outer-nested', default: middle });

    await outer.close();

    expect(adapterCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('terminates on a parent cycle (A -> B -> A) without stack overflow', async () => {
    const a = new MastraCompositeStore({ id: 'close-a', default: new InMemoryStore({ id: 'close-a-inner' }) });
    const b = new MastraCompositeStore({ id: 'close-b', default: new InMemoryStore({ id: 'close-b-inner' }) });
    setParent(a, b);
    setParent(b, a);

    await expect(a.close()).resolves.toBeUndefined();
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

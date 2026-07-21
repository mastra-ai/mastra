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

describe('MastraCompositeStore — disabled domains (`false` override)', () => {
  it('resolves a `false` domain to undefined instead of falling through to default', async () => {
    const inner = new InMemoryStore({ id: 'inner' });

    const composite = new MastraCompositeStore({
      id: 'outer',
      default: inner,
      domains: { observability: false },
    });

    expect(await composite.getStore('observability')).toBeUndefined();
    // Other domains still fall through to the default store.
    expect(await composite.getStore('memory')).toBe(inner.stores?.memory);
  });

  it('resolves a `false` domain to undefined instead of falling through to editor', async () => {
    const editor = new InMemoryStore({ id: 'editor-inner' });

    const composite = new MastraCompositeStore({
      id: 'outer',
      editor,
      domains: { agents: false },
    });

    expect(await composite.getStore('agents')).toBeUndefined();
    expect(await composite.getStore('skills')).toBe(editor.stores?.skills);
  });

  it('disables threadState via `false` instead of falling back to the in-memory store', async () => {
    const inner = new InMemoryStore({ id: 'inner' });

    const composite = new MastraCompositeStore({
      id: 'outer',
      default: inner,
      domains: { threadState: false },
    });

    expect(await composite.getStore('threadState')).toBeUndefined();
  });

  it('wires the in-memory threadState store when the domain is left unset', async () => {
    const inner = new InMemoryStore({ id: 'inner' });

    const composite = new MastraCompositeStore({
      id: 'outer',
      default: inner,
    });

    expect(await composite.getStore('threadState')).toBeDefined();
  });

  it('does not count `false` overrides as a storage source', () => {
    expect(
      () =>
        new MastraCompositeStore({
          id: 'outer',
          domains: { observability: false },
        }),
    ).toThrow(/requires at least one storage source/);
  });
});

describe('MastraCompositeStore init caching', () => {
  it('retries init after a rejected attempt', async () => {
    const inner = new InMemoryStore({ id: 'retry-inner' });
    const innerInitSpy = vi
      .spyOn(inner, 'init')
      .mockRejectedValueOnce(new Error('transient init failure'))
      .mockResolvedValueOnce(undefined);
    const composite = new MastraCompositeStore({ id: 'retry-outer', default: inner });

    await expect(composite.init()).rejects.toThrow('transient init failure');
    await composite.init();
    await composite.init();

    expect(innerInitSpy).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent failed attempts before allowing a retry', async () => {
    const inner = new InMemoryStore({ id: 'concurrent-retry-inner' });
    const innerInitSpy = vi
      .spyOn(inner, 'init')
      .mockRejectedValueOnce(new Error('shared init failure'))
      .mockResolvedValueOnce(undefined);
    const composite = new MastraCompositeStore({ id: 'concurrent-retry-outer', default: inner });

    const results = await Promise.allSettled([composite.init(), composite.init(), composite.init()]);

    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(innerInitSpy).toHaveBeenCalledTimes(1);

    await composite.init();
    expect(innerInitSpy).toHaveBeenCalledTimes(2);
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

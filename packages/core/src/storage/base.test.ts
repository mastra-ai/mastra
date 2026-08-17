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

describe('MastraCompositeStore — close() forwarding', () => {
  const spyOnLoggerError = (store: MastraCompositeStore) =>
    vi
      .spyOn((store as unknown as { logger: { error: (msg: string, ctx?: unknown) => void } }).logger, 'error')
      .mockImplementation(() => {});

  it('closes the underlying `default` store', async () => {
    // Composing a store must not lose its teardown: Mastra.shutdown() only
    // reaches the composite, so an unforwarded close() leaks the adapter's
    // connection and keeps the process alive.
    const inner = new InMemoryStore({ id: 'inner' });
    const innerCloseSpy = vi.spyOn(inner, 'close');

    const composite = new MastraCompositeStore({ id: 'outer', default: inner });

    await composite.close();

    expect(innerCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('closes the underlying `editor` store', async () => {
    const inner = new InMemoryStore({ id: 'editor-inner' });
    const innerCloseSpy = vi.spyOn(inner, 'close');

    const composite = new MastraCompositeStore({ id: 'outer-editor', editor: inner });

    await composite.close();

    expect(innerCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('closes a shared parent once when used as both default and editor', async () => {
    const shared = new InMemoryStore({ id: 'shared-inner' });
    const sharedCloseSpy = vi.spyOn(shared, 'close');

    const composite = new MastraCompositeStore({ id: 'outer-shared', default: shared, editor: shared });

    await composite.close();

    expect(sharedCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('closes a domain that owns its own handle', async () => {
    // Domains supplied via `domains` are not reachable through a parent, so a
    // domain holding its own client (e.g. one constructed standalone) has to
    // be closed directly.
    const owner = new InMemoryStore({ id: 'domain-owner' });
    const memory = owner.stores!.memory!;
    const domainClose = vi.fn().mockResolvedValue(undefined);
    (memory as unknown as { close: () => Promise<void> }).close = domainClose;

    const composite = new MastraCompositeStore({ id: 'outer-domains', domains: { memory } });

    await composite.close();

    expect(domainClose).toHaveBeenCalledTimes(1);
  });

  it('closes a domain inherited from the default parent once, via the parent', async () => {
    // A parent's domains share the parent's client; the parent's own close()
    // is responsible for them. Closing such a domain directly as well would
    // double-close the shared client.
    const inner = new InMemoryStore({ id: 'inner' });
    const domainClose = vi.fn().mockResolvedValue(undefined);
    (inner.stores!.memory as unknown as { close: () => Promise<void> }).close = domainClose;
    const innerCloseSpy = vi.spyOn(inner, 'close');

    const composite = new MastraCompositeStore({ id: 'outer-inherited', default: inner });

    await composite.close();

    expect(innerCloseSpy).toHaveBeenCalledTimes(1);
    expect(domainClose).toHaveBeenCalledTimes(1);
  });

  it('logs and skips a failing store so the rest are still released', async () => {
    const failing = new InMemoryStore({ id: 'failing-inner' });
    const editor = new InMemoryStore({ id: 'editor-inner' });
    vi.spyOn(failing, 'close').mockRejectedValueOnce(new Error('connection reset'));
    const editorCloseSpy = vi.spyOn(editor, 'close');

    const composite = new MastraCompositeStore({ id: 'outer-failing', default: failing, editor });
    const loggerErrorSpy = spyOnLoggerError(composite);

    await expect(composite.close()).resolves.toBeUndefined();

    expect(editorCloseSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith('close() failed for default storage', expect.anything());
  });
});

describe('MastraCompositeStore — resolve semantics pinning', () => {
  // These tests pin the constructor's per-key resolution behavior BEFORE the
  // resolve block is made data-driven, so any semantic drift in the refactor
  // trips a test instead of shipping silently.

  it('resolves with priority: `domains` override > editor > default', async () => {
    const defaultStore = new InMemoryStore({ id: 'default-inner' });
    const editorStore = new InMemoryStore({ id: 'editor-inner' });
    const overrideOwner = new InMemoryStore({ id: 'override-owner' });
    const memoryOverride = overrideOwner.stores!.memory!;

    const composite = new MastraCompositeStore({
      id: 'outer-priority',
      default: defaultStore,
      editor: editorStore,
      domains: { memory: memoryOverride },
    });

    // Overridden domain resolves to the override, not editor or default.
    expect(await composite.getStore('memory')).toBe(memoryOverride);
    // Editor-list domain (EDITOR_DOMAINS member) without an override resolves
    // to the editor store's domain, not the default's.
    expect(await composite.getStore('skills')).toBe(editorStore.stores!.skills);
    expect(await composite.getStore('skills')).not.toBe(defaultStore.stores!.skills);
    // Plain (non-editor) domain resolves to the default store's domain, even
    // though an editor store is present.
    expect(await composite.getStore('workflows')).toBe(defaultStore.stores!.workflows);
    expect(await composite.getStore('workflows')).not.toBe(editorStore.stores!.workflows);
  });

  it('an override on an editor-list domain beats the editor store', async () => {
    const editorStore = new InMemoryStore({ id: 'editor-inner' });
    const overrideOwner = new InMemoryStore({ id: 'override-owner' });
    const skillsOverride = overrideOwner.stores!.skills!;

    const composite = new MastraCompositeStore({
      id: 'outer-editor-override',
      editor: editorStore,
      domains: { skills: skillsOverride },
    });

    expect(await composite.getStore('skills')).toBe(skillsOverride);
  });

  it('a `false` override disables a plain domain with no fall-through', async () => {
    const defaultStore = new InMemoryStore({ id: 'default-inner' });
    const editorStore = new InMemoryStore({ id: 'editor-inner' });

    const composite = new MastraCompositeStore({
      id: 'outer-false-plain',
      default: defaultStore,
      editor: editorStore,
      domains: { workflows: false },
    });

    expect(await composite.getStore('workflows')).toBeUndefined();
  });

  it('a `false` override disables threadState with no in-memory fallback', async () => {
    const defaultStore = new InMemoryStore({ id: 'default-inner' });

    const composite = new MastraCompositeStore({
      id: 'outer-false-threadstate',
      default: defaultStore,
      domains: { threadState: false },
    });

    expect(await composite.getStore('threadState')).toBeUndefined();
  });

  it('installs the in-memory threadState fallback when no store supplies the domain', async () => {
    const overrideOwner = new InMemoryStore({ id: 'override-owner' });

    const composite = new MastraCompositeStore({
      id: 'outer-threadstate-fallback',
      domains: { memory: overrideOwner.stores!.memory! },
    });

    const threadState = await composite.getStore('threadState');
    expect(threadState).toBeDefined();
    // The fallback is the composite's own in-memory instance, not something
    // inherited from the override owner.
    expect(threadState).not.toBe(overrideOwner.stores!.threadState);
  });
});

describe('MastraCompositeStore — init coverage pinning', () => {
  // These tests pin #runInit's coverage and dedup behavior BEFORE the hand
  // roll call is replaced with iteration.
  type InitCapable = { init: () => Promise<void> };
  const fakeDomain = () => ({ init: vi.fn().mockResolvedValue(undefined) });

  it('init()s every domain supplied via `domains` exactly once', async () => {
    const memory = fakeDomain();
    const workflows = fakeDomain();
    const skills = fakeDomain();

    const composite = new MastraCompositeStore({
      id: 'outer-init-coverage',
      domains: {
        memory: memory as unknown as NonNullable<InMemoryStore['stores']>['memory'],
        workflows: workflows as unknown as NonNullable<InMemoryStore['stores']>['workflows'],
        skills: skills as unknown as NonNullable<InMemoryStore['stores']>['skills'],
      },
    });

    await composite.init();

    expect(memory.init).toHaveBeenCalledTimes(1);
    expect(workflows.init).toHaveBeenCalledTimes(1);
    expect(skills.init).toHaveBeenCalledTimes(1);
  });

  it('init()s a shared domain object supplied under two keys exactly once', async () => {
    const shared = fakeDomain();

    const composite = new MastraCompositeStore({
      id: 'outer-init-shared',
      domains: {
        memory: shared as unknown as NonNullable<InMemoryStore['stores']>['memory'],
        workflows: shared as unknown as NonNullable<InMemoryStore['stores']>['workflows'],
      },
    });

    await composite.init();

    expect(shared.init).toHaveBeenCalledTimes(1);
  });

  it('does not re-init a domain instance the parent default store already owns', async () => {
    // Exercises both dedup paths: the parent's own init() runs, and
    // addParentDomains marks its domain instances so the override pointing at
    // one of them is skipped by the alreadyInitialized set.
    const parent = new InMemoryStore({ id: 'parent-inner' });
    const parentMemory = parent.stores!.memory!;
    const memoryInitSpy = vi.fn().mockResolvedValue(undefined);
    (parentMemory as unknown as InitCapable).init = memoryInitSpy;
    const parentInitSpy = vi.spyOn(parent, 'init');

    const composite = new MastraCompositeStore({
      id: 'outer-init-parent-dedup',
      default: parent,
      domains: { memory: parentMemory },
    });

    await composite.init();

    // The parent's own init() ran once and owns its domains; the composite
    // must not additionally init() the parent-owned domain instance directly.
    expect(parentInitSpy).toHaveBeenCalledTimes(1);
    expect(memoryInitSpy).not.toHaveBeenCalled();
  });

  it('initializes every registered domain, including ones added after this file was written', async () => {
    // Conformance test: a synthetic 24th domain registered in the stores map
    // under a key no hand-written roll call ever named must still be
    // initialized by composite init(). This fails on roll-call code (the
    // domain is silently skipped) and passes on the iteration-based init.
    const memory = fakeDomain();
    const synthetic = fakeDomain();

    const composite = new MastraCompositeStore({
      id: 'outer-init-conformance',
      domains: {
        memory: memory as unknown as NonNullable<InMemoryStore['stores']>['memory'],
      },
    });
    // Register the synthetic domain the way a future StorageDomains member
    // would appear in the stores map, without changing any public API.
    (composite.stores as unknown as Record<string, unknown>).syntheticFutureDomain = synthetic;

    await composite.init();

    expect(memory.init).toHaveBeenCalledTimes(1);
    expect(synthetic.init).toHaveBeenCalledTimes(1);
  });

  it('skips a stores map entry without an init function instead of throwing', async () => {
    // Intentional behavior delta of the iteration-based init: an entry that
    // lacks an init method is skipped, where the old roll call would have
    // thrown a TypeError calling init on it.
    const memory = fakeDomain();

    const composite = new MastraCompositeStore({
      id: 'outer-init-no-init-entry',
      domains: {
        memory: memory as unknown as NonNullable<InMemoryStore['stores']>['memory'],
      },
    });
    (composite.stores as unknown as Record<string, unknown>).entryWithoutInit = {};

    await expect(composite.init()).resolves.not.toThrow();
    expect(memory.init).toHaveBeenCalledTimes(1);
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

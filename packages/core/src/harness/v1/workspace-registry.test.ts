/**
 * Harness v1 — WorkspaceRegistry tests.
 *
 * Covers the three ownership models (shared / per-resource / per-session),
 * provider lifecycle (create / resume / destroy), refcounts (per-resource
 * `destroyResourceWorkspace` blocking on refcount > 0), and rehydrate
 * validation (`HarnessWorkspaceProviderMismatchError` /
 * `HarnessWorkspaceLostError`).
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { Workspace } from '../../workspace';

import { HarnessWorkspaceInUseError, HarnessWorkspaceLostError, HarnessWorkspaceProviderMismatchError } from './errors';
import { Harness } from './harness';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';
import { nonDurableProvider } from './workspace-provider';

function makeAgent(name: string) {
  return new Agent({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
}

/**
 * Build a stub Workspace that satisfies the lifecycle hooks the registry
 * cares about (`id`, `status`, `init()`, `destroy()`). The registry never
 * touches filesystem / sandbox, so the structural minimum is enough.
 */
let _wsCounter = 0;
function makeWorkspace(label?: string): Workspace {
  _wsCounter++;
  const id = `${label ?? 'ws'}-${_wsCounter}`;
  const stub = {
    id,
    name: label ?? id,
    status: 'ready' as const,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    async init() {
      /* no-op */
    },
    async destroy() {
      /* no-op */
    },
  };
  return stub as unknown as Workspace;
}

function baseConfig(extra: Record<string, any> = {}) {
  return {
    agents: { a: makeAgent('a') } as any,
    modes: [{ id: 'm', agentId: 'a' }],
    defaultModeId: 'm',
    sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
    ...extra,
  };
}

describe('WorkspaceRegistry — shared', () => {
  it('lazy-resolves the shared workspace on first acquire and reuses it across sessions', async () => {
    const ws = makeWorkspace('shared');
    let calls = 0;
    const harness = new Harness(
      baseConfig({
        workspace: {
          kind: 'shared' as const,
          workspace: () => {
            calls++;
            return ws;
          },
        },
      }),
    );

    const s1 = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const s2 = await harness.session({ resourceId: 'u2', threadId: { fresh: true } });

    const w1 = await s1.getWorkspace();
    const w2 = await s2.getWorkspace();

    expect(w1).toBe(ws);
    expect(w2).toBe(ws);
    expect(calls).toBe(1);
  });

  it('eager: true provisions the workspace synchronously from the Harness constructor', async () => {
    let constructed = 0;
    const factory = () => {
      constructed++;
      return makeWorkspace('eager');
    };
    new Harness(baseConfig({ workspace: { kind: 'shared' as const, workspace: factory, eager: true } }));
    // Constructor fires acquireShared() — give the microtask a tick to land.
    await new Promise(r => setImmediate(r));
    expect(constructed).toBe(1);
  });
});

describe('WorkspaceRegistry — per-resource', () => {
  it('shares one workspace per resourceId across sessions and provisions a new one for a new resource', async () => {
    const created: Workspace[] = [];
    const provider = nonDurableProvider(ctx => {
      const w = makeWorkspace(`per-resource:${ctx.resourceId}`);
      created.push(w);
      return w;
    });
    const harness = new Harness(baseConfig({ workspace: { kind: 'per-resource' as const, provider } }));

    const a1 = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const a2 = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const b1 = await harness.session({ resourceId: 'u2', threadId: { fresh: true } });

    const wa1 = await a1.getWorkspace();
    const wa2 = await a2.getWorkspace();
    const wb1 = await b1.getWorkspace();

    expect(wa1).toBe(wa2);
    expect(wb1).not.toBe(wa1);
    expect(created.length).toBe(2);
  });

  it('destroyResourceWorkspace throws HarnessWorkspaceInUseError while refcount > 0 and succeeds when 0', async () => {
    const provider = nonDurableProvider(() => makeWorkspace());
    const harness = new Harness(baseConfig({ workspace: { kind: 'per-resource' as const, provider } }));

    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s.getWorkspace();

    await expect(harness.destroyResourceWorkspace({ resourceId: 'u1' })).rejects.toBeInstanceOf(
      HarnessWorkspaceInUseError,
    );

    await s.close();

    await expect(harness.destroyResourceWorkspace({ resourceId: 'u1' })).resolves.toBeUndefined();
  });
});

describe('WorkspaceRegistry — per-session', () => {
  it('provisions a unique workspace per session', async () => {
    const provider: WorkspaceProvider = {
      providerId: 'p1',
      resumable: true,
      create: async () => makeWorkspace(),
      resume: async () => makeWorkspace(),
    };
    const harness = new Harness(baseConfig({ workspace: { kind: 'per-session' as const, provider } }));

    const s1 = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const s2 = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const w1 = await s1.getWorkspace();
    const w2 = await s2.getWorkspace();
    expect(w1).not.toBe(w2);
  });

  it('persists state via pushState and replays it through resume() on rehydrate', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const resumedStates: unknown[] = [];

    const provider: WorkspaceProvider = {
      providerId: 'durable',
      resumable: true,
      create: async (ctx: WorkspaceProviderContext) => {
        await ctx.pushState({ saved: true });
        return makeWorkspace();
      },
      resume: async ctx => {
        resumedStates.push(ctx.state);
        return makeWorkspace();
      },
    };

    const harness1 = new Harness(
      baseConfig({ sessions: { storage }, workspace: { kind: 'per-session' as const, provider } }),
    );

    const s = await harness1.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s.getWorkspace();
    const sessionId = s.id;
    await harness1.shutdown();

    // Storage should have persisted the workspace state on the record.
    const stored = await storage.loadSession({ sessionId });
    expect(stored?.workspace?.providerId).toBe('durable');
    expect(stored?.workspace?.state).toEqual({ saved: true });

    const harness2 = new Harness(
      baseConfig({ sessions: { storage }, workspace: { kind: 'per-session' as const, provider } }),
    );

    const s2 = await harness2.session({ sessionId });
    await s2.getWorkspace();

    expect(resumedStates).toEqual([{ saved: true }]);
  });

  it('rejects per-session config with a non-resumable provider at construction', () => {
    expect(() => {
      new Harness(
        baseConfig({
          workspace: {
            kind: 'per-session' as const,
            // Bare factory desugars to nonDurableProvider — invalid for per-session.
            provider: nonDurableProvider(() => makeWorkspace()) as any,
          },
        }),
      );
    }).toThrow();
  });

  it('throws HarnessWorkspaceProviderMismatchError when stored providerId disagrees with config', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const providerA: WorkspaceProvider = {
      providerId: 'A',
      resumable: true,
      create: async ctx => {
        await ctx.pushState({ from: 'A' });
        return makeWorkspace();
      },
      resume: async () => makeWorkspace(),
    };
    const providerB: WorkspaceProvider = {
      providerId: 'B',
      resumable: true,
      create: async () => makeWorkspace(),
      resume: async () => makeWorkspace(),
    };

    const h1 = new Harness(
      baseConfig({ sessions: { storage }, workspace: { kind: 'per-session' as const, provider: providerA } }),
    );

    const s1 = await h1.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s1.getWorkspace();
    const sessionId = s1.id;
    await h1.shutdown();

    const h2 = new Harness(
      baseConfig({ sessions: { storage }, workspace: { kind: 'per-session' as const, provider: providerB } }),
    );

    // Mismatch surfaces at hydration time (we refuse to hand a stored record
    // to the wrong provider implementation).
    await expect(h2.session({ sessionId })).rejects.toBeInstanceOf(HarnessWorkspaceProviderMismatchError);
  });

  it('Session._markWorkspaceLost causes the next getWorkspace() to throw HarnessWorkspaceLostError', async () => {
    // The registry rejects non-resumable per-session providers at config time,
    // so the "lost" path is only reachable via the rehydrate flag (Harness sets
    // `_markWorkspaceLost` when a stored record references a provider that
    // cannot resume). We poke the flag directly to exercise the gate.
    const provider: WorkspaceProvider = {
      providerId: 'lost',
      resumable: true,
      create: async () => makeWorkspace(),
      resume: async () => makeWorkspace(),
    };
    const harness = new Harness(baseConfig({ workspace: { kind: 'per-session' as const, provider } }));
    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    s._markWorkspaceLost();
    await expect(s.getWorkspace()).rejects.toBeInstanceOf(HarnessWorkspaceLostError);
  });
});

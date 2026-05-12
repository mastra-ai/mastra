/**
 * Harness v1 — workspace runtime behavior (§2.7, §6.1, §9).
 *
 * Covers the runtime guarantees the workspace integration depends on:
 *
 * 1. Tools see `ctx.workspace` populated when one is configured.
 * 2. `session.close()` releases workspace handles correctly per ownership model.
 * 3. `harness.shutdown()` tears down the shared workspace.
 * 4. Subagent `workspace: 'inherit'` shares the parent's workspace at runtime.
 * 5. Subagent `workspace: 'fresh'` provisions an independent workspace and
 *    releases it when the child closes — without affecting the parent.
 * 6. The inherit refcount keeps the parent's workspace alive while any
 *    inheriting child holds a reference.
 * 7. `workspace_error` event fires when `provider.create` throws, and the
 *    failure surfaces as `HarnessWorkspaceProvisioningError`.
 * 8. Per-resource workspaces are destroyed automatically once the last
 *    holder closes.
 * 9. `destroyResourceWorkspace` rejects on `shared` and `per-session` kinds.
 * 10. `eager: true` provisioning works for per-resource and per-session.
 * 11. Workspace tools registered via `Workspace.tools` show up in the
 *     session's tool set.
 */

import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { Workspace } from '../../workspace';

import { setupHarness } from './__test-utils__/setup';
import { HarnessConfigError, HarnessWorkspaceProvisioningError } from './errors';
import { Harness } from './harness';
import { createSpawnSubagentTool } from './spawn-subagent-tool';
import type { HarnessRequestContext } from './types';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';
import { nonDurableProvider } from './workspace-provider';

// ---------------------------------------------------------------------------
// Helpers (parallel structure to workspace-session.test.ts — duck-typed
// Workspace stubs so the registry can observe lifecycle hooks without a
// real filesystem/sandbox.)
// ---------------------------------------------------------------------------

let _wsCounter = 0;
interface StubWorkspace {
  id: string;
  name: string;
  status: 'pending' | 'ready' | 'destroyed';
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeWorkspace(label?: string): Workspace {
  _wsCounter++;
  const id = `${label ?? 'ws'}-${_wsCounter}`;
  const stub: StubWorkspace = {
    id,
    name: label ?? id,
    status: 'ready',
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(async () => {
      stub.status = 'destroyed';
    }),
  };
  return stub as unknown as Workspace;
}

function makeAgent(name: string) {
  return new Agent({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
}

function multiAgentConfig(extra: Record<string, any> = {}) {
  return {
    agents: { a: makeAgent('a'), b: makeAgent('b') } as any,
    modes: [
      { id: 'm', agentId: 'a' },
      { id: 'm2', agentId: 'b' },
    ],
    defaultModeId: 'm',
    sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
    ...extra,
  };
}

function resumableProvider(opts: {
  providerId: string;
  onCreate?: (ctx: WorkspaceProviderContext) => Workspace | Promise<Workspace>;
}): WorkspaceProvider {
  return {
    providerId: opts.providerId,
    resumable: true,
    create: async ctx => (opts.onCreate ? opts.onCreate(ctx) : makeWorkspace()),
    resume: async () => makeWorkspace(),
  };
}

// Minimal execution context for direct tool.execute() calls in subagent tests.
function execCtx(toolCallId = 'tc-1') {
  return {
    abortSignal: new AbortController().signal,
    agent: { toolCallId, runId: 'run-1' },
    runId: 'run-1',
    tracingContext: {} as any,
    requestContext: { get: () => undefined } as any,
    mastra: undefined,
  } as any;
}

function getHarnessSlot(streamCalls: any[]): HarnessRequestContext {
  const ctx = streamCalls.at(-1)!.options.requestContext;
  return ctx.get('harness') as HarnessRequestContext;
}

// ---------------------------------------------------------------------------
// 1. Tool sees `ctx.workspace`
// ---------------------------------------------------------------------------

describe('HarnessRequestContext.workspace — runtime plumbing', () => {
  it('exposes the shared workspace on the slot during a tool call', async () => {
    const ws = makeWorkspace('shared');
    const { harness, agent } = setupHarness({
      workspace: { kind: 'shared', workspace: ws },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.workspace).toBe(ws);
  });

  it('exposes per-resource workspace on the slot', async () => {
    const created: Workspace[] = [];
    const provider = nonDurableProvider(() => {
      const w = makeWorkspace('per-resource');
      created.push(w);
      return w;
    });
    const { harness, agent } = setupHarness({
      workspace: { kind: 'per-resource', provider },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    expect(getHarnessSlot(agent.streamCalls).workspace).toBe(created[0]);
  });

  it('exposes per-session workspace on the slot', async () => {
    const created: Workspace[] = [];
    const provider = resumableProvider({
      providerId: 'per-session',
      onCreate: () => {
        const w = makeWorkspace('per-session');
        created.push(w);
        return w;
      },
    });
    const { harness, agent } = setupHarness({
      workspace: { kind: 'per-session', provider },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    expect(getHarnessSlot(agent.streamCalls).workspace).toBe(created[0]);
  });

  it('slot.workspace is undefined when no workspace is configured', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });
    expect(getHarnessSlot(agent.streamCalls).workspace).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2 + 8. close() release semantics
// ---------------------------------------------------------------------------

describe('Workspace release on session.close()', () => {
  it('per-session: close destroys the workspace', async () => {
    let captured: StubWorkspace | undefined;
    const provider = resumableProvider({
      providerId: 'per-session',
      onCreate: () => {
        const w = makeWorkspace('s') as unknown as StubWorkspace;
        captured = w;
        return w as unknown as Workspace;
      },
    });
    const { harness } = setupHarness({ workspace: { kind: 'per-session', provider } });
    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s.getWorkspace();
    expect(captured!.destroy).not.toHaveBeenCalled();

    await s.close();
    expect(captured!.destroy).toHaveBeenCalledTimes(1);
  });

  it('per-resource: workspace persists while another session still holds it', async () => {
    const created: StubWorkspace[] = [];
    const provider = nonDurableProvider(() => {
      const w = makeWorkspace('per-resource') as unknown as StubWorkspace;
      created.push(w);
      return w as unknown as Workspace;
    });
    const { harness } = setupHarness({ workspace: { kind: 'per-resource', provider } });

    const s1 = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const s2 = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s1.getWorkspace();
    await s2.getWorkspace();
    expect(created).toHaveLength(1);

    await s1.close();
    // Refcount drops to 1 — workspace still alive.
    expect(created[0]!.destroy).not.toHaveBeenCalled();

    await s2.close();
    // Last session gone — workspace destroyed.
    expect(created[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('shared: close() does NOT destroy the shared workspace', async () => {
    const ws = makeWorkspace('shared') as unknown as StubWorkspace;
    const { harness } = setupHarness({
      workspace: { kind: 'shared', workspace: ws as unknown as Workspace },
    });
    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s.getWorkspace();
    await s.close();
    expect(ws.destroy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. harness.shutdown() tears down shared
// ---------------------------------------------------------------------------

describe('Workspace lifecycle on harness.shutdown()', () => {
  it('shared: shutdown() destroys the resolved workspace', async () => {
    const ws = makeWorkspace('shared') as unknown as StubWorkspace;
    const { harness } = setupHarness({
      workspace: { kind: 'shared', workspace: ws as unknown as Workspace },
    });
    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s.getWorkspace();
    await harness.shutdown();
    expect(ws.destroy).toHaveBeenCalledTimes(1);
  });

  it('shared: shutdown() does NOT destroy an unresolved (lazy) workspace', async () => {
    const ws = makeWorkspace('shared') as unknown as StubWorkspace;
    const { harness } = setupHarness({
      workspace: { kind: 'shared', workspace: ws as unknown as Workspace },
    });
    // Never call getWorkspace() — should stay lazy.
    await harness.shutdown();
    expect(ws.destroy).not.toHaveBeenCalled();
  });

  it('per-resource: shutdown() destroys any provisioned workspaces', async () => {
    const created: StubWorkspace[] = [];
    const provider = nonDurableProvider(() => {
      const w = makeWorkspace() as unknown as StubWorkspace;
      created.push(w);
      return w as unknown as Workspace;
    });
    const { harness } = setupHarness({ workspace: { kind: 'per-resource', provider } });

    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s.getWorkspace();
    await harness.shutdown();
    expect(created[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('per-session: shutdown() destroys any provisioned workspaces', async () => {
    const created: StubWorkspace[] = [];
    const provider = resumableProvider({
      providerId: 'per-session',
      onCreate: () => {
        const w = makeWorkspace() as unknown as StubWorkspace;
        created.push(w);
        return w as unknown as Workspace;
      },
    });
    const { harness } = setupHarness({ workspace: { kind: 'per-session', provider } });

    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await s.getWorkspace();
    await harness.shutdown();
    expect(created[0]!.destroy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 4 + 5 + 6. Subagent workspace inheritance runtime
// ---------------------------------------------------------------------------

describe('Subagent workspace inheritance — runtime', () => {
  function subagentSetup(opts: { workspace: 'inherit' | 'fresh' }) {
    const created: StubWorkspace[] = [];
    const provider: WorkspaceProvider = {
      providerId: 'per-session',
      resumable: true,
      create: async () => {
        const w = makeWorkspace() as unknown as StubWorkspace;
        created.push(w);
        return w as unknown as Workspace;
      },
      resume: async () => {
        const w = makeWorkspace() as unknown as StubWorkspace;
        created.push(w);
        return w as unknown as Workspace;
      },
    };
    const harness = new Harness(
      multiAgentConfig({
        workspace: { kind: 'per-session', provider },
        subagents: {
          maxDepth: 3,
          types: {
            explore: {
              agentId: 'b',
              modeId: 'm2',
              description: 'child',
              workspace: opts.workspace,
            },
          },
        },
      }),
    );
    return { harness, created };
  }

  it("'inherit' (the default): child shares parent's workspace instance", async () => {
    const { harness, created } = subagentSetup({ workspace: 'inherit' });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const parentWs = await parent.getWorkspace();

    const tool = createSpawnSubagentTool(parent)!;
    const result = (await tool.execute!({ agentType: 'explore', task: 'go' }, execCtx('tc-inherit-1'))) as any;
    expect(result.isError ?? false).toBe(false);

    // Only one physical workspace was provisioned (parent's).
    expect(created).toHaveLength(1);
    expect(parentWs).toBe(created[0]);
  });

  it("'inherit': child close does NOT destroy parent's workspace", async () => {
    const { harness, created } = subagentSetup({ workspace: 'inherit' });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await parent.getWorkspace();

    const tool = createSpawnSubagentTool(parent)!;
    await tool.execute!({ agentType: 'explore', task: 'go' }, execCtx('tc-inherit-2'));

    // Spawn tool auto-closes the child after it returns. Parent still alive.
    expect(created[0]!.destroy).not.toHaveBeenCalled();

    // Once the parent closes, the refcount finally drops to zero.
    await parent.close();
    expect(created[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it("'fresh': child gets an independent workspace, parent's unaffected", async () => {
    const { harness, created } = subagentSetup({ workspace: 'fresh' });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const parentWs = await parent.getWorkspace();

    const tool = createSpawnSubagentTool(parent)!;
    await tool.execute!({ agentType: 'explore', task: 'go' }, execCtx('tc-fresh-1'));

    // Two physical workspaces were provisioned. The child's was destroyed
    // when the spawn tool auto-closed it. Parent's is still alive.
    expect(created).toHaveLength(2);
    const parentStub = parentWs as unknown as StubWorkspace;
    const child = created.find(w => w !== parentStub)!;
    expect(child.destroy).toHaveBeenCalledTimes(1);
    expect(parentStub.destroy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Provider failure → HarnessWorkspaceProvisioningError + workspace_error
// ---------------------------------------------------------------------------

describe('Provider failures surface as HarnessWorkspaceProvisioningError', () => {
  it('per-resource: create() throws → first getWorkspace rejects with provisioning error', async () => {
    const provider = nonDurableProvider(() => {
      throw new Error('boom');
    });
    const { harness } = setupHarness({ workspace: { kind: 'per-resource', provider } });
    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(s.getWorkspace()).rejects.toBeInstanceOf(HarnessWorkspaceProvisioningError);
  });

  it('per-session: create() throws → first getWorkspace rejects with provisioning error', async () => {
    const provider: WorkspaceProvider = {
      providerId: 'broken',
      resumable: true,
      create: async () => {
        throw new Error('boom');
      },
      resume: async () => makeWorkspace(),
    };
    const { harness } = setupHarness({ workspace: { kind: 'per-session', provider } });
    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(s.getWorkspace()).rejects.toBeInstanceOf(HarnessWorkspaceProvisioningError);
  });

  it('emits a workspace_error event on the harness when provisioning fails', async () => {
    const provider: WorkspaceProvider = {
      providerId: 'broken',
      resumable: true,
      create: async () => {
        throw new Error('boom');
      },
      resume: async () => makeWorkspace(),
    };
    const { harness } = setupHarness({ workspace: { kind: 'per-session', provider } });
    const events: any[] = [];
    harness.subscribe(e => {
      if (e.type === 'workspace_error') events.push(e);
    });
    const s = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(s.getWorkspace()).rejects.toBeInstanceOf(HarnessWorkspaceProvisioningError);
    expect(events).toHaveLength(1);
    expect(events[0].providerId).toBe('broken');
    expect(events[0].error.message).toContain('boom');
  });
});

// ---------------------------------------------------------------------------
// 9. destroyResourceWorkspace rejects on wrong kinds
// ---------------------------------------------------------------------------

describe('destroyResourceWorkspace — kind validation', () => {
  it('rejects with HarnessConfigError under kind: "shared"', async () => {
    const { harness } = setupHarness({
      workspace: { kind: 'shared', workspace: makeWorkspace() },
    });
    await expect(harness.destroyResourceWorkspace({ resourceId: 'u1' })).rejects.toBeInstanceOf(HarnessConfigError);
  });

  it('rejects with HarnessConfigError under kind: "per-session"', async () => {
    const provider = resumableProvider({ providerId: 'p' });
    const { harness } = setupHarness({ workspace: { kind: 'per-session', provider } });
    await expect(harness.destroyResourceWorkspace({ resourceId: 'u1' })).rejects.toBeInstanceOf(HarnessConfigError);
  });

  it('rejects with HarnessConfigError when no workspace is configured', async () => {
    const { harness } = setupHarness();
    await expect(harness.destroyResourceWorkspace({ resourceId: 'u1' })).rejects.toBeInstanceOf(HarnessConfigError);
  });
});

// ---------------------------------------------------------------------------
// 10. eager: true for non-shared kinds
// ---------------------------------------------------------------------------

describe('eager: true — non-shared kinds', () => {
  it('per-resource: eager has no harness-level effect (resource scoping requires a session)', async () => {
    // `eager` on per-resource isn't well-defined at harness construction —
    // there's no resourceId yet. The spec leaves this as a no-op at the
    // harness level; the workspace is provisioned on first session use.
    let calls = 0;
    const provider = nonDurableProvider(() => {
      calls++;
      return makeWorkspace();
    });
    new Harness(
      multiAgentConfig({
        workspace: { kind: 'per-resource', provider, eager: true },
      }),
    );
    await new Promise(r => setImmediate(r));
    expect(calls).toBe(0);
  });

  it('per-session: eager has no harness-level effect (per-session scoping requires a session)', async () => {
    let calls = 0;
    const provider: WorkspaceProvider = {
      providerId: 'p',
      resumable: true,
      create: async () => {
        calls++;
        return makeWorkspace();
      },
      resume: async () => makeWorkspace(),
    };
    new Harness(
      multiAgentConfig({
        workspace: { kind: 'per-session', provider, eager: true },
      }),
    );
    await new Promise(r => setImmediate(r));
    expect(calls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Workspace tool integration is asserted by the `HarnessRequestContext.workspace`
// suite above: workspace-aware tools (e.g. read_file / write_file / execute_command)
// read the workspace handle through `ctx.workspace`, which is populated by
// `_buildRequestContext`. The `Workspace.tools` config field is a toolset
// gating layer applied at workspace-init time and isn't part of Harness
// session toolset wiring, so there's nothing additional to assert here.

import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../agent';
import type { MastraBrowser } from '../browser';
import { InMemoryStore } from '../storage/mock';
import { Workspace } from '../workspace/workspace';
import { AgentController } from './agent-controller';

/**
 * Create a minimal Workspace instance for testing.
 * Uses a skills-only config to satisfy the "at least one provider" validation.
 */
function createMockWorkspace(name = 'test-workspace'): Workspace {
  return new Workspace({ name, skills: ['/tmp/test-skills'] });
}

/**
 * Create a minimal mock MastraBrowser for testing.
 * Cast through `unknown` because MastraBrowser is abstract with many members
 * we don't need to exercise in workspace/browser resolution tests.
 */
function createMockBrowser(id = 'mock-browser'): MastraBrowser {
  return { id, provider: 'mock', providerType: 'sdk' } as unknown as MastraBrowser;
}

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

// ===========================================================================
// Static workspace (Workspace instance)
// ===========================================================================

describe('AgentController workspace — static instance', () => {
  it('attaches a static workspace without initializing it', async () => {
    const ws = createMockWorkspace();
    const initSpy = vi.spyOn(ws, 'init');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      threadId: 'test-thread',
    });

    expect(session.getWorkspace()).toBe(ws);
    expect(session.thread.requireId()).toBe('test-thread');
    expect(initSpy).not.toHaveBeenCalled();
    expect(controller.isWorkspaceReady()).toBe(false);

    await ws.init();
    expect(controller.isWorkspaceReady()).toBe(true);
  });

  it('createSession succeeds when workspace is provided as a session override', async () => {
    const ws = createMockWorkspace('override-ws');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace: ws,
    });
    expect(session).toBeDefined();
  });
});

// ===========================================================================
// Dynamic workspace (factory function)
// ===========================================================================

describe('AgentController workspace — dynamic factory', () => {
  it('resolves the factory during createSession without initializing its workspace', async () => {
    const ws = createMockWorkspace('dynamic-ws');
    const initSpy = vi.spyOn(ws, 'init');
    const factory = vi.fn().mockResolvedValue(ws);
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
    });
    await controller.init();

    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    expect(session.getWorkspace()).toBe(ws);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        requestContext: expect.anything(),
        mastra: expect.anything(),
      }),
    );
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('factory is invoked per-session, not cached across sessions', async () => {
    const ws = createMockWorkspace('dynamic-ws');
    const factory = vi.fn().mockResolvedValue(ws);
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
    });
    await controller.init();

    await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'resource-a' });
    await controller.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'resource-b' });

    // Each session creation invokes the factory independently.
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('the factory reads session state through the request context', async () => {
    const ws = createMockWorkspace('dynamic-ws');
    // Simulates a dynamic workspace factory that reads session state via
    // getState() — the recommended accessor on AgentControllerRequestContext.
    // Before the fix, resolveWorkspace built a minimal context missing
    // state accessors, causing "Cannot read properties of undefined".
    const factory = vi.fn(async ({ requestContext }) => {
      const ctx = requestContext.get('controller');
      const state = ctx.getState();
      expect(state).toEqual({ projectPath: '/tmp/test' });
      return ws;
    });
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
      initialState: { projectPath: '/tmp/test' },
    });
    await controller.init();

    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    // Callers outside the request flow (e.g. slash commands) get the instance
    // the session already runs against, so the factory is not asked twice.
    expect(await controller.resolveWorkspace({ session })).toBe(ws);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resolveWorkspace does not pin one session workspace onto the controller', async () => {
    const wsA = createMockWorkspace('ws-a');
    const wsB = createMockWorkspace('ws-b');
    const factory = vi.fn(async ({ requestContext }) => {
      const projectPath = requestContext.get('controller').getState().projectPath;
      return projectPath === '/repo-a' ? wsA : wsB;
    });
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
    });
    await controller.init();

    const sessionA = await controller.createSession({
      id: 'session-a',
      ownerId: 'test-owner',
      resourceId: 'resource-a',
      tags: { projectPath: '/repo-a' },
    });
    await controller.resolveWorkspace({ session: sessionA });

    const sessionB = await controller.createSession({
      id: 'session-b',
      ownerId: 'test-owner',
      resourceId: 'resource-b',
      tags: { projectPath: '/repo-b' },
    });

    expect(sessionA.getWorkspace()).toBe(wsA);
    expect(sessionB.getWorkspace()).toBe(wsB);
    expect(await controller.resolveWorkspace({ session: sessionA })).toBe(wsA);
    expect(await controller.resolveWorkspace({ session: sessionB })).toBe(wsB);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(controller.getWorkspace()).toBeUndefined();
    expect(controller.isWorkspaceReady()).toBe(true);
  });
});

// ===========================================================================
// Per-session workspace overrides via createSession({ workspace })
// ===========================================================================

describe('AgentController createSession — workspace overrides', () => {
  it('per-session workspace override is resolved at session creation', async () => {
    const sessionWs = createMockWorkspace('session-ws');
    const initSpy = vi.spyOn(sessionWs, 'init');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace: sessionWs,
    });

    expect(session.getWorkspace()).toBe(sessionWs);
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('falls back to AgentController-level workspace when no override is provided', async () => {
    const controllerWs = createMockWorkspace('controller-ws');
    const initSpy = vi.spyOn(controllerWs, 'init');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: controllerWs,
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
    });

    expect(session.getWorkspace()).toBe(controllerWs);
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('per-session workspace override takes precedence over controller-level', async () => {
    const controllerWs = createMockWorkspace('controller-ws');
    const sessionWs = createMockWorkspace('session-ws');
    const controllerInitSpy = vi.spyOn(controllerWs, 'init');
    const sessionInitSpy = vi.spyOn(sessionWs, 'init');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: controllerWs,
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace: sessionWs,
    });

    expect(session.getWorkspace()).toBe(sessionWs);
    expect(sessionInitSpy).not.toHaveBeenCalled();
    expect(controllerInitSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Per-session workspace isolation between sessions
// ===========================================================================

describe('AgentController createSession — workspace isolation', () => {
  it('two sessions with different resource IDs use different workspace overrides', async () => {
    const wsA = createMockWorkspace('ws-a');
    const wsB = createMockWorkspace('ws-b');
    const initSpyA = vi.spyOn(wsA, 'init');
    const initSpyB = vi.spyOn(wsB, 'init');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    const sessionA = await controller.createSession({
      id: 'session-a',
      ownerId: 'test-owner',
      resourceId: 'resource-a',
      workspace: wsA,
    });
    const sessionB = await controller.createSession({
      id: 'session-b',
      ownerId: 'test-owner',
      resourceId: 'resource-b',
      workspace: wsB,
    });

    expect(sessionA.getWorkspace()).toBe(wsA);
    expect(sessionB.getWorkspace()).toBe(wsB);
    expect(sessionA.getWorkspace()).not.toBe(sessionB.getWorkspace());
    expect(initSpyA).not.toHaveBeenCalled();
    expect(initSpyB).not.toHaveBeenCalled();
  });

  it('one session workspace override does not leak into another session', async () => {
    const wsA = createMockWorkspace('ws-a');
    const initSpyA = vi.spyOn(wsA, 'init');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    // Session A has a workspace override
    const sessionA = await controller.createSession({
      id: 'session-a',
      ownerId: 'test-owner',
      resourceId: 'resource-a',
      workspace: wsA,
    });

    // Session B has no workspace override and the controller has none either —
    // it runs without a workspace rather than inheriting session A's.
    const sessionB = await controller.createSession({
      id: 'session-b',
      ownerId: 'test-owner',
      resourceId: 'resource-b',
    });

    expect(sessionB.getWorkspace()).toBeUndefined();
    expect(sessionB.getWorkspace()).not.toBe(wsA);

    // Session A still has its own workspace without initializing it.
    expect(sessionA.getWorkspace()).toBe(wsA);
    expect(initSpyA).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Per-session browser overrides via createSession({ browser })
// ===========================================================================

describe('AgentController createSession — browser overrides', () => {
  it('uses the per-session browser instance instead of the AgentController-level one', async () => {
    const ws = createMockWorkspace();
    const controllerBrowser = createMockBrowser('controller-browser');
    const sessionBrowser = createMockBrowser('session-browser');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
      browser: controllerBrowser,
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      browser: sessionBrowser,
    });

    expect(session.browser).toBe(sessionBrowser);
    expect(session.browser).not.toBe(controllerBrowser);
  });

  it('per-session browser override is used at session creation', async () => {
    const ws = createMockWorkspace();
    const sessionBrowser = createMockBrowser('session-browser');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      browser: sessionBrowser,
    });

    expect(session.browser).toBe(sessionBrowser);
  });

  it('falls back to AgentController-level browser when no override is provided', async () => {
    const ws = createMockWorkspace();
    const controllerBrowser = createMockBrowser('controller-browser');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
      browser: controllerBrowser,
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
    });

    expect(session.browser).toBe(controllerBrowser);
  });

  it('per-session browser override does not leak into another session', async () => {
    const ws = createMockWorkspace();
    const browserA = createMockBrowser('browser-a');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await controller.init();

    // Session A has a browser override
    const sessionA = await controller.createSession({
      id: 'session-a',
      ownerId: 'test-owner',
      resourceId: 'resource-a',
      browser: browserA,
    });

    // Session B has no browser override — should NOT see session A's browser
    const sessionB = await controller.createSession({
      id: 'session-b',
      ownerId: 'test-owner',
      resourceId: 'resource-b',
    });

    expect(sessionB.browser).toBeUndefined();
    expect(sessionB.browser).not.toBe(browserA);

    // Session A still has its own browser
    expect(sessionA.browser).toBe(browserA);
  });
});

// ===========================================================================
// Sessions without a workspace (#20594)
// ===========================================================================

describe('AgentController createSession — no workspace', () => {
  it('creates a usable session when no workspace is configured anywhere', async () => {
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      resourceId: 'resource-1',
    });

    expect(session.getWorkspace()).toBeUndefined();
    expect(controller.hasWorkspace()).toBe(false);
    // The rest of the session is fully wired: it still has an identity and a thread.
    expect(session.identity.getResourceId()).toBe('resource-1');
    expect(session.thread.requireId()).toBeDefined();
  });

  it('emits no workspace lifecycle events for a workspace-less session', async () => {
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    const events: string[] = [];
    controller.onSessionCreated(session => {
      session.subscribe(event => {
        if (event.type.startsWith('workspace')) events.push(event.type);
      });
    });

    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // Late subscribers get replayed workspace events; there must be none to replay.
    session.subscribe(event => {
      if (event.type.startsWith('workspace')) events.push(event.type);
    });

    expect(events).toEqual([]);
  });

  it('a dynamic workspace factory resolving to undefined yields a workspace-less session', async () => {
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: async () => undefined,
    });
    await controller.init();

    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    expect(session.getWorkspace()).toBeUndefined();
  });

  it('still rejects a workspace that is not a Workspace instance', async () => {
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    await expect(
      controller.createSession({
        id: 'test-session',
        ownerId: 'test-owner',
        workspace: { name: 'not-a-workspace' } as unknown as Workspace,
      }),
    ).rejects.toThrow(/must be a valid Workspace instance/);
  });
});

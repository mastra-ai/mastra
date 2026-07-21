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
  it('createSession succeeds with a static workspace and initializes it', async () => {
    const ws = createMockWorkspace();
    const initSpy = vi.spyOn(ws, 'init');
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await controller.init();

    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    expect(session).toBeDefined();
    expect(initSpy).toHaveBeenCalled();
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
  it('factory is called during createSession with requestContext and mastra', async () => {
    const ws = createMockWorkspace('dynamic-ws');
    const factory = vi.fn().mockResolvedValue(ws);
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
    });
    await controller.init();

    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    expect(session).toBeDefined();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        requestContext: expect.anything(),
        mastra: expect.anything(),
      }),
    );
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

  it('createSession throws when factory returns undefined', async () => {
    const nullFactory = vi.fn().mockResolvedValue(undefined);
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: nullFactory,
    });
    await controller.init();

    await expect(controller.createSession({ id: 'test-session', ownerId: 'test-owner' })).rejects.toThrow(
      'A session requires a valid workspace instance.',
    );
  });

  it('resolveWorkspace provides session state to the factory', async () => {
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

    // resolveWorkspace is called outside the request flow (e.g. from slash
    // commands). createSession does not cache the resolved workspace on
    // this.workspace, so this re-invokes the factory with a fresh context.
    const resolved = await controller.resolveWorkspace({ session });
    expect(resolved).toBe(ws);
  });
});

// ===========================================================================
// No workspace configured
// ===========================================================================

describe('AgentController workspace — none configured', () => {
  it('createSession throws when no workspace is configured', async () => {
    const controller = new AgentController({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    await expect(controller.createSession({ id: 'test-session', ownerId: 'test-owner' })).rejects.toThrow(
      'A session requires a valid workspace instance.',
    );
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

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(session).toBeDefined();
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
    initSpy.mockClear();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
    });

    expect(session).toBeDefined();
    // The controller-level workspace is initialized for the session.
    expect(initSpy).toHaveBeenCalled();
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
    controllerInitSpy.mockClear();
    sessionInitSpy.mockClear();

    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace: sessionWs,
    });

    expect(session).toBeDefined();
    // The session-level workspace is initialized, not the controller-level one.
    expect(sessionInitSpy).toHaveBeenCalled();
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
    expect(initSpyA).toHaveBeenCalled();
    expect(initSpyB).toHaveBeenCalled();
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

    // Session B has no workspace override — should throw because no workspace is available
    await expect(
      controller.createSession({
        id: 'session-b',
        ownerId: 'test-owner',
        resourceId: 'resource-b',
      }),
    ).rejects.toThrow('A session requires a valid workspace instance.');

    // Session A still has its own workspace (init was called)
    expect(sessionA).toBeDefined();
    expect(initSpyA).toHaveBeenCalled();
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

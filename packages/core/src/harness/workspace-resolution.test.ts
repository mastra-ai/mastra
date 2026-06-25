import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../agent';
import type { MastraBrowser } from '../browser';
import { InMemoryStore } from '../storage/mock';
import { Workspace } from '../workspace/workspace';
import { Harness } from './harness';

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

describe('Harness workspace — static instance', () => {
  it('createSession succeeds with a static workspace and initializes it', async () => {
    const ws = createMockWorkspace();
    const initSpy = vi.spyOn(ws, 'init');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await harness.init();

    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
    expect(session).toBeDefined();
    expect(initSpy).toHaveBeenCalled();
  });

  it('createSession succeeds when workspace is provided as a session override', async () => {
    const ws = createMockWorkspace('override-ws');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await harness.init();

    const session = await harness.createSession({
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

describe('Harness workspace — dynamic factory', () => {
  it('factory is called during createSession with requestContext and mastra', async () => {
    const ws = createMockWorkspace('dynamic-ws');
    const factory = vi.fn().mockResolvedValue(ws);
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
    });
    await harness.init();

    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
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
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
    });
    await harness.init();

    await harness.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'resource-a' });
    await harness.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'resource-b' });

    // Each session creation invokes the factory independently.
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('createSession throws when factory returns undefined', async () => {
    const nullFactory = vi.fn().mockResolvedValue(undefined);
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: nullFactory,
    });
    await harness.init();

    await expect(harness.createSession({ id: 'test-session', ownerId: 'test-owner' })).rejects.toThrow(
      'A session requires a valid workspace instance.',
    );
  });
});

// ===========================================================================
// No workspace configured
// ===========================================================================

describe('Harness workspace — none configured', () => {
  it('createSession throws when no workspace is configured', async () => {
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await harness.init();

    await expect(harness.createSession({ id: 'test-session', ownerId: 'test-owner' })).rejects.toThrow(
      'A session requires a valid workspace instance.',
    );
  });
});

// ===========================================================================
// Per-session workspace overrides via createSession({ workspace })
// ===========================================================================

describe('Harness createSession — workspace overrides', () => {
  it('per-session workspace override is resolved at session creation', async () => {
    const sessionWs = createMockWorkspace('session-ws');
    const initSpy = vi.spyOn(sessionWs, 'init');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await harness.init();

    const session = await harness.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace: sessionWs,
    });

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(session).toBeDefined();
  });

  it('falls back to Harness-level workspace when no override is provided', async () => {
    const harnessWs = createMockWorkspace('harness-ws');
    const initSpy = vi.spyOn(harnessWs, 'init');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: harnessWs,
    });
    await harness.init();
    initSpy.mockClear();

    const session = await harness.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
    });

    expect(session).toBeDefined();
    // The harness-level workspace is initialized for the session.
    expect(initSpy).toHaveBeenCalled();
  });

  it('per-session workspace override takes precedence over harness-level', async () => {
    const harnessWs = createMockWorkspace('harness-ws');
    const sessionWs = createMockWorkspace('session-ws');
    const harnessInitSpy = vi.spyOn(harnessWs, 'init');
    const sessionInitSpy = vi.spyOn(sessionWs, 'init');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: harnessWs,
    });
    await harness.init();
    harnessInitSpy.mockClear();
    sessionInitSpy.mockClear();

    const session = await harness.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace: sessionWs,
    });

    expect(session).toBeDefined();
    // The session-level workspace is initialized, not the harness-level one.
    expect(sessionInitSpy).toHaveBeenCalled();
    expect(harnessInitSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Per-session workspace isolation between sessions
// ===========================================================================

describe('Harness createSession — workspace isolation', () => {
  it('two sessions with different resource IDs use different workspace overrides', async () => {
    const wsA = createMockWorkspace('ws-a');
    const wsB = createMockWorkspace('ws-b');
    const initSpyA = vi.spyOn(wsA, 'init');
    const initSpyB = vi.spyOn(wsB, 'init');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await harness.init();

    const sessionA = await harness.createSession({
      id: 'session-a',
      ownerId: 'test-owner',
      resourceId: 'resource-a',
      workspace: wsA,
    });
    const sessionB = await harness.createSession({
      id: 'session-b',
      ownerId: 'test-owner',
      resourceId: 'resource-b',
      workspace: wsB,
    });

    expect(sessionA).toBeDefined();
    expect(sessionB).toBeDefined();
    expect(initSpyA).toHaveBeenCalled();
    expect(initSpyB).toHaveBeenCalled();
    expect(wsA).not.toBe(wsB);
  });

  it('one session workspace override does not leak into another session', async () => {
    const wsA = createMockWorkspace('ws-a');
    const initSpyA = vi.spyOn(wsA, 'init');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await harness.init();

    // Session A has a workspace override
    const sessionA = await harness.createSession({
      id: 'session-a',
      ownerId: 'test-owner',
      resourceId: 'resource-a',
      workspace: wsA,
    });

    // Session B has no workspace override — should throw because no workspace is available
    await expect(
      harness.createSession({
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

describe('Harness createSession — browser overrides', () => {
  it('uses the per-session browser instance instead of the Harness-level one', async () => {
    const ws = createMockWorkspace();
    const harnessBrowser = createMockBrowser('harness-browser');
    const sessionBrowser = createMockBrowser('session-browser');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
      browser: harnessBrowser,
    });
    await harness.init();

    const session = await harness.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      browser: sessionBrowser,
    });

    expect(session.browser).toBe(sessionBrowser);
    expect(session.browser).not.toBe(harnessBrowser);
  });

  it('per-session browser override is used at session creation', async () => {
    const ws = createMockWorkspace();
    const sessionBrowser = createMockBrowser('session-browser');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await harness.init();

    const session = await harness.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      browser: sessionBrowser,
    });

    expect(session.browser).toBe(sessionBrowser);
  });

  it('falls back to Harness-level browser when no override is provided', async () => {
    const ws = createMockWorkspace();
    const harnessBrowser = createMockBrowser('harness-browser');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
      browser: harnessBrowser,
    });
    await harness.init();

    const session = await harness.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
    });

    expect(session.browser).toBe(harnessBrowser);
  });

  it('per-session browser override does not leak into another session', async () => {
    const ws = createMockWorkspace();
    const browserA = createMockBrowser('browser-a');
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await harness.init();

    // Session A has a browser override
    const sessionA = await harness.createSession({
      id: 'session-a',
      ownerId: 'test-owner',
      resourceId: 'resource-a',
      browser: browserA,
    });

    // Session B has no browser override — should NOT see session A's browser
    const sessionB = await harness.createSession({
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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Workspace } from '../workspace/workspace';
import { Harness } from './harness';
import type { Session } from './session';

/**
 * Create a minimal Workspace instance for testing.
 * Uses a skills-only config to satisfy the "at least one provider" validation.
 */
function createMockWorkspace(name = 'test-workspace'): Workspace {
  return new Workspace({ name, skills: ['/tmp/test-skills'] });
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
  it('getWorkspace() returns the workspace immediately', () => {
    const ws = createMockWorkspace();
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });

    expect(harness.getWorkspace()).toBe(ws);
  });

  it('hasWorkspace() returns true', () => {
    const ws = createMockWorkspace();
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });

    expect(harness.hasWorkspace()).toBe(true);
  });

  it('resolveWorkspace() returns the existing workspace without calling workspaceFn', async () => {
    const ws = createMockWorkspace();
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: ws,
    });
    await harness.init();
    const session = await harness.createSession();

    const resolved = await harness.resolveWorkspace({ session });
    expect(resolved).toBe(ws);
  });
});

// ===========================================================================
// Dynamic workspace (factory function)
// ===========================================================================

describe('Harness workspace — dynamic factory', () => {
  let ws: Workspace;
  let workspaceFn: ReturnType<typeof vi.fn>;
  let harness: Harness;

  beforeEach(async () => {
    ws = createMockWorkspace('dynamic-ws');
    workspaceFn = vi.fn().mockResolvedValue(ws);
    harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: workspaceFn,
    });
    await harness.init();
  });

  it('getWorkspace() returns undefined before resolution', () => {
    // No session created yet, so the dynamic workspace has not been resolved.
    expect(harness.getWorkspace()).toBeUndefined();
  });

  it('hasWorkspace() returns true (factory is configured)', () => {
    expect(harness.hasWorkspace()).toBe(true);
  });

  it('resolveWorkspace() invokes the factory and caches the result', async () => {
    const session = await harness.createSession();
    // createSession resolves the workspace once; the explicit resolve below
    // should hit the cache rather than re-invoking the factory.
    workspaceFn.mockClear();

    const resolved = await harness.resolveWorkspace({ session });

    expect(resolved).toBe(ws);
    expect(workspaceFn).not.toHaveBeenCalled();
    // getWorkspace() returns the cached value
    expect(harness.getWorkspace()).toBe(ws);
  });

  it('resolveWorkspace() returns cached workspace without re-invoking factory', async () => {
    const session = await harness.createSession();
    workspaceFn.mockClear();

    await harness.resolveWorkspace({ session });
    const resolved2 = await harness.resolveWorkspace({ session });

    expect(resolved2).toBe(ws);
    // Factory not called again — the workspace was cached at createSession time.
    expect(workspaceFn).not.toHaveBeenCalled();
  });

  it('resolveWorkspace() returns undefined when factory returns undefined', async () => {
    const nullFactory = vi.fn().mockResolvedValue(undefined);
    const h = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: nullFactory,
    });
    await h.init();
    const session = await h.createSession();

    const resolved = await h.resolveWorkspace({ session });
    expect(resolved).toBeUndefined();
  });
});

// ===========================================================================
// No workspace configured
// ===========================================================================

describe('Harness workspace — none configured', () => {
  let harness: Harness;
  let session: Session;

  beforeEach(async () => {
    harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await harness.init();
    session = await harness.createSession();
  });

  it('getWorkspace() returns undefined', () => {
    expect(harness.getWorkspace()).toBeUndefined();
  });

  it('hasWorkspace() returns false', () => {
    expect(harness.hasWorkspace()).toBe(false);
  });

  it('resolveWorkspace() returns undefined', async () => {
    const resolved = await harness.resolveWorkspace({ session });
    expect(resolved).toBeUndefined();
  });
});

// ===========================================================================
// buildRequestContext caches workspace
// ===========================================================================

describe('buildRequestContext caches dynamic workspace', () => {
  it('getWorkspace() returns the resolved workspace after buildRequestContext runs', async () => {
    const ws = createMockWorkspace('ctx-ws');
    const factory = vi.fn().mockResolvedValue(ws);
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: factory,
    });

    // Before — workspace is not resolved
    expect(harness.getWorkspace()).toBeUndefined();

    await harness.init();
    const session = await harness.createSession();
    // Trigger buildRequestContext indirectly via resolveWorkspace
    await harness.resolveWorkspace({ session });

    // After — workspace is cached
    expect(harness.getWorkspace()).toBe(ws);
  });
});

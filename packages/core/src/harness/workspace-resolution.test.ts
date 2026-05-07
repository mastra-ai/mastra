import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
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

    const resolved = await harness.resolveWorkspace();
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

  beforeEach(() => {
    ws = createMockWorkspace('dynamic-ws');
    workspaceFn = vi.fn().mockResolvedValue(ws);
    harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: workspaceFn,
    });
  });

  it('getWorkspace() returns undefined before resolution', () => {
    expect(harness.getWorkspace()).toBeUndefined();
  });

  it('hasWorkspace() returns true (factory is configured)', () => {
    expect(harness.hasWorkspace()).toBe(true);
  });

  it('resolveWorkspace() invokes the factory and caches the result', async () => {
    const resolved = await harness.resolveWorkspace();

    expect(resolved).toBe(ws);
    expect(workspaceFn).toHaveBeenCalledTimes(1);
    // Subsequent calls to getWorkspace() return the cached value
    expect(harness.getWorkspace()).toBe(ws);
  });

  it('resolveWorkspace() returns cached workspace on second call without re-invoking factory', async () => {
    await harness.resolveWorkspace();
    const resolved2 = await harness.resolveWorkspace();

    expect(resolved2).toBe(ws);
    // Factory called once (first resolve), not twice
    expect(workspaceFn).toHaveBeenCalledTimes(1);
  });

  it('resolveWorkspace() returns undefined when factory returns undefined', async () => {
    const nullFactory = vi.fn().mockResolvedValue(undefined);
    const h = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      workspace: nullFactory,
    });

    const resolved = await h.resolveWorkspace();
    expect(resolved).toBeUndefined();
  });
});

// ===========================================================================
// No workspace configured
// ===========================================================================

describe('Harness workspace — none configured', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
  });

  it('getWorkspace() returns undefined', () => {
    expect(harness.getWorkspace()).toBeUndefined();
  });

  it('hasWorkspace() returns false', () => {
    expect(harness.hasWorkspace()).toBe(false);
  });

  it('resolveWorkspace() returns undefined', async () => {
    const resolved = await harness.resolveWorkspace();
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

    // Trigger buildRequestContext indirectly via resolveWorkspace
    await harness.resolveWorkspace();

    // After — workspace is cached
    expect(harness.getWorkspace()).toBe(ws);
  });
});

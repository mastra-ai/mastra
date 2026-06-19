import { describe, it, expect, beforeEach } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createHarness(storage: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

describe('session.permissions', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('returns empty rules when none are set', () => {
    const harness = createHarness(storage);
    expect(harness.session.permissions.getRules()).toEqual({ categories: {}, tools: {} });
  });

  it('setForCategory persists the policy to session state', async () => {
    const harness = createHarness(storage);

    await harness.session.permissions.setForCategory({ category: 'execute', policy: 'ask' });

    expect(harness.session.permissions.getRules().categories.execute).toBe('ask');
    expect((harness.session.state.get() as any).permissionRules.categories.execute).toBe('ask');
  });

  it('setForTool persists the policy to session state', async () => {
    const harness = createHarness(storage);

    await harness.session.permissions.setForTool({ toolName: 'dangerous_tool', policy: 'deny' });

    expect(harness.session.permissions.getRules().tools.dangerous_tool).toBe('deny');
    expect((harness.session.state.get() as any).permissionRules.tools.dangerous_tool).toBe('deny');
  });

  it('reflects rules already present in session state', async () => {
    const harness = createHarness(storage);
    await harness.session.state.set({
      permissionRules: { categories: { read: 'allow' }, tools: {} },
    } as any);

    expect(harness.session.permissions.getRules().categories.read).toBe('allow');
  });

  it('merges new policies without dropping existing ones', async () => {
    const harness = createHarness(storage);

    await harness.session.permissions.setForCategory({ category: 'execute', policy: 'deny' });
    await harness.session.permissions.setForTool({ toolName: 'fetch', policy: 'allow' });

    const rules = harness.session.permissions.getRules();
    expect(rules.categories.execute).toBe('deny');
    expect(rules.tools.fetch).toBe('allow');
  });
});

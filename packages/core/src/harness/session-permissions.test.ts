import { describe, it, expect, beforeEach } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

async function createSession(storage: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const harness = new Harness({
    id: 'test-harness',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await harness.init();
  const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { harness, session };
}

describe('session.permissions', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('returns empty rules when none are set', async () => {
    const { session } = await createSession(storage);
    expect(session.permissions.getRules()).toEqual({ categories: {}, tools: {} });
  });

  it('setForCategory persists the policy to session state', async () => {
    const { session } = await createSession(storage);

    await session.permissions.setForCategory({ category: 'execute', policy: 'ask' });

    expect(session.permissions.getRules().categories.execute).toBe('ask');
    expect((session.state.get() as any).permissionRules.categories.execute).toBe('ask');
  });

  it('setForTool persists the policy to session state', async () => {
    const { session } = await createSession(storage);

    await session.permissions.setForTool({ toolName: 'dangerous_tool', policy: 'deny' });

    expect(session.permissions.getRules().tools.dangerous_tool).toBe('deny');
    expect((session.state.get() as any).permissionRules.tools.dangerous_tool).toBe('deny');
  });

  it('reflects rules already present in session state', async () => {
    const { session } = await createSession(storage);
    await session.state.set({
      permissionRules: { categories: { read: 'allow' }, tools: {} },
    } as any);

    expect(session.permissions.getRules().categories.read).toBe('allow');
  });

  it('merges new policies without dropping existing ones', async () => {
    const { session } = await createSession(storage);

    await session.permissions.setForCategory({ category: 'execute', policy: 'deny' });
    await session.permissions.setForTool({ toolName: 'fetch', policy: 'allow' });

    const rules = session.permissions.getRules();
    expect(rules.categories.execute).toBe('deny');
    expect(rules.tools.fetch).toBe('allow');
  });
});

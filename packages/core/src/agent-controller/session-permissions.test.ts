import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

async function createSession(storage: InMemoryStore, stateSchema?: z.ZodType) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    ...(stateSchema ? { stateSchema } : {}),
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
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

  it('keeps every concurrent policy change', async () => {
    const { session } = await createSession(storage);
    await session.permissions.setForCategory({ category: 'execute', policy: 'allow' });

    await Promise.all([
      session.permissions.setForCategory({ category: 'execute', policy: 'deny' }),
      session.permissions.setForCategory({ category: 'read', policy: 'deny' }),
      session.permissions.setForTool({ toolName: 'fetch', policy: 'ask' }),
    ]);

    expect(session.permissions.getRules()).toEqual({
      categories: { execute: 'deny', read: 'deny' },
      tools: { fetch: 'ask' },
    });
  });

  it('leaves the rules unchanged when the state schema rejects an update', async () => {
    const askOrDeny = z.record(z.string(), z.enum(['ask', 'deny'])).default({});
    const { session } = await createSession(
      storage,
      z.looseObject({
        permissionRules: z.object({ categories: askOrDeny, tools: askOrDeny }).default({ categories: {}, tools: {} }),
      }),
    );
    await session.permissions.setForTool({ toolName: 'fetch', policy: 'deny' });

    await expect(session.permissions.setForCategory({ category: 'execute', policy: 'allow' })).rejects.toThrow(
      'Invalid state update',
    );
    await expect(session.permissions.setForTool({ toolName: 'fetch', policy: 'allow' })).rejects.toThrow(
      'Invalid state update',
    );

    expect(session.permissions.getRules()).toEqual({ categories: {}, tools: { fetch: 'deny' } });
    expect(session.resolveToolApproval('fetch')).toBe('deny');
  });
});

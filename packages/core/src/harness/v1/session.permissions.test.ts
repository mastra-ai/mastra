import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { HarnessConfigError, HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';
import type { ToolCategory } from './shared';

class FakeAgent extends Agent<any, any, any> {
  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }
}

function setup(opts?: { toolCategoryResolver?: (toolName: string) => ToolCategory | null | undefined }) {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
    ...(opts?.toolCategoryResolver ? { toolCategoryResolver: opts.toolCategoryResolver } : {}),
  });
  return { harness, storage };
}

async function openSession() {
  const { harness, storage } = setup();
  const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
  return { harness, storage, session };
}

function collectEvents(session: Awaited<ReturnType<typeof openSession>>['session']) {
  const events: HarnessEvent[] = [];
  session.subscribe(event => {
    events.push(event);
  });
  return events;
}

describe('Session.permissions', () => {
  it('persists category grants and emits permission_granted once', async () => {
    const { session } = await openSession();
    const events = collectEvents(session);

    await session.permissions.grantCategory({ category: 'read' });
    await session.permissions.grantCategory({ category: 'read' });

    expect(session.permissions.getGrants().categories).toEqual(['read']);
    expect(events.filter(event => event.type === 'permission_granted')).toEqual([
      expect.objectContaining({ type: 'permission_granted', category: 'read' }),
    ]);
  });

  it('revokes category grants idempotently', async () => {
    const { session } = await openSession();
    await session.permissions.grantCategory({ category: 'execute' });
    const events = collectEvents(session);

    await session.permissions.revokeCategory({ category: 'execute' });
    await session.permissions.revokeCategory({ category: 'execute' });

    expect(session.permissions.getGrants().categories).toEqual([]);
    expect(events.filter(event => event.type === 'permission_revoked')).toEqual([
      expect.objectContaining({ type: 'permission_revoked', category: 'execute' }),
    ]);
  });

  it('persists tool grants independently from category grants', async () => {
    const { session } = await openSession();
    const events = collectEvents(session);

    await session.permissions.grantTool({ toolName: 'fs.write' });
    await session.permissions.grantTool({ toolName: 'shell' });

    expect(session.permissions.getGrants()).toEqual({ categories: [], tools: ['fs.write', 'shell'] });
    expect(events.filter(event => event.type === 'permission_granted')).toEqual([
      expect.objectContaining({ type: 'permission_granted', toolName: 'fs.write' }),
      expect.objectContaining({ type: 'permission_granted', toolName: 'shell' }),
    ]);
  });

  it('revokes tool grants idempotently', async () => {
    const { session } = await openSession();
    await session.permissions.grantTool({ toolName: 'shell' });
    const events = collectEvents(session);

    await session.permissions.revokeTool({ toolName: 'shell' });
    await session.permissions.revokeTool({ toolName: 'shell' });

    expect(session.permissions.getGrants().tools).toEqual([]);
    expect(events.filter(event => event.type === 'permission_revoked')).toEqual([
      expect.objectContaining({ type: 'permission_revoked', toolName: 'shell' }),
    ]);
  });

  it('sets category and tool policies with previous values', async () => {
    const { session } = await openSession();
    const events = collectEvents(session);

    await session.permissions.setPolicy({ category: 'edit', policy: 'ask' });
    await session.permissions.setPolicy({ category: 'edit', policy: 'deny' });
    await session.permissions.setPolicy({ toolName: 'shell.echo', policy: 'allow' });

    expect(session.permissions.getRules()).toEqual({
      categories: { edit: 'deny' },
      tools: { 'shell.echo': 'allow' },
    });
    expect(events.filter(event => event.type === 'permission_policy_changed')).toEqual([
      expect.objectContaining({ category: 'edit', oldPolicy: null, newPolicy: 'ask' }),
      expect.objectContaining({ category: 'edit', oldPolicy: 'ask', newPolicy: 'deny' }),
      expect.objectContaining({ toolName: 'shell.echo', oldPolicy: null, newPolicy: 'allow' }),
    ]);
  });

  it('does not emit when setting an existing policy to the same value', async () => {
    const { session } = await openSession();
    await session.permissions.setPolicy({ category: 'read', policy: 'allow' });
    const events = collectEvents(session);

    await session.permissions.setPolicy({ category: 'read', policy: 'allow' });

    expect(events.filter(event => event.type === 'permission_policy_changed')).toHaveLength(0);
  });

  it('returns defensive frozen snapshots', async () => {
    const { session } = await openSession();
    await session.permissions.grantCategory({ category: 'read' });
    await session.permissions.setPolicy({ category: 'edit', policy: 'deny' });

    const grants = session.permissions.getGrants();
    const rules = session.permissions.getRules();

    expect(Object.isFrozen(grants)).toBe(true);
    expect(Object.isFrozen(rules)).toBe(true);

    await session.permissions.grantCategory({ category: 'execute' });
    expect(grants.categories).toEqual(['read']);
    expect(session.permissions.getGrants().categories).toEqual(['read', 'execute']);
  });

  it('writes grants and rules to the SessionRecord', async () => {
    const { storage, session } = await openSession();

    await session.permissions.grantCategory({ category: 'read' });
    await session.permissions.grantTool({ toolName: 'shell' });
    await session.permissions.setPolicy({ category: 'execute', policy: 'deny' });
    await session.permissions.setPolicy({ toolName: 'fs.write', policy: 'allow' });

    const persisted = await storage.loadSession({ sessionId: session.id });
    expect(persisted?.sessionGrants).toEqual({ categories: ['read'], tools: ['shell'] });
    expect(persisted?.permissionRules).toEqual({
      categories: { execute: 'deny' },
      tools: { 'fs.write': 'allow' },
    });
  });

  it('validates categories, tool names, policies, and policy target shape', async () => {
    const { session } = await openSession();

    await expect(session.permissions.grantCategory({ category: 'nope' as ToolCategory })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
    await expect(session.permissions.grantTool({ toolName: '' })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.permissions.setPolicy({ category: 'read', policy: 'maybe' as any })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
    await expect(
      // @ts-expect-error runtime validation still protects wire callers.
      session.permissions.setPolicy({ category: 'read', toolName: 'shell', policy: 'allow' }),
    ).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Harness permission configuration', () => {
  it('returns configured tool categories', () => {
    const { harness } = setup({
      toolCategoryResolver: name => (name === 'shell' ? 'execute' : name === 'fs.read' ? 'read' : null),
    });

    expect(harness.getToolCategory({ toolName: 'shell' })).toBe('execute');
    expect(harness.getToolCategory({ toolName: 'fs.read' })).toBe('read');
    expect(harness.getToolCategory({ toolName: 'unknown' })).toBeNull();
  });

  it('rejects invalid permission config', () => {
    expect(
      () =>
        new Harness({
          agents: {} as any,
          modes: [],
          defaultPermissionPolicy: 'maybe' as any,
        }),
    ).toThrow(HarnessConfigError);
    expect(
      () =>
        new Harness({
          agents: {} as any,
          modes: [],
          toolCategoryResolver: 'not-a-function' as any,
        }),
    ).toThrow(HarnessConfigError);
  });
});

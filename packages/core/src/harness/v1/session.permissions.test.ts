/**
 * Permission gate surface (§4.2e).
 *
 * Covers the 7 Session methods (grantCategory / grantTool / revokeCategory /
 * revokeTool / getGrants / getRules / setPolicy) + the harness-level
 * `getToolCategory` accessor + emitted events + persistence.
 */

import { describe, expect, it } from 'vitest';

import { setupHarness } from './__test-utils__';
import { HarnessValidationError, HarnessConfigError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';
import type { ToolCategory } from './types';

async function openSession() {
  const { harness } = setupHarness();
  const session = await harness.session({ resourceId: 'user-1', threadId: { fresh: true } });
  return { harness, session };
}

function collectEvents(session: Awaited<ReturnType<typeof openSession>>['session']) {
  const events: HarnessEvent[] = [];
  session.subscribe(e => {
    events.push(e);
  });
  return events;
}

describe('Session permissions (§4.2e)', () => {
  describe('grantCategory / revokeCategory', () => {
    it('persists category grants and emits permission_granted exactly once', async () => {
      const { session } = await openSession();
      const events = collectEvents(session);

      await session.permissions.grantCategory({ category: 'read' });
      expect(session.permissions.getGrants().categories).toEqual(['read']);

      // Second call is a no-op: no extra storage write, no extra event.
      await session.permissions.grantCategory({ category: 'read' });
      expect(session.permissions.getGrants().categories).toEqual(['read']);

      const granted = events.filter(e => e.type === 'permission_granted');
      expect(granted).toHaveLength(1);
      expect(granted[0]).toMatchObject({ type: 'permission_granted', category: 'read' });
    });

    it('revokes a previously granted category and emits permission_revoked', async () => {
      const { session } = await openSession();
      await session.permissions.grantCategory({ category: 'execute' });
      const events = collectEvents(session);

      await session.permissions.revokeCategory({ category: 'execute' });
      expect(session.permissions.getGrants().categories).toEqual([]);

      // No-op when not granted.
      await session.permissions.revokeCategory({ category: 'execute' });
      const revoked = events.filter(e => e.type === 'permission_revoked');
      expect(revoked).toHaveLength(1);
      expect(revoked[0]).toMatchObject({ type: 'permission_revoked', category: 'execute' });
    });

    it('rejects unknown ToolCategory values', async () => {
      const { session } = await openSession();
      await expect(session.permissions.grantCategory({ category: 'nope' as ToolCategory })).rejects.toBeInstanceOf(
        HarnessValidationError,
      );
      await expect(session.permissions.revokeCategory({ category: 'nope' as ToolCategory })).rejects.toBeInstanceOf(
        HarnessValidationError,
      );
    });
  });

  describe('grantTool / revokeTool', () => {
    it('persists tool grants independently from category grants', async () => {
      const { session } = await openSession();
      const events = collectEvents(session);

      await session.permissions.grantTool({ toolName: 'fs.write' });
      await session.permissions.grantTool({ toolName: 'shell' });
      expect(session.permissions.getGrants().tools).toEqual(['fs.write', 'shell']);
      expect(session.permissions.getGrants().categories).toEqual([]);

      const granted = events.filter(e => e.type === 'permission_granted');
      expect(granted.map(e => (e as any).toolName)).toEqual(['fs.write', 'shell']);
    });

    it('revokeTool is idempotent', async () => {
      const { session } = await openSession();
      await session.permissions.grantTool({ toolName: 'shell' });
      const events = collectEvents(session);

      await session.permissions.revokeTool({ toolName: 'shell' });
      await session.permissions.revokeTool({ toolName: 'shell' });

      expect(session.permissions.getGrants().tools).toEqual([]);
      const revoked = events.filter(e => e.type === 'permission_revoked');
      expect(revoked).toHaveLength(1);
    });

    it('rejects empty tool names', async () => {
      const { session } = await openSession();
      await expect(session.permissions.grantTool({ toolName: '' })).rejects.toBeInstanceOf(HarnessValidationError);
      await expect(session.permissions.revokeTool({ toolName: '' })).rejects.toBeInstanceOf(HarnessValidationError);
    });
  });

  describe('setPolicy', () => {
    it('writes a per-category rule and emits policy change with previous value', async () => {
      const { session } = await openSession();
      const events = collectEvents(session);

      await session.permissions.setPolicy({ category: 'edit', policy: 'ask' });
      await session.permissions.setPolicy({ category: 'edit', policy: 'deny' });

      expect(session.permissions.getRules().categories).toEqual({ edit: 'deny' });

      const changes = events.filter(e => e.type === 'permission_policy_changed');
      expect(changes).toHaveLength(2);
      expect(changes[0]).toMatchObject({ category: 'edit', oldPolicy: undefined, newPolicy: 'ask' });
      expect(changes[1]).toMatchObject({ category: 'edit', oldPolicy: 'ask', newPolicy: 'deny' });
    });

    it('writes a per-tool rule that lives alongside category rules', async () => {
      const { session } = await openSession();
      await session.permissions.setPolicy({ category: 'execute', policy: 'deny' });
      await session.permissions.setPolicy({ toolName: 'shell.echo', policy: 'allow' });

      const rules = session.permissions.getRules();
      expect(rules.categories).toEqual({ execute: 'deny' });
      expect(rules.tools).toEqual({ 'shell.echo': 'allow' });
    });

    it('is a no-op when the policy matches the existing rule', async () => {
      const { session } = await openSession();
      await session.permissions.setPolicy({ category: 'read', policy: 'allow' });
      const events = collectEvents(session);

      await session.permissions.setPolicy({ category: 'read', policy: 'allow' });
      expect(events.filter(e => e.type === 'permission_policy_changed')).toHaveLength(0);
    });

    it('rejects calls that set both or neither of category/toolName', async () => {
      const { session } = await openSession();
      await expect(
        // @ts-expect-error — union forbids passing both at compile time, runtime gate still enforces it.
        session.permissions.setPolicy({ category: 'read', toolName: 'shell', policy: 'allow' }),
      ).rejects.toBeInstanceOf(HarnessValidationError);
      await expect(
        // @ts-expect-error — union forbids passing neither at compile time.
        session.permissions.setPolicy({ policy: 'allow' }),
      ).rejects.toBeInstanceOf(HarnessValidationError);
    });

    it('rejects unknown policy values', async () => {
      const { session } = await openSession();
      await expect(session.permissions.setPolicy({ category: 'read', policy: 'maybe' as any })).rejects.toBeInstanceOf(
        HarnessValidationError,
      );
    });
  });

  describe('snapshots are frozen', () => {
    it('getGrants and getRules return frozen views that reject mutation', async () => {
      const { session } = await openSession();
      await session.permissions.grantCategory({ category: 'read' });
      await session.permissions.setPolicy({ category: 'edit', policy: 'deny' });

      const grants = session.permissions.getGrants();
      const rules = session.permissions.getRules();

      expect(Object.isFrozen(grants)).toBe(true);
      expect(Object.isFrozen(rules)).toBe(true);

      // Returned snapshots are defensive copies of the underlying arrays/maps:
      // a subsequent mutator on the session must not mutate prior snapshots.
      await session.permissions.grantCategory({ category: 'execute' });
      expect(grants.categories).toEqual(['read']);

      const grantsAfter = session.permissions.getGrants();
      expect(grantsAfter.categories).toEqual(['read', 'execute']);
    });
  });

  describe('persistence', () => {
    it('writes are durable on the underlying SessionRecord', async () => {
      const { harness, storage } = setupHarness();
      const session = await harness.session({ resourceId: 'user-1', threadId: { fresh: true } });
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
  });
});

describe('Harness.getToolCategory (§4.2e)', () => {
  it('returns null when no resolver is configured', () => {
    const { harness } = setupHarness();
    expect(harness.getToolCategory({ toolName: 'shell' })).toBeNull();
  });

  it('returns the resolver result for known tools and null for unknown', () => {
    const { harness } = setupHarness({
      toolCategoryResolver: name => (name === 'shell' ? 'execute' : name === 'fs.read' ? 'read' : null),
    });
    expect(harness.getToolCategory({ toolName: 'shell' })).toBe('execute');
    expect(harness.getToolCategory({ toolName: 'fs.read' })).toBe('read');
    expect(harness.getToolCategory({ toolName: 'mystery' })).toBeNull();
  });

  it('coerces an undefined return value into null', () => {
    const { harness } = setupHarness({ toolCategoryResolver: () => undefined as any });
    expect(harness.getToolCategory({ toolName: 'anything' })).toBeNull();
  });
});

describe('HarnessConfig permission validation', () => {
  it('rejects invalid defaultPermissionPolicy values at construction', () => {
    expect(
      () =>
        new Harness({
          agents: {} as any,
          modes: [],
          defaultPermissionPolicy: 'maybe' as any,
        }),
    ).toThrow(HarnessConfigError);
  });

  it('rejects non-function toolCategoryResolver values at construction', () => {
    expect(
      () =>
        new Harness({
          agents: {} as any,
          modes: [],
          toolCategoryResolver: 'not-a-fn' as any,
        }),
    ).toThrow(HarnessConfigError);
  });
});

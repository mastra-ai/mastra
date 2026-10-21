import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import { AuditStorage, clampAuditLimit, encodeAuditCursor } from './base.js';

describe('clampAuditLimit', () => {
  it('defaults non-finite values and truncates fractions', () => {
    expect(clampAuditLimit(undefined)).toBe(50);
    expect(clampAuditLimit(Number.NaN)).toBe(50);
    expect(clampAuditLimit(Number.POSITIVE_INFINITY)).toBe(50);
    expect(clampAuditLimit(12.9)).toBe(12);
  });

  it('clamps normalized values to the supported range', () => {
    expect(clampAuditLimit(0)).toBe(1);
    expect(clampAuditLimit(-12)).toBe(1);
    expect(clampAuditLimit(201)).toBe(200);
  });
});

async function makeStorage(): Promise<AuditStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'audit-test', url: ':memory:' });
  const domain = backend.registerDomain(new AuditStorage());
  await backend.init();
  return domain;
}

describe('AuditStorage', () => {
  it('records with defaults and scopes listing to the org', async () => {
    const storage = await makeStorage();

    const row = await storage.record({
      orgId: 'org1',
      actorId: 'user:alice',
      action: 'factory.work_item.created',
      targets: [{ type: 'work_item', id: 'wi-1' }],
    });
    expect(row.actorType).toBe('human');
    expect(row.metadata).toEqual({});
    expect(row.occurredAt).toBeInstanceOf(Date);

    await storage.record({
      orgId: 'org2',
      actorId: 'user:eve',
      action: 'factory.work_item.created',
      targets: [],
    });

    const page = await storage.list({ orgId: 'org1' });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]!.id).toBe(row.id);
    expect(page.nextCursor).toBeUndefined();
  });

  it('paginates newest-first with keyset cursors', async () => {
    const storage = await makeStorage();
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await storage.record({
        orgId: 'org1',
        actorId: 'user:alice',
        action: `action.${i}`,
        targets: [],
        occurredAt: new Date(base + i * 1000),
      });
    }

    const first = await storage.list({ orgId: 'org1', limit: 2 });
    expect(first.events.map(e => e.action)).toEqual(['action.4', 'action.3']);
    expect(first.nextCursor).toBeDefined();

    const second = await storage.list({ orgId: 'org1', limit: 2, before: first.nextCursor });
    expect(second.events.map(e => e.action)).toEqual(['action.2', 'action.1']);

    const last = await storage.list({ orgId: 'org1', limit: 2, before: second.nextCursor });
    expect(last.events.map(e => e.action)).toEqual(['action.0']);
    expect(last.nextCursor).toBeUndefined();
  });

  it('pages forward oldest-first without gaps or repeats, even when events share a timestamp', async () => {
    const storage = await makeStorage();
    const base = new Date('2026-10-21T12:00:00.000Z').getTime();
    // Three events land in the same millisecond, so only the id orders them.
    const times = [0, 1000, 1000, 1000, 2000, 3000];
    const recorded = [];
    for (const [i, offset] of times.entries()) {
      recorded.push(
        await storage.record({
          orgId: 'org1',
          actorId: 'user:alice',
          action: `action.${i}`,
          targets: [],
          occurredAt: new Date(base + offset),
        }),
      );
    }
    const inOrder = [...recorded].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || (a.id < b.id ? -1 : 1),
    );

    const seen: string[] = [];
    let after = encodeAuditCursor(inOrder[0]!);
    for (;;) {
      const page = await storage.list({ orgId: 'org1', limit: 2, after });
      seen.push(...page.events.map(e => e.id));
      if (!page.nextCursor) break;
      after = page.nextCursor;
    }

    expect(seen).toEqual(inOrder.slice(1).map(e => e.id));
  });

  it('refuses to page both ways at once, or forward from an unreadable cursor', async () => {
    const storage = await makeStorage();
    const row = await storage.record({ orgId: 'org1', actorId: 'user:alice', action: 'a.one', targets: [] });
    const cursor = encodeAuditCursor(row);

    await expect(storage.list({ orgId: 'org1', before: cursor, after: cursor })).rejects.toThrow(/not both/);
    await expect(storage.list({ orgId: 'org1', after: 'not-a-cursor' })).rejects.toThrow(/Invalid audit cursor/);
  });

  it('filters by project, actions, and actor', async () => {
    const storage = await makeStorage();
    await storage.record({
      orgId: 'org1',
      actorId: 'user:alice',
      action: 'a.one',
      targets: [],
      factoryProjectId: 'p1',
      projectRepositoryId: 'pr1',
    });
    await storage.record({ orgId: 'org1', actorId: 'user:bob', action: 'a.two', targets: [] });
    await storage.record({
      orgId: 'org1',
      actorId: 'agent:thread-1',
      actorType: 'agent',
      action: 'a.three',
      targets: [],
    });

    const byProject = await storage.list({ orgId: 'org1', factoryProjectId: 'p1' });
    expect(byProject.events.map(e => e.action)).toEqual(['a.one']);

    const byActions = await storage.list({ orgId: 'org1', actions: ['a.two', 'a.three'] });
    expect(byActions.events.map(e => e.action).sort()).toEqual(['a.three', 'a.two']);

    const byActor = await storage.list({ orgId: 'org1', actorId: 'agent:thread-1' });
    expect(byActor.events).toHaveLength(1);
    expect(byActor.events[0]!.actorType).toBe('agent');
  });
});

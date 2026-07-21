import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetRuntimeConfigForTests } from '../runtime-config';
import { seedFactoryStorageForTests } from '../storage/test-utils';
import type { FactoryStorageTestSeed } from '../storage/test-utils';
import { listAuditEvents, recordAuditEvent } from './store';

const ORG = 'org_123';
const ACTOR = 'user_abc';
const PROJECT = '11111111-1111-4111-8111-111111111111';

function baseEvent(overrides: Record<string, any> = {}) {
  return {
    orgId: ORG,
    actorId: ACTOR,
    action: 'factory.work_item.created',
    targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix login' }],
    githubProjectId: PROJECT,
    ...overrides,
  };
}

let seed: FactoryStorageTestSeed;

beforeEach(async () => {
  seed = await seedFactoryStorageForTests();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.restoreAllMocks();
});

describe('recordAuditEvent', () => {
  it('appends a row with defaults for optional fields', async () => {
    const row = await recordAuditEvent(baseEvent());
    expect(row).not.toBeNull();
    expect(row!.orgId).toBe(ORG);
    expect(row!.actorId).toBe(ACTOR);
    expect(row!.action).toBe('factory.work_item.created');
    expect(row!.targets).toEqual([{ type: 'work_item', id: 'wi-1', name: 'Fix login' }]);
    expect(row!.metadata).toEqual({});
    expect(row!.context).toEqual({});
    expect(row!.occurredAt).toBeInstanceOf(Date);
    expect((await listAuditEvents({ orgId: ORG })).events).toHaveLength(1);
  });

  it('defaults actorType to human', async () => {
    const row = await recordAuditEvent(baseEvent());
    expect(row!.actorType).toBe('human');
  });

  it('stores an agent actorType when provided', async () => {
    const row = await recordAuditEvent(
      baseEvent({ actorId: 'agent:thread-1', actorType: 'agent', metadata: { startedBy: 'user_abc' } }),
    );
    expect(row!.actorType).toBe('agent');
    expect(row!.actorId).toBe('agent:thread-1');
    expect(row!.metadata).toEqual({ startedBy: 'user_abc' });
  });

  it('stores metadata and context when provided', async () => {
    const row = await recordAuditEvent(
      baseEvent({
        metadata: { fromStages: ['intake'], toStages: ['triage'] },
        context: { location: '10.0.0.1', userAgent: 'vitest' },
      }),
    );
    expect(row!.metadata).toEqual({ fromStages: ['intake'], toStages: ['triage'] });
    expect(row!.context).toEqual({ location: '10.0.0.1', userAgent: 'vitest' });
  });

  it('replaces oversized metadata with a truncation marker instead of dropping the event', async () => {
    const row = await recordAuditEvent(baseEvent({ metadata: { blob: 'x'.repeat(10_000) } }));
    expect(row).not.toBeNull();
    expect(row!.metadata).toEqual({ truncated: true });
  });

  it('swallows insert failures and returns null', async () => {
    vi.spyOn(seed.audit, 'record').mockRejectedValueOnce(new Error('insert exploded'));
    const row = await recordAuditEvent(baseEvent());
    expect(row).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      '[Audit] Failed to record audit event',
      expect.objectContaining({ action: 'factory.work_item.created' }),
    );
    // The failure never propagates — a later record works fine.
    expect(await recordAuditEvent(baseEvent())).not.toBeNull();
  });

  it('swallows an unseeded factory store and returns null', async () => {
    __resetRuntimeConfigForTests();
    const row = await recordAuditEvent(baseEvent());
    expect(row).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('[Audit] Failed to record audit event', expect.anything());
  });
});

describe('listAuditEvents', () => {
  it('returns the org events newest-first and excludes other orgs', async () => {
    await recordAuditEvent(baseEvent({ occurredAt: new Date('2026-07-01T10:00:00Z') }));
    await recordAuditEvent(baseEvent({ occurredAt: new Date('2026-07-02T10:00:00Z'), action: 'factory.git.push' }));
    await recordAuditEvent(baseEvent({ orgId: 'org_other' }));

    const page = await listAuditEvents({ orgId: ORG });
    expect(page.events.map(e => e.action)).toEqual(['factory.git.push', 'factory.work_item.created']);
    expect(page.nextCursor).toBeUndefined();
  });

  it('filters by project, actions and actor', async () => {
    await recordAuditEvent(baseEvent());
    await recordAuditEvent(baseEvent({ githubProjectId: '22222222-2222-4222-8222-222222222222' }));
    await recordAuditEvent(baseEvent({ action: 'factory.worktree.deleted' }));
    await recordAuditEvent(baseEvent({ actorId: 'user_other' }));

    const byProject = await listAuditEvents({ orgId: ORG, githubProjectId: PROJECT });
    expect(byProject.events).toHaveLength(3);

    const byAction = await listAuditEvents({ orgId: ORG, actions: ['factory.worktree.deleted'] });
    expect(byAction.events).toHaveLength(1);
    expect(byAction.events[0]!.action).toBe('factory.worktree.deleted');

    const byActor = await listAuditEvents({ orgId: ORG, actorId: 'user_other' });
    expect(byActor.events).toHaveLength(1);
    expect(byActor.events[0]!.actorId).toBe('user_other');
  });

  it('paginates with a keyset cursor and ends without one', async () => {
    for (let i = 1; i <= 5; i++) {
      await recordAuditEvent(baseEvent({ occurredAt: new Date(`2026-07-0${i}T10:00:00Z`) }));
    }

    const first = await listAuditEvents({ orgId: ORG, limit: 2 });
    expect(first.events).toHaveLength(2);
    expect(first.nextCursor).toBeDefined();

    const second = await listAuditEvents({ orgId: ORG, limit: 2, before: first.nextCursor });
    expect(second.events).toHaveLength(2);
    expect(second.nextCursor).toBeDefined();

    const third = await listAuditEvents({ orgId: ORG, limit: 2, before: second.nextCursor });
    expect(third.events).toHaveLength(1);
    expect(third.nextCursor).toBeUndefined();

    const seen = [...first.events, ...second.events, ...third.events].map(e => e.occurredAt.toISOString());
    expect(seen).toEqual([...seen].sort().reverse());
    expect(new Set(seen).size).toBe(5);
  });

  it('breaks occurredAt ties by id so pages never skip or repeat rows', async () => {
    const at = new Date('2026-07-01T10:00:00Z');
    for (let i = 0; i < 3; i++) await recordAuditEvent(baseEvent({ occurredAt: at }));

    const first = await listAuditEvents({ orgId: ORG, limit: 2 });
    const second = await listAuditEvents({ orgId: ORG, limit: 2, before: first.nextCursor });
    const ids = [...first.events, ...second.events].map(e => e.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('ignores malformed cursors and clamps limits', async () => {
    for (let i = 1; i <= 3; i++) {
      await recordAuditEvent(baseEvent({ occurredAt: new Date(`2026-07-0${i}T10:00:00Z`) }));
    }
    const page = await listAuditEvents({ orgId: ORG, before: 'not-a-cursor', limit: 0 });
    expect(page.events).toHaveLength(1); // limit clamped up to 1
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
vi.mock('drizzle-orm', async () => {
  const actual = (await vi.importActual('drizzle-orm')) as Record<string, unknown>;
  return {
    ...actual,
    eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
    and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
    or: (...conds: any[]) => ({ kind: 'or', conds: conds.filter(Boolean) }),
    lt: (column: any, value: any) => ({ kind: 'lt', column: column?.name, value }),
    inArray: (column: any, values: any[]) => ({ kind: 'in', column: column?.name, values }),
    desc: (column: any) => ({ kind: 'desc', column: column?.name }),
  };
});

// In-memory audit_events rows.
let rows: Array<Record<string, any>> = [];
let nextId = 1;
let failNextInsert = false;

const COLUMNS: Record<string, string> = {
  id: 'id',
  org_id: 'orgId',
  actor_id: 'actorId',
  action: 'action',
  github_project_id: 'githubProjectId',
  occurred_at: 'occurredAt',
};

function valueOf(row: any, column: string): any {
  return row[COLUMNS[column] ?? column];
}

function compare(a: any, b: any): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function matches(row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') return cond.conds.every((c: any) => matches(row, c));
  if (cond.kind === 'or') return cond.conds.some((c: any) => matches(row, c));
  if (cond.kind === 'eq') return compare(valueOf(row, cond.column), cond.value) === 0;
  if (cond.kind === 'lt') return compare(valueOf(row, cond.column), cond.value) < 0;
  if (cond.kind === 'in') return cond.values.includes(valueOf(row, cond.column));
  return true;
}

vi.mock('../github/db', () => ({
  getAppDb: () => ({
    execute: async () => undefined,
    insert: () => ({
      values: (vals: any) => ({
        returning: async () => {
          if (failNextInsert) {
            failNextInsert = false;
            throw new Error('insert exploded');
          }
          const row = { id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`, ...vals };
          rows.push(row);
          return [row];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: (cond: any) => ({
          orderBy: (...orders: any[]) => ({
            limit: async (n: number) => {
              const filtered = rows.filter(row => matches(row, cond));
              filtered.sort((a, b) => {
                for (const order of orders) {
                  const diff = compare(valueOf(a, order.column), valueOf(b, order.column));
                  if (diff !== 0) return -diff; // all orders are desc
                }
                return 0;
              });
              return filtered.slice(0, n);
            },
          }),
        }),
      }),
    }),
  }),
}));

import { __resetAuditDbForTests } from './db';
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

beforeEach(() => {
  rows = [];
  nextId = 1;
  failNextInsert = false;
  __resetAuditDbForTests();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
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
    expect(rows).toHaveLength(1);
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
    failNextInsert = true;
    const row = await recordAuditEvent(baseEvent());
    expect(row).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      '[Audit] Failed to record audit event',
      expect.objectContaining({ action: 'factory.work_item.created' }),
    );
    // The failure never propagates — a later record works fine.
    expect(await recordAuditEvent(baseEvent())).not.toBeNull();
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

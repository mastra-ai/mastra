import { TABLE_NOTIFICATIONS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportSchemas, PostgresStore } from '../..';
import { generateTableSQL } from '../../db';
import { connectionString } from '../../test-utils';
import { NotificationsPG } from './index';

const createTestPool = () => new Pool({ connectionString });

describe('NotificationsPG', () => {
  let pool: Pool;
  let store: NotificationsPG;

  beforeEach(async () => {
    pool = createTestPool();
    store = new NotificationsPG({ pool });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(async () => {
    await pool?.end();
  });

  it('creates, gets, and lists notifications with JSON fields and dates', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const deliverAt = new Date('2026-01-01T00:05:00.000Z');
    const summaryAt = new Date('2026-01-01T00:10:00.000Z');

    const created = await store.createNotification({
      id: 'n1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'mastracode',
      kind: 'manual',
      priority: 'high',
      summary: 'Review the deployment',
      payload: { nested: { ok: true }, count: 2 },
      sourceId: 'source-1',
      dedupeKey: 'dedupe-1',
      coalesceKey: 'coalesce-1',
      attributes: { route: '/notify', important: true, count: 2 },
      metadata: { origin: { command: 'notify' } },
      deliverAt,
      summaryAt,
      deliveryReason: 'test-reason',
      createdAt,
    });

    expect(created.id).toBe('n1');
    expect(created.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(created.deliverAt?.toISOString()).toBe(deliverAt.toISOString());
    expect(created.summaryAt?.toISOString()).toBe(summaryAt.toISOString());
    expect(created.payload).toEqual({ nested: { ok: true }, count: 2 });
    expect(created.attributes).toEqual({ route: '/notify', important: true, count: 2 });
    expect(created.metadata).toEqual({ origin: { command: 'notify' } });

    const fetched = await store.getNotification({ threadId: 'thread-1', id: 'n1' });
    expect(fetched).toMatchObject({
      id: 'n1',
      threadId: 'thread-1',
      source: 'mastracode',
      kind: 'manual',
      priority: 'high',
      status: 'pending',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      sourceId: 'source-1',
      dedupeKey: 'dedupe-1',
      coalesceKey: 'coalesce-1',
      coalescedCount: 1,
      deliveryReason: 'test-reason',
    });
    expect(fetched?.payload).toEqual({ nested: { ok: true }, count: 2 });
    expect(fetched?.createdAt).toBeInstanceOf(Date);

    const listed = await store.listNotifications({ threadId: 'thread-1' });
    expect(listed.map(record => record.id)).toEqual(['n1']);
  });

  it('repairs notification JSON without losing literal escape text', async () => {
    const literal = String.raw`literal\uD800`;
    const payload = { path: 'C:\\path\\\ud800-end', literal, nul: 'a\0b' };
    await store.createNotification({
      id: 'json-repair',
      threadId: 'thread-json',
      source: 'mastracode',
      kind: 'manual',
      priority: 'high',
      summary: 'JSON repair',
      payload,
    });

    const stored = await store.getNotification({ threadId: 'thread-json', id: 'json-repair' });
    expect(stored?.payload).toEqual({ path: 'C:\\path\\\ufffd-end', literal, nul: 'ab' });
  });

  it('filters notifications by status, priority, source, resource, agent, search, and limit', async () => {
    await store.createNotification({
      id: 'n1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'mastracode',
      kind: 'manual',
      priority: 'high',
      summary: 'Release blocker',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await store.createNotification({
      id: 'n2',
      threadId: 'thread-1',
      resourceId: 'resource-2',
      agentId: 'agent-1',
      source: 'github',
      kind: 'pull-request',
      priority: 'low',
      summary: 'Pull request comment',
      createdAt: new Date('2026-01-01T00:01:00.000Z'),
    });
    await store.createNotification({
      id: 'n3',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-2',
      source: 'mastracode',
      kind: 'reminder',
      priority: 'medium',
      summary: 'Daily standup',
      createdAt: new Date('2026-01-01T00:02:00.000Z'),
    });
    await store.createNotification({
      id: 'other-thread',
      threadId: 'thread-2',
      source: 'mastracode',
      kind: 'manual',
      summary: 'Other thread',
    });

    await store.updateNotification({ threadId: 'thread-1', id: 'n2', status: 'delivered' });

    await expectIds({ threadId: 'thread-1', status: 'delivered' }, ['n2']);
    await expectIds({ threadId: 'thread-1', priority: ['high', 'medium'] }, ['n3', 'n1']);
    await expectIds({ threadId: 'thread-1', source: 'mastracode' }, ['n3', 'n1']);
    await expectIds({ threadId: 'thread-1', resourceId: 'resource-1' }, ['n3', 'n1']);
    await expectIds({ threadId: 'thread-1', agentId: 'agent-2' }, ['n3']);
    await expectIds({ threadId: 'thread-1', search: 'stand' }, ['n3']);
    expect(await store.listNotifications({ threadId: 'thread-1', limit: 1 })).toHaveLength(1);
  });

  it('coalesces pending notifications by dedupeKey or coalesceKey within matching scope', async () => {
    const first = await store.createNotification({
      id: 'dedupe-original',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'github',
      kind: 'comment',
      priority: 'medium',
      summary: 'Original comment',
      dedupeKey: 'same-comment',
      attributes: { first: true },
      metadata: { first: true },
    });

    const coalesced = await store.createNotification({
      id: 'dedupe-new',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'github',
      kind: 'comment',
      priority: 'urgent',
      summary: 'Updated comment',
      payload: { latest: true },
      dedupeKey: 'same-comment',
      attributes: { second: true },
      metadata: { second: true },
    });

    expect(coalesced.id).toBe(first.id);
    expect(coalesced.summary).toBe('Updated comment');
    expect(coalesced.priority).toBe('urgent');
    expect(coalesced.payload).toEqual({ latest: true });
    expect(coalesced.attributes).toEqual({ first: true, second: true });
    expect(coalesced.metadata).toEqual({ first: true, second: true });
    expect(coalesced.coalescedCount).toBe(2);

    const differentAgent = await store.createNotification({
      id: 'dedupe-other-agent',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-2',
      source: 'github',
      kind: 'comment',
      summary: 'Different agent',
      dedupeKey: 'same-comment',
    });
    expect(differentAgent.id).toBe('dedupe-other-agent');

    const group = await store.createNotification({
      id: 'coalesce-original',
      threadId: 'thread-1',
      source: 'alerts',
      kind: 'build',
      summary: 'Build 1 failed',
      coalesceKey: 'build-failures',
    });
    const grouped = await store.createNotification({
      id: 'coalesce-new',
      threadId: 'thread-1',
      source: 'alerts',
      kind: 'build',
      summary: 'Build 2 failed',
      coalesceKey: 'build-failures',
    });
    expect(grouped.id).toBe(group.id);
    expect(grouped.coalescedCount).toBe(2);
  });

  it('updates status timestamps and delivery metadata', async () => {
    await store.createNotification({
      id: 'n1',
      threadId: 'thread-1',
      source: 'mastracode',
      kind: 'manual',
      summary: 'Ship it',
    });

    const deliverAt = new Date('2026-01-01T00:05:00.000Z');
    const summaryAt = new Date('2026-01-01T00:10:00.000Z');
    const lastDeliveryAttemptAt = new Date('2026-01-01T00:15:00.000Z');

    const updated = await store.updateNotification({
      id: 'n1',
      threadId: 'thread-1',
      status: 'delivered',
      summary: 'Delivered notification',
      payload: { delivered: true },
      attributes: { channel: 'thread' },
      metadata: { attempt: 1 },
      deliverAt,
      summaryAt,
      deliveryReason: 'urgent',
      deliveryAttempts: 2,
      lastDeliveryAttemptAt,
      lastDeliveryError: 'temporary failure',
      deliveredSignalId: 'signal-1',
      summarySignalId: 'summary-1',
    });

    expect(updated.status).toBe('delivered');
    expect(updated.deliveredAt).toBeInstanceOf(Date);
    expect(updated.summary).toBe('Delivered notification');
    expect(updated.payload).toEqual({ delivered: true });
    expect(updated.attributes).toEqual({ channel: 'thread' });
    expect(updated.metadata).toEqual({ attempt: 1 });
    expect(updated.deliverAt?.toISOString()).toBe(deliverAt.toISOString());
    expect(updated.summaryAt?.toISOString()).toBe(summaryAt.toISOString());
    expect(updated.deliveryReason).toBe('urgent');
    expect(updated.deliveryAttempts).toBe(2);
    expect(updated.lastDeliveryAttemptAt?.toISOString()).toBe(lastDeliveryAttemptAt.toISOString());
    expect(updated.lastDeliveryError).toBe('temporary failure');
    expect(updated.deliveredSignalId).toBe('signal-1');
    expect(updated.summarySignalId).toBe('summary-1');
  });

  it('bulk status update accepts more ids than one statement can bind and returns each record once', async () => {
    const ids = Array.from({ length: 1200 }, (_, index) => `n-${index}`);
    for (const id of ids) {
      await store.createNotification({ id, threadId: 'thread-1', source: 'email', kind: 'dm', summary: id });
    }

    // 40k ids exceeds any single-statement bind-parameter limit (SQLite caps at 32,766);
    // most are unknown ids so the test stays fast while still stressing the parameter count.
    const missing = Array.from({ length: 40_000 - ids.length }, (_, index) => `missing-${index}`);
    const updated = await store.updateNotificationsStatus({
      threadId: 'thread-1',
      ids: [...ids, ...ids.slice(0, 10), ...missing],
      status: 'seen',
    });

    expect(updated).toHaveLength(ids.length);
    expect(new Set(updated.map(notification => notification.id)).size).toBe(ids.length);
    expect(updated.every(notification => notification.status === 'seen')).toBe(true);
    await expect(store.listNotifications({ threadId: 'thread-1', status: 'pending' })).resolves.toEqual([]);
  });

  it('updates the status of many notifications in one write, scoped to the thread', async () => {
    for (const id of ['a', 'b', 'c']) {
      await store.createNotification({ id, threadId: 'thread-1', source: 'email', kind: 'dm', summary: id });
    }
    await store.createNotification({ id: 'a', threadId: 'thread-2', source: 'email', kind: 'dm', summary: 'other' });

    const updated = await store.updateNotificationsStatus({
      threadId: 'thread-1',
      ids: ['a', 'b', 'missing', 'a'],
      status: 'seen',
    });

    expect(updated.map(notification => notification.id).sort()).toEqual(['a', 'b']);
    for (const notification of updated) {
      expect(notification.status).toBe('seen');
      expect(notification.seenAt).toBeInstanceOf(Date);
      expect(notification.summary).toBe(notification.id);
    }
    await expect(store.getNotification({ threadId: 'thread-1', id: 'a' })).resolves.toMatchObject({ status: 'seen' });
    await expect(store.getNotification({ threadId: 'thread-1', id: 'c' })).resolves.toMatchObject({
      status: 'pending',
    });
    await expect(store.getNotification({ threadId: 'thread-2', id: 'a' })).resolves.toMatchObject({
      status: 'pending',
    });
    await expect(store.updateNotificationsStatus({ threadId: 'thread-1', ids: [], status: 'seen' })).resolves.toEqual(
      [],
    );
  });

  it('lists due pending notifications sorted by earliest due time with agent/resource filters and limit', async () => {
    const now = new Date('2026-01-01T12:00:00.000Z');

    await store.createNotification({
      id: 'due-deliver',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'mastracode',
      kind: 'manual',
      summary: 'Deliver due',
      deliverAt: new Date('2026-01-01T11:50:00.000Z'),
    });
    await store.createNotification({
      id: 'due-summary',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'github',
      kind: 'comment',
      summary: 'Summary due',
      summaryAt: new Date('2026-01-01T11:55:00.000Z'),
    });
    await store.createNotification({
      id: 'due-earliest',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'alerts',
      kind: 'build',
      summary: 'Earliest due',
      deliverAt: new Date('2026-01-01T11:40:00.000Z'),
    });
    await store.createNotification({
      id: 'future',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'alerts',
      kind: 'build',
      summary: 'Future',
      deliverAt: new Date('2026-01-01T12:10:00.000Z'),
    });
    await store.createNotification({
      id: 'other-agent',
      threadId: 'thread-1',
      resourceId: 'resource-2',
      agentId: 'agent-2',
      source: 'alerts',
      kind: 'build',
      summary: 'Other agent due',
      deliverAt: new Date('2026-01-01T11:45:00.000Z'),
    });
    await store.updateNotification({ threadId: 'thread-1', id: 'other-agent', status: 'seen' });

    const due = await store.listDueNotifications({ now });
    expect(due.map(record => record.id)).toEqual(['due-earliest', 'due-deliver', 'due-summary']);

    const limited = await store.listDueNotifications({ now, limit: 2 });
    expect(limited.map(record => record.id)).toEqual(['due-earliest', 'due-deliver']);

    const filtered = await store.listDueNotifications({ now, agentId: 'agent-1', resourceId: 'resource-1' });
    expect(filtered.map(record => record.id)).toEqual(['due-earliest', 'due-deliver', 'due-summary']);
  });

  it('clears summaryAt while preserving deliverAt and due ordering after summary dispatch metadata updates', async () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    const deliverAt = new Date('2026-01-01T12:00:00.000Z');
    const summaryAt = new Date('2026-01-01T11:55:00.000Z');
    await store.createNotification({
      id: 'summary-then-deliver',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      agentId: 'agent-1',
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'Summarized then delivered',
      deliverAt,
      summaryAt,
    });

    const updated = await store.updateNotification({
      id: 'summary-then-deliver',
      threadId: 'thread-1',
      summaryAt: null,
      summarySignalId: 'summary-signal-1',
    });

    expect(updated.status).toBe('pending');
    expect(updated.summaryAt).toBeUndefined();
    expect(updated.deliverAt?.toISOString()).toBe(deliverAt.toISOString());
    expect(updated.summarySignalId).toBe('summary-signal-1');

    const due = await store.listDueNotifications({ now });
    expect(due.map(record => record.id)).toEqual(['summary-then-deliver']);
    expect(due[0]?.summaryAt).toBeUndefined();
    expect(due[0]?.deliverAt?.toISOString()).toBe(deliverAt.toISOString());
  });

  it('exposes notifications through PostgresStore and includes notification DDL in schema export', async () => {
    const composite = new PostgresStore({ id: 'pg-notifications-composite', pool: createTestPool() });
    try {
      await composite.init();
      const notifications = await composite.getStore('notifications');
      expect(notifications).toBeDefined();
      const record = await notifications!.createNotification({
        id: 'composite-notification',
        threadId: 'thread-1',
        source: 'mastracode',
        kind: 'manual',
        summary: 'Composite notification',
      });
      expect(record.id).toBe('composite-notification');
      await expect(
        notifications!.getNotification({ threadId: 'thread-1', id: 'composite-notification' }),
      ).resolves.toMatchObject({ summary: 'Composite notification' });
    } finally {
      await composite.close();
    }

    const ddl = exportSchemas();
    expect(ddl).toContain(TABLE_NOTIFICATIONS);
    expect(ddl).toContain('idx_notifications_thread_status_updated');
    expect(ddl).toContain('idx_notifications_coalescing');
    expect(ddl).toContain('idx_notifications_due');
    expect(ddl).toContain('PRIMARY KEY ("threadId", "id")');
  });

  async function expectIds(input: Parameters<NotificationsPG['listNotifications']>[0], ids: string[]) {
    const records = await store.listNotifications(input);
    expect(records.map(record => record.id)).toEqual(ids);
  }
});

describe('NotificationsPG primary key', () => {
  let pool: Pool;

  const primaryKeyColumns = async () => {
    const rows = await pool.query<{ attname: string }>(
      `SELECT a.attname FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
       WHERE c.relname = $1 AND n.nspname = 'public' AND i.indisprimary
       ORDER BY k.ord`,
      [TABLE_NOTIFICATIONS],
    );
    return rows.rows.map(row => row.attname);
  };

  const insertRaw = (id: string, threadId: string) =>
    pool.query(
      `INSERT INTO "${TABLE_NOTIFICATIONS}" (id, "threadId", source, kind, priority, status, summary, "coalescedCount", "createdAt", "updatedAt", "deliveryAttempts")
       VALUES ($1, $2, 'test', 'manual', 'medium', 'pending', 's', 1, now(), now(), 0)`,
      [id, threadId],
    );

  const createLegacyTable = () =>
    pool.query(generateTableSQL({ tableName: TABLE_NOTIFICATIONS, schema: TABLE_SCHEMAS[TABLE_NOTIFICATIONS] }));

  beforeEach(async () => {
    pool = createTestPool();
    await pool.query(`DROP TABLE IF EXISTS "${TABLE_NOTIFICATIONS}"`);
  });

  afterEach(async () => {
    await pool.query(`DROP TABLE IF EXISTS "${TABLE_NOTIFICATIONS}"`);
    await pool.end();
  });

  it('creates new tables with the ("threadId", "id") primary key', async () => {
    await new NotificationsPG({ pool }).init();
    expect(await primaryKeyColumns()).toEqual(['threadId', 'id']);
  });

  it('adds the primary key to legacy tables created without it, idempotently', async () => {
    await createLegacyTable();
    await insertRaw('n1', 't1');
    await insertRaw('n1', 't2');
    expect(await primaryKeyColumns()).toEqual([]);

    await new NotificationsPG({ pool }).init();
    await new NotificationsPG({ pool }).init();

    expect(await primaryKeyColumns()).toEqual(['threadId', 'id']);
    await expect(insertRaw('n1', 't1')).rejects.toThrow(/duplicate key/);
  });

  it('warns and skips the migration when a legacy table contains duplicates', async () => {
    await createLegacyTable();
    await insertRaw('dup', 't1');
    await insertRaw('dup', 't1');

    const store = new NotificationsPG({ pool });
    const warn = vi.fn();
    store.__setLogger({ warn, info: vi.fn(), debug: vi.fn(), error: vi.fn() } as any);
    await expect(store.init()).resolves.toBeUndefined();

    expect(await primaryKeyColumns()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ADD PRIMARY KEY ("threadId", "id")'));
  });

  const rejectAlterTable = (error: Error) => {
    const query = pool.query.bind(pool) as (...args: any[]) => any;
    vi.spyOn(pool, 'query').mockImplementation(((text: unknown, ...rest: any[]) =>
      typeof text === 'string' && text.includes('ADD PRIMARY KEY')
        ? Promise.reject(error)
        : query(text, ...rest)) as any);
  };

  it('warns and continues when the role lacks privilege to add the key', async () => {
    await createLegacyTable();
    rejectAlterTable(Object.assign(new Error('must be owner of table mastra_notifications'), { code: '42501' }));

    const store = new NotificationsPG({ pool });
    const warn = vi.fn();
    store.__setLogger({ warn, info: vi.fn(), debug: vi.fn(), error: vi.fn() } as any);
    await expect(store.init()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ADD PRIMARY KEY ("threadId", "id")'));
    vi.restoreAllMocks();
    expect(await primaryKeyColumns()).toEqual([]);
  });

  it('wraps other migration failures in a MastraError', async () => {
    await createLegacyTable();
    rejectAlterTable(Object.assign(new Error('boom'), { code: 'XX000' }));

    await expect(new NotificationsPG({ pool }).init()).rejects.toMatchObject({
      id: 'MASTRA_STORAGE_PG_ADD_NOTIFICATIONS_PRIMARY_KEY_FAILED',
    });
    vi.restoreAllMocks();
  });
});

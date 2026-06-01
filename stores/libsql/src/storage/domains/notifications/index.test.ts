import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NotificationsLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

const createTestClient = () => createClient({ url: TEST_DB_URL });

describe('NotificationsLibSQL', () => {
  let client: Client;
  let store: NotificationsLibSQL;

  beforeEach(async () => {
    client = createTestClient();
    store = new NotificationsLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(() => {
    client.close();
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

  async function expectIds(input: Parameters<NotificationsLibSQL['listNotifications']>[0], ids: string[]) {
    const records = await store.listNotifications(input);
    expect(records.map(record => record.id)).toEqual(ids);
  }
});

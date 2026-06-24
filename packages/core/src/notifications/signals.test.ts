/**
 * Tests for packages/core/src/notifications/signals.ts
 *
 * All exported helpers are pure functions — no I/O, no async behaviour,
 * no mocking required.
 */
import { describe, expect, it } from 'vitest';

import {
  notificationSignalAttributes,
  notificationSignalMetadata,
  notificationSummaryContents,
  notificationSummarySignalMetadata,
  summarizeNotifications,
} from './signals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Record<string, any>> = {}): any {
  return {
    id: 'notif-1',
    source: 'agent',
    kind: 'alert',
    priority: 'medium' as const,
    status: 'pending' as const,
    summary: 'Something happened',
    threadId: 'thread-1',
    attributes: { tag: 'test' },
    metadata: {},
    ...overrides,
  };
}

function makeSummary(overrides: Partial<Record<string, any>> = {}): any {
  return {
    threadId: 'thread-1',
    pending: 2,
    bySource: { agent: 1, system: 1 },
    byPriority: { medium: 1, high: 1 },
    notificationIds: ['notif-1', 'notif-2'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// notificationSignalAttributes
// ---------------------------------------------------------------------------

describe('notificationSignalAttributes', () => {
  it('maps core notification fields to signal attributes', () => {
    const notif = makeNotification();
    const result = notificationSignalAttributes(notif);
    expect(result.id).toBe('notif-1');
    expect(result.source).toBe('agent');
    expect(result.type).toBe('alert');
    expect(result.kind).toBe('alert');
    expect(result.priority).toBe('medium');
    expect(result.status).toBe('pending');
  });

  it('spreads notification.attributes into the result', () => {
    const notif = makeNotification({ attributes: { custom: 'value', extra: 42 } });
    const result = notificationSignalAttributes(notif);
    expect(result.custom).toBe('value');
    expect(result.extra).toBe(42);
  });

  it('includes coalescedCount when > 1', () => {
    const notif = makeNotification({ coalescedCount: 3 });
    const result = notificationSignalAttributes(notif);
    expect(result.coalescedCount).toBe(3);
  });

  it('omits coalescedCount when it is 1', () => {
    const notif = makeNotification({ coalescedCount: 1 });
    const result = notificationSignalAttributes(notif);
    expect(result).not.toHaveProperty('coalescedCount');
  });

  it('omits coalescedCount when undefined', () => {
    const notif = makeNotification({ coalescedCount: undefined });
    const result = notificationSignalAttributes(notif);
    expect(result).not.toHaveProperty('coalescedCount');
  });

  it('notification attribute keys override base fields in spread order', () => {
    // attributes is spread first, then id/source/type etc. override it
    const notif = makeNotification({ attributes: { id: 'overridden-by-spread', source: 'custom' } });
    const result = notificationSignalAttributes(notif);
    expect(result.id).toBe('notif-1'); // own id wins
    expect(result.source).toBe('agent'); // own source wins
  });
});

// ---------------------------------------------------------------------------
// notificationSummaryContents
// ---------------------------------------------------------------------------

describe('notificationSummaryContents', () => {
  it('formats bySource as sorted "source: count" pairs', () => {
    const summary = makeSummary({ bySource: { agent: 3, system: 1 } });
    expect(notificationSummaryContents(summary)).toBe('agent: 3, system: 1');
  });

  it('sorts sources alphabetically', () => {
    const summary = makeSummary({ bySource: { zebra: 1, alpha: 2, middle: 5 } });
    expect(notificationSummaryContents(summary)).toBe('alpha: 2, middle: 5, zebra: 1');
  });

  it('returns "No pending notifications" for empty bySource', () => {
    const summary = makeSummary({ bySource: {} });
    expect(notificationSummaryContents(summary)).toBe('No pending notifications');
  });

  it('handles a single source', () => {
    const summary = makeSummary({ bySource: { system: 7 } });
    expect(notificationSummaryContents(summary)).toBe('system: 7');
  });
});

// ---------------------------------------------------------------------------
// notificationSignalMetadata
// ---------------------------------------------------------------------------

describe('notificationSignalMetadata', () => {
  it('sets signal = "notification"', () => {
    expect(notificationSignalMetadata(makeNotification()).signal).toBe('notification');
  });

  it('maps core fields to metadata', () => {
    const notif = makeNotification({ id: 'n-42', source: 'sys', kind: 'info', priority: 'low', status: 'seen' });
    const result = notificationSignalMetadata(notif);
    expect(result.recordId).toBe('n-42');
    expect(result.source).toBe('sys');
    expect(result.kind).toBe('info');
    expect(result.priority).toBe('low');
    expect(result.status).toBe('seen');
  });

  it('includes coalescedCount when > 1', () => {
    const result = notificationSignalMetadata(makeNotification({ coalescedCount: 5 }));
    expect(result.coalescedCount).toBe(5);
  });

  it('omits coalescedCount when 1', () => {
    expect(notificationSignalMetadata(makeNotification({ coalescedCount: 1 }))).not.toHaveProperty('coalescedCount');
  });

  it('includes deliveredAt as ISO string when present', () => {
    const date = new Date('2024-06-01T10:00:00.000Z');
    const result = notificationSignalMetadata(makeNotification({ deliveredAt: date }));
    expect(result.deliveredAt).toBe('2024-06-01T10:00:00.000Z');
  });

  it('omits deliveredAt when undefined', () => {
    expect(notificationSignalMetadata(makeNotification())).not.toHaveProperty('deliveredAt');
  });

  it('includes seenAt as ISO string when present', () => {
    const date = new Date('2024-06-02T12:00:00.000Z');
    const result = notificationSignalMetadata(makeNotification({ seenAt: date }));
    expect(result.seenAt).toBe('2024-06-02T12:00:00.000Z');
  });

  it('omits seenAt when undefined', () => {
    expect(notificationSignalMetadata(makeNotification())).not.toHaveProperty('seenAt');
  });
});

// ---------------------------------------------------------------------------
// notificationSummarySignalMetadata
// ---------------------------------------------------------------------------

describe('notificationSummarySignalMetadata', () => {
  it('sets signal = "summary"', () => {
    expect(notificationSummarySignalMetadata(makeSummary()).signal).toBe('summary');
  });

  it('includes pending count', () => {
    expect(notificationSummarySignalMetadata(makeSummary({ pending: 7 })).pending).toBe(7);
  });

  it('sorts groups alphabetically by source', () => {
    const summary = makeSummary({ bySource: { zebra: 2, alpha: 1 } });
    const result = notificationSummarySignalMetadata(summary);
    expect(result.groups[0]).toEqual({ source: 'alpha', count: 1 });
    expect(result.groups[1]).toEqual({ source: 'zebra', count: 2 });
  });

  it('includes byPriority map', () => {
    const summary = makeSummary({ byPriority: { high: 2, low: 1 } });
    expect(notificationSummarySignalMetadata(summary).byPriority).toEqual({ high: 2, low: 1 });
  });

  it('includes notificationIds', () => {
    const ids = ['a', 'b', 'c'];
    const result = notificationSummarySignalMetadata(makeSummary({ notificationIds: ids }));
    expect(result.notificationIds).toEqual(ids);
  });

  it('sets highest priority from byPriority — urgent > high > medium > low', () => {
    const summary = makeSummary({ byPriority: { low: 1, medium: 2, high: 3 } });
    expect(notificationSummarySignalMetadata(summary).priority).toBe('high');
  });

  it('sets urgent as highest priority', () => {
    const summary = makeSummary({ byPriority: { urgent: 1, high: 2 } });
    expect(notificationSummarySignalMetadata(summary).priority).toBe('urgent');
  });

  it('omits priority when byPriority is empty', () => {
    const summary = makeSummary({ byPriority: {} });
    expect(notificationSummarySignalMetadata(summary)).not.toHaveProperty('priority');
  });

  it('returns empty groups for empty bySource', () => {
    const summary = makeSummary({ bySource: {} });
    expect(notificationSummarySignalMetadata(summary).groups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// summarizeNotifications
// ---------------------------------------------------------------------------

describe('summarizeNotifications', () => {
  it('counts only pending notifications', () => {
    const notifications = [
      makeNotification({ id: '1', status: 'pending', source: 'agent', priority: 'medium' }),
      makeNotification({ id: '2', status: 'seen', source: 'system', priority: 'low' }),
      makeNotification({ id: '3', status: 'pending', source: 'agent', priority: 'high' }),
    ];
    const result = summarizeNotifications(notifications);
    expect(result.pending).toBe(2);
  });

  it('groups bySource correctly', () => {
    const notifications = [
      makeNotification({ id: '1', status: 'pending', source: 'agent', priority: 'medium' }),
      makeNotification({ id: '2', status: 'pending', source: 'system', priority: 'low' }),
      makeNotification({ id: '3', status: 'pending', source: 'agent', priority: 'high' }),
    ];
    const result = summarizeNotifications(notifications);
    expect(result.bySource).toEqual({ agent: 2, system: 1 });
  });

  it('groups byPriority correctly', () => {
    const notifications = [
      makeNotification({ id: '1', status: 'pending', source: 'a', priority: 'high' }),
      makeNotification({ id: '2', status: 'pending', source: 'a', priority: 'high' }),
      makeNotification({ id: '3', status: 'pending', source: 'a', priority: 'low' }),
    ];
    const result = summarizeNotifications(notifications);
    expect(result.byPriority).toEqual({ high: 2, low: 1 });
  });

  it('collects notificationIds of pending notifications only', () => {
    const notifications = [
      makeNotification({ id: 'p1', status: 'pending', source: 'a', priority: 'medium' }),
      makeNotification({ id: 's1', status: 'seen', source: 'a', priority: 'low' }),
    ];
    const result = summarizeNotifications(notifications);
    expect(result.notificationIds).toEqual(['p1']);
  });

  it('returns zero pending for all-seen notifications', () => {
    const notifications = [makeNotification({ id: '1', status: 'seen', source: 'a', priority: 'low' })];
    const result = summarizeNotifications(notifications);
    expect(result.pending).toBe(0);
    expect(result.bySource).toEqual({});
    expect(result.notificationIds).toEqual([]);
  });

  it('sets threadId from first notification', () => {
    const notifications = [
      makeNotification({ threadId: 'thread-xyz', status: 'pending', source: 'a', priority: 'medium' }),
    ];
    const result = summarizeNotifications(notifications);
    expect(result.threadId).toBe('thread-xyz');
  });

  it('sets resourceId from first notification when present', () => {
    const notifications = [makeNotification({ resourceId: 'res-1', status: 'pending', source: 'a', priority: 'low' })];
    expect(summarizeNotifications(notifications).resourceId).toBe('res-1');
  });

  it('handles empty notifications array', () => {
    const result = summarizeNotifications([]);
    expect(result.pending).toBe(0);
    expect(result.bySource).toEqual({});
    expect(result.notificationIds).toEqual([]);
    expect(result.threadId).toBe('');
  });
});

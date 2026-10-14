import { describe, expect, it } from 'vitest';

import type { SessionListRow } from '../sessionRows';
import { SESSION_SORTS, compareSessionRows } from '../sessionSort';
import { factoryRow, testSession, testWorkItem, userRow } from './fixtures/sessionRows';

const sessionIds = (rows: SessionListRow[]) => rows.map(row => row.session.sessionId);

describe('compareSessionRows', () => {
  it.each(SESSION_SORTS)('keeps a pinned done row above an unpinned running row under %s', sort => {
    const rows = [
      userRow(
        'running',
        { createdAt: '2026-09-04T11:00:00.000Z', updatedAt: '2026-09-04T11:00:00.000Z' },
        { running: true },
      ),
      factoryRow(testSession('pinned'), { item: testWorkItem({ stages: ['done'] }), pinned: true }),
    ];

    expect(sessionIds(rows.sort(compareSessionRows(sort)))).toEqual(['pinned', 'running']);
  });

  it('orders activity as live work, then idle, then done, across factory and user rows whatever their age', () => {
    const rows = [
      factoryRow(testSession('done', { createdAt: '2026-09-04T12:00:00.000Z' }), {
        item: testWorkItem({ stages: ['done'] }),
      }),
      factoryRow(testSession('idle', { createdAt: '2026-09-04T11:00:00.000Z' })),
      userRow('running', { createdAt: '2026-09-04T08:00:00.000Z' }, { running: true }),
    ];

    expect(sessionIds(rows.sort(compareSessionRows('activity')))).toEqual(['running', 'idle', 'done']);
  });

  it('orders by last update even when creation order disagrees', () => {
    const rows = [
      userRow('created-last', { createdAt: '2026-09-04T12:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z' }),
      factoryRow(
        testSession('updated-last', { createdAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T11:00:00.000Z' }),
      ),
    ];

    expect(sessionIds(rows.sort(compareSessionRows('updated')))).toEqual(['updated-last', 'created-last']);
  });

  it('orders by creation even when update order disagrees', () => {
    const rows = [
      userRow('updated-last', { createdAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T12:00:00.000Z' }),
      userRow('created-last', { createdAt: '2026-09-04T11:00:00.000Z' }),
    ];

    expect(sessionIds(rows.sort(compareSessionRows('created')))).toEqual(['created-last', 'updated-last']);
  });

  it('breaks timestamp ties by session id so the order never flickers', () => {
    const rows = [userRow('a'), userRow('c'), userRow('b')];

    expect(sessionIds(rows.sort(compareSessionRows('created')))).toEqual(['c', 'b', 'a']);
  });
});

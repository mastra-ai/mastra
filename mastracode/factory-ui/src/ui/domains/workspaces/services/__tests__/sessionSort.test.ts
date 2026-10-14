import { describe, expect, it } from 'vitest';

import { WORKSPACE_SESSION_SORTS, compareUserSessions, compareWorkspaceRows } from '../sessionSort';
import type { SortableWorkspaceRow } from '../sessionSort';
import type { FactoryUserSession } from '../user-sessions';

function row(sessionId: string, overrides: Partial<SortableWorkspaceRow> = {}): SortableWorkspaceRow {
  return {
    pinned: false,
    initializing: false,
    running: false,
    attention: false,
    settled: false,
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
    workspace: { sessionId },
    ...overrides,
  };
}

function userSession(sessionId: string, overrides: Partial<FactoryUserSession> = {}): FactoryUserSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId: 'repo-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title: sessionId,
    branch: `user/${sessionId}`,
    baseBranch: 'main',
    sandboxId: 'sandbox-1',
    sandboxWorkdir: '/workspace',
    materializedAt: '2026-09-04T09:00:00.000Z',
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
    ...overrides,
  };
}

const sessionIds = (rows: { workspace: { sessionId: string } }[]) => rows.map(item => item.workspace.sessionId);

describe('compareWorkspaceRows', () => {
  it.each(WORKSPACE_SESSION_SORTS)('keeps a pinned settled row above an unpinned running row under %s', sort => {
    const rows = [
      row('running', { running: true, createdAt: '2026-09-04T11:00:00.000Z', updatedAt: '2026-09-04T11:00:00.000Z' }),
      row('pinned', { pinned: true, settled: true }),
    ];

    expect(sessionIds(rows.sort(compareWorkspaceRows(sort)))).toEqual(['pinned', 'running']);
  });

  it('orders activity as running, then idle, then settled, whatever their age', () => {
    const rows = [
      row('settled', { settled: true, createdAt: '2026-09-04T12:00:00.000Z' }),
      row('idle', { createdAt: '2026-09-04T11:00:00.000Z' }),
      row('running', { running: true, createdAt: '2026-09-04T08:00:00.000Z' }),
    ];

    expect(sessionIds(rows.sort(compareWorkspaceRows('activity')))).toEqual(['running', 'idle', 'settled']);
  });

  it('orders by last update even when creation order disagrees', () => {
    const rows = [
      row('created-last', { createdAt: '2026-09-04T12:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z' }),
      row('updated-last', { createdAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T11:00:00.000Z' }),
    ];

    expect(sessionIds(rows.sort(compareWorkspaceRows('updated')))).toEqual(['updated-last', 'created-last']);
  });

  it('breaks timestamp ties by session id so the order never flickers', () => {
    expect(sessionIds([row('a'), row('c'), row('b')].sort(compareWorkspaceRows('created')))).toEqual(['c', 'b', 'a']);
  });
});

describe('compareUserSessions', () => {
  it('puts pinned sessions first, then the newest created', () => {
    const sessions = [
      userSession('old', { createdAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T12:00:00.000Z' }),
      userSession('new', { createdAt: '2026-09-04T11:00:00.000Z' }),
      userSession('pinned', { createdAt: '2026-09-04T07:00:00.000Z' }),
    ];

    expect(sessions.sort(compareUserSessions('created', new Set(['pinned']))).map(item => item.sessionId)).toEqual([
      'pinned',
      'new',
      'old',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { createTriageWorkRegistry } from '../boards/test-utils.js';
import { sessionRowsQuerySchema } from '../routes/contracts.js';
import type { SessionRow } from '../routes/contracts.js';
import { testCard } from '../routes/test-utils.js';
import { isSettling, sessionActivity, sessionRowsView } from './session-row-view.js';
import type { SessionRowsView } from './session-row-view.js';
import { sessionRows } from './session-rows.js';
import type { RowSession } from './session-rows.js';

const VIEWER = 'user-1';
const NOW = Date.parse('2026-09-04T12:00:00.000Z');
const AT = '2026-09-04T09:00:00.000Z';

function row(
  sessionId: string,
  overrides: Partial<SessionRow> = {},
  session: Partial<SessionRow['session']> = {},
): SessionRow {
  return {
    session: {
      id: `row-${sessionId}`,
      sessionId,
      projectRepositoryId: 'repo-1',
      userId: VIEWER,
      branch: `factory/issue-${sessionId}`,
      title: null,
      visibility: 'org',
      createdAt: AT,
      ...session,
    },
    origin: 'factory',
    board: 'work',
    status: 'idle',
    pinned: false,
    updatedAt: AT,
    ...overrides,
  };
}

function userRow(sessionId: string, overrides: Partial<SessionRow> = {}, session: Partial<SessionRow['session']> = {}) {
  const { board: _board, ...base } = row(
    sessionId,
    { origin: 'user', ...overrides },
    { branch: `user/${sessionId}`, ...session },
  );
  return base;
}

function viewOf(query: Record<string, string | string[]> = {}): SessionRowsView {
  const { pin: _pin, children: _children, ...view } = sessionRowsQuerySchema.parse(query);
  return view;
}

function listed(rows: readonly SessionRow[], query: Record<string, string | string[]> = {}) {
  return sessionRowsView(rows, viewOf(query), VIEWER, NOW);
}

function sessionIds(rows: readonly SessionRow[], query: Record<string, string | string[]> = {}) {
  return listed(rows, query).groups.flatMap(group => group.rows.map(entry => entry.session.sessionId));
}

function groupSummary(rows: readonly SessionRow[], query: Record<string, string | string[]>) {
  return listed(rows, query).groups.map(group => [group.key, group.rows.map(entry => entry.session.sessionId)]);
}

describe('session order', () => {
  it.each(['activity', 'updated', 'created'])(
    'keeps a pinned done row above an unpinned running row under %s',
    sort => {
      const rows = [
        userRow(
          'running',
          { status: 'working', updatedAt: '2026-09-04T11:00:00.000Z' },
          { createdAt: '2026-09-04T11:00:00.000Z' },
        ),
        row('pinned', { status: 'done', pinned: true }),
      ];

      expect(sessionIds(rows, { sort })).toEqual(['pinned', 'running']);
    },
  );

  it('orders activity as live work, then idle, then done, across factory and user rows whatever their age', () => {
    const rows = [
      row('done', { status: 'done' }, { createdAt: '2026-09-04T12:00:00.000Z' }),
      row('idle', {}, { createdAt: '2026-09-04T11:00:00.000Z' }),
      userRow('running', { status: 'working' }, { createdAt: '2026-09-04T08:00:00.000Z' }),
    ];

    expect(sessionIds(rows, { sort: 'activity' })).toEqual(['running', 'idle', 'done']);
  });

  it('orders by last update even when creation order disagrees', () => {
    const rows = [
      userRow('created-last', { updatedAt: '2026-09-04T10:00:00.000Z' }, { createdAt: '2026-09-04T12:00:00.000Z' }),
      row('updated-last', { updatedAt: '2026-09-04T11:00:00.000Z' }, { createdAt: '2026-09-04T08:00:00.000Z' }),
    ];

    expect(sessionIds(rows, { sort: 'updated' })).toEqual(['updated-last', 'created-last']);
  });

  it('orders by creation even when update order disagrees', () => {
    const rows = [
      userRow('updated-last', { updatedAt: '2026-09-04T12:00:00.000Z' }, { createdAt: '2026-09-04T08:00:00.000Z' }),
      userRow('created-last', {}, { createdAt: '2026-09-04T11:00:00.000Z' }),
    ];

    expect(sessionIds(rows, { sort: 'created' })).toEqual(['created-last', 'updated-last']);
  });

  it('breaks timestamp ties by session id so the order never flickers', () => {
    expect(sessionIds([userRow('a'), userRow('c'), userRow('b')], { sort: 'created' })).toEqual(['c', 'b', 'a']);
  });
});

describe('session filters', () => {
  it('filters mine and specific owners by stable user id', () => {
    const rows = [userRow('session-1', {}, { userId: 'user-2' }), userRow('session-2')];

    expect(sessionIds(rows, { owner: 'mine' })).toEqual(['session-2']);
    expect(sessionIds(rows, { owner: 'owner:user-2' })).toEqual(['session-1']);
  });

  it('combines status and updated filters with an inclusive cutoff', () => {
    const rows = [
      userRow('recent-working', { status: 'working', updatedAt: '2026-09-04T11:00:00.000Z' }),
      userRow('old-working', { status: 'working', updatedAt: '2026-09-03T11:59:59.999Z' }),
      userRow('recent-idle', { updatedAt: '2026-09-03T12:00:00.000Z' }),
    ];

    expect(sessionIds(rows, { status: 'working', updated: '24h' })).toEqual(['recent-working']);
    expect(sessionIds(rows, { updated: '24h' })).toEqual(['recent-working', 'recent-idle']);
  });

  it('keeps only done rows under Done and only rows awaiting a person under Waiting on you', () => {
    const rows = [
      row('done', { status: 'done' }),
      row('waiting', { status: 'waiting' }),
      row('idle'),
      userRow('user-idle'),
    ];

    expect(sessionIds(rows, { status: 'done' })).toEqual(['done']);
    expect(sessionIds(rows, { status: 'waiting' })).toEqual(['waiting']);
  });

  it('counts every row in total and only the matching ones in matching', () => {
    const answer = listed([row('a', { status: 'done' }), row('b'), row('c')], { status: 'idle' });

    expect([answer.total, answer.matching, answer.groups.map(group => group.total)]).toEqual([3, 2, [2]]);
  });
});

describe('a card with its sessions revealed', () => {
  const ref = (sessionId: string) => ({
    sessionId,
    branch: `factory/${sessionId}`,
    threadId: `${sessionId}-thread`,
    startedBy: VIEWER,
  });
  const session = (sessionId: string): RowSession => ({
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId: 'repo-1',
    userId: VIEWER,
    branch: `factory/${sessionId}`,
    title: null,
    visibility: 'org',
    materializedAt: new Date(AT),
    createdAt: new Date(AT),
    updatedAt: new Date(AT),
  });
  const revealed = sessionRows({
    sessions: [session('triage'), session('work'), session('review')],
    cards: [
      testCard('c1', {
        stages: ['execute'],
        sessions: { triage: ref('triage'), work: ref('work'), review: ref('review') },
      }),
    ],
    boards: createTriageWorkRegistry(),
    awaitingPerson: new Set(),
    runningSessionIds: new Set(['review']),
    parkedSessionIds: new Set(),
    viewerUserId: VIEWER,
    pinnedSessionIds: new Set(),
    revealChildSessions: true,
  });
  const cardsAndChildren = (query: Record<string, string>) =>
    listed(revealed, query).groups.flatMap(group =>
      group.rows.map(entry => [entry.session.sessionId, entry.childRows?.map(child => child.session.sessionId)]),
    );

  it('keeps a card under a status filter when one of its sessions matches, listing only the ones that do', () => {
    expect(cardsAndChildren({ status: 'working' })).toEqual([['work', ['review']]]);
    expect(cardsAndChildren({ status: 'idle' })).toEqual([['work', ['triage']]]);
  });

  it("groups a card by what its sessions carry, as it does when they're hidden", () => {
    expect(groupSummary(revealed, { groupBy: 'status' })).toEqual([['status:working', ['work']]]);
  });

  it('keeps the card listed while one of its sessions is open', () => {
    const rows = [...Array.from({ length: 6 }, (_, index) => row(`a-${index}`, { status: 'working' })), ...revealed];

    expect(listed(rows, { open: 'triage' }).groups[0]?.rows.at(-1)?.session.sessionId).toBe('work');
  });
});

describe('session groups', () => {
  it('groups by board, with people and Slack apart, in the order the rows sort', () => {
    const rows = [
      userRow('web-1', {}, { createdAt: '2026-09-04T11:00:00.000Z' }),
      userRow('slack-1', {}, { branch: 'slack/123.456', createdAt: '2026-09-04T10:00:00.000Z' }),
      row('release-1', { board: 'release' }, { createdAt: '2026-09-04T09:30:00.000Z' }),
      row('work-1'),
      userRow('slack-2', {}, { branch: 'slack/789.012', createdAt: '2026-09-04T08:00:00.000Z' }),
    ];

    expect(groupSummary(rows, { groupBy: 'board', sort: 'created' })).toEqual([
      ['user', ['web-1']],
      ['slack', ['slack-1', 'slack-2']],
      ['board:release', ['release-1']],
      ['board:work', ['work-1']],
    ]);
  });

  it('groups by status', () => {
    const rows = [
      userRow('idle-1'),
      row('init-1', { status: 'initializing' }),
      row('waiting-1', { status: 'waiting' }),
    ];

    expect(groupSummary(rows, { groupBy: 'status', sort: 'created' })).toEqual([
      ['status:waiting', ['waiting-1']],
      ['status:initializing', ['init-1']],
      ['status:idle', ['idle-1']],
    ]);
  });

  it('groups by owner', () => {
    const rows = [userRow('zoe-1', {}, { userId: 'zoe' }), userRow('mine-1'), userRow('zoe-2', {}, { userId: 'zoe' })];

    expect(groupSummary(rows, { groupBy: 'owner', sort: 'created' })).toEqual([
      ['owner:zoe', ['zoe-2', 'zoe-1']],
      [`owner:${VIEWER}`, ['mine-1']],
    ]);
  });

  it('puts every row in one group with no grouping', () => {
    expect(groupSummary([row('work-1'), userRow('user-1'), row('review-1')], { sort: 'created' })).toEqual([
      ['all', ['work-1', 'user-1', 'review-1']],
    ]);
  });
});

describe('group window', () => {
  const rows = Array.from({ length: 8 }, (_, index) =>
    row(`work-${index + 1}`, {}, { createdAt: `2026-09-04T0${8 - index}:00:00.000Z` }),
  );
  const windowed = (query: Record<string, string | string[]>) => listed(rows, { sort: 'created', ...query }).groups[0];

  it('lists the first five rows of each group and counts the rest', () => {
    const otherBoard = Array.from({ length: 6 }, (_, index) => row(`release-${index}`, { board: 'release' }));
    const answer = listed([...rows, ...otherBoard], { groupBy: 'board' });

    expect(answer.groups.map(group => [group.key, group.rows.length, group.total])).toEqual([
      ['board:release', 5, 6],
      ['board:work', 5, 8],
    ]);
  });

  it('lists a group as deep as the reader asked, and other groups at five', () => {
    const otherBoard = Array.from({ length: 6 }, (_, index) => row(`release-${index}`, { board: 'release' }));
    const answer = listed([...rows, ...otherBoard], { groupBy: 'board', window: ['board:work:7'] });

    expect(answer.groups.map(group => [group.key, group.rows.length])).toEqual([
      ['board:release', 5],
      ['board:work', 7],
    ]);
  });

  it('keeps the open session listed when it sorts past the fold, and says where it lies', () => {
    const group = windowed({ open: 'work-7' });

    expect(group?.rows.map(entry => entry.session.sessionId)).toEqual([
      'work-1',
      'work-2',
      'work-3',
      'work-4',
      'work-5',
      'work-7',
    ]);
    expect(group?.openIndex).toBe(6);
  });

  it('lists the open session in the last slot when a deeper window still stops short of it', () => {
    const group = windowed({ open: 'work-8', window: ['all:6'] });

    expect(group?.rows.map(entry => entry.session.sessionId)).toEqual([
      'work-1',
      'work-2',
      'work-3',
      'work-4',
      'work-5',
      'work-6',
      'work-8',
    ]);
  });

  it("finds the open session among a folded card's sessions", () => {
    const folded = [
      ...rows,
      row('card', { cardSessionIds: ['card', 'other'] }, { createdAt: '2026-09-04T00:00:00.000Z' }),
    ];

    expect(listed(folded, { sort: 'created', open: 'other' }).groups[0]?.openIndex).toBe(8);
  });

  it('sends no open index when the open session is not in the group', () => {
    expect(windowed({ open: 'elsewhere' })).not.toHaveProperty('openIndex');
  });
});

describe('boards and owners', () => {
  it('lists every board and owner a row has, whatever the filters', () => {
    const answer = listed(
      [
        row(
          'a',
          { board: 'release' },
          { userId: 'zoe', owner: { id: 'zoe', name: 'Zoe', avatarUrl: 'https://a/zoe.png' } },
        ),
        row('b'),
        userRow('c', {}, { owner: { id: VIEWER, name: 'Ada' } }),
      ],
      { owner: 'owner:nobody' },
    );

    expect(answer.matching).toBe(0);
    expect(answer.boards).toEqual(['release', 'work']);
    expect(answer.owners).toEqual([
      { userId: VIEWER, name: 'Ada' },
      { userId: 'zoe', name: 'Zoe', avatarUrl: 'https://a/zoe.png' },
    ]);
  });
});

describe('isSettling', () => {
  const coming = (updatedAt: number) => ({ materializedAt: null, updatedAt: new Date(updatedAt) });

  it('settles a session still coming up for ten minutes, then stops waiting on it', () => {
    expect(isSettling([coming(NOW - 10 * 60_000 + 1)], NOW)).toBe(true);
    expect(isSettling([coming(NOW - 10 * 60_000)], NOW)).toBe(false);
    expect(isSettling([{ materializedAt: new Date(NOW), updatedAt: new Date(NOW) }], NOW)).toBe(false);
  });
});

describe('sessionActivity', () => {
  const session = (sessionId: string, materializedAt: Date | null = new Date(AT)): RowSession => ({
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId: null,
    userId: VIEWER,
    branch: `user/${sessionId}`,
    title: null,
    visibility: 'org',
    materializedAt,
    createdAt: new Date(AT),
    updatedAt: new Date(AT),
  });
  const ref = (sessionId: string) => ({
    sessionId,
    branch: `factory/${sessionId}`,
    threadId: sessionId,
    startedBy: VIEWER,
  });

  it("reports runs on the project's sessions only, and counts each card once by its most urgent session", () => {
    const activity = sessionActivity({
      sessions: [session('listed'), session('coming', null)],
      cards: [
        testCard('working', { sessions: { work: ref('card-run') } }),
        testCard('waiting', { sessions: { work: ref('parked'), review: ref('parked-and-running') } }),
        testCard('quiet', { sessions: { work: ref('quiet') } }),
      ],
      runningSessionIds: new Set(['listed', 'card-run', 'parked-and-running', 'elsewhere', VIEWER]),
      parkedSessionIds: new Set(['parked']),
      now: NOW,
    });

    expect(activity).toEqual({
      runningSessionIds: ['card-run', 'listed', 'parked-and-running'],
      parkedSessionIds: ['parked'],
      initializingSessionIds: ['coming'],
      cards: { working: 1, waiting: 1 },
      settling: false,
    });
  });
});

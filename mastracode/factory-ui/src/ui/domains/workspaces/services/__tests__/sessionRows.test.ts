import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { SESSION_ROW_PINS_MAX } from '@mastra/factory/session/session-row-query';
import { describe, expect, it } from 'vitest';

import type { SessionRowWire } from '../../../../../api/types';
import { pinnedSessionsAfter, presentSessionRow, sessionOwners } from '../sessionRows';
import { sessionRowsRequest } from '../sessionRowReads';
import type { SessionRowPresentation } from '../sessionRows';

const FACTORY_ID = 'factory-1';

function wireRow(sessionId: string, overrides: Partial<SessionRowWire> = {}): SessionRowWire {
  const { session, ...rest } = overrides;
  return {
    session: {
      id: `row-${sessionId}`,
      sessionId,
      projectRepositoryId: 'repo-1',
      userId: 'user-1',
      branch: `factory/${sessionId}`,
      title: null,
      visibility: 'org',
      createdAt: '2026-09-01T00:00:00.000Z',
      ...session,
    },
    origin: 'factory',
    board: 'work',
    status: 'idle',
    pinned: false,
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...rest,
  };
}

function card(overrides: Partial<NonNullable<SessionRowWire['card']>> = {}): NonNullable<SessionRowWire['card']> {
  return { id: 'card-1', title: 'Fix the login', workItemUrl: null, externalSource: null, ...overrides };
}

const presentation: SessionRowPresentation = {
  factoryId: FACTORY_ID,
  openSessionId: undefined,
  viewer: { userId: 'user-1', name: 'Ada Viewer' },
  repositories: [{ projectRepositoryId: 'repo-1', slug: 'acme/app' }],
};

const pullRequestUrl = 'https://github.com/acme/app/pull/43';
const mergeRequestUrl = 'https://gitlab.com/acme/app/-/merge_requests/43';
const linearSource = {
  integrationId: 'linear',
  type: 'issue',
  externalId: 'FACT-528',
  url: 'https://linear.app/acme/issue/FACT-528',
};

const present = (wire: SessionRowWire, overrides: Partial<SessionRowPresentation> = {}) =>
  presentSessionRow(wire, { ...presentation, ...overrides });

describe('presentSessionRow', () => {
  it('opens a factory session on its own thread, inside its workspace, with its repository', () => {
    const row = present(wireRow('s1'));

    expect(row).toMatchObject({
      origin: 'factory',
      url: `/factories/${FACTORY_ID}/workspaces/s1`,
      openPath: `/factories/${FACTORY_ID}/workspaces/s1/threads/s1`,
      repository: 'acme/app',
    });
  });

  it('opens a user session on its user thread', () => {
    const row = present(wireRow('u1', { origin: 'user' }));

    expect(row).toMatchObject({
      origin: 'user',
      board: undefined,
      url: `/factories/${FACTORY_ID}/user/threads/u1`,
      openPath: `/factories/${FACTORY_ID}/user/threads/u1`,
    });
    expect(row.repository).toBeUndefined();
  });

  it.each([
    [
      'a factory session by its title',
      wireRow('s1', { session: { ...wireRow('s1').session, title: 'Ship it' } }),
      'Ship it',
    ],
    ['a factory session with no title by its branch', wireRow('s1'), 'factory/s1'],
    [
      'an untitled Slack factory session by its card',
      wireRow('s1', { session: { ...wireRow('s1').session, branch: 'slack/1.2' }, card: card() }),
      'Fix the login',
    ],
    [
      'an untitled Slack user session by its card',
      wireRow('u1', { origin: 'user', session: { ...wireRow('u1').session, branch: 'slack/1.2' }, card: card() }),
      'Fix the login',
    ],
    [
      'a fresh user session as new',
      wireRow('u1', { origin: 'user', session: { ...wireRow('u1').session, branch: 'user/session-u1' } }),
      'New session',
    ],
  ] as const)('names %s', (_case, wire, name) => {
    expect(present(wire).name).toBe(name);
  });

  it('marks a folded card row open while any of its sessions is', () => {
    const wire = wireRow('work', { cardSessionIds: ['work', 'triage'] });

    expect(present(wire, { openSessionId: 'triage' }).active).toBe(true);
    expect(present(wire, { openSessionId: 'other' }).active).toBe(false);
    expect(present(wireRow('s1'), { openSessionId: 's1' }).active).toBe(true);
    expect(present(wireRow('s1'), { openSessionId: undefined }).active).toBe(false);
  });

  it('draws the sessions listed under a row, each open on its own', () => {
    const row = present(
      wireRow('work', {
        childRows: [{ ...wireRow('review'), phaseLabel: 'Review', runByFactory: true, waitingSessionId: 'review' }],
      }),
      { openSessionId: 'review' },
    );

    expect(row.active).toBe(false);
    expect(row.childRows).toEqual([
      expect.objectContaining({
        url: `/factories/${FACTORY_ID}/workspaces/review`,
        active: true,
        phaseLabel: 'Review',
        runByFactory: true,
        waitingSessionId: 'review',
      }),
    ]);
  });

  it("names the viewer's own sessions by their profile and lets only them act as owner", () => {
    const own = present(wireRow('s1'));
    const theirs = present(
      wireRow('s2', { session: { ...wireRow('s2').session, userId: 'user-2', owner: { id: 'user-2', name: 'Zoe' } } }),
    );

    expect(own).toMatchObject({ owner: { name: 'Ada Viewer' }, ownedByViewer: true });
    expect(theirs).toMatchObject({ owner: { name: 'Zoe' }, ownedByViewer: false });
    expect(present(wireRow('s2'), { viewer: undefined }).ownedByViewer).toBe(true);
  });

  const slackSession = { ...wireRow('s1').session, branch: 'slack/1791936483-798759' };

  it.each([
    ['an owned user session', true, wireRow('s1', { origin: 'user' }), presentation.viewer],
    ['an owned Slack session', true, wireRow('s1', { session: slackSession }), presentation.viewer],
    ['an owned work session', false, wireRow('s1'), presentation.viewer],
    ["another owner's Slack session", false, wireRow('s1', { session: slackSession }), { userId: 'user-2' }],
  ] as const)('offers title regeneration for %s: %s', (_case, offered, wire, viewer) => {
    expect(present(wire, { viewer }).canRegenerateTitle).toBe(offered);
  });

  it('shows where a card came from, falling back to a review branch without a card', () => {
    expect(present(wireRow('s1', { card: card({ externalSource: linearSource }) })).source).toBe('linear-issue');
    expect(present(wireRow('s1', { session: { ...wireRow('s1').session, branch: 'factory/pr-2' } })).source).toBe(
      'github-pr',
    );
  });

  it('reads the change request state of a factory row', () => {
    const row = present(
      wireRow('s1', {
        threadId: 's1-thread',
        pullRequest: { provider: 'github', url: pullRequestUrl, number: 43, status: 'merged', draft: false },
      }),
    );

    expect(row).toMatchObject({ threadId: 's1-thread', pullRequestStatus: 'merged' });
  });
});

describe('external links', () => {
  it.each([
    [
      'the Slack thread and its pull request',
      card({
        externalSource: { integrationId: 'slack', type: 'slack-thread', externalId: 'slack:C1:1.2', workspaceId: 'T1' },
        workItemUrl: '/factories/factory-1/workspaces/s1',
      }),
      { provider: 'github', url: pullRequestUrl, draft: false },
      [
        ['Open in Slack', 'https://app.slack.com/client/T1/C1/thread/C1-1.2'],
        ['Open pull request', pullRequestUrl],
      ],
    ],
    [
      'a merge request once when it is the source',
      card({
        externalSource: { integrationId: 'gitlab', type: 'pull-request', externalId: '43' },
        workItemUrl: mergeRequestUrl,
      }),
      { provider: 'gitlab', url: mergeRequestUrl, draft: false },
      [['Open merge request', mergeRequestUrl]],
    ],
    [
      'an issue tracker by name',
      card({ externalSource: linearSource }),
      undefined,
      [['Open in Linear', linearSource.url]],
    ],
    ['nothing for a card without a link', card(), undefined, []],
  ] as const)('offers %s', (_case, rowCard, pullRequest, links) => {
    const row = present(wireRow('s1', { card: rowCard, ...(pullRequest ? { pullRequest } : {}) }));

    expect(row.externalLinks.map(link => [link.label, link.url])).toEqual(links);
  });
});

describe('pinnedSessionsAfter', () => {
  it("unpins every session of a card's row, and pins only the session it shows", () => {
    const shown = present(wireRow('work', { pinned: true, cardSessionIds: ['work', 'triage'] }));

    expect([...pinnedSessionsAfter(new Set(['triage', 'other']), shown, false)]).toEqual(['other']);
    expect([...pinnedSessionsAfter(new Set(), shown, true)]).toEqual(['work']);
  });

  it('pins again a session whose pin fell past the newest the sidebar sends', () => {
    const newer = Array.from({ length: SESSION_ROW_PINS_MAX }, (_, index) => `newer-${index}`);
    const repinned = pinnedSessionsAfter(new Set(['old', ...newer]), present(wireRow('old')), true);

    const { pin } = sessionRowsRequest({
      sort: 'activity',
      groupBy: 'none',
      filters: { owner: 'all', source: 'all', status: 'all', updated: 'all' },
      pinned: repinned,
      open: undefined,
      children: false,
      windows: {},
    });

    expect(pin).toContain('old');
  });
});

describe('sessionRowsRequest', () => {
  it('sends the windows of the groups opened last, as many as the server accepts', () => {
    const opened = Array.from({ length: 65 }, (_, index) => [`board:board-${index}`, 25] as const);

    const { windows } = sessionRowsRequest({
      sort: 'activity',
      groupBy: 'board',
      filters: { owner: 'all', source: 'all', status: 'all', updated: 'all' },
      pinned: new Set(),
      open: undefined,
      children: false,
      windows: Object.fromEntries(opened),
    });

    const query = FACTORY_ROUTE_CONTRACTS.sessionRows.querySchema.safeParse({
      window: Object.entries(windows).map(([group, count]) => `${group}:${count}`),
    });
    expect(query.success).toBe(true);
    expect(windows).toHaveProperty(['board:board-64'], 25);
    expect(windows).not.toHaveProperty(['board:board-0']);
  });
});

describe('sessionOwners', () => {
  it('names owners as their rows do, sorted by name', () => {
    const owners = sessionOwners(
      [
        { userId: 'factory-project:p1' },
        { userId: 'user-1', name: 'ada' },
        { userId: 'user-2', name: 'Bea' },
        { userId: 'user-3' },
      ],
      presentation.viewer,
    );

    expect(owners).toEqual([
      { userId: 'user-1', name: 'Ada Viewer' },
      { userId: 'user-2', name: 'Bea' },
      { userId: 'factory-project:p1', name: 'Factory' },
      { userId: 'user-3', name: 'user-3' },
    ]);
  });
});

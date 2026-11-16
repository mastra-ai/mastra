import { describe, expect, it } from 'vitest';

import { defineBoard } from '../boards/index.js';
import { createTriageWorkRegistry } from '../boards/test-utils.js';
import { testCard } from '../routes/test-utils.js';
import type { Card, ExternalWorkItemSource } from '../storage/domains/work-items/base.js';
import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';
import { runningSessionIds, sessionRows } from './session-rows.js';
import type { RowSession, SessionRowFacts } from './session-rows.js';

const VIEWER = 'user-1';
const PROJECT = '00000000-0000-4000-8000-0000000000aa';
const FACTORY = `factory-project:${PROJECT}`;
const AT = new Date('2026-09-04T09:00:00.000Z');

const releaseBoard = defineBoard({
  id: 'release',
  name: 'Release Preview',
  initialPhase: 'queued',
  phases: {
    queued: { name: 'Queued', kind: 'resting', nextPhases: ['preparing'] },
    preparing: {
      name: 'Preparing',
      kind: 'working',
      runner: { context: 'release-preparer' },
      nextPhases: ['shipping'],
    },
    shipping: { name: 'Shipping', kind: 'working', runner: { context: 'release-publisher' }, nextPhases: ['shipped'] },
    shipped: { name: 'Shipped', kind: 'terminal' },
  },
});
const boards = createTriageWorkRegistry(releaseBoard);

function testSession(sessionId: string, overrides: Partial<RowSession> = {}): RowSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId: 'repo-1',
    userId: VIEWER,
    branch: `factory/issue-${sessionId}`,
    title: null,
    visibility: 'org',
    materializedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

function personSession(sessionId: string, overrides: Partial<RowSession> = {}): RowSession {
  return testSession(sessionId, { branch: `user/${sessionId}`, ...overrides });
}

function ref(sessionId: string) {
  return { sessionId, branch: `factory/issue-${sessionId}`, threadId: `${sessionId}-thread`, startedBy: VIEWER };
}

function rowsOf(facts: Partial<SessionRowFacts> & Pick<SessionRowFacts, 'sessions'>) {
  return sessionRows({
    cards: [],
    boards,
    awaitingPerson: new Set(),
    runningSessionIds: new Set(),
    parkedSessionIds: new Set(),
    viewerUserId: VIEWER,
    pinnedSessionIds: new Set(),
    revealChildSessions: false,
    ...facts,
  });
}

function onlyRow(facts: Partial<SessionRowFacts> & Pick<SessionRowFacts, 'sessions'>) {
  const [row, ...others] = rowsOf(facts);
  expect(others).toEqual([]);
  return row;
}

const pullRequestSource = (
  integrationId: 'github' | 'gitlab',
  url: string,
  externalId = url,
): ExternalWorkItemSource => ({ integrationId, type: 'pull-request', externalId, url });

function pullRequestCard(id: string, overrides: Partial<Card> = {}, state: string | null = 'open'): Card {
  const card = testCard(id, { externalSource: pullRequestSource('github', `https://github.com/acme/app/pull/${id}`) });
  return {
    ...card,
    workItem: { ...card.workItem, provider: 'github', url: `https://github.com/acme/app/pull/${id}`, state },
    ...overrides,
  };
}

function sourceRow(overrides: Partial<WorkItemSourceRow>): WorkItemSourceRow {
  return {
    id: 'source-1',
    workItemId: 'work-c1',
    provider: 'github',
    integrationId: 'github',
    sourceType: 'issue',
    workspaceId: null,
    externalId: 'acme/app#73',
    sourceKey: null,
    key: null,
    url: null,
    state: 'open',
    labels: [],
    author: null,
    metadata: null,
    revision: 1,
    syncedAt: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

describe('the board of a session row', () => {
  it('puts a pull request card from before boards existed on Work', () => {
    const card = pullRequestCard('c1', { board: null, sessions: { review: ref('s1') } });

    expect(onlyRow({ sessions: [testSession('s1')], cards: [card] })?.board).toBe('work');
  });

  it("follows the card's custom board", () => {
    const card = testCard('c1', { board: 'release', stages: ['queued'], sessions: { work: ref('s1') } });

    expect(onlyRow({ sessions: [testSession('s1')], cards: [card] })?.board).toBe('release');
  });

  it('puts a Factory session with no card on Work, and a person session on no board', () => {
    const rows = rowsOf({ sessions: [testSession('loose'), personSession('mine')] });

    expect(rows.map(row => [row.session.sessionId, row.board])).toEqual([
      ['loose', 'work'],
      ['mine', undefined],
    ]);
  });
});

describe('session row status', () => {
  const doneCard = testCard('c1', { stages: ['done'], sessions: { work: ref('s1') } });

  it.each([
    [
      'a sandbox coming up over a parked run',
      { materializedAt: null },
      { parkedSessionIds: new Set(['s1']) },
      'initializing',
    ],
    ['a run on a finished card', {}, { cards: [doneCard], runningSessionIds: new Set(['s1']) }, 'working'],
    ['a parked run on a finished card', {}, { cards: [doneCard], parkedSessionIds: new Set(['s1']) }, 'waiting'],
    ['a quiet session on a finished card', {}, { cards: [doneCard] }, 'done'],
    ['a quiet session with no card', {}, {}, 'idle'],
    [
      'a card whose next step waits on a person',
      {},
      {
        cards: [testCard('c1', { stages: ['execute'], sessions: { work: ref('s1') } })],
        awaitingPerson: new Set(['c1']),
      },
      'waiting',
    ],
  ] as const)('reads %s as %s', (_case, session, facts, status) => {
    expect(onlyRow({ sessions: [testSession('s1', session)], ...facts })?.status).toBe(status);
  });

  it.each([
    ['shipped', 'done'],
    ['shipping', 'idle'],
  ] as const)('reads a quiet session in the %s phase of a custom board as %s', (phase, status) => {
    const card = testCard('c1', { board: 'release', stages: [phase], sessions: { work: ref('s1') } });

    expect(onlyRow({ sessions: [testSession('s1')], cards: [card] })?.status).toBe(status);
  });

  it('never reads a card on a board the project lacks as finished', () => {
    const card = testCard('c1', { board: 'gone', stages: ['done'], sessions: { work: ref('s1') } });

    expect(onlyRow({ sessions: [testSession('s1')], cards: [card] })?.status).toBe('idle');
  });

  it("reads a person's session by its run alone, parked or not", () => {
    const rows = rowsOf({
      sessions: [personSession('quiet'), personSession('busy', { materializedAt: null })],
      parkedSessionIds: new Set(['quiet']),
      runningSessionIds: new Set(['busy']),
    });

    expect(rows.map(row => [row.session.sessionId, row.status])).toEqual([
      ['quiet', 'idle'],
      ['busy', 'initializing'],
    ]);
  });

  it("dates a card's session by the card's last change, and a person's session by its own", () => {
    const card = testCard('c1', {
      stages: ['execute'],
      sessions: { work: ref('s1') },
      updatedAt: new Date('2026-09-05T10:00:00.000Z'),
    });
    const rows = rowsOf({ sessions: [testSession('s1'), personSession('mine')], cards: [card] });

    expect(rows.map(row => row.updatedAt)).toEqual(['2026-09-05T10:00:00.000Z', AT.toISOString()]);
  });
});

describe("a session row's pull request", () => {
  it.each(['github', 'gitlab'] as const)(
    'reads a merged %s request as merged without a legacy merged flag',
    provider => {
      const url = `https://${provider}.com/acme/app/pull/43`;
      const base = testCard('c1', { externalSource: pullRequestSource(provider, url), stages: ['pr-review'] });
      const card: Card = {
        ...base,
        sessions: { review: ref('s1') },
        metadata: { merged: false },
        workItem: { ...base.workItem, provider, url, state: 'merged', metadata: {} },
      };
      const row = onlyRow({ sessions: [testSession('s1')], cards: [card] });

      expect(row?.pullRequest).toMatchObject({ url, provider, status: 'merged' });
      expect(row?.status).toBe('done');
    },
  );

  it('carries the pull request an issue card opened, next to the issue', () => {
    const issueUrl = 'https://github.com/acme/app/issues/73';
    const pullRequestUrl = 'https://github.com/acme/app/pull/74';
    const base = testCard('c1', {
      externalSource: { integrationId: 'github', type: 'issue', externalId: 'acme/app#73', url: issueUrl },
      stages: ['execute'],
      sessions: { work: ref('s1') },
    });
    const card: Card = {
      ...base,
      workItem: {
        ...base.workItem,
        url: issueUrl,
        sources: [
          sourceRow({
            id: 'source-pull-request',
            sourceType: 'pull-request',
            url: pullRequestUrl,
            state: 'open',
            metadata: { githubPullRequestNumber: 74 },
          }),
        ],
      },
    };
    const row = onlyRow({ sessions: [testSession('s1')], cards: [card] });

    expect(row?.card).toMatchObject({ id: 'c1', workItemUrl: issueUrl });
    expect(row?.pullRequest).toMatchObject({ url: pullRequestUrl, number: 74, status: 'open' });
  });

  it('carries the most recently updated pull request card filed under the card', () => {
    const issue = testCard('c1', { stages: ['execute'], sessions: { work: ref('s1') } });
    const older = pullRequestCard('41', { parentWorkItemId: 'c1', updatedAt: new Date('2026-09-04T10:00:00.000Z') });
    const newer = pullRequestCard(
      '42',
      { parentWorkItemId: 'c1', updatedAt: new Date('2026-09-04T11:00:00.000Z') },
      'merged',
    );
    const row = onlyRow({ sessions: [testSession('s1')], cards: [older, issue, newer] });

    expect(row?.pullRequest).toMatchObject({ url: 'https://github.com/acme/app/pull/42', status: 'merged' });
    expect(row?.status).toBe('done');
  });

  it('names a legacy `plan` session after the context that shares it', () => {
    const card = testCard('c1', {
      stages: ['execute'],
      sessions: { plan: ref('s1'), work: { ...ref('s1'), threadId: 'work-thread' } },
    });

    expect(onlyRow({ sessions: [testSession('s1')], cards: [card] })?.threadId).toBe('work-thread');
  });
});

describe('one row per card', () => {
  const card = testCard('c1', {
    stages: ['execute'],
    sessions: { triage: ref('triage'), work: ref('work'), review: ref('review') },
  });
  const sessions = [testSession('triage'), testSession('work'), testSession('review')];

  it("keeps the card's current session and carries what its other sessions show", () => {
    const rows = rowsOf({
      sessions,
      cards: [card],
      pinnedSessionIds: new Set(['triage']),
      runningSessionIds: new Set(['review']),
    });

    expect(rows).toEqual([
      expect.objectContaining({
        session: expect.objectContaining({ sessionId: 'work' }),
        status: 'working',
        pinned: true,
        cardSessionIds: ['triage', 'work', 'review'],
      }),
    ]);
  });

  it("falls back to the card's next session when its current one is not listed", () => {
    const rows = rowsOf({ sessions: [testSession('review'), testSession('triage')], cards: [card] });

    expect(rows.map(row => row.session.sessionId)).toEqual(['triage']);
  });

  it('lists the other sessions under the card, named by phase, each with its own pin', () => {
    const [row, ...others] = rowsOf({
      sessions,
      cards: [card],
      pinnedSessionIds: new Set(['triage']),
      runningSessionIds: new Set(['review']),
      revealChildSessions: true,
    });

    expect(others).toEqual([]);
    expect(row).toMatchObject({ session: { sessionId: 'work' }, status: 'idle', cardStatus: 'working', pinned: false });
    expect(row?.cardSessionIds).toBeUndefined();
    expect(
      row?.childRows?.map(child => [child.session.sessionId, child.phaseLabel, child.status, child.pinned]),
    ).toEqual([
      ['triage', 'Triage', 'idle', true],
      ['review', 'Review', 'working', false],
    ]);
  });

  it('leaves sessions without a card alone', () => {
    const rows = rowsOf({ sessions: [testSession('loose'), personSession('mine')], cards: [card] });

    expect(rows.map(row => [row.session.sessionId, row.cardSessionIds, row.childRows])).toEqual([
      ['loose', undefined, undefined],
      ['mine', undefined, undefined],
    ]);
  });
});

describe('followed cards', () => {
  const card = testCard('c1', { stages: ['execute'], sessions: { work: ref('phase') } });
  const phase = testSession('phase', { userId: FACTORY });
  const parked = new Set(['phase']);

  it("reads the viewer's session as waiting while a card it follows is parked", () => {
    const rows = rowsOf({
      sessions: [phase, personSession('mine', { followedWorkItemIds: ['c1'] })],
      cards: [card],
      parkedSessionIds: parked,
    });

    expect(rows.find(row => row.session.sessionId === 'mine')).toMatchObject({
      status: 'waiting',
      waitingSessionId: 'phase',
    });
  });

  it('reads another person following the card as waiting only when the viewer follows it too', () => {
    const theirs = personSession('theirs', { userId: 'user-2', followedWorkItemIds: ['c1'] });
    const statusOfTheirs = (viewerFollows: readonly string[]) =>
      rowsOf({
        sessions: [phase, theirs, personSession('mine', { followedWorkItemIds: viewerFollows })],
        cards: [card],
        parkedSessionIds: parked,
      }).find(row => row.session.sessionId === 'theirs')?.status;

    expect(statusOfTheirs([])).toBe('idle');
    expect(statusOfTheirs(['c1'])).toBe('waiting');
  });

  it("lists the card's sessions under the follower, marking the ones the Factory runs", () => {
    const rows = rowsOf({
      sessions: [phase, personSession('mine', { followedWorkItemIds: ['c1'] })],
      cards: [card],
      parkedSessionIds: parked,
      revealChildSessions: true,
    });

    expect(rows.find(row => row.session.sessionId === 'mine')?.childRows).toEqual([
      expect.objectContaining({
        session: expect.objectContaining({ sessionId: 'phase' }),
        waitingSessionId: 'phase',
        runByFactory: true,
      }),
    ]);
  });
});

describe('the wire row', () => {
  it("sends a person's session as the sidebar reads it, without the facts it was built from", () => {
    const session = personSession('mine', {
      title: 'Fix login',
      owner: { id: VIEWER, name: 'Ada' },
      followedWorkItemIds: [],
    });

    expect(JSON.parse(JSON.stringify(rowsOf({ sessions: [session] })))).toEqual([
      {
        session: {
          id: 'row-mine',
          sessionId: 'mine',
          projectRepositoryId: 'repo-1',
          userId: VIEWER,
          branch: 'user/mine',
          title: 'Fix login',
          visibility: 'org',
          createdAt: AT.toISOString(),
          owner: { id: VIEWER, name: 'Ada' },
        },
        origin: 'user',
        status: 'idle',
        pinned: false,
        updatedAt: AT.toISOString(),
      },
    ]);
  });
});

describe('runningSessionIds', () => {
  const runs = [
    { threadId: 'own', resourceId: VIEWER },
    { threadId: 'factory', resourceId: PROJECT },
    { threadId: 'shared', resourceId: 'shared' },
    { threadId: 'private', resourceId: 'user-2' },
    { threadId: 'loose' },
  ];
  const reach = { viewerUserId: VIEWER, factoryProjectId: PROJECT, visibleSessionIds: new Set(['shared']) };

  it("leaves out another person's run while auth is on", () => {
    expect([...runningSessionIds(runs, { ...reach, authEnabled: true })].toSorted()).toEqual(
      ['own', VIEWER, 'factory', PROJECT, 'shared', 'loose'].toSorted(),
    );
  });

  it('counts every run while auth is off', () => {
    expect(runningSessionIds(runs, { ...reach, authEnabled: false })).toContain('private');
  });
});

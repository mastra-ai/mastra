import { describe, expect, it } from 'vitest';

import { releaseBoard, workBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { providerFactsCard } from '../../../../__tests__/fixtures/providerFactsCard';
import { EMPTY_SESSION_FILTERS, filterSessionRows } from '../sessionFilters';
import { groupSessionRows, sessionGroupHeadings } from '../sessionGroups';
import { oneRowPerCard, pinnedSessionsAfter, sessionActivityStatus, sessionBoard } from '../sessionRows';
import { factoryRow, testSession, testWorkItem, userRow } from './fixtures/sessionRows';

describe('sessionBoard', () => {
  it('puts a pull request item from before boards existed on Work', () => {
    expect(sessionBoard(testWorkItem({ board: null, source: 'github-pr' }))).toBe('work');
  });

  it("follows the item's custom board", () => {
    expect(sessionBoard(testWorkItem({ board: 'release' }))).toBe('release');
  });

  it('puts a session with no linked item on Work, pull request reviews included', () => {
    expect(sessionBoard(undefined)).toBe('work');
  });
});

describe('sessionActivityStatus', () => {
  const quiet = { initializing: false, running: false, attention: false, settled: false };

  it.each([
    [{ ...quiet, initializing: true, attention: true }, 'initializing'],
    [{ ...quiet, running: true, settled: true }, 'working'],
    [{ ...quiet, attention: true, settled: true }, 'waiting'],
    [{ ...quiet, settled: true }, 'done'],
    [quiet, 'idle'],
  ] as const)('reads %o as %s', (row, status) => {
    expect(sessionActivityStatus(row)).toBe(status);
  });
});

describe('factory session status on a custom board', () => {
  it.each([
    ['shipped', 'done'],
    ['shipping', 'idle'],
  ] as const)('reads a quiet session in the %s phase as %s', (phase, status) => {
    const item = testWorkItem({ board: releaseBoard.id, stages: [phase] });

    expect(factoryRow(testSession('s1'), { item, boards: [releaseBoard] }).status).toBe(status);
  });
});

describe('title regeneration', () => {
  const slackSession = testSession('s1', { branch: 'slack/1791936483-798759' });

  it.each([
    ['an owned user session', true, userRow('s1')],
    ['an owned Slack session', true, factoryRow(slackSession)],
    ['an owned work session', false, factoryRow(testSession('s1'))],
    ["another owner's Slack session", false, factoryRow(slackSession, { viewer: { userId: 'user-2' } })],
  ] as const)('is offered for %s: %s', (_case, offered, row) => {
    expect(row.canRegenerateTitle).toBe(offered);
  });
});

describe('external links', () => {
  it.each(['github-pr', 'gitlab-pr'] as const)('shows a normalized merged %s without a legacy merged flag', source => {
    const pullRequest = testWorkItem({
      source,
      metadata: { merged: false },
      workItem: { ...providerFactsCard.workItem, state: 'merged', metadata: {} },
    });
    const row = factoryRow(testSession('s1'), { pullRequest });

    expect(row.pullRequest).toMatchObject({ knownMerged: true });
  });

  const slackThread = testWorkItem({ source: 'slack-thread', url: 'https://app.slack.com/client/T-1/C-1' });
  const pullRequest = testWorkItem({ id: 'pr-1', source: 'github-pr', url: 'https://github.com/acme/app/pull/43' });
  const mergeRequest = testWorkItem({
    id: 'mr-1',
    source: 'gitlab-pr',
    url: 'https://gitlab.com/acme/app/-/merge_requests/43',
  });
  const linearIssue = testWorkItem({ source: 'linear-issue', url: 'https://linear.app/acme/issue/FACT-528' });

  it.each([
    [
      'the source and its pull request',
      slackThread,
      pullRequest,
      [
        ['Open in Slack', slackThread.url],
        ['Open pull request', pullRequest.url],
      ],
    ],
    [
      'a merge request once when it is the source',
      mergeRequest,
      mergeRequest,
      [['Open merge request', mergeRequest.url]],
    ],
    ['an issue tracker by name', linearIssue, undefined, [['Open in Linear', linearIssue.url]]],
    ['nothing for an item without a link', testWorkItem(), undefined, []],
  ] as const)('offers %s', (_case, item, pullRequestItem, links) => {
    const row = factoryRow(testSession('s1'), { item, pullRequest: pullRequestItem });

    expect(row.externalLinks.map(link => [link.label, link.url])).toEqual(links);
  });
});

describe('oneRowPerCard', () => {
  const ref = (sessionId: string) => ({
    sessionId,
    branch: `factory/${sessionId}`,
    threadId: `${sessionId}-thread`,
    startedBy: 'user-1',
  });
  const item = testWorkItem({
    stages: ['execute'],
    sessions: { triage: ref('triage'), work: ref('work'), review: ref('review') },
  });
  const boards = workBoardCatalog.boards;
  const cardRow = (context: string, input: Parameters<typeof factoryRow>[1] = {}) =>
    factoryRow(testSession(context), { item, boards, context, ...input });

  it("keeps the card's current session and carries what its other sessions show", () => {
    const rows = oneRowPerCard(
      [
        cardRow('triage', { routeSessionId: 'triage', pinned: true }),
        cardRow('work'),
        cardRow('review', { running: true }),
      ],
      boards,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      session: { sessionId: 'work' },
      status: 'working',
      active: true,
      pinned: true,
    });
  });

  it("falls back to the card's next session when its current one is not listed", () => {
    const rows = oneRowPerCard([cardRow('review'), cardRow('triage')], boards);

    expect(rows.map(row => row.session.sessionId)).toEqual(['triage']);
  });

  it("unpins a card's row when its pin came from another of the card's sessions", () => {
    const listed = (pinned: ReadonlySet<string>) =>
      oneRowPerCard(
        [cardRow('triage', { pinned: pinned.has('triage') }), cardRow('work', { pinned: pinned.has('work') })],
        boards,
      )[0];
    const pinned = new Set(['triage']);
    const shown = listed(pinned);
    expect(shown).toMatchObject({ session: { sessionId: 'work' }, pinned: true });

    expect(listed(pinnedSessionsAfter(pinned, shown, false)).pinned).toBe(false);
    expect([...pinnedSessionsAfter(new Set(), shown, true)]).toEqual(['work']);
  });

  describe('with child sessions revealed', () => {
    const revealed = () =>
      oneRowPerCard([cardRow('triage'), cardRow('work'), cardRow('review', { running: true })], boards, {
        revealChildSessions: true,
      });
    const byStatus = (status: 'working' | 'idle') =>
      filterSessionRows(revealed(), { ...EMPTY_SESSION_FILTERS, status }, 'user-1');
    const listed = (rows: ReturnType<typeof revealed>) =>
      rows.map(row => [row.session.sessionId, row.childRows?.map(child => child.session.sessionId)]);

    it('keeps a card under a status filter when one of its sessions matches, listing only the ones that do', () => {
      expect(listed(byStatus('working'))).toEqual([['work', ['review']]]);
      expect(listed(byStatus('idle'))).toEqual([['work', ['triage']]]);
    });

    it("groups a card by what its sessions carry, as it does when they're hidden", () => {
      const rows = revealed();
      const groups = groupSessionRows(
        rows,
        'status',
        sessionGroupHeadings(rows, 'status', { boards, viewerUserId: 'user-1' }),
        [],
      );

      expect(groups.map(group => [group.key, group.rows.map(row => row.session.sessionId)])).toEqual([
        ['status:working', ['work']],
      ]);
    });
  });

  it('leaves sessions without a card alone', () => {
    const rows = [factoryRow(testSession('loose')), userRow('mine')];

    expect(oneRowPerCard(rows, boards)).toEqual(rows);
  });
});

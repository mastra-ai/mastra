import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import {
  collapsedRowsKeepingActive,
  customGroupOrder,
  groupSessionRows,
  orderGroupHeadings,
  sessionGroupHeadings,
} from '../sessionGroups';
import type { SessionGroup, SessionGroupBy, SessionGroupContext } from '../sessionGroups';
import type { SessionListRow } from '../sessionRows';
import { factoryRow, testSession, testWorkItem, userRow } from './fixtures/sessionRows';

const [workBoard, reviewBoard] = builtinBoardCatalog.boards;

const workRow = factoryRow(testSession('work-1', { branch: 'factory/issue-1' }));
const reviewRow = factoryRow(testSession('review-1', { branch: 'factory/pr-2' }));
const releaseRow = factoryRow(testSession('release-1'), { item: testWorkItem({ board: 'release' }) });
const opsRow = factoryRow(testSession('ops-1'), { item: testWorkItem({ board: 'ops' }) });

const builtinContext: SessionGroupContext = { boards: builtinBoardCatalog.boards, viewerUserId: 'viewer' };

const groupSummary = (groups: SessionGroup[]) =>
  groups.map(group => ({ label: group.label, sessionIds: group.rows.map(row => row.session.sessionId) }));

function groupRows(
  rows: readonly SessionListRow[],
  groupBy: SessionGroupBy,
  context: SessionGroupContext,
  hiddenKeys: readonly string[],
) {
  return groupSessionRows(rows, groupBy, sessionGroupHeadings(rows, groupBy, context), hiddenKeys);
}

function ownedRow(sessionId: string, userId: string, name: string) {
  return userRow(sessionId, { userId, owner: { id: userId, name } });
}

describe('groupSessionRows by board', () => {
  it('orders Work, Review, custom boards, then User, whatever the catalog order', () => {
    const groups = groupRows(
      [userRow('user-1'), releaseRow, reviewRow, workRow],
      'board',
      { boards: [reviewBoard, releaseBoard, workBoard], viewerUserId: undefined },
      [],
    );

    expect(groupSummary(groups)).toEqual([
      { label: 'Work', sessionIds: ['work-1'] },
      { label: 'Review', sessionIds: ['review-1'] },
      { label: 'Release Preview', sessionIds: ['release-1'] },
      { label: 'User', sessionIds: ['user-1'] },
    ]);
  });

  it('shows Slack-origin user sessions together, separate from web sessions and boards', () => {
    const groups = groupRows(
      [
        userRow('web-1'),
        userRow('slack-1', { branch: 'slack/123.456' }),
        workRow,
        userRow('slack-2', { branch: 'slack/789.012' }),
      ],
      'board',
      builtinContext,
      [],
    );

    expect(groupSummary(groups)).toEqual([
      { label: 'Work', sessionIds: ['work-1'] },
      { label: 'User', sessionIds: ['web-1'] },
      { label: 'Slack', sessionIds: ['slack-1', 'slack-2'] },
    ]);
  });

  it('names a board missing from the catalog after its id and places it before User', () => {
    const groups = groupRows(
      [userRow('user-1'), opsRow, releaseRow],
      'board',
      { boards: [workBoard, releaseBoard], viewerUserId: undefined },
      [],
    );

    expect(groupSummary(groups).map(group => group.label)).toEqual(['Release Preview', 'Ops', 'User']);
  });

  it('keeps the incoming row order inside a group and leaves out empty groups', () => {
    const secondWorkRow = factoryRow(testSession('work-2', { branch: 'factory/issue-2' }));

    const groups = groupRows([secondWorkRow, workRow], 'board', builtinContext, []);

    expect(groupSummary(groups)).toEqual([{ label: 'Work', sessionIds: ['work-2', 'work-1'] }]);
  });

  it('leaves out hidden groups and ignores hidden keys no group has', () => {
    const groups = groupRows([workRow, reviewRow, userRow('user-1')], 'board', builtinContext, [
      'board:review',
      'board:gone',
    ]);

    expect(groupSummary(groups).map(group => group.label)).toEqual(['Work', 'User']);
  });

  it('puts stored groups first in stored order, appends unseen groups in default order, and skips stale keys', () => {
    const rows = [workRow, reviewRow, releaseRow, userRow('user-1')];
    const defaults = sessionGroupHeadings(rows, 'board', {
      boards: [...builtinBoardCatalog.boards, releaseBoard],
      viewerUserId: undefined,
    });

    const ordered = orderGroupHeadings(defaults, ['user', 'board:gone', 'board:review']);

    expect(ordered.map(heading => heading.label)).toEqual(['User', 'Review', 'Work', 'Release Preview', 'Slack']);
  });
});

describe('customGroupOrder', () => {
  const defaults = sessionGroupHeadings([], 'status', builtinContext);
  const defaultKeys = defaults.map(heading => heading.key);

  it('keeps an order that differs from the default', () => {
    const moved = [defaultKeys[1] ?? '', defaultKeys[0] ?? '', ...defaultKeys.slice(2)];

    expect(customGroupOrder(moved, defaults)).toEqual(moved);
  });

  it('forgets an order that matches the default', () => {
    expect(customGroupOrder(defaultKeys, defaults)).toEqual([]);
  });
});

describe('groupSessionRows by status', () => {
  it('orders groups Waiting, Working, Initializing, Idle, Done and leaves out empty ones', () => {
    const waitingRow = factoryRow(testSession('waiting-1'), { attention: true });
    const initializingRow = factoryRow(testSession('init-1', { materializedAt: undefined }), { running: true });
    const idleRow = userRow('idle-1');

    const groups = groupRows([idleRow, initializingRow, waitingRow], 'status', builtinContext, []);

    expect(groupSummary(groups)).toEqual([
      { label: 'Waiting on you', sessionIds: ['waiting-1'] },
      { label: 'Initializing', sessionIds: ['init-1'] },
      { label: 'Idle', sessionIds: ['idle-1'] },
    ]);
  });
});

describe('sessionGroupHeadings', () => {
  it('lists every status even with no sessions, so a group can be hidden before it has any', () => {
    expect(sessionGroupHeadings([], 'status', builtinContext).map(heading => heading.label)).toEqual([
      'Waiting on you',
      'Working',
      'Initializing',
      'Idle',
      'Done',
    ]);
  });
});

describe('groupSessionRows by owner', () => {
  it('puts the viewer first, then other owners by name', () => {
    const groups = groupRows(
      [ownedRow('zoe-1', 'zoe', 'Zoe'), ownedRow('mine-1', 'viewer', 'Viewer'), ownedRow('ada-1', 'ada', 'Ada')],
      'owner',
      builtinContext,
      [],
    );

    expect(groupSummary(groups)).toEqual([
      { label: 'Viewer', sessionIds: ['mine-1'] },
      { label: 'Ada', sessionIds: ['ada-1'] },
      { label: 'Zoe', sessionIds: ['zoe-1'] },
    ]);
  });
});

describe('groupSessionRows with no grouping', () => {
  it('puts every row in one group', () => {
    const groups = groupRows([workRow, userRow('user-1'), reviewRow], 'none', builtinContext, []);

    expect(groupSummary(groups)).toEqual([{ label: 'All', sessionIds: ['work-1', 'user-1', 'review-1'] }]);
  });
});

describe('collapsedRowsKeepingActive', () => {
  const rows = (activeIndex?: number) =>
    Array.from({ length: 8 }, (_, index) =>
      factoryRow(testSession(`work-${index + 1}`), {
        routeSessionId: activeIndex === index ? `work-${index + 1}` : undefined,
      }),
    );
  const sessionIds = (visible: ReturnType<typeof collapsedRowsKeepingActive>) =>
    visible.map(row => row.session.sessionId);

  it('keeps the first five rows of a long group', () => {
    expect(sessionIds(collapsedRowsKeepingActive(rows()))).toEqual(['work-1', 'work-2', 'work-3', 'work-4', 'work-5']);
  });

  it('keeps the open session visible when it sorts past the fold', () => {
    expect(sessionIds(collapsedRowsKeepingActive(rows(6)))).toEqual([
      'work-1',
      'work-2',
      'work-3',
      'work-4',
      'work-5',
      'work-7',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { collapsedRowsKeepingActive, groupSessionRows } from '../sessionGroups';
import type { SessionGroup, SessionGroupContext } from '../sessionGroups';
import { factoryRow, testSession, testWorkItem, userRow } from './fixtures/sessionRows';

const [workBoard, reviewBoard] = builtinBoardCatalog.boards;

const workRow = factoryRow(testSession('work-1', { branch: 'factory/issue-1' }));
const reviewRow = factoryRow(testSession('review-1', { branch: 'factory/pr-2' }));
const releaseRow = factoryRow(testSession('release-1'), { item: testWorkItem({ board: 'release' }) });
const opsRow = factoryRow(testSession('ops-1'), { item: testWorkItem({ board: 'ops' }) });

const builtinContext: SessionGroupContext = { boards: builtinBoardCatalog.boards, viewerUserId: 'viewer' };

const groupSummary = (groups: SessionGroup[]) =>
  groups.map(group => ({ label: group.label, sessionIds: group.rows.map(row => row.session.sessionId) }));

function ownedRow(sessionId: string, userId: string, name: string) {
  return userRow(sessionId, { userId, owner: { id: userId, name } });
}

describe('groupSessionRows by board', () => {
  it('orders Work, Review, custom boards, then User, whatever the catalog order', () => {
    const groups = groupSessionRows(
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

  it('names a board missing from the catalog after its id and places it before User', () => {
    const groups = groupSessionRows(
      [userRow('user-1'), opsRow, releaseRow],
      'board',
      { boards: [workBoard, releaseBoard], viewerUserId: undefined },
      [],
    );

    expect(groupSummary(groups).map(group => group.label)).toEqual(['Release Preview', 'Ops', 'User']);
  });

  it('keeps the incoming row order inside a group and leaves out empty groups', () => {
    const secondWorkRow = factoryRow(testSession('work-2', { branch: 'factory/issue-2' }));

    const groups = groupSessionRows([secondWorkRow, workRow], 'board', builtinContext, []);

    expect(groupSummary(groups)).toEqual([{ label: 'Work', sessionIds: ['work-2', 'work-1'] }]);
  });

  it('leaves out hidden groups and ignores hidden keys no group has', () => {
    const groups = groupSessionRows([workRow, reviewRow, userRow('user-1')], 'board', builtinContext, [
      'board:review',
      'board:gone',
    ]);

    expect(groupSummary(groups).map(group => group.label)).toEqual(['Work', 'User']);
  });
});

describe('groupSessionRows by status', () => {
  it('files a row under its strongest status, in Waiting, Working, Initializing, Idle, Done order', () => {
    const waitingRow = factoryRow(testSession('waiting-1'), { attention: true });
    const runningAndWaitingRow = factoryRow(testSession('working-1'), { running: true, attention: true });
    const initializingRow = factoryRow(testSession('init-1', { materializedAt: undefined }), { running: true });
    const idleRow = userRow('idle-1');

    const groups = groupSessionRows(
      [idleRow, initializingRow, runningAndWaitingRow, waitingRow],
      'status',
      builtinContext,
      [],
    );

    expect(groupSummary(groups)).toEqual([
      { label: 'Waiting on you', sessionIds: ['waiting-1'] },
      { label: 'Working', sessionIds: ['working-1'] },
      { label: 'Initializing', sessionIds: ['init-1'] },
      { label: 'Idle', sessionIds: ['idle-1'] },
    ]);
  });
});

describe('groupSessionRows by owner', () => {
  it('puts the viewer first, then other owners by name', () => {
    const groups = groupSessionRows(
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
    const groups = groupSessionRows([workRow, userRow('user-1'), reviewRow], 'none', builtinContext, []);

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

import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { collapsedRowsKeepingActive, groupSessionRowsByBoard } from '../sessionGroups';
import type { SessionGroup } from '../sessionGroups';
import { factoryRow, testSession, testWorkItem, userRow } from './fixtures/sessionRows';

const [workBoard, reviewBoard] = builtinBoardCatalog.boards;

const workRow = factoryRow(testSession('work-1', { branch: 'factory/issue-1' }));
const reviewRow = factoryRow(testSession('review-1', { branch: 'factory/pr-2' }));
const releaseRow = factoryRow(testSession('release-1'), { item: testWorkItem({ board: 'release' }) });
const opsRow = factoryRow(testSession('ops-1'), { item: testWorkItem({ board: 'ops' }) });

const groupSummary = (groups: SessionGroup[]) =>
  groups.map(group => ({ label: group.label, sessionIds: group.rows.map(row => row.session.sessionId) }));

describe('groupSessionRowsByBoard', () => {
  it('orders Work, Review, custom boards, then User, whatever the catalog order', () => {
    const groups = groupSessionRowsByBoard(
      [userRow('user-1'), releaseRow, reviewRow, workRow],
      [reviewBoard, releaseBoard, workBoard],
    );

    expect(groupSummary(groups)).toEqual([
      { label: 'Work', sessionIds: ['work-1'] },
      { label: 'Review', sessionIds: ['review-1'] },
      { label: 'Release Preview', sessionIds: ['release-1'] },
      { label: 'User', sessionIds: ['user-1'] },
    ]);
  });

  it('names a board missing from the catalog after its id and places it before User', () => {
    const groups = groupSessionRowsByBoard([userRow('user-1'), opsRow, releaseRow], [workBoard, releaseBoard]);

    expect(groupSummary(groups).map(group => group.label)).toEqual(['Release Preview', 'Ops', 'User']);
  });

  it('keeps the incoming row order inside a group and leaves out empty groups', () => {
    const secondWorkRow = factoryRow(testSession('work-2', { branch: 'factory/issue-2' }));

    const groups = groupSessionRowsByBoard([secondWorkRow, workRow], builtinBoardCatalog.boards);

    expect(groupSummary(groups)).toEqual([{ label: 'Work', sessionIds: ['work-2', 'work-1'] }]);
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

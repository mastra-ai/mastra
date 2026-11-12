import { describe, expect, it } from 'vitest';

import type { BoardColumnsSnapshot } from '../../../hooks/useWorkItems';
import { shownBoardColumns } from './boardColumns';
import type { ShownBoardColumn } from './boardColumns';
import type { WorkItem } from './services/workItems';

const stages = [{ id: 'intake' }, { id: 'planning' }, { id: 'done' }];

function card(id: string, cardStages: string[]): WorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'fp-1',
    board: 'work',
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    title: id,
    url: null,
    stages: cardStages,
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    description: null,
    revision: 1,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
  };
}

function snapshot(columns: BoardColumnsSnapshot['columns'], workItems: WorkItem[]): BoardColumnsSnapshot {
  return {
    columns,
    workItems,
    matchingTotal: columns.reduce((sum, column) => sum + column.total, 0),
    boardTotal: columns.reduce((sum, column) => sum + column.total, 0),
    runningSessionIds: [],
    parkedSessionIds: [],
  };
}

function titles(shown: ReadonlyMap<string, ShownBoardColumn>, stage: string) {
  return shown.get(stage)?.cards.map(item => item.id);
}

describe('shownBoardColumns', () => {
  it('shows each column its listed cards in the order the server listed them, whatever order the bodies came in', () => {
    const shown = shownBoardColumns(
      snapshot(
        [
          { stage: 'intake', total: 2, ids: ['b', 'a'] },
          { stage: 'planning', total: 1, ids: ['c'] },
          { stage: 'done', total: 0, ids: [] },
        ],
        [card('a', ['intake']), card('c', ['planning']), card('b', [])],
      ),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['b', 'a']);
    expect(titles(shown, 'planning')).toEqual(['c']);
    expect(shown.get('intake')).toMatchObject({ total: 2, listedAll: true });
  });

  it('says a column has more to load while the server lists fewer cards than match', () => {
    const shown = shownBoardColumns(
      snapshot([{ stage: 'intake', total: 120, ids: ['a', 'b'] }], [card('a', ['intake']), card('b', ['intake'])]),
      stages,
    );

    expect(shown.get('intake')).toMatchObject({ total: 120, listedAll: false });
    expect(shown.get('planning')).toEqual({ cards: [], total: 0, listedAll: true });
  });

  it('shows a card moved since the read on top of the column it entered, gone from the one it left, and counts follow', () => {
    const shown = shownBoardColumns(
      snapshot(
        [
          { stage: 'intake', total: 120, ids: ['a', 'b'] },
          { stage: 'planning', total: 1, ids: ['c'] },
        ],
        // `a` was listed in Intake; its body now says Planning.
        [card('a', ['planning']), card('b', ['intake']), card('c', ['planning'])],
      ),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['b']);
    expect(titles(shown, 'planning')).toEqual(['a', 'c']);
    expect(shown.get('intake')?.total).toBe(119);
    expect(shown.get('planning')?.total).toBe(2);
    // Intake still has cards the server did not list: the move does not hide that.
    expect(shown.get('intake')?.listedAll).toBe(false);
  });

  it('keeps a card in both columns it sits in, and leaves out a card held only as a relative', () => {
    const shown = shownBoardColumns(
      snapshot(
        [
          { stage: 'intake', total: 1, ids: ['a'] },
          { stage: 'planning', total: 1, ids: ['a'] },
        ],
        [card('a', ['intake', 'planning']), card('parent', ['done'])],
      ),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['a']);
    expect(titles(shown, 'planning')).toEqual(['a']);
    expect(titles(shown, 'done')).toEqual([]);
    expect(shown.get('planning')?.total).toBe(1);
  });

  it('shows empty columns with nothing to load before the first answer', () => {
    const shown = shownBoardColumns(undefined, stages);

    expect([...shown.keys()]).toEqual(['intake', 'planning', 'done']);
    expect(shown.get('done')).toEqual({ cards: [], total: 0, listedAll: true });
  });
});

import { describe, expect, it } from 'vitest';

import type { BoardPhasesSnapshot } from '../../../hooks/useWorkItems';
import { shownBoardPhases } from './boardPhases';
import type { ShownPhase } from './boardPhases';
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

function snapshot(
  phases: BoardPhasesSnapshot['phases'],
  workItems: WorkItem[],
  asked?: BoardPhasesSnapshot['asked'],
): BoardPhasesSnapshot {
  return {
    phases,
    workItems,
    ...(asked ? { asked } : {}),
    matchingTotal: phases.reduce((sum, listed) => sum + listed.total, 0),
    boardTotal: phases.reduce((sum, listed) => sum + listed.total, 0),
    runningSessionIds: [],
    parkedSessionIds: [],
  };
}

function titles(shown: ReadonlyMap<string, ShownPhase>, stage: string) {
  return shown.get(stage)?.cards.map(item => item.id);
}

describe('shownBoardPhases', () => {
  it('shows each phase its listed cards in the order the server listed them, whatever order the bodies came in', () => {
    const shown = shownBoardPhases(
      snapshot(
        [
          { phase: 'intake', total: 2, ids: ['b', 'a'] },
          { phase: 'planning', total: 1, ids: ['c'] },
          { phase: 'done', total: 0, ids: [] },
        ],
        [card('a', ['intake']), card('c', ['planning']), card('b', [])],
      ),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['b', 'a']);
    expect(titles(shown, 'planning')).toEqual(['c']);
    expect(shown.get('intake')).toMatchObject({ total: 2, listedAll: true });
  });

  it('says a phase has more to load while the server lists fewer cards than match', () => {
    const shown = shownBoardPhases(
      snapshot([{ phase: 'intake', total: 120, ids: ['a', 'b'] }], [card('a', ['intake']), card('b', ['intake'])]),
      stages,
    );

    expect(shown.get('intake')).toMatchObject({ total: 120, listedAll: false });
    expect(shown.get('planning')).toEqual({ cards: [], total: 0, listed: 0, listedAll: true });
  });

  it('shows a card moved since the read on top of the phase it entered, gone from the one it left, and counts follow', () => {
    const shown = shownBoardPhases(
      snapshot(
        [
          { phase: 'intake', total: 120, ids: ['a', 'b'] },
          { phase: 'planning', total: 1, ids: ['c'] },
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

  it('keeps a card in both phases it sits in, and leaves out a card held only as a relative', () => {
    const shown = shownBoardPhases(
      snapshot(
        [
          { phase: 'intake', total: 1, ids: ['a'] },
          { phase: 'planning', total: 1, ids: ['a'] },
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

  it('shows empty phases with nothing to load before the first answer', () => {
    const shown = shownBoardPhases(undefined, stages);

    expect([...shown.keys()]).toEqual(['intake', 'planning', 'done']);
    expect(shown.get('done')).toEqual({ cards: [], total: 0, listed: 0, listedAll: true });
  });

  it('shows the asked card on top of a phase that holds it deeper than it lists, without counting it twice', () => {
    const shown = shownBoardPhases(
      snapshot(
        [
          { phase: 'intake', total: 120, ids: ['a', 'b'] },
          { phase: 'planning', total: 1, ids: ['c'] },
        ],
        [card('a', ['intake']), card('b', ['intake']), card('c', ['planning']), card('deep', ['intake'])],
        { id: 'deep', phases: ['intake'] },
      ),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['deep', 'a', 'b']);
    expect(titles(shown, 'planning')).toEqual(['c']);
    // The phase's total counted the card before it was asked for, and a deeper window counts from the two listed.
    expect(shown.get('intake')).toMatchObject({ total: 120, listed: 2, listedAll: false });
  });

  it('shows the asked card once where the phase lists it, and on top of another phase that holds it deeper', () => {
    const shown = shownBoardPhases(
      snapshot(
        [
          { phase: 'intake', total: 2, ids: ['both', 'a'] },
          { phase: 'planning', total: 80, ids: ['c'] },
        ],
        [card('both', ['intake', 'planning']), card('a', ['intake']), card('c', ['planning'])],
        { id: 'both', phases: ['intake', 'planning'] },
      ),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['both', 'a']);
    expect(titles(shown, 'planning')).toEqual(['both', 'c']);
    expect(shown.get('intake')?.total).toBe(2);
    expect(shown.get('planning')?.total).toBe(80);
  });

  it('shows nowhere an asked card the view leaves out', () => {
    const shown = shownBoardPhases(
      snapshot([{ phase: 'intake', total: 1, ids: ['a'] }], [card('a', ['intake']), card('hidden', ['intake'])], {
        id: 'hidden',
        phases: [],
      }),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['a']);
    expect(shown.get('intake')?.total).toBe(1);
  });

  it('shows an asked card moved since the read on top of the phase it entered, not the one that held it', () => {
    const shown = shownBoardPhases(
      snapshot(
        [
          { phase: 'intake', total: 120, ids: ['a'] },
          { phase: 'planning', total: 1, ids: ['c'] },
        ],
        // The view held `deep` far down Intake; its body now says Planning.
        [card('a', ['intake']), card('c', ['planning']), card('deep', ['planning'])],
        { id: 'deep', phases: ['intake'] },
      ),
      stages,
    );

    expect(titles(shown, 'intake')).toEqual(['a']);
    expect(titles(shown, 'planning')).toEqual(['deep', 'c']);
    expect(shown.get('intake')?.total).toBe(119);
    expect(shown.get('planning')?.total).toBe(2);
  });
});

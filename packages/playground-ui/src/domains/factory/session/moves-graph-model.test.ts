import { describe, expect, it } from 'vitest';

import { movesGraph } from './moves-graph-model';

const minute = 60_000;
const now = Date.parse('2026-07-10T12:00:00.000Z');
const at = (minutes: number) => new Date(now - minutes * minute).toISOString();
const phases = [
  { id: 'plan', name: 'Plan' },
  { id: 'build', name: 'Build', working: true },
];

describe('movesGraph', () => {
  it('sizes each stay by how long it lasted and marks working phases', () => {
    const { lanes, stays } = movesGraph(
      [
        { stage: 'plan', enteredAt: at(90), exitedAt: at(30) },
        { stage: 'build', enteredAt: at(30) },
      ],
      phases,
      now,
    );

    expect(lanes).toEqual(['plan', 'build']);
    expect(stays.map(({ start, width, working }) => [start, width, working])).toEqual([
      [0, expect.closeTo(2 / 3), false],
      [expect.closeTo(2 / 3), expect.closeTo(1 / 3), true],
    ]);
  });

  it('puts stages the board no longer has after its own phases', () => {
    const { lanes } = movesGraph(
      [
        { stage: 'gone', enteredAt: at(60), exitedAt: at(40) },
        { stage: 'build', enteredAt: at(40), exitedAt: at(20) },
        { stage: 'plan', enteredAt: at(20) },
      ],
      phases,
      now,
    );

    expect(lanes).toEqual(['plan', 'build', 'gone']);
  });

  it('spreads stays evenly when no time has passed', () => {
    const { stays } = movesGraph(
      [
        { stage: 'plan', enteredAt: at(0), exitedAt: at(0) },
        { stage: 'build', enteredAt: at(0) },
      ],
      phases,
      now,
    );

    expect(stays.map(({ start, width }) => [start, width])).toEqual([
      [0, 0.5],
      [0.5, 0.5],
    ]);
  });
});

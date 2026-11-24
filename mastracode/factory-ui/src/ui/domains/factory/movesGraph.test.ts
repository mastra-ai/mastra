import { describe, expect, it } from 'vitest';

import { workBoardInfo } from '../../../../e2e/ui/board-catalog';
import { movesGraph } from './movesGraph';

const minute = 60_000;
const now = Date.parse('2026-07-10T12:00:00.000Z');

function history(stays: Array<[stage: string, minutes: number]>) {
  let cursor = now - stays.reduce((total, [, minutes]) => total + minutes * minute, 0);
  return stays.map(([stage, minutes], index) => {
    const enteredAt = new Date(cursor).toISOString();
    cursor += minutes * minute;
    return {
      stage,
      enteredAt,
      by: 'user-1',
      ...(index < stays.length - 1 ? { exitedAt: new Date(cursor).toISOString() } : {}),
    };
  });
}

describe('movesGraph', () => {
  it('draws every stay as long as it lasted, so days in Intake dwarf a short review', () => {
    const { stays } = movesGraph(
      history([
        ['intake', 4 * 24 * 60],
        ['pr-review', 20],
        ['intake', 60],
      ]),
      workBoardInfo,
      now,
    );

    const total = 4 * 24 * 60 + 20 + 60;
    expect(stays.map(stay => stay.width)).toEqual([
      expect.closeTo((4 * 24 * 60) / total),
      expect.closeTo(20 / total),
      expect.closeTo(60 / total),
    ]);
    expect(stays.map(stay => stay.working)).toEqual([false, true, false]);
  });

  it('lets stays that ran at the same time share the axis', () => {
    const start = now - 120 * minute;
    const time = (minutes: number) => new Date(start + minutes * minute).toISOString();
    const { lanes, stays } = movesGraph(
      [
        { stage: 'planning', enteredAt: time(0), exitedAt: time(60), by: 'user-1' },
        { stage: 'execute', enteredAt: time(30), exitedAt: time(90), by: 'user-1' },
        { stage: 'pr-review', enteredAt: time(90), by: 'user-1' },
      ],
      workBoardInfo,
      now,
    );

    expect(lanes).toEqual(['planning', 'execute', 'pr-review']);
    expect(stays.map(({ start: from, width }) => [from, width])).toEqual([
      [0, 0.5],
      [0.25, 0.5],
      [0.75, 0.25],
    ]);
  });

  it('stacks the phases in board order, whatever order the card met them in, with retired ones last', () => {
    const { lanes, stays } = movesGraph(
      history([
        ['execute', 30],
        ['review', 10],
        ['planning', 20],
        ['execute', 15],
      ]),
      workBoardInfo,
      now,
    );

    expect(lanes).toEqual(['planning', 'execute', 'review']);
    expect(stays.map(stay => stay.lane)).toEqual([1, 2, 0, 1]);
  });
});

import { describe, expect, it } from 'vitest';

import type { TimeWindow } from '../../time/timeViewport';
import type { PlacedRun } from '../layout/laneLayout';
import { MIN_FOLD_PX, runFolds } from './runFolds';

const WINDOW: TimeWindow = { startMs: 0, endMs: 1_000, endsAtNow: false };
const TRACK_PX = 1_000;

function placedRun(id: string, startedAt: number, endedAt: number): PlacedRun {
  return {
    run: { id, role: 'review', workItemId: id, card: undefined, title: id, startedAt, endedAt, status: 'complete' },
    row: 2,
    fromMs: startedAt,
    toMs: endedAt,
    startNotInView: false,
  };
}

function foldedIds(runs: PlacedRun[], window = WINDOW): string[][] {
  return runFolds(runs, window, TRACK_PX).map(fold => fold.runs.map(placed => placed.run.id));
}

describe('runFolds', () => {
  it('folds overflow runs that touch on screen into one chip, and keeps distant ones apart', () => {
    const runs = [placedRun('late', 700, 800), placedRun('first', 100, 300), placedRun('overlapping', 250, 400)];

    expect(foldedIds(runs)).toEqual([['first', 'overlapping'], ['late']]);
  });

  it('folds a short run into its neighbour once the chip it needs reaches it', () => {
    expect(foldedIds([placedRun('blip', 100, 101), placedRun('next', 100 + MIN_FOLD_PX, 200)])).toEqual([
      ['blip', 'next'],
    ]);
  });

  it('keeps a chip at the live edge inside the track', () => {
    const [fold] = runFolds([placedRun('fresh', 999, 1_000)], { ...WINDOW, endsAtNow: true }, TRACK_PX);

    expect(fold?.rightPx).toBe(TRACK_PX);
  });
});

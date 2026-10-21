import { describe, expect, it } from 'vitest';

import { clockTime } from '../../../../../activity';
import type { RunBar } from '../../runs/runBars';
import type { TimeWindow } from '../../time/timeViewport';
import { inspectedMarks } from './inspectedMarks';
import type { PlacedRun } from './laneLayout';

const MINUTE_MS = 60_000;
const WINDOW: TimeWindow = { startMs: 0, endMs: 60 * MINUTE_MS, endsAtNow: true };
const TRACK_PX = 600;

function placed(startMinute: number, endMinute: number | undefined, status: RunBar['status'] = 'complete'): PlacedRun {
  const startedAt = startMinute * MINUTE_MS;
  const endedAt = endMinute === undefined ? undefined : endMinute * MINUTE_MS;
  return {
    run: {
      id: 'run',
      role: 'review',
      workItemId: 'card',
      card: undefined,
      title: 'Review',
      startedAt,
      endedAt,
      status,
    },
    fromMs: startedAt,
    toMs: endedAt ?? WINDOW.endMs,
    row: 0,
    startNotInView: false,
  };
}

const labels = (startMinute: number, endMinute: number | undefined, status?: RunBar['status']) =>
  inspectedMarks(placed(startMinute, endMinute, status), WINDOW, TRACK_PX).map(mark => mark.label);

describe('inspectedMarks', () => {
  it('labels the start and the end apart when there is room for both', () => {
    expect(labels(10, 40)).toEqual([`Started ${clockTime(10 * MINUTE_MS)}`, `Ended ${clockTime(40 * MINUTE_MS)}`]);
  });

  it('folds a short run into one label instead of printing two over each other', () => {
    expect(labels(10, 12)).toEqual([`${clockTime(10 * MINUTE_MS)} – ${clockTime(12 * MINUTE_MS)}`]);
  });

  it('names a run that started and ended within the minute once', () => {
    expect(labels(10, 10)).toEqual([clockTime(10 * MINUTE_MS)]);
  });

  it('folds labels that only collide because the one at the edge is pinned inside the chart', () => {
    expect(labels(1, 15.5)).toEqual([`${clockTime(1 * MINUTE_MS)} – ${clockTime(15.5 * MINUTE_MS)}`]);
    expect(labels(1, 25)).toEqual([`Started ${clockTime(1 * MINUTE_MS)}`, `Ended ${clockTime(25 * MINUTE_MS)}`]);
  });

  it('ends a run still going at now, folded in when it started moments ago', () => {
    expect(labels(10, undefined, 'running')).toEqual([`Started ${clockTime(10 * MINUTE_MS)}`, 'now']);
    expect(labels(58, undefined, 'running')).toEqual([`${clockTime(58 * MINUTE_MS)} – now`]);
  });
});

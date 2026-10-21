import { describe, expect, it } from 'vitest';

import type { TimeWindow } from '../../time/timeViewport';
import { EDGE_FADE_PX } from '../../track/edgeFade';
import type { PlacedRun } from './laneLayout';
import { drawnBarSpan } from './laneSizes';

const LIVE_WINDOW: TimeWindow = { startMs: 1_000, endMs: 2_000, endsAtNow: true };
const PAST_WINDOW: TimeWindow = { ...LIVE_WINDOW, endsAtNow: false };
const TRACK_PX = 1_000;

function placedRun(startedAt: number, endedAt: number, window: TimeWindow): PlacedRun {
  return {
    run: {
      id: 'run',
      role: 'work',
      workItemId: 'card',
      card: undefined,
      title: 'run',
      startedAt,
      endedAt,
      status: 'complete',
    },
    row: 0,
    fromMs: Math.max(startedAt, window.startMs),
    toMs: Math.min(endedAt, window.endMs),
    startNotInView: startedAt < window.startMs,
  };
}

function labelEdgesPx(startedAt: number, endedAt: number) {
  const span = drawnBarSpan(placedRun(startedAt, endedAt, PAST_WINDOW), PAST_WINDOW, TRACK_PX);
  return { startPx: span.leftPx + span.labelOffsetStartPx, endPx: span.rightPx - span.labelOffsetEndPx };
}

describe('drawnBarSpan', () => {
  it('draws a run crossing the left edge at its true extent, so it slides out instead of pinning a stub there', () => {
    expect(drawnBarSpan(placedRun(900, 1_010, LIVE_WINDOW), LIVE_WINDOW, TRACK_PX)).toMatchObject({
      leftPx: -100,
      rightPx: 10,
    });
  });

  it('holds the label of a long run crossing either edge inside the faded strip', () => {
    const leaving = labelEdgesPx(900, 1_500);
    const arriving = labelEdgesPx(1_800, 2_500);

    expect(leaving.startPx).toBeGreaterThan(0);
    expect(leaving.startPx).toBeLessThan(EDGE_FADE_PX);
    expect(arriving.endPx).toBeLessThan(TRACK_PX);
    expect(arriving.endPx).toBeGreaterThan(TRACK_PX - EDGE_FADE_PX);
  });

  it('lets the label leave with a run once only a sliver of it is in view, instead of squeezing it', () => {
    expect(labelEdgesPx(900, 1_030).startPx).toBeLessThan(0);
    expect(labelEdgesPx(1_970, 2_500).endPx).toBeGreaterThan(TRACK_PX);
  });
});

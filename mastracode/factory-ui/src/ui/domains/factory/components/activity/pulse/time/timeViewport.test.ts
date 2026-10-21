import { describe, expect, it, vi } from 'vitest';

import { clockTime, dayHeading } from '../../../../activity';
import {
  axisTicks,
  MAX_SPAN_MS,
  MIN_SPAN_MS,
  panViewport,
  viewedDayLabel,
  viewportWindow,
  zoomViewport,
} from './timeViewport';
import type { TimeViewport, TimeWindow } from './timeViewport';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const NOW_MS = Date.UTC(2025, 5, 10, 12, 0);

function momentAt(fraction: number, timeWindow: TimeWindow): number {
  return timeWindow.startMs + fraction * (timeWindow.endMs - timeWindow.startMs);
}

describe('zoomViewport', () => {
  it('zooms into the moment under the pointer even while following now', () => {
    const viewport: TimeViewport = { live: true, spanMs: HOUR_MS };
    const before = viewportWindow(viewport, NOW_MS);

    const zoomed = zoomViewport(viewport, 0.5, 0.25, NOW_MS);
    const after = viewportWindow(zoomed, NOW_MS);

    expect(zoomed.live).toBe(false);
    expect(momentAt(0.25, after)).toBe(momentAt(0.25, before));
    expect(after.endMs - after.startMs).toBe(HOUR_MS / 2);
  });

  it('keeps following now when zooming at the right edge', () => {
    expect(zoomViewport({ live: true, spanMs: HOUR_MS }, 0.5, 1, NOW_MS)).toEqual({
      live: true,
      spanMs: 30 * MINUTE_MS,
    });
  });

  it('holds the moment under the pointer in place on a fixed window', () => {
    const viewport: TimeViewport = { live: false, spanMs: HOUR_MS, endMs: NOW_MS - 5 * HOUR_MS };
    const before = viewportWindow(viewport, NOW_MS);

    const after = viewportWindow(zoomViewport(viewport, 0.5, 0.25, NOW_MS), NOW_MS);

    expect(momentAt(0.25, after)).toBe(momentAt(0.25, before));
    expect(after.endMs - after.startMs).toBe(30 * MINUTE_MS);
  });

  it('stops at five minutes and at a week', () => {
    expect(zoomViewport({ live: true, spanMs: 10 * MINUTE_MS }, 0.01, 1, NOW_MS).spanMs).toBe(MIN_SPAN_MS);
    expect(zoomViewport({ live: true, spanMs: 3 * 24 * HOUR_MS }, 100, 1, NOW_MS).spanMs).toBe(MAX_SPAN_MS);
  });

  it('follows now again once zooming out would reach past it', () => {
    const viewport: TimeViewport = { live: false, spanMs: HOUR_MS, endMs: NOW_MS - 10 * MINUTE_MS };

    expect(zoomViewport(viewport, 4, 0.5, NOW_MS)).toEqual({ live: true, spanMs: 4 * HOUR_MS });
  });
});

describe('panViewport', () => {
  it('leaves now on the smallest swipe back, so a slow trackpad gesture still moves', () => {
    expect(panViewport({ live: true, spanMs: HOUR_MS }, -0.001, NOW_MS)).toEqual({
      live: false,
      spanMs: HOUR_MS,
      endMs: NOW_MS - 0.001 * HOUR_MS,
    });
  });

  it('cannot pan into the future, and follows now again on reaching it', () => {
    const viewport: TimeViewport = { live: false, spanMs: HOUR_MS, endMs: NOW_MS - 10 * MINUTE_MS };

    expect(panViewport({ live: true, spanMs: HOUR_MS }, 0.5, NOW_MS)).toEqual({ live: true, spanMs: HOUR_MS });
    expect(panViewport(viewport, 1, NOW_MS)).toEqual({ live: true, spanMs: HOUR_MS });
  });
});

describe('axisTicks', () => {
  it('counts back from now while following it, leaving the edges to the window labels', () => {
    const viewport: TimeViewport = { live: true, spanMs: HOUR_MS };

    expect(axisTicks(viewport, viewportWindow(viewport, NOW_MS), NOW_MS).map(tick => tick.label)).toEqual([
      '−10m',
      '−20m',
      '−30m',
      '−40m',
      '−50m',
    ]);
  });

  it('marks a fixed window on round local hours and names the day at midnight', () => {
    const midnightMs = new Date(2025, 5, 3).getTime();
    const viewport: TimeViewport = {
      live: false,
      spanMs: 6 * HOUR_MS,
      endMs: midnightMs + 3 * HOUR_MS + 20 * MINUTE_MS,
    };

    const ticks = axisTicks(viewport, viewportWindow(viewport, NOW_MS), NOW_MS);

    expect(ticks.map(tick => tick.atMs - midnightMs)).toEqual([-2, -1, 0, 1, 2, 3].map(hours => hours * HOUR_MS));
    expect(ticks.find(tick => tick.atMs === midnightMs)?.label).toBe(dayHeading(midnightMs, NOW_MS));
    expect(ticks[0]?.label).toBe(clockTime(midnightMs - 2 * HOUR_MS));
  });

  it('keeps day ticks on local midnight after the clocks go back', () => {
    vi.stubEnv('TZ', 'Europe/Paris');
    try {
      const startMs = new Date(2026, 9, 21, 12).getTime();
      const viewport: TimeViewport = { live: false, spanMs: MAX_SPAN_MS, endMs: startMs + MAX_SPAN_MS };
      const nowMs = viewport.endMs + HOUR_MS;

      const ticks = axisTicks(viewport, viewportWindow(viewport, nowMs), nowMs);

      expect(ticks.map(tick => new Date(tick.atMs).getHours())).toEqual([0, 0, 0, 0, 0, 0, 0]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('viewedDayLabel', () => {
  const justAfterMidnightMs = new Date(2025, 5, 10, 0, 30).getTime();

  it('names no day while following now, even when the window reaches back into yesterday', () => {
    const viewport: TimeViewport = { live: true, spanMs: HOUR_MS };

    expect(
      viewedDayLabel(viewport, viewportWindow(viewport, justAfterMidnightMs), justAfterMidnightMs),
    ).toBeUndefined();
  });

  it('names the day a fixed window starts on once it leaves today', () => {
    const viewport: TimeViewport = { live: false, spanMs: HOUR_MS, endMs: justAfterMidnightMs };

    expect(viewedDayLabel(viewport, viewportWindow(viewport, justAfterMidnightMs), justAfterMidnightMs)).toBe(
      dayHeading(new Date(2025, 5, 9).getTime(), justAfterMidnightMs),
    );
  });
});

import { describe, expect, it } from 'vitest';

import type { RunBar } from '../../runs/runBars';
import type { TimeWindow } from '../../time/timeViewport';
import { EXPANDED_LANE_ROWS, FOLDED_LANE_ROWS, laneHandoffs, packLanes, placeLanes } from './laneLayout';
import type { Lane } from './laneLayout';

const WINDOW: TimeWindow = { startMs: 1_000, endMs: 2_000, endsAtNow: true };

function run(
  id: string,
  role: string,
  startedAt: number | undefined,
  endedAt: number | undefined,
  workItemId = id,
): RunBar {
  return {
    id,
    role,
    workItemId,
    card: undefined,
    title: id,
    startedAt,
    endedAt,
    status: endedAt === undefined ? 'running' : 'complete',
  };
}

function laneLayout(
  runs: RunBar[],
  window: TimeWindow,
  narrowestBarMs = 0,
  expandedRoles: ReadonlySet<string> = new Set(),
): Lane[] {
  const liveEndMs = window.endsAtNow ? window.endMs : undefined;
  return placeLanes(packLanes(runs, narrowestBarMs, liveEndMs), window, expandedRoles);
}

function laneOf(runs: RunBar[], role: string, window = WINDOW, narrowestBarMs = 0, expandedRoles = new Set<string>()) {
  return laneLayout(runs, window, narrowestBarMs, expandedRoles).find(candidate => candidate.role === role);
}

function rowsOf(runs: RunBar[], role: string, window = WINDOW, narrowestBarMs = 0): Record<string, number> {
  return Object.fromEntries(
    (laneOf(runs, role, window, narrowestBarMs)?.runs ?? []).map(placed => [placed.run.id, placed.row]),
  );
}

function overlapping(count: number, role: string): RunBar[] {
  return Array.from({ length: count }, (_, index) => run(`${role}-${index}`, role, 1_100 + index * 10, 1_900));
}

describe('laneLayout', () => {
  it('keeps every built-in role as a lane, idle or not, with custom roles after them', () => {
    const lanes = laneLayout([run('a', 'zeta', 1_100, 1_200), run('b', 'alpha', 1_100, 1_200)], WINDOW);

    expect(lanes.map(lane => lane.role)).toEqual(['triage', 'plan', 'work', 'review', 'alpha', 'zeta']);
    expect(lanes.find(lane => lane.role === 'triage')).toMatchObject({ rowCount: 1, runs: [] });
  });

  it('stacks runs that overlap in one role, and lets back-to-back runs share a row', () => {
    const runs = [
      run('first', 'work', 1_100, 1_400),
      run('overlapping', 'work', 1_300, 1_600),
      run('after-first', 'work', 1_400, 1_500),
      run('open', 'work', 1_450, undefined),
    ];

    expect(rowsOf(runs, 'work')).toEqual({ first: 0, overlapping: 1, 'after-first': 0, open: 2 });
    expect(laneOf(runs, 'work')?.rowCount).toBe(3);
  });

  it('stacks runs too short to draw apart, even though their times do not overlap', () => {
    const runs = [run('quick', 'review', 1_100, 1_101), run('right-after', 'review', 1_110, 1_111)];

    expect(rowsOf(runs, 'review', WINDOW, 0)).toEqual({ quick: 0, 'right-after': 0 });
    expect(rowsOf(runs, 'review', WINDOW, 50)).toEqual({ quick: 0, 'right-after': 1 });
  });

  it('stacks a run that just began under one ending at now, since both are drawn at the live edge', () => {
    const runs = [run('ending', 'work', 1_800, 1_990), run('just-began', 'work', 1_995, undefined)];

    expect(rowsOf(runs, 'work', WINDOW, 50)).toEqual({ ending: 0, 'just-began': 1 });
    expect(rowsOf(runs, 'work', { ...WINDOW, endsAtNow: false }, 50)).toEqual({ ending: 0, 'just-began': 0 });
  });

  it('folds a busy lane to three rows, moving runs from the third row down into its overflow, until expanded', () => {
    const runs = overlapping(5, 'review');

    const folded = laneOf(runs, 'review');
    const expanded = laneOf(runs, 'review', WINDOW, 0, new Set(['review']));

    expect(folded).toMatchObject({ rowCount: FOLDED_LANE_ROWS, overflowRow: FOLDED_LANE_ROWS - 1 });
    expect(folded?.runs.map(placed => placed.run.id)).toEqual(['review-0', 'review-1']);
    expect(folded?.overflowRuns.map(placed => placed.run.id)).toEqual(['review-2', 'review-3', 'review-4']);
    expect(expanded).toMatchObject({ rowCount: 5, overflowRuns: [], foldable: true });
  });

  it('caps an expanded lane too, folding what is left into its last row', () => {
    const expanded = laneOf(overlapping(EXPANDED_LANE_ROWS + 3, 'work'), 'work', WINDOW, 0, new Set(['work']));

    expect(expanded).toMatchObject({ rowCount: EXPANDED_LANE_ROWS, overflowRow: EXPANDED_LANE_ROWS - 1 });
    expect(expanded?.runs).toHaveLength(EXPANDED_LANE_ROWS - 1);
    expect(expanded?.overflowRuns.map(placed => placed.run.id)).toEqual(['work-11', 'work-12', 'work-13', 'work-14']);
  });

  it('keeps a run on its row while the window pans past the run that pushed it down', () => {
    const runs = [
      run('pushing', 'work', 1_100, 1_300),
      run('pushed', 'work', 1_200, 1_600),
      run('later', 'work', 1_700, 1_900),
    ];

    expect(rowsOf(runs, 'work')).toEqual({ pushing: 0, pushed: 1, later: 0 });
    expect(rowsOf(runs, 'work', { startMs: 1_500, endMs: 2_000, endsAtNow: true })).toEqual({ pushed: 1, later: 0 });
  });

  it('closes up rows that have nothing in view', () => {
    const runs = [run('gone', 'work', 1_100, 1_300), run('stacked', 'work', 1_200, 1_600)];

    expect(laneOf(runs, 'work', { startMs: 1_400, endMs: 2_000, endsAtNow: true })).toMatchObject({
      rowCount: 1,
      runs: [{ run: { id: 'stacked' }, row: 0 }],
    });
  });

  it('cuts a run that began before the window at its edge and leaves out one that ended before it', () => {
    const runs = [
      run('straddling', 'work', 500, 1_200),
      run('earlier', 'work', 200, 900),
      run('unknown-start', 'work', undefined, 1_100),
    ];
    const placed = laneOf(runs, 'work')?.runs ?? [];

    expect(placed.find(candidate => candidate.run.id === 'straddling')).toMatchObject({
      fromMs: 1_000,
      toMs: 1_200,
      startNotInView: true,
    });
    expect(placed.find(candidate => candidate.run.id === 'unknown-start')).toMatchObject({
      fromMs: 1_000,
      startNotInView: true,
    });
    expect(rowsOf(runs, 'work')).not.toHaveProperty('earlier');
  });

  it('keeps a run whose server time runs ahead of the browser clock, pinned at "now"', () => {
    const [placed] = laneOf([run('just-started', 'work', 2_050, undefined)], 'work')?.runs ?? [];

    expect(placed).toMatchObject({ run: { id: 'just-started' }, fromMs: 2_000, toMs: 2_000 });
  });

  it('leaves out runs that start after a window panned back from now', () => {
    const runs = [run('later', 'work', 2_050, undefined), run('inside', 'work', 1_500, 1_900)];

    expect(rowsOf(runs, 'work', { ...WINDOW, endsAtNow: false })).toEqual({ inside: 0 });
  });

  it('keeps a run lost days ago where it started instead of stretching it into the live window', () => {
    const hourMs = 3_600_000;
    const nowMs = 100 * hourMs;
    const lost: RunBar = { ...run('lost', 'work', nowMs - 48 * hourMs, undefined), status: 'unaccounted' };
    const runs = [lost, run('current', 'work', nowMs - hourMs / 2, undefined)];

    expect(rowsOf(runs, 'work', { startMs: nowMs - hourMs, endMs: nowMs, endsAtNow: true })).toEqual({ current: 0 });
    expect(
      rowsOf(runs, 'work', { startMs: nowMs - 49 * hourMs, endMs: nowMs - 47 * hourMs, endsAtNow: false }),
    ).toEqual({ lost: 0 });
  });
});

describe('laneHandoffs', () => {
  it('links a card from the end of one role to the start of the next role that picked it up', () => {
    const lanes = laneLayout(
      [run('plan', 'plan', 1_100, 1_300, 'card'), run('build', 'work', 1_350, undefined, 'card')],
      WINDOW,
    );

    expect(laneHandoffs(lanes)).toMatchObject([
      {
        id: 'plan->build',
        from: { laneIndex: 1, placed: { run: { id: 'plan' }, row: 0 } },
        to: { laneIndex: 2, placed: { run: { id: 'build' }, row: 0 } },
      },
    ]);
  });

  it('draws nothing when the runs overlap, stay in one role, or the first never recorded an end', () => {
    const lanes = laneLayout(
      [
        run('plan', 'plan', 1_100, 1_300, 'overlap'),
        run('build', 'work', 1_200, 1_400, 'overlap'),
        run('build-again', 'work', 1_500, 1_600, 'same-role'),
        run('build-once-more', 'work', 1_650, 1_700, 'same-role'),
        run('triage-open', 'triage', 1_100, undefined, 'unended'),
        run('plan-later', 'plan', 1_800, 1_900, 'unended'),
      ],
      WINDOW,
    );

    expect(laneHandoffs(lanes)).toEqual([]);
  });

  it('draws nothing across a run folded out of sight, instead of skipping over it', () => {
    const lanes = laneLayout(
      [
        ...overlapping(4, 'work'),
        run('build', 'work', 1_250, 1_300, 'card'),
        run('plan', 'plan', 1_100, 1_200, 'card'),
        run('review', 'review', 1_350, 1_400, 'card'),
      ],
      WINDOW,
    );

    expect(laneHandoffs(lanes)).toEqual([]);
  });
});

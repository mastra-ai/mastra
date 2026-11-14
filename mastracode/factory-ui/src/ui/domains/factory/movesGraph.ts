import type { InstalledBoardInfo } from '../../../api/types';
import { phaseOf } from './boardFlow';
import type { WorkItemStageEntry } from './services/workItems';

/** A wait draws no longer than this share of the card's working time, so a day in Intake doesn't flatten the work. */
const WAIT_SHARE = 0.25;
/** No stretch of time draws thinner than this share of the axis, so a move made within the minute still shows. */
const MIN_SHARE = 0.015;

export interface GraphStay {
  entry: WorkItemStageEntry;
  /** The row of the stay's phase, counted from the top. */
  lane: number;
  /** A resting or finished phase, where the card waits instead of Factory working on it. */
  waiting: boolean;
  /** Where the stay starts on the axis and how much of it the stay draws, both as shares of the axis. */
  start: number;
  width: number;
}

/** A move from one phase to another: where it happened on the axis, and the lanes it joins. */
export interface GraphRiser {
  at: number;
  from: number;
  to: number;
}

export interface MovesGraphLayout {
  /** The phases the card has been in, in board order, one lane each. */
  lanes: string[];
  /** Every stay, oldest first. A card can sit in several phases at once, so stays can overlap. */
  stays: GraphStay[];
  risers: GraphRiser[];
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Lays a card's stays out like a sleep graph: one lane per phase it has been in, along one time axis that stays share
 * when they overlap. Stretches where the card only waits fold to a share of the working time, so the work keeps its
 * length beside them.
 */
export function movesGraph(
  history: readonly WorkItemStageEntry[],
  board: InstalledBoardInfo | undefined,
  now: number,
): MovesGraphLayout {
  const visited = [...new Set(history.map(entry => entry.stage))];
  const phaseCount = board?.phases.length ?? 0;
  // Phases off the board, from an older board, follow the board's own in the order the card met them.
  const order = (stage: string) => {
    const index = board?.phases.findIndex(phase => phase.id === stage) ?? -1;
    return index === -1 ? phaseCount + visited.indexOf(stage) : index;
  };
  const lanes = visited.toSorted((a, b) => order(a) - order(b));

  const timed = history
    .map(entry => {
      const phase = phaseOf(board, entry.stage);
      const from = Date.parse(entry.enteredAt);
      return {
        entry,
        lane: lanes.indexOf(entry.stage),
        waiting: phase !== undefined && phase.kind !== 'working',
        from,
        // The clock reads to the minute, so a stay entered since its last tick ends where it starts.
        to: Math.max(from, entry.exitedAt ? Date.parse(entry.exitedAt) : now),
      };
    })
    .toSorted((a, b) => a.from - b.from);

  // The axis runs through every moment a stay starts or ends; between two of them, the card works or only waits.
  const moments = [...new Set(timed.flatMap(stay => [stay.from, stay.to]))].toSorted((a, b) => a - b);
  const stretches = moments.slice(1).map((to, index) => {
    const from = moments[index] ?? to;
    return { length: to - from, working: timed.some(stay => !stay.waiting && stay.from < to && stay.to > from) };
  });
  const working = sum(stretches.filter(stretch => stretch.working).map(stretch => stretch.length));
  // Without working time there is nothing for a wait to flatten, so every stretch draws as long as it lasted.
  const cap = working > 0 ? working * WAIT_SHARE : Number.POSITIVE_INFINITY;
  const folded = foldWaits(stretches, cap);
  const total = sum(folded);
  const drawn = folded.map(length => Math.max(length, total * MIN_SHARE));
  const axis = sum(drawn);

  const position = new Map<number, number>();
  let cursor = 0;
  moments.forEach((moment, index) => {
    position.set(moment, axis > 0 ? cursor / axis : 0);
    cursor += drawn[index] ?? 0;
  });
  const at = (moment: number) => position.get(moment) ?? 0;

  const stays = timed.map(({ entry, lane, waiting, from, to }, index) =>
    // Stays that all start and end at one moment share the axis evenly, so each still shows.
    axis > 0
      ? { entry, lane, waiting, start: at(from), width: at(to) - at(from) }
      : { entry, lane, waiting, start: index / timed.length, width: 1 / timed.length },
  );
  const risers = timed.flatMap(stay =>
    timed
      .filter(left => left.entry.exitedAt !== undefined && left.to === stay.from && left.lane !== stay.lane)
      .map(left => ({ at: at(stay.from), from: left.lane, to: stay.lane })),
  );
  return { lanes, stays, risers };
}

/** Shrinks each unbroken run of waiting to at most `cap`, keeping the proportions inside it. */
function foldWaits(stretches: ReadonlyArray<{ length: number; working: boolean }>, cap: number): number[] {
  const runs: Array<{ working: boolean; lengths: number[] }> = [];
  for (const stretch of stretches) {
    const run = runs.at(-1);
    if (run && !run.working && !stretch.working) run.lengths.push(stretch.length);
    else runs.push({ working: stretch.working, lengths: [stretch.length] });
  }
  return runs.flatMap(run => {
    const length = sum(run.lengths);
    const scale = run.working || length <= cap ? 1 : cap / length;
    return run.lengths.map(part => part * scale);
  });
}

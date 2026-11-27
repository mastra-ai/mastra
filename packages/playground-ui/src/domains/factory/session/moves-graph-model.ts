import type { BoardPhaseKind } from '../board/board-icons';

export interface MovesGraphEntry {
  stage: string;
  enteredAt: string;
  exitedAt?: string | null;
}

export interface MovesGraphPhase {
  id: string;
  name: string;
  /** Icon kind; leave unset where the board draws its own stage art. */
  kind?: BoardPhaseKind;
  /** Stays in a working phase draw solid; others draw faint. */
  working?: boolean;
}

export interface MovesGraphStay<E extends MovesGraphEntry = MovesGraphEntry> {
  entry: E;
  from: number;
  to: number;
  lane: number;
  working: boolean;
  start: number;
  width: number;
}

/** How the graph words times and lengths; hosts pass their own to match the rest of their UI. */
export interface MovesGraphLabels {
  /** A stay's length: `<1m`, `20m`, `2h 5m`. */
  elapsed: (from: number, to: number) => string;
  /** The moment a stay began, with the clock. */
  moment: (time: number, now: number) => string;
  /** When the first stay began, after "Since". */
  start: (time: number, now: number) => string;
}

/** Lays out a card's stays: one lane per phase visited, in board order, each stay sized by how long it lasted. */
export function movesGraph<E extends MovesGraphEntry>(
  history: readonly E[],
  phases: readonly MovesGraphPhase[],
  now: number,
): { lanes: string[]; stays: MovesGraphStay<E>[] } {
  const visited = [...new Set(history.map(entry => entry.stage))];
  const order = (stage: string) => {
    const index = phases.findIndex(phase => phase.id === stage);
    return index === -1 ? phases.length + visited.indexOf(stage) : index;
  };
  const lanes = visited.toSorted((a, b) => order(a) - order(b));
  const stays = history
    .map(entry => {
      const from = Date.parse(entry.enteredAt);
      // The clock reads to the minute, so a stay entered since its last tick ends where it starts.
      return { entry, from, to: Math.max(from, entry.exitedAt ? Date.parse(entry.exitedAt) : now) };
    })
    .toSorted((a, b) => a.from - b.from);
  const start = stays[0]?.from ?? now;
  const length = Math.max(0, ...stays.map(stay => stay.to - start));
  return {
    lanes,
    stays: stays.map((stay, index) => {
      const working = phases.find(phase => phase.id === stay.entry.stage)?.working ?? false;
      const lane = lanes.indexOf(stay.entry.stage);
      return length > 0
        ? { ...stay, lane, working, start: (stay.from - start) / length, width: (stay.to - stay.from) / length }
        : { ...stay, lane, working, start: index / stays.length, width: 1 / stays.length };
    }),
  };
}

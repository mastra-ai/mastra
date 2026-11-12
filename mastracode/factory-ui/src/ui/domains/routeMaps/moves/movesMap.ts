import type { InstalledBoardInfo, InstalledPhaseInfo, IntakeRouteInfo } from '../../../../api/types';
import { placesNewCards, triggerLabel } from '../../settings/components/intakeRoutes';

export type MapPhase = {
  phase: InstalledPhaseInfo;
  /** It may move to every other phase, which the map says once instead of drawing a line to each. */
  anyPhase: boolean;
  /** The phases it may move to, in board order. */
  targets: InstalledPhaseInfo[];
  isInitial: boolean;
};

export type MapTransition = {
  id: string;
  from: string;
  to: string;
  /** Forward moves (down the board) curve on one side of the phases, moves back on the other. */
  direction: 'forward' | 'back';
  /** How many phases apart the two ends are, which sets how far the curve bows out so curves nest. */
  distance: number;
};

/**
 * A route that moves cards already on the board when something happens to them. Each is one card left of the phases,
 * wired to the phase it sends cards to, whatever the event; a new event only needs its wording in `triggerLabel`.
 */
export type MapEventMove = {
  route: IntakeRouteInfo;
  /** "A card is closed", "A pull request is merged". */
  trigger: string;
  /** The phase it moves cards to. */
  to: string;
};

export type MovesMap = { phases: MapPhase[]; transitions: MapTransition[]; eventMoves: MapEventMove[] };

/** A board's phases in order, the moves each allows, and the routes that move its cards when their issue changes. */
export function movesMap(board: InstalledBoardInfo, routes: readonly IntakeRouteInfo[]): MovesMap {
  const order = new Map(board.phases.map((phase, index) => [phase.id, index]));
  const phases = board.phases.map((phase): MapPhase => {
    const others = board.phases.filter(other => other.id !== phase.id);
    // Unset, a finished phase keeps its cards and any other phase may send them anywhere.
    const next = phase.nextPhases ?? (phase.kind === 'terminal' ? [] : others.map(other => other.id));
    const targets = board.phases.filter(other => next.includes(other.id));
    return {
      phase,
      anyPhase: others.length > 1 && others.every(other => next.includes(other.id)),
      targets,
      isInitial: phase.id === board.initialPhase,
    };
  });
  const transitions = phases.flatMap(({ phase, anyPhase, targets }) => {
    if (anyPhase) return [];
    const from = order.get(phase.id) ?? 0;
    return targets.flatMap((target): MapTransition[] => {
      const to = order.get(target.id) ?? 0;
      if (to === from) return [];
      return [
        {
          id: `${phase.id}->${target.id}`,
          from: phase.id,
          to: target.id,
          direction: to > from ? 'forward' : 'back',
          distance: Math.abs(to - from),
        },
      ];
    });
  });
  const eventMoves = routes
    .filter(route => !placesNewCards(route) && route.target.boardKey === board.id)
    .map(route => ({ route, trigger: triggerLabel(route.on), to: route.target.phaseKey ?? board.initialPhase }));
  return { phases, transitions, eventMoves };
}

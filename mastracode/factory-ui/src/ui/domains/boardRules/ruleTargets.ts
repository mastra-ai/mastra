import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../api/types';

export function phaseName(board: InstalledBoardInfo | undefined, phaseKey: string | null): string | undefined {
  if (!board) return undefined;
  const key = phaseKey ?? board.initialPhase;
  const phase = board.phases.find(candidate => candidate.id === key);
  return phase ? (phase.name ?? phase.title) : undefined;
}

export function boardName(board: InstalledBoardInfo): string {
  return board.name ?? board.title;
}

/** A board's phases as condition values, so a phase rule names them. */
export function phaseOptions(board: InstalledBoardInfo | undefined): Record<string, FilterBarOption[]> {
  if (!board) return {};
  return {
    'closedIssue.phase': board.phases.map(phase => ({ value: phase.id, label: phase.name ?? phase.title })),
  };
}

/**
 * The whole project's route order after moving the `shown` route at `from` to `to` among them. Routes not
 * shown keep their slots: the shown ones only trade places with each other.
 */
export function reorderWithin(
  routes: readonly Pick<IntakeRouteInfo, 'id'>[],
  shown: readonly string[],
  from: number,
  to: number,
): string[] {
  const order = [...shown];
  const [moved] = order.splice(from, 1);
  if (moved === undefined) return routes.map(route => route.id);
  order.splice(to, 0, moved);
  const shownIds = new Set(shown);
  let next = 0;
  return routes.map(route => (shownIds.has(route.id) ? (order[next++] ?? route.id) : route.id));
}

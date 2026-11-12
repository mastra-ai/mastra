import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';

import type { InstalledBoardInfo, InstalledPhaseInfo, IntakeRouteInfo } from '../../../../api/types';
import { catchesEveryArrival } from '../../settings/components/intakeRoutes';

export type IntakeSource = 'github' | 'gitlab' | 'linear' | 'jira' | 'incidentio' | 'manual';

export const INTAKE_SOURCES: readonly IntakeSource[] = ['github', 'gitlab', 'linear', 'jira', 'incidentio', 'manual'];

export const INTAKE_SOURCE_LABELS: Record<IntakeSource, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  linear: 'Linear',
  jira: 'Jira',
  incidentio: 'incident.io',
  manual: 'Manual or API',
};

/**
 * The events that start a card's trip through the routes, each its own lane on the map. A new event (a card
 * leaving a phase) is one more entry here.
 */
export const ARRIVAL_EVENTS = [{ id: 'work_item.created', label: 'A new card arrives' }] as const;

export type ArrivalEvent = (typeof ARRIVAL_EVENTS)[number]['id'];

const SOURCE_FIELDS = new Set(['source.integration', 'source.provider']);

function isIntakeSource(value: unknown): value is IntakeSource {
  return typeof value === 'string' && (INTAKE_SOURCES as readonly string[]).includes(value);
}

/**
 * The sources a route takes cards from, read from its top-level `source.integration`/`source.provider`
 * conditions; undefined when it takes cards from any source. A route that only names other facts, or names
 * sources inside an OR, can match any source.
 */
export function routeSources(when: RuleGroup | null): IntakeSource[] | undefined {
  if (!when || when.operator !== 'AND') return undefined;
  let allowed: IntakeSource[] | undefined;
  for (const condition of when.conditions) {
    if ('conditions' in condition || !SOURCE_FIELDS.has(condition.field)) continue;
    const values = Array.isArray(condition.value) ? condition.value : [condition.value];
    const named = values.filter(isIntakeSource);
    const matching =
      condition.operator === 'equals' || condition.operator === 'in'
        ? named
        : condition.operator === 'not_equals' || condition.operator === 'not_in'
          ? INTAKE_SOURCES.filter(source => !named.includes(source))
          : undefined;
    if (!matching) continue;
    allowed = allowed ? allowed.filter(source => matching.includes(source)) : matching;
  }
  return allowed;
}

/** Whether a route may take a card from `source`: it names that source, or no source at all. */
export function routeTakesFrom(route: Pick<IntakeRouteInfo, 'when'>, source: IntakeSource): boolean {
  return routeSources(route.when)?.includes(source) ?? true;
}

/** The key of the phase a card lands on, `board:phase`, which the map's destination rows are anchored by. */
export function destinationKey(boardKey: string, phaseKey: string): string {
  return `${boardKey}:${phaseKey}`;
}

export type MapRoute = {
  route: IntakeRouteInfo;
  /** "If", "Else if", "Otherwise". */
  step: string;
  isCatchAll: boolean;
  /** Below a route that takes every new card, so it never runs. */
  unreachable: boolean;
  /** The phase it sends cards to, as `destinationKey`, or undefined when its board isn't installed. */
  destination: string | undefined;
};

export type MapDestinationBoard = { board: InstalledBoardInfo; phases: InstalledPhaseInfo[] };

export type IntakeMap = {
  routes: MapRoute[];
  /** Where cards no route takes land, when no route takes every new card. */
  fallback: { board: InstalledBoardInfo; destination: string } | undefined;
  /** The boards new cards can land on, in catalog order, each with the phases routes send cards to. */
  boards: MapDestinationBoard[];
};

/** The new-card routes for `event` in the order they're tried, and where each sends cards. */
export function intakeMap(
  routes: readonly IntakeRouteInfo[],
  boards: readonly InstalledBoardInfo[],
  event: ArrivalEvent,
): IntakeMap {
  const listening = routes.filter(route => route.on.includes(event));
  const catchAllAt = listening.findIndex(catchesEveryArrival);
  const mapped = listening.map((route, index): MapRoute => {
    const board = boards.find(candidate => candidate.id === route.target.boardKey);
    return {
      route,
      step: index === catchAllAt ? 'Otherwise' : index === 0 ? 'If' : 'Else if',
      isCatchAll: index === catchAllAt,
      unreachable: catchAllAt >= 0 && index > catchAllAt,
      destination: board ? destinationKey(board.id, route.target.phaseKey ?? board.initialPhase) : undefined,
    };
  });
  const defaultBoard = boards.find(board => board.id === DEFAULT_BOARD_ID) ?? boards[0];
  const fallback =
    catchAllAt < 0 && defaultBoard
      ? { board: defaultBoard, destination: destinationKey(defaultBoard.id, defaultBoard.initialPhase) }
      : undefined;

  const targeted = new Set(mapped.flatMap(entry => (entry.destination ? [entry.destination] : [])));
  if (fallback) targeted.add(fallback.destination);
  const destinationBoards = boards.flatMap(board => {
    const phases = board.phases.filter(phase => targeted.has(destinationKey(board.id, phase.id)));
    return phases.length > 0 ? [{ board, phases }] : [];
  });
  return { routes: mapped, fallback, boards: destinationBoards };
}

import { STATUS_EVENTS } from '@mastra/factory/boards/board-events';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';

import type { InstalledBoardInfo, IntakeRouteInfo, IntakeRouteInput, IntakeRoutePatch } from '../../../../api/types';

type IntakeRouteWrite =
  | { kind: 'create'; route: IntakeRouteInput }
  | { kind: 'update'; id: string; patch: IntakeRoutePatch };

const MAX_ROUTE_NAME = 120;

/** Whether `route` places every new card that reaches it, like the default "Everything else" route. */
export function catchesEveryArrival(route: IntakeRouteInfo): boolean {
  return (
    route.enabled && route.when === null && route.on.includes('work_item.created') && !route.target.joinClosedIssue
  );
}

export function phaseName(board: InstalledBoardInfo | undefined, phaseKey: string | null): string | undefined {
  if (!board) return undefined;
  const key = phaseKey ?? board.initialPhase;
  const phase = board.phases.find(candidate => candidate.id === key);
  return phase ? (phase.name ?? phase.title) : undefined;
}

export function boardName(board: InstalledBoardInfo): string {
  return board.name ?? board.title;
}

/** Where a route sends its cards, as `Board › Phase`. */
export function describeTarget(route: IntakeRouteInfo, boards: readonly InstalledBoardInfo[]): string {
  const board = boards.find(candidate => candidate.id === route.target.boardKey);
  if (!board) return `${route.target.boardKey} (not installed)`;
  const phase = phaseName(board, route.target.phaseKey) ?? route.target.phaseKey ?? board.initialPhase;
  return `${boardName(board)} › ${phase}`;
}

/** A board's phases as condition values, so a phase rule names them. */
export function phaseOptions(board: InstalledBoardInfo | undefined): Record<string, FilterBarOption[]> {
  if (!board) return {};
  return {
    'closedIssue.phase': board.phases.map(phase => ({ value: phase.id, label: phase.name ?? phase.title })),
  };
}

const TRIGGER_TEXT: Record<string, string> = {
  'work_item.created': 'a new card arrives',
  'work_item.closed': 'a card is closed',
  'work_item.reopened': 'a card is reopened',
  'pull_request.opened': 'a pull request opens',
  'pull_request.synchronized': 'a pull request gets new commits',
  'pull_request.review_requested': 'a review is requested',
  'pull_request.merged': 'a pull request is merged',
  'pull_request.closed': 'a pull request closes unmerged',
};

/** The events that move a card already on a board, in the order a card meets them. */
export const MOVE_EVENTS = STATUS_EVENTS.filter(event => event !== 'work_item.created');

/** Events as a choice in a list: "A card is closed", or "A card is closed or a card is reopened". */
export function triggerLabel(events: readonly string[]): string {
  const text = events.map(event => TRIGGER_TEXT[event] ?? event).join(' or ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Whether a route places new cards. Every other route only moves cards already on its own board, so it
 * belongs to that board's settings, not the factory's.
 */
export function placesNewCards(route: Pick<IntakeRouteInfo, 'on'>): boolean {
  return route.on.includes('work_item.created');
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

/** The phase of `to` that plays the part `phaseKey` plays on `from`, if `to` has one. */
function matchingPhase(
  from: InstalledBoardInfo,
  to: InstalledBoardInfo,
  phaseKey: string | null,
): string | null | undefined {
  if (phaseKey === null || phaseKey === from.initialPhase) return to.initialPhase;
  const parts = ['completed', 'canceled', 'pullRequestReview', 'triage'] as const;
  const part = parts.find(candidate => from.flow?.[candidate] === phaseKey);
  return part ? to.flow?.[part] : undefined;
}

function sameRule(a: RuleGroup | null, b: RuleGroup | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The route changes that send the project's new cards to `boardKey`'s first phase: the catch-all
 * route (the first route taking every new card, the one that places them) points there, and each
 * status-event route of the board the catch-all pointed at gets a copy on `boardKey`, since a status event only moves a card
 * through routes on the card's own board. A copy is skipped when `boardKey` has no phase playing
 * the same part, or already has such a route.
 */
export function sendNewCardsTo(
  routes: readonly IntakeRouteInfo[],
  boards: readonly InstalledBoardInfo[],
  boardKey: string,
): IntakeRouteWrite[] {
  const to = boards.find(board => board.id === boardKey);
  if (!to) return [];
  // Routes apply in order, so the first route that takes every new card is the one that places them.
  const catchAll = routes.find(catchesEveryArrival);
  const fromKey = catchAll?.target.boardKey;
  const from = boards.find(board => board.id === fromKey);
  const landing = phaseName(to, to.initialPhase) ?? to.initialPhase;
  const catchAllName = `Everything else goes to ${boardName(to)} › ${landing}`.slice(0, MAX_ROUTE_NAME);
  const writes: IntakeRouteWrite[] = [];

  // The catch-all goes first: each route created after it moves it down a slot, which bumps
  // its revision, so a later patch would name a revision it no longer has.
  if (!catchAll) {
    writes.push({
      kind: 'create',
      route: { name: catchAllName, when: null, target: { boardKey: to.id, phaseKey: to.initialPhase } },
    });
  } else if (catchAll.target.boardKey !== to.id || catchAll.target.phaseKey !== to.initialPhase) {
    writes.push({
      kind: 'update',
      id: catchAll.id,
      patch: {
        name: catchAllName,
        target: { boardKey: to.id, phaseKey: to.initialPhase },
        expectedRevision: catchAll.revision,
      },
    });
  }

  if (from && from.id !== to.id) {
    for (const route of routes) {
      if (route.target.boardKey !== from.id || route.on.includes('work_item.created') || route.target.joinClosedIssue)
        continue;
      const phaseKey = matchingPhase(from, to, route.target.phaseKey);
      if (phaseKey === undefined) continue;
      const exists = routes.some(
        other =>
          other.target.boardKey === to.id &&
          sameRule(other.when, route.when) &&
          JSON.stringify(other.on) === JSON.stringify(route.on),
      );
      if (exists) continue;
      writes.push({
        kind: 'create',
        route: {
          name: `${route.name} on ${boardName(to)}`.slice(0, MAX_ROUTE_NAME),
          enabled: route.enabled,
          when: route.when,
          target: { boardKey: to.id, phaseKey },
          on: route.on,
        },
      });
    }
  }

  return writes;
}

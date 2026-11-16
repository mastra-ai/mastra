import { arrivalKinds, STATUS_EVENTS } from '@mastra/factory/boards/board-events';
import type { ArrivalKind } from '@mastra/factory/boards/board-events';
import { kindsTakenWhole } from '@mastra/factory/boards/intake-order';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';

import type { InstalledBoardInfo, IntakeRouteInfo, IntakeRouteInput, IntakeRoutePatch } from '../../../../api/types';

type IntakeRouteWrite =
  | { kind: 'create'; route: IntakeRouteInput }
  | { kind: 'update'; id: string; patch: IntakeRoutePatch };

const MAX_ROUTE_NAME = 120;

const ARRIVAL_KINDS: readonly ArrivalKind[] = ['issue', 'pull_request'];

/**
 * Whether `route` places every new `kind` of item that reaches it (issues or pull requests), like the
 * default "Everything else" and "Pull requests go to Review" routes; with no `kind`, either. A rule
 * testing nothing but the item's kind still takes all of that kind.
 */
export function catchesEveryArrival(route: IntakeRouteInfo, kind?: ArrivalKind): boolean {
  if (!route.enabled || route.target.joinClosedIssue) return false;
  const kinds: readonly string[] = kindsTakenWhole(route);
  return kind ? kinds.includes(kind) : kinds.length > 0;
}

/** The first route taking every new item of each kind, in route order: issues, then pull requests. */
export function catchAllsByKind(routes: readonly IntakeRouteInfo[]): Map<ArrivalKind, IntakeRouteInfo> {
  const found = new Map<ArrivalKind, IntakeRouteInfo>();
  for (const kind of ARRIVAL_KINDS) {
    const route = routes.find(candidate => catchesEveryArrival(candidate, kind));
    if (route) found.set(kind, route);
  }
  return found;
}

/**
 * The route past which no new card reaches another: the later of the issue and pull request
 * catch-alls, once both kinds are caught. Undefined while a kind still reaches the end.
 */
export function finalCatchAll(routes: readonly IntakeRouteInfo[]): IntakeRouteInfo | undefined {
  const found = catchAllsByKind(routes);
  if (found.size < ARRIVAL_KINDS.length) return undefined;
  const caught = new Set(found.values());
  return routes.findLast(route => caught.has(route));
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
  'work_item.opened': 'a new issue arrives',
  'work_item.closed': 'a card is closed',
  'work_item.reopened': 'a card is reopened',
  'pull_request.opened': 'a pull request opens',
  'pull_request.synchronized': 'a pull request gets new commits',
  'pull_request.review_requested': 'a review is requested',
  'pull_request.merged': 'a pull request is merged',
  'pull_request.closed': 'a pull request closes unmerged',
};

/** The events that move a card already on a board, in the order a card meets them. */
export const MOVE_EVENTS = STATUS_EVENTS.filter(event => event !== 'work_item.opened');

/** Events as a choice in a list: "A card is closed", or "A card is closed or a card is reopened". */
export function triggerLabel(events: readonly string[]): string {
  const text = events.map(event => TRIGGER_TEXT[event] ?? event).join(' or ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Whether a route places new cards. Every other route only moves cards already on its own board, so it
 * belongs to that board's settings, not the factory's.
 */
export function placesNewCards(route: Pick<IntakeRouteInfo, 'on' | 'pullRequestOpenedMovesOnly'>): boolean {
  return arrivalKinds(route).size > 0;
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
 * Whether a route tests the issue a pull request closes, a fact only an issue's card has when a pull
 * request links to it: it never places a new card, only moves that one.
 */
function movesLinkedCardsOnly(route: IntakeRouteInfo): boolean {
  return (
    route.when?.operator === 'AND' &&
    route.when.conditions.some(condition => 'field' in condition && condition.field.startsWith('closedIssue.'))
  );
}

/**
 * `when` for a copy on `to`: each phase a `closedIssue.phase` condition names is the linked issue
 * card's phase, so it becomes `to`'s phase playing the same part. Undefined when one has none.
 */
function remapClosedIssuePhases(
  when: RuleGroup | null,
  from: InstalledBoardInfo,
  to: InstalledBoardInfo,
): RuleGroup | null | undefined {
  if (!when) return when;
  const conditions: RuleGroup['conditions'] = [];
  for (const condition of when.conditions) {
    if (!('field' in condition)) {
      const nested = remapClosedIssuePhases(condition, from, to);
      if (!nested) return undefined;
      conditions.push(nested);
      continue;
    }
    if (condition.field !== 'closedIssue.phase') {
      conditions.push(condition);
      continue;
    }
    const values = Array.isArray(condition.value) ? condition.value : [condition.value];
    const mapped = values.map(value => (typeof value === 'string' ? matchingPhase(from, to, value) : undefined));
    if (mapped.some(value => value === undefined)) return undefined;
    conditions.push({ ...condition, value: Array.isArray(condition.value) ? mapped : mapped[0] } as typeof condition);
  }
  return { ...when, conditions };
}

/**
 * The route changes that send the project's new cards to `boardKey`: the catch-alls (the first
 * route taking every new issue, and the first taking every new pull request) point there, new
 * issues to its first phase and pull requests to its phase playing the same part, and each
 * status-event route of the board the catch-all pointed at gets a copy on `boardKey`, since a
 * status event only moves a card through routes on the card's own board. A copy is skipped when
 * `boardKey` has no phase playing the same part, or already has such a route.
 */
export function sendNewCardsTo(
  routes: readonly IntakeRouteInfo[],
  boards: readonly InstalledBoardInfo[],
  boardKey: string,
): IntakeRouteWrite[] {
  const to = boards.find(board => board.id === boardKey);
  if (!to) return [];
  // Routes apply in order, so the first route taking every new item of a kind is the one that places it.
  const catchAlls = catchAllsByKind(routes);
  const fromKey = (catchAlls.get('issue') ?? catchAlls.get('pull_request'))?.target.boardKey;
  const from = boards.find(board => board.id === fromKey);
  const landingName = (phaseKey: string) => `${boardName(to)} › ${phaseName(to, phaseKey) ?? phaseKey}`;
  const catchAllName = `Everything else goes to ${landingName(to.initialPhase)}`.slice(0, MAX_ROUTE_NAME);
  const writes: IntakeRouteWrite[] = [];
  const creates: IntakeRouteWrite[] = [];

  // The catch-alls go first: each route created after them moves them down a slot, which bumps
  // their revisions, so a later patch would name a revision they no longer have.
  if (catchAlls.size === 0) {
    creates.push({
      kind: 'create',
      route: { name: catchAllName, when: null, target: { boardKey: to.id, phaseKey: to.initialPhase } },
    });
  }
  for (const [kind, catchAll] of catchAlls) {
    // One route catching both kinds, as older projects have, is moved once.
    if (kind === 'pull_request' && catchAll === catchAlls.get('issue')) continue;
    const pullRequestsOnly = !catchesEveryArrival(catchAll, 'issue');
    const routeFrom = boards.find(board => board.id === catchAll.target.boardKey);
    const phaseKey = pullRequestsOnly
      ? ((routeFrom && matchingPhase(routeFrom, to, catchAll.target.phaseKey)) ?? to.initialPhase)
      : to.initialPhase;
    if (catchAll.target.boardKey === to.id && catchAll.target.phaseKey === phaseKey) continue;
    writes.push({
      kind: 'update',
      id: catchAll.id,
      patch: {
        name: pullRequestsOnly ? `Pull requests go to ${landingName(phaseKey)}`.slice(0, MAX_ROUTE_NAME) : catchAllName,
        target: { boardKey: to.id, phaseKey },
        expectedRevision: catchAll.revision,
      },
    });
  }
  writes.push(...creates);

  if (from && from.id !== to.id) {
    for (const route of routes) {
      // Routes placing new cards stay where they are: the catch-alls above already send them on.
      if (route.target.boardKey !== from.id || route.target.joinClosedIssue) continue;
      if (placesNewCards(route) && !movesLinkedCardsOnly(route)) continue;
      const phaseKey = matchingPhase(from, to, route.target.phaseKey);
      if (phaseKey === undefined) continue;
      const when = remapClosedIssuePhases(route.when, from, to);
      if (when === undefined) continue;
      const exists = routes.some(
        other =>
          other.target.boardKey === to.id &&
          sameRule(other.when, when) &&
          JSON.stringify(other.on) === JSON.stringify(route.on),
      );
      if (exists) continue;
      writes.push({
        kind: 'create',
        route: {
          name: `${route.name} on ${boardName(to)}`.slice(0, MAX_ROUTE_NAME),
          enabled: route.enabled,
          when,
          target: { boardKey: to.id, phaseKey },
          on: route.on,
          // A 0.28 `pull_request.opened` route stays a card move on the copy too.
          ...(route.pullRequestOpenedMovesOnly && { pullRequestOpenedMovesOnly: true }),
        },
      });
    }
  }

  return writes;
}

import type { RuleCondition, RuleGroup } from '@mastra/factory/rules/rule-group';

import type { InstalledBoardInfo, IntakeRouteInfo, IntakeRouteInput, IntakeRoutePatch } from '../../../../api/types';

export type IntakeRouteWrite =
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
  const join = route.target.joinClosedIssue ? 'Joins the closed issue’s card, then ' : '';
  return `${join}${boardName(board)} › ${phase}`;
}

const OPERATOR_TEXT: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  in: 'is one of',
  not_in: 'is not one of',
  exists: 'is set',
  not_exists: 'is not set',
  greater_than: '>',
  less_than: '<',
  greater_than_or_equal: '≥',
  less_than_or_equal: '≤',
};

function describeMember(member: RuleCondition | RuleGroup): string {
  if ('conditions' in member) return `(${describeWhen(member)})`;
  const operator = OPERATOR_TEXT[member.operator] ?? member.operator;
  if (member.value === undefined) return `${member.field} ${operator}`;
  const value = Array.isArray(member.value) ? member.value.join(', ') : String(member.value);
  return `${member.field} ${operator} ${value}`;
}

/** A route's condition in words; `null` matches every card. */
export function describeWhen(when: RuleGroup | null): string {
  if (!when) return 'Every card';
  return when.conditions.map(describeMember).join(when.operator === 'AND' ? ' and ' : ' or ');
}

const EVENT_TEXT: Record<string, string> = {
  'work_item.created': 'New cards',
  'work_item.closed': 'Closed',
  'work_item.reopened': 'Reopened',
  'pull_request.opened': 'PR opened',
  'pull_request.synchronized': 'PR updated',
  'pull_request.review_requested': 'Review requested',
  'pull_request.merged': 'PR merged',
  'pull_request.closed': 'PR closed',
};

export function describeEvents(on: readonly string[]): string {
  return on.map(event => EVENT_TEXT[event] ?? event).join(', ');
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
 * route (the last route taking every new card) points there, and each status-event route of the
 * board the catch-all pointed at gets a copy on `boardKey`, since a status event only moves a card
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
  const catchAll = routes.findLast(catchesEveryArrival);
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
          allowWorkingPhase: route.allowWorkingPhase,
        },
      });
    }
  }

  return writes;
}

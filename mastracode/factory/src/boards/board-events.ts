import type { RuleGroup } from '../rules/rule-group.js';
import { CARD_RULE_FIELDS } from '../rules/rule-group.js';
import { AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL } from '../rules/types.js';

/**
 * What happened to a card's source, named the same for every provider. Integrations map their
 * webhooks onto these. Status events change where a card belongs: only these can move a card, so
 * only these may be named in a route's `on`.
 */
export const STATUS_EVENTS = [
  'work_item.opened',
  'work_item.reopened',
  'work_item.updated',
  'work_item.closed',
  'pull_request.opened',
  'pull_request.reopened',
  'pull_request.updated',
  'pull_request.synchronized',
  'pull_request.review_requested',
  'pull_request.merged',
  'pull_request.closed',
] as const;
export type StatusEvent = (typeof STATUS_EVENTS)[number];

/**
 * The event routes placed new cards on before issues and pull requests had events of their own: an
 * issue or a pull request with no card opened. It never fires and never moves a card. A stored
 * route naming it, or naming no event, keeps filing both for good, and the API keeps accepting and
 * returning it, so editing such a route never narrows it.
 */
export const LEGACY_ARRIVAL_EVENT = 'work_item.created';

/** What a route's `on` may name: the status events, and the legacy arrival event. */
export const ROUTE_EVENTS = [...STATUS_EVENTS, LEGACY_ARRIVAL_EVENT] as const;
export type RouteEvent = (typeof ROUTE_EVENTS)[number];

/** What an arrival is: an issue (any provider's work item) or a pull request with no card. */
export type ArrivalKind = 'issue' | 'pull_request';

/** The kind of an arrival, read from its `source.kind` fact. */
export function arrivalKind(facts: Record<string, unknown>): ArrivalKind {
  return facts['source.kind'] === 'pull_request' ? 'pull_request' : 'issue';
}

/** What a route's arrival events mean: a route stored by 0.28 moved cards on `pull_request.opened` and filed none. */
export interface RouteArrivals {
  on: readonly string[];
  /** True on a route stored before `pull_request.opened` filed pull requests: there it only moves a card. */
  pullRequestOpenedMovesOnly?: boolean;
}

/** The arrivals a route files: issues on `work_item.opened`, pull requests on `pull_request.opened`, both on `work_item.created`. */
export function arrivalKinds({ on, pullRequestOpenedMovesOnly }: RouteArrivals): Set<ArrivalKind> {
  const kinds = new Set<ArrivalKind>();
  if (on.includes('work_item.opened') || on.includes(LEGACY_ARRIVAL_EVENT)) kinds.add('issue');
  if ((on.includes('pull_request.opened') && !pullRequestOpenedMovesOnly) || on.includes(LEGACY_ARRIVAL_EVENT)) {
    kinds.add('pull_request');
  }
  return kinds;
}

/** Labels or assignees an update added and removed. */
export interface ItemChange {
  added: string[];
  removed: string[];
}

/**
 * Folds several changes, oldest first, into the net change: a label added then removed (or removed
 * then added back) cancels out, so the result never carries just the newest delta.
 */
export function combineChanges(changes: readonly ItemChange[]): ItemChange {
  // Keyed case-insensitively like `listChange`, keeping the newest spelling.
  const net = new Map<string, { name: string; side: 'added' | 'removed' }>();
  const fold = (name: string, side: 'added' | 'removed') => {
    const key = name.toLowerCase();
    const seen = net.get(key);
    if (seen && seen.side !== side) net.delete(key);
    else net.set(key, { name, side });
  };
  for (const change of changes) {
    for (const name of change.removed) fold(name, 'removed');
    for (const name of change.added) fold(name, 'added');
  }
  const pick = (side: 'added' | 'removed') =>
    [...net.values()].filter(entry => entry.side === side).map(entry => entry.name);
  return { added: pick('added'), removed: pick('removed') };
}

/** The change between two lists (compared case-insensitively, keeping the newer spelling). */
export function listChange(before: readonly string[], after: readonly string[]): ItemChange {
  const key = (value: string) => value.toLowerCase();
  const had = new Set(before.map(key));
  const has = new Set(after.map(key));
  return {
    added: after.filter(value => !had.has(key(value))),
    removed: before.filter(value => !has.has(key(value))),
  };
}

function changed(change: ItemChange | undefined): boolean {
  return Boolean(change && (change.added.length > 0 || change.removed.length > 0));
}

/** The events that report labels or assignees changing on the card's work item or pull request. */
export const UPDATE_EVENTS = ['work_item.updated', 'pull_request.updated'] as const;
export type UpdateEvent = (typeof UPDATE_EVENTS)[number];

export function isUpdateEvent(type: string): type is UpdateEvent {
  return (UPDATE_EVENTS as readonly string[]).includes(type);
}

/**
 * Labels Factory sets and clears itself to track triage and acceptance. Like a rule's own move,
 * changing them is bookkeeping, so they never count as a change, whoever made it.
 */
const FACTORY_MANAGED_LABELS = new Set([NEEDS_APPROVAL_LABEL, AUTO_TRIAGED_LABEL]);

function withoutManagedLabels(change: ItemChange | undefined): ItemChange | undefined {
  if (!change) return undefined;
  const kept = (names: readonly string[]) => names.filter(name => !FACTORY_MANAGED_LABELS.has(name.toLowerCase()));
  return { added: kept(change.added), removed: kept(change.removed) };
}

/**
 * The update event for a change of labels and assignees, or undefined when nothing changed: an
 * item that reports "changed" without a label or assignee difference produces no event, and
 * neither does a change to only the labels Factory manages.
 */
export function updateEventFacts(
  type: UpdateEvent,
  { assignees, ...rest }: { labels?: ItemChange; assignees?: ItemChange },
): BoardEventFacts | undefined {
  const change = { labels: withoutManagedLabels(rest.labels), assignees };
  if (!changed(change.labels) && !changed(change.assignees)) return undefined;
  return {
    type,
    ...(changed(change.labels) ? { labels: change.labels } : {}),
    ...(changed(change.assignees) ? { assignees: change.assignees } : {}),
  };
}

/** One update event standing for several, oldest first, or undefined when they cancel out. */
export function combineUpdates(events: readonly BoardEventFacts[]): BoardEventFacts | undefined {
  const [first] = events;
  if (!first || !isUpdateEvent(first.type)) return undefined;
  const combined = updateEventFacts(first.type, {
    labels: combineChanges(events.flatMap(event => (event.labels ? [event.labels] : []))),
    assignees: combineChanges(events.flatMap(event => (event.assignees ? [event.assignees] : []))),
  });
  if (!combined) return undefined;
  const identified = first.pullRequest !== undefined ? { ...combined, pullRequest: first.pullRequest } : combined;
  // The folded change stands for every pull request in it, so it is trusted only when each one is.
  if (events.some(event => event.pullRequestTrusted === undefined)) return identified;
  return { ...identified, pullRequestTrusted: events.every(event => event.pullRequestTrusted === true) };
}

/**
 * What happened to a card's pull request (GitHub) or merge request (GitLab): opened by the card's
 * session, pushed to, re-review requested, merged, or closed unmerged. A provider's default rule
 * decides whether the event moves the card at all; a route on the card's board naming the event
 * decides where it goes.
 */
export type PullRequestEvent = Extract<StatusEvent, `pull_request.${string}`>;

export function isPullRequestEvent(type: StatusEvent): type is PullRequestEvent {
  return type.startsWith('pull_request.');
}

/**
 * Whether the event may move a card that is, or isn't, finished: a reopen moves only a finished
 * card, a close or a merge only an unfinished one. A push or a review request re-reviews a pull
 * request whatever its card's phase, and an update or a pull request reopening moves the card
 * wherever a route sends it.
 */
export function eventMovesCard(type: StatusEvent, finished: boolean): boolean {
  switch (type) {
    case 'work_item.reopened':
      return finished;
    case 'work_item.closed':
    case 'pull_request.merged':
    case 'pull_request.closed':
      return !finished;
    default:
      return true;
  }
}

/** Activity on a card: it never moves the card, it only tells the card's session. */
export const ACTIVITY_EVENTS = ['work_item.commented', 'work_item.edited'] as const;
export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

/** Why a work item closed: `canceled` covers "not planned" and duplicates. */
export const CLOSE_REASONS = ['completed', 'canceled'] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

/** A status event as routes see it. Update events carry what changed. */
export interface BoardEventFacts {
  type: StatusEvent;
  reason?: CloseReason;
  labels?: ItemChange;
  assignees?: ItemChange;
  /**
   * On a pull request's update: which pull request changed (its source's external id), so changes
   * to two pull requests on one card never net out against each other.
   */
  pullRequest?: string;
  /** On a pull request event: whether that pull request's author has write access (or is Factory). */
  pullRequestTrusted?: boolean;
  /**
   * On the `pull_request.opened` a pull request linking to the card of the issue it closes brings:
   * that card as it was before the pull request joined it (see `closedIssueRuleFacts`).
   */
  closedIssue?: { phase: string | null; hasPullRequest: boolean };
}

/** The facts a route's `when` reads from an event. */
export function eventRuleFacts(event: BoardEventFacts): Record<string, unknown> {
  return {
    'event.type': event.type,
    'event.reason': event.reason,
    'event.labels.added': event.labels?.added,
    'event.labels.removed': event.labels?.removed,
    'event.assignees.added': event.assignees?.added,
    'event.assignees.removed': event.assignees?.removed,
  };
}

/** The close reason for a provider's own closed-state fact. */
export function closeReason(canceled: boolean): CloseReason {
  return canceled ? 'canceled' : 'completed';
}

/** What a route without `on` handles: placing new cards, issues and pull requests alike, as routes always have. */
export const DEFAULT_ROUTE_EVENTS: readonly RouteEvent[] = [LEGACY_ARRIVAL_EVENT];

/** What an update changed: only update events carry these. */
export const CHANGE_RULE_FIELDS = [
  'event.labels.added',
  'event.labels.removed',
  'event.assignees.added',
  'event.assignees.removed',
] as const;

/** Facts a route's `when` can test about the event, besides the card's own facts. */
export const EVENT_RULE_FIELDS = ['event.type', 'event.reason', ...CHANGE_RULE_FIELDS] as const;

/** Facts about the card an event would move; a new item has no card yet. */
export const CARD_MOVE_RULE_FIELDS = ['card.phase'] as const;

/**
 * Facts a route can test about the issue an arriving pull request closes (see
 * `closedIssueRuleFacts`). Only arrivals have them, so phase conditions can't name them.
 */
export const CLOSED_ISSUE_RULE_FIELDS = [
  'pullRequest.closesIssue',
  'closedIssue.phase',
  'closedIssue.hasPullRequest',
] as const;

/** Every field an intake route's `when` may name. */
export const INTAKE_ROUTE_RULE_FIELDS = [
  ...CARD_RULE_FIELDS,
  ...CARD_MOVE_RULE_FIELDS,
  ...EVENT_RULE_FIELDS,
  ...CLOSED_ISSUE_RULE_FIELDS,
] as const;

/**
 * Fields a stored route may still name and that keep evaluating, but the filter picker no longer
 * offers; the picker shows them as "Legacy filter" with a remove button.
 */
export const LEGACY_RULE_FIELDS = [
  'item.key',
  'item.title',
  'item.state',
  'source.integration',
  'item.pullRequest',
  'event.type',
  ...CLOSED_ISSUE_RULE_FIELDS,
] as const;

/** The one filter set the picker offers: every route field that isn't legacy. */
export const PICKER_RULE_FIELDS = INTAKE_ROUTE_RULE_FIELDS.filter(
  field => !(LEGACY_RULE_FIELDS as readonly string[]).includes(field),
);

function isStatusEvent(value: string): value is StatusEvent {
  return (STATUS_EVENTS as readonly string[]).includes(value);
}

function isRouteEvent(value: string): value is RouteEvent {
  return (ROUTE_EVENTS as readonly string[]).includes(value);
}

/** Events that only file new cards, so carry no event facts: `pull_request.opened` also moves cards. */
function onlyFilesNewCards(event: string): boolean {
  return event === 'work_item.opened' || event === LEGACY_ARRIVAL_EVENT;
}

function namesField(group: RuleGroup, fields: readonly string[]): boolean {
  return group.conditions.some(condition =>
    'conditions' in condition ? namesField(condition, fields) : fields.includes(condition.field),
  );
}

/**
 * Why a route's `on` and `when` can't be saved together, or null. `on` must name at least one
 * route event, each once; `event.*` conditions need an event besides `work_item.opened` and
 * `work_item.created`, which place new cards and carry no event facts, and `event.reason` needs `work_item.closed`, the
 * only event with a reason.
 */
export function routeEventsProblem(on: readonly string[], when: RuleGroup | null): string | null {
  if (on.length === 0) return '`on` must name at least one event.';
  if (new Set(on).size !== on.length) return '`on` may name each event only once.';
  for (const event of on) {
    if ((ACTIVITY_EVENTS as readonly string[]).includes(event)) {
      return `"${event}" is activity, not a status change: it notifies the card's session and can't move a card, so a route can't name it.`;
    }
    if (!isRouteEvent(event)) return `"${event}" is not a board event; use one of ${ROUTE_EVENTS.join(', ')}.`;
  }
  if (when && on.every(onlyFilesNewCards) && namesField(when, EVENT_RULE_FIELDS)) {
    return '`event.*` filters only apply to routes that handle an event besides work_item.opened and work_item.created.';
  }
  if (when && on.every(onlyFilesNewCards) && namesField(when, CARD_MOVE_RULE_FIELDS)) {
    return '`card.phase` only applies to routes that move an existing card: a new item has no card yet.';
  }
  if (when && !on.some(isUpdateEvent) && namesField(when, CHANGE_RULE_FIELDS)) {
    return 'What changed (`event.labels.*`, `event.assignees.*`) only applies to routes that handle work_item.updated or pull_request.updated.';
  }
  if (when && !on.includes('work_item.closed') && namesField(when, ['event.reason'])) {
    return '`event.reason` only applies to routes that handle work_item.closed: no other event carries a reason.';
  }
  return null;
}

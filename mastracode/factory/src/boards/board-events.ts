import type { RuleGroup } from '../rules/rule-group.js';
import { CARD_RULE_FIELDS } from '../rules/rule-group.js';

/**
 * What happened to a card's source, named the same for every provider. Integrations map their
 * webhooks onto these; intake routes name the ones they handle in `on`.
 */
export const BOARD_EVENTS = [
  'work_item.created',
  'work_item.closed',
  'work_item.reopened',
  'work_item.commented',
  'work_item.edited',
] as const;
export type BoardEvent = (typeof BOARD_EVENTS)[number];

/** Events that change where a card belongs. Only these can move a card, so only these may be named in a route's `on`. */
export const STATUS_EVENTS = ['work_item.created', 'work_item.closed', 'work_item.reopened'] as const;
export type StatusEvent = (typeof STATUS_EVENTS)[number];

/** Activity on a card: it never moves the card, it only tells the card's session. */
export const ACTIVITY_EVENTS = ['work_item.commented', 'work_item.edited'] as const;
export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

/** Why a work item closed: `canceled` covers "not planned" and duplicates. */
export const CLOSE_REASONS = ['completed', 'canceled'] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

/** A status event as routes see it. */
export interface BoardEventFacts {
  type: StatusEvent;
  reason?: CloseReason;
}

/** The close reason for a provider's own closed-state fact. */
export function closeReason(canceled: boolean): CloseReason {
  return canceled ? 'canceled' : 'completed';
}

/** What a route without `on` handles: placing new cards, as routes always have. */
export const DEFAULT_ROUTE_EVENTS: readonly StatusEvent[] = ['work_item.created'];

/** Facts a route's `when` can test about the event, besides the card's own facts. */
export const EVENT_RULE_FIELDS = ['event.type', 'event.reason'] as const;

/** Every field an intake route's `when` may name. */
export const INTAKE_ROUTE_RULE_FIELDS = [...CARD_RULE_FIELDS, ...EVENT_RULE_FIELDS] as const;

function isStatusEvent(value: string): value is StatusEvent {
  return (STATUS_EVENTS as readonly string[]).includes(value);
}

function namesEventField(group: RuleGroup): boolean {
  return group.conditions.some(condition =>
    'conditions' in condition
      ? namesEventField(condition)
      : (EVENT_RULE_FIELDS as readonly string[]).includes(condition.field),
  );
}

/**
 * Why a route's `on` and `when` can't be saved together, or null. `on` must name at least one
 * status event, each once; `event.*` conditions need an event besides `work_item.created`, which
 * places new cards and carries no event facts.
 */
export function routeEventsProblem(on: readonly string[], when: RuleGroup | null): string | null {
  if (on.length === 0) return '`on` must name at least one event.';
  if (new Set(on).size !== on.length) return '`on` may name each event only once.';
  for (const event of on) {
    if ((ACTIVITY_EVENTS as readonly string[]).includes(event)) {
      return `"${event}" is activity, not a status change: it notifies the card's session and can't move a card, so a route can't name it.`;
    }
    if (!isStatusEvent(event)) return `"${event}" is not a board event; use one of ${STATUS_EVENTS.join(', ')}.`;
  }
  if (when && on.every(event => event === 'work_item.created') && namesEventField(when)) {
    return '`event.type` and `event.reason` only apply to routes that handle an event besides work_item.created.';
  }
  return null;
}

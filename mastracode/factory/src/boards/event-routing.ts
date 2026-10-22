import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleFacts } from '../rules/rule-group.js';
import type { StoredEventRoute } from '../storage/domains/boards/base.js';
import type { BoardEvent } from '../storage/domains/boards/validation.js';

/** Integration rule events whose card moves a stored board's event routes decide. */
const ROUTED_EVENTS: Readonly<Record<string, BoardEvent>> = {
  pullRequestOpened: 'pull_request.opened',
  pullRequestMerged: 'pull_request.merged',
  pullRequestClosed: 'pull_request.closed',
  pullRequestReviewRequested: 'pull_request.review_requested',
  pullRequestUpdated: 'pull_request.updated',
  issueClosed: 'issue.closed',
  mergeRequestOpened: 'pull_request.opened',
  mergeRequestMerged: 'pull_request.merged',
  mergeRequestClosed: 'pull_request.closed',
  mergeRequestUpdated: 'pull_request.updated',
};

export function routedBoardEvent(event: string): BoardEvent | undefined {
  return ROUTED_EVENTS[event];
}

interface MoveDecision {
  type: string;
  board?: unknown;
  stage?: unknown;
  message?: unknown;
}

/**
 * Lets a stored board's event routes decide where a card move an integration rule proposed lands.
 * The rule keeps its gates (trusted actor, Factory-authored, recorded verdict): a route never adds
 * a move the rule didn't propose. No matching route drops the move; a route to the proposed phase
 * keeps the rule's decision as written; a route elsewhere moves the card there without the rule's
 * message. Non-move decisions pass through.
 */
export function routeEventMoves<D extends MoveDecision>(input: {
  decisions: readonly D[];
  routes: readonly StoredEventRoute[];
  event: BoardEvent;
  board: string;
  fromPhase: string | undefined;
  facts: RuleFacts;
}): D[] {
  const route = input.routes.find(
    candidate =>
      candidate.enabled &&
      candidate.event === input.event &&
      (candidate.fromPhases === null ||
        (input.fromPhase !== undefined && candidate.fromPhases.includes(input.fromPhase))) &&
      evaluateRuleGroup(candidate.when, input.facts),
  );
  return input.decisions.flatMap(decision => {
    if (decision.type !== 'transition' || decision.board !== input.board) return [decision];
    if (!route) return [];
    if (route.toPhaseKey === decision.stage) return [decision];
    const { message: _message, ...rest } = decision;
    return [{ ...rest, stage: route.toPhaseKey } as D];
  });
}

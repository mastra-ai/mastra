import type { SessionRowStatus } from '../workspaces/services/sessionStatus';
import type { FactoryDecisionSummary } from './services/decisions';

/** A card has one status row, so every announcement it could make resolves to one of these. */
export type BoardCardStatus =
  | { kind: 'idle' }
  | { kind: 'waiting'; label: string; decisionId: string }
  /** Triage classed the card as non-bug work, so it waits on a maintainer's call. */
  | { kind: 'held'; label: string }
  | { kind: 'busy'; label: string }
  | { kind: 'error'; label: string; detail?: string; retryDecisionId?: string };

export interface BoardCardStatusInput {
  /** Run a rule parked on this card, held until someone releases it. */
  proposal?: { label: string; decisionId: string };
  /** Destination of an in-flight stage move. */
  moving?: { stage: string; label: string };
  /** Status text for the window between the click and the session mutation. */
  preparing?: string;
  /** Rule effect the server is still working through, or gave up on. */
  decision?: FactoryDecisionSummary;
  /** Why the server refused the last move. */
  transitionReason?: string;
  /** What the run registry and workspace records say about the card's bound sessions. */
  sessionStatus?: SessionRowStatus;
  /** Triage classification a person still has to act on, e.g. `feature request`. */
  heldAs?: string;
}

/**
 * The sidebar's reading of a card's `waiting` and `error` kinds: a run parked
 * for approval, or an effect that failed for good. A retry the server still
 * owns is not a person's turn, and neither is a proposal that an effect in
 * flight already outranks on the card.
 */
export function itemAwaitsPerson(
  proposal: FactoryDecisionSummary | undefined,
  effect: FactoryDecisionSummary | undefined,
): boolean {
  if (effect) return effect.status === 'failed';
  return proposal !== undefined;
}

/** The system a linked card is synced with, named the way that system names the thing. */
function linkedSourceName(source: FactoryDecisionSummary['source']): string {
  switch (source) {
    case 'github-issue':
      return 'GitHub issue';
    case 'github-pr':
      return 'GitHub pull request';
    case 'linear-issue':
      return 'Linear issue';
    default:
      // Every linked-card decision carries its source; only a manual card would land here.
      return 'card';
  }
}

/** Human phrasing for a rule effect, by decision type. */
function automationCopy(decision: Pick<FactoryDecisionSummary, 'type' | 'source'>): {
  busy: string;
  failed: string;
} {
  switch (decision.type) {
    case 'invokeSkill':
      return { busy: 'Starting an automated run…', failed: 'Automated run could not start' };
    case 'transition':
      return { busy: 'Moving this card automatically…', failed: 'Automatic move failed' };
    case 'upsertLinkedWorkItem': {
      const source = linkedSourceName(decision.source);
      return { busy: `Syncing ${source}…`, failed: `Couldn't sync ${source}` };
    }
    case 'sendMessage':
    case 'notify':
      return { busy: 'Notifying the session…', failed: 'Session could not be notified' };
    default:
      return { busy: 'Automation is working on this card…', failed: 'Automation failed' };
  }
}

/**
 * The lease outlives kickoff until the dispatcher sees the run end: shown as a row it would double
 * the wick for the whole run and linger on a card the agent already moved to Done.
 */
function runAnnouncedByWick(
  decision: Pick<FactoryDecisionSummary, 'type' | 'status'>,
  sessionStatus: SessionRowStatus | undefined,
): boolean {
  if (decision.type !== 'invokeSkill' || decision.status !== 'leased') return false;
  return sessionStatus === 'working' || sessionStatus === 'initializing';
}

/**
 * Resolves the card's single status, freshest intent first: the user's own
 * in-flight action outranks what the server is doing on its own, and both
 * outrank a parked run.
 */
export function boardCardStatus(input: BoardCardStatusInput): BoardCardStatus {
  const { moving, decision } = input;
  if (moving) {
    return { kind: 'busy', label: moving.stage === 'done' ? 'Marking done…' : `Moving to ${moving.label}…` };
  }
  if (input.preparing !== undefined) return { kind: 'busy', label: input.preparing };
  if (input.transitionReason !== undefined) return { kind: 'error', label: input.transitionReason };
  if (decision?.status === 'failed') {
    return {
      kind: 'error',
      label: automationCopy(decision).failed,
      ...(decision.canRetry ? { retryDecisionId: decision.id } : {}),
      detail: decision.lastError ?? undefined,
    };
  }
  // `retry` alone does not mean anything went wrong: a linked-card decision that
  // already succeeded is deliberately reset to `retry` when its card is
  // rematerialized, so the card gets re-filed. That replay has no attempt behind
  // it and no error, and calling it a failure makes the board cry wolf. A real
  // failure has been tried at least once, or left an error to show. The server
  // retries either on its own, so neither offers a button.
  if (decision?.status === 'retry' && (decision.attempts > 0 || decision.lastError)) {
    return {
      kind: 'error',
      label: `${automationCopy(decision).failed} — retrying…`,
      detail: decision.lastError ?? undefined,
    };
  }
  if (decision && !runAnnouncedByWick(decision, input.sessionStatus)) {
    return { kind: 'busy', label: automationCopy(decision).busy };
  }
  // Nothing is moving on its own. A held card's live question is the
  // maintainer's decision, even when a run has been suggested for it: the
  // card cannot start that run until it is accepted.
  if (input.heldAs !== undefined) {
    return { kind: 'held', label: `${capitalize(input.heldAs)} · needs your approval` };
  }
  if (input.proposal) {
    return { kind: 'waiting', label: input.proposal.label, decisionId: input.proposal.decisionId };
  }
  return { kind: 'idle' };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

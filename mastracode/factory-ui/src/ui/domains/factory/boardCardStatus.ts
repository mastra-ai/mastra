import type { FactoryRunPhase } from '../../../hooks/useStartFactoryRun';
import type { SessionRowStatus } from '../workspaces/services/sessionStatus';
import { RUN_PHASE_LABELS } from './boardRunSpecs';
import type { FactoryDecisionSummary } from './services/decisions';

/** A card has one status row, so every announcement it could make resolves to one of these. */
export type BoardCardStatus =
  | { kind: 'idle' }
  | { kind: 'waiting'; label: string; decisionId: string }
  | { kind: 'busy'; label: string }
  | { kind: 'error'; label: string; detail?: string; retryDecisionId?: string };

export interface BoardCardStatusInput {
  /** Run a rule parked on this card, held until someone releases it. */
  proposal?: { label: string; decisionId: string };
  /** Destination of an in-flight stage move. */
  moving?: { stage: string; label: string };
  /** Runs whose start mutation is in flight, newest intent first. */
  runs?: ReadonlyArray<{ label: string; phase?: FactoryRunPhase }>;
  /** Status text for the window between the click and the run mutation. */
  preparing?: string;
  /** Rule effect the server is still working through, or gave up on. */
  decision?: FactoryDecisionSummary;
  /** Why the server refused the last move. */
  transitionReason?: string;
  /** What the run registry and workspace records say about the card's bound sessions. */
  sessionStatus?: SessionRowStatus;
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

/** Human phrasing for a rule effect, by decision type. `underway` speaks for a leased decision. */
function automationCopy(type: string): { busy: string; underway: string; failed: string } {
  switch (type) {
    case 'invokeSkill':
      return {
        busy: 'Starting an automated run…',
        underway: 'Automated run in progress…',
        failed: 'Automated run could not start',
      };
    case 'transition': {
      const busy = 'Moving this card automatically…';
      return { busy, underway: busy, failed: 'Automatic move failed' };
    }
    case 'upsertLinkedWorkItem': {
      const busy = 'Filing a linked card…';
      return { busy, underway: busy, failed: 'Linked card could not be filed' };
    }
    case 'sendMessage':
    case 'notify': {
      const busy = 'Notifying the session…';
      return { busy, underway: busy, failed: 'Session could not be notified' };
    }
    default: {
      const busy = 'Automation is working on this card…';
      return { busy, underway: busy, failed: 'Automation failed' };
    }
  }
}

/**
 * A leased `invokeSkill` decision also brackets workspace materialization and
 * kickoff, so `underway` may claim a run only while the run registry agrees.
 */
function leasedInvokeSkillLabel(
  sessionStatus: SessionRowStatus | undefined,
  copy: { busy: string; underway: string },
): string {
  if (sessionStatus === 'working') return copy.underway;
  if (sessionStatus === 'initializing') return 'Preparing workspace…';
  return copy.busy;
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
  const run = input.runs?.[0];
  if (run) {
    return { kind: 'busy', label: `${run.label} — ${run.phase ? RUN_PHASE_LABELS[run.phase] : 'starting…'}` };
  }
  if (input.preparing !== undefined) return { kind: 'busy', label: input.preparing };
  if (input.transitionReason !== undefined) return { kind: 'error', label: input.transitionReason };
  if (decision?.status === 'failed') {
    return {
      kind: 'error',
      label: automationCopy(decision.type).failed,
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
      label: `${automationCopy(decision.type).failed} — retrying…`,
      detail: decision.lastError ?? undefined,
    };
  }
  if (decision) {
    const copy = automationCopy(decision.type);
    if (decision.status !== 'leased') return { kind: 'busy', label: copy.busy };
    const label = decision.type === 'invokeSkill' ? leasedInvokeSkillLabel(input.sessionStatus, copy) : copy.underway;
    return { kind: 'busy', label };
  }
  // Nothing is moving on its own, so a parked run is the card's live question.
  if (input.proposal) {
    return { kind: 'waiting', label: input.proposal.label, decisionId: input.proposal.decisionId };
  }
  return { kind: 'idle' };
}

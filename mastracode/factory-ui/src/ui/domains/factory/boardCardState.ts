import type { InstalledPhaseInfo } from '../../../api/types';
import type { SessionRowStatus } from '../workspaces/services/sessionStatus';
import type { FactoryDecisionSummary } from './services/decisions';

export type BoardCardStatus =
  | { kind: 'idle' }
  | { kind: 'waiting'; label: string; decisionId: string }
  | { kind: 'held'; label: string }
  | { kind: 'busy'; label: string }
  | { kind: 'error'; label: string; detail?: string; retryDecisionId?: string };

export type BoardCardOwner =
  | { kind: 'free' }
  | { kind: 'you'; progressLabel: string }
  | { kind: 'automation'; progressLabel: string }
  | { kind: 'session'; status: SessionRowStatus };

export interface BoardCardState {
  status: BoardCardStatus;
  owner: BoardCardOwner;
  wick?: SessionRowStatus;
}

export interface BoardCardStateInput {
  proposal?: { label: string; decisionId: string };
  moving?: { stage: string; label: string };
  preparing?: string;
  retryRequested?: boolean;
  decision?: FactoryDecisionSummary;
  transitionReason?: string;
  sessionStatus?: SessionRowStatus;
  held?: boolean;
}

const FREE: BoardCardOwner = { kind: 'free' };

export function boardCardState(input: BoardCardStateInput): BoardCardState {
  const { decision, sessionStatus, transitionReason } = input;
  const request = yourRequest(input);
  if (request !== undefined) {
    return {
      status: { kind: 'busy', label: request.statusLabel },
      owner: { kind: 'you', progressLabel: request.progressLabel },
      wick: sessionStatus,
    };
  }
  const automation = decision === undefined ? undefined : automationOnCard(decision, sessionStatus);
  const refusedMove: BoardCardStatus | undefined =
    transitionReason === undefined ? undefined : { kind: 'error', label: transitionReason };
  const sessionOwner: BoardCardOwner | undefined =
    sessionStatus === undefined ? undefined : { kind: 'session', status: sessionStatus };
  return {
    status: refusedMove ?? automation?.status ?? statusWhenNothingInFlight(input),
    owner: sessionOwner ?? automation?.owner ?? FREE,
    wick: sessionStatus,
  };
}

export const BUSY_CARD_MOVE_REFUSAL = "Another run can't start while this card is busy.";

export function canStartRun(ownerKind: BoardCardOwner['kind']): boolean {
  return ownerKind === 'free';
}

export function canMoveTo(
  ownerKind: BoardCardOwner['kind'],
  phaseKind: InstalledPhaseInfo['kind'] | undefined,
): boolean {
  if (ownerKind === 'you') return false;
  return canStartRun(ownerKind) || !phaseMayStartRun(phaseKind);
}

function phaseMayStartRun(phaseKind: InstalledPhaseInfo['kind'] | undefined): boolean {
  return phaseKind !== 'resting' && phaseKind !== 'terminal';
}

function sessionIsLive(sessionStatus: SessionRowStatus | undefined): boolean {
  return sessionStatus === 'initializing' || sessionStatus === 'working';
}

function yourRequest(input: BoardCardStateInput): { statusLabel: string; progressLabel: string } | undefined {
  const { moving } = input;
  if (moving) {
    const statusLabel = moving.stage === 'done' ? 'Marking done…' : `Moving to ${moving.label}…`;
    return { statusLabel, progressLabel: 'Moving…' };
  }
  if (input.preparing !== undefined) return { statusLabel: input.preparing, progressLabel: 'Starting…' };
  if (input.retryRequested) return { statusLabel: 'Retrying…', progressLabel: 'Retrying…' };
  return undefined;
}

function automationOnCard(
  decision: FactoryDecisionSummary,
  sessionStatus: SessionRowStatus | undefined,
): { status?: BoardCardStatus; owner: BoardCardOwner } {
  const copy = automationCopy(decision);
  const detail = decision.lastError ?? undefined;
  if (decision.status === 'failed') {
    return {
      status: {
        kind: 'error',
        label: copy.failed,
        ...(decision.canRetry ? { retryDecisionId: decision.id } : {}),
        detail,
      },
      owner: FREE,
    };
  }

  if (retriesAfterFailure(decision)) {
    return {
      status: { kind: 'error', label: `${copy.failed}. Retrying…`, detail },
      owner: { kind: 'automation', progressLabel: 'Retrying…' },
    };
  }
  const owner: BoardCardOwner = { kind: 'automation', progressLabel: copy.progressLabel };
  if (runAnnouncedByWick(decision, sessionStatus)) return { owner };
  return { status: { kind: 'busy', label: copy.busy }, owner };
}

function statusWhenNothingInFlight(input: BoardCardStateInput): BoardCardStatus {
  if (sessionIsLive(input.sessionStatus)) return { kind: 'idle' };

  if (input.held) {
    return { kind: 'held', label: 'Triaged and waiting for you' };
  }
  if (input.proposal) {
    return { kind: 'waiting', label: input.proposal.label, decisionId: input.proposal.decisionId };
  }
  return { kind: 'idle' };
}

export function itemAwaitsPerson(
  proposal: FactoryDecisionSummary | undefined,
  effect: FactoryDecisionSummary | undefined,
): boolean {
  if (effect) return effect.status === 'failed';
  return proposal !== undefined;
}

function linkedSourceName(source: FactoryDecisionSummary['source']): string {
  switch (source) {
    case 'github-issue':
      return 'GitHub issue';
    case 'github-pr':
      return 'GitHub pull request';
    case 'gitlab-issue':
      return 'GitLab issue';
    case 'gitlab-pr':
      return 'GitLab merge request';
    case 'linear-issue':
      return 'Linear issue';
    default:
      return 'card';
  }
}

function automationCopy(decision: Pick<FactoryDecisionSummary, 'type' | 'source'>): {
  busy: string;
  failed: string;
  progressLabel: string;
} {
  switch (decision.type) {
    case 'invokeSkill':
      return {
        busy: 'Starting an automated run…',
        failed: 'Automated run could not start',
        progressLabel: 'Starting…',
      };
    case 'transition':
      return { busy: 'Moving this card automatically…', failed: 'Automatic move failed', progressLabel: 'Moving…' };
    case 'upsertLinkedWorkItem': {
      const source = linkedSourceName(decision.source);
      return { busy: `Syncing ${source}…`, failed: `Couldn't sync ${source}`, progressLabel: 'Syncing…' };
    }
    case 'sendMessage':
    case 'notify':
      return {
        busy: 'Notifying the session…',
        failed: 'Session could not be notified',
        progressLabel: 'Notifying…',
      };
    default:
      return { busy: 'Automation is working on this card…', failed: 'Automation failed', progressLabel: 'Working…' };
  }
}

// Dispatcher leases can outlive the run.
function runAnnouncedByWick(
  decision: Pick<FactoryDecisionSummary, 'type' | 'status'>,
  sessionStatus: SessionRowStatus | undefined,
): boolean {
  return decision.type === 'invokeSkill' && decision.status === 'leased' && sessionIsLive(sessionStatus);
}

// Rematerialized decisions reuse retry without a failed attempt.
function retriesAfterFailure(decision: Pick<FactoryDecisionSummary, 'status' | 'attempts' | 'lastError'>): boolean {
  return decision.status === 'retry' && (decision.attempts > 0 || Boolean(decision.lastError));
}

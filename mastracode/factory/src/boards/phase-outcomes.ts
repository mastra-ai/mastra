import type { Card } from '../storage/domains/work-items/base.js';
import type { BoardDefinition, BoardPhaseOutcome } from './define-board.js';
import { exitToolSucceeded, PHASE_EXIT_METADATA_KEY } from './phase-automation.js';

/**
 * Card metadata holding the outcome the session working the card reported on its phase:
 * `{ phase, outcome, to, reason, source, at, bindingId }`. Factory moves the card once that
 * session's run ends.
 */
export const PHASE_OUTCOME_METADATA_KEY = 'phaseOutcome';

/** How the session reported its outcome: with `factory_report_outcome`, or through a verdict tool. */
export type PhaseOutcomeSource = 'reported' | 'verdict';

export interface ReportedPhaseOutcome {
  phase: string;
  outcome: string;
  to: string;
  reason: string;
  source: PhaseOutcomeSource;
  at: string;
  bindingId: string;
}

type OutcomeBoard = Pick<BoardDefinition<string, string>, 'phases'>;

/** The outcomes the session working `phaseId` may report: the phase's own, else one per next phase. */
export function phaseOutcomes(board: OutcomeBoard, phaseId: string): readonly BoardPhaseOutcome<string>[] {
  const phase = board.phases[phaseId];
  if (phase?.kind !== 'working') return [];
  if (phase.outcomes) return phase.outcomes;
  return phase.nextPhases
    .filter(to => to !== phaseId)
    .map(to => ({ key: to, label: board.phases[to]?.name ?? to, to }));
}

/**
 * The outcome a phase's exit tool reports when it succeeds: the phase's `advance` outcome, else
 * its only outcome into a working phase. Undefined when neither picks one out; the session then
 * reports its outcome itself.
 */
export function exitToolOutcome(board: OutcomeBoard, phaseId: string): BoardPhaseOutcome<string> | undefined {
  const outcomes = phaseOutcomes(board, phaseId);
  const advance = outcomes.find(outcome => outcome.key === 'advance');
  if (advance) return advance;
  const working = outcomes.filter(outcome => board.phases[outcome.to]?.kind === 'working');
  return working.length === 1 ? working[0] : undefined;
}

/** When the card entered its current visit to `stage`; undefined when it is not there. */
function enteredAt(item: Pick<Card, 'stageHistory'>, stage: string): number | undefined {
  const entry = item.stageHistory.findLast(candidate => candidate.stage === stage && candidate.exitedAt === undefined);
  return entry ? Date.parse(entry.enteredAt) : undefined;
}

/** The outcome reported on the card's current visit to `stage`; an outcome from an earlier visit is undefined. */
export function reportedPhaseOutcome(
  item: Pick<Card, 'metadata' | 'stageHistory'>,
  stage: string,
): ReportedPhaseOutcome | undefined {
  const value: unknown = item.metadata?.[PHASE_OUTCOME_METADATA_KEY];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const stamp = value as Record<string, unknown>;
  const fields = ['phase', 'outcome', 'to', 'reason', 'source', 'at', 'bindingId'] as const;
  if (fields.some(field => typeof stamp[field] !== 'string')) return undefined;
  const outcome = stamp as unknown as ReportedPhaseOutcome;
  if (outcome.phase !== stage) return undefined;
  const entered = enteredAt(item, stage);
  return entered !== undefined && Date.parse(outcome.at) >= entered ? outcome : undefined;
}

/** An outcome the card's current phase holds, ready to be applied as a move. */
export interface PendingPhaseOutcome {
  outcome: string;
  label: string;
  to: string;
  reason: string;
  /** When it was reported: with the card, it names this report among every other. */
  at: string;
  /** The exit tool whose success reported it, when it was not reported in words. */
  exitTool?: string;
}

/**
 * The outcome the session working the card reported on its current phase, latest first: a
 * reported outcome, or the one the phase's exit tool reports by succeeding. Undefined when there
 * is none, or when the reported one no longer names an outcome the phase allows.
 */
export function pendingPhaseOutcome(
  board: OutcomeBoard,
  item: Pick<Card, 'metadata' | 'stageHistory' | 'stages'>,
): PendingPhaseOutcome | undefined {
  if (item.stages.length !== 1) return undefined;
  const stage = item.stages[0]!;
  const phase = board.phases[stage];
  if (phase?.kind !== 'working') return undefined;
  const reported = reportedPhaseOutcome(item, stage);
  const exitTool = phase.exitTool?.id;
  const exited = exitTool !== undefined && exitToolSucceeded(item, stage, exitTool);
  const exitStamp = exited
    ? String((item.metadata?.[PHASE_EXIT_METADATA_KEY] as { at?: unknown } | undefined)?.at)
    : undefined;
  const exitAt = exitStamp === undefined ? undefined : Date.parse(exitStamp);
  if (reported && (exitAt === undefined || Date.parse(reported.at) >= exitAt)) {
    // A verdict names its destination; a reported outcome must still be one the phase allows.
    const declared = phaseOutcomes(board, stage).find(outcome => outcome.key === reported.outcome);
    if (reported.source === 'verdict') {
      return {
        outcome: reported.outcome,
        label: declared?.label ?? reported.outcome,
        to: reported.to,
        reason: reported.reason,
        at: reported.at,
      };
    }
    return declared
      ? { outcome: declared.key, label: declared.label, to: declared.to, reason: reported.reason, at: reported.at }
      : undefined;
  }
  if (exitStamp === undefined) return undefined;
  const implicit = exitToolOutcome(board, stage);
  return implicit
    ? {
        outcome: implicit.key,
        label: implicit.label,
        to: implicit.to,
        reason: `${exitTool} succeeded.`,
        at: exitStamp,
        exitTool,
      }
    : undefined;
}

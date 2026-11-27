import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { BOARD_IDENTIFIER_RE, MAX_BOARD_IDENTIFIER_LENGTH } from '@mastra/factory/rules/validation';
import { phaseRunFieldsValid } from '@mastra/playground-ui/domains/factory';

import type { StoredBoardInfo, StoredPhaseInfo } from '../../../api/types';
import { ruleProblem } from '../settings/services/rules';

export type CardRule = NonNullable<StoredPhaseInfo['autoStartWhen']>;
export type PhaseKind = StoredPhaseInfo['kind'];
export type RuleField = 'autoStartWhen' | 'autoApproveWhen';
type CodeBehaviour = StoredBoardInfo['codeBehaviour'];

/** Runner context a phase gets when it names none. */
export const DEFAULT_SESSION = 'work';

/** Factory tools a phase can grant the session working a card there. */
export const PHASE_TOOLS = [
  { id: 'factory_record_review_verdict', label: 'Record a review verdict' },
  { id: 'factory_review_source', label: 'Review the source of a change request' },
] as const;

/** Starts a phase on its own or by hand. Turning it off drops the cards it was limited to. */
export function withAutoStart<Phase extends { autoStart?: boolean; autoStartWhen?: unknown }>(
  phase: Phase,
  on: boolean,
): Phase {
  return { ...phase, autoStart: on, autoStartWhen: on ? phase.autoStartWhen : null };
}

/** What the config page edits and saves; everything else on the board stays as stored. */
export interface BoardDraft {
  name: string;
  description: string | null;
  phases: StoredPhaseInfo[];
}

export function draftOf(board: Pick<StoredBoardInfo, 'name' | 'description' | 'phases'>): BoardDraft {
  return { name: board.name, description: board.description ?? null, phases: board.phases };
}

export function draftChanged(draft: BoardDraft, board: StoredBoardInfo): boolean {
  return JSON.stringify(draft) !== JSON.stringify(draftOf(board));
}

/** Every other phase when `nextPhases` is unset, none from a terminal phase, as the server reads it. */
export function nextPhasesOf(phase: StoredPhaseInfo, phases: readonly StoredPhaseInfo[]): string[] {
  if (phase.nextPhases != null) return phase.nextPhases;
  return phase.kind === 'terminal' ? [] : phases.filter(other => other.key !== phase.key).map(other => other.key);
}

/** Why the server would refuse a phase's "only when" rule, if it would. */
export function cardRuleProblem(rule: CardRule | null | undefined): string | undefined {
  return ruleProblem(cardRuleGroupSchema, rule);
}

/**
 * Whether the server would refuse this phase as drafted: a rule it can't read, text over its limit, a goal run count
 * out of range, or an outcome without a usable key or label.
 */
export function phaseHasProblem(phase: StoredPhaseInfo): boolean {
  const goal = phase.runner?.goal;
  // A rule only counts while its switch is on.
  const ruleRefused = (active: boolean, rule: CardRule | null | undefined) =>
    active && cardRuleProblem(rule) !== undefined;
  return (
    phase.name.trim() === '' ||
    !phaseRunFieldsValid(phase.runner?.instructions ?? '', goal) ||
    (phase.outcomes?.length ?? 0) > MAX_OUTCOMES ||
    outcomeProblems(phase.outcomes ?? []).some(problem => problem.key || problem.label) ||
    ruleRefused(phase.autoStart === true, phase.autoStartWhen) ||
    ruleRefused(phase.exitTool?.autoApprove === true, phase.exitTool?.autoApproveWhen)
  );
}

/** Moves a phase to a new position. Cards start in the first phase, so it stays first. */
export function movePhase(phases: StoredPhaseInfo[], from: number, to: number): StoredPhaseInfo[] {
  if (from <= 0 || from >= phases.length) return phases;
  const target = Math.min(Math.max(to, 1), phases.length - 1);
  if (target === from) return phases;
  const next = [...phases];
  next.splice(target, 0, ...next.splice(from, 1));
  return next;
}

/** Whether a phase can change kind: the first stays resting, and a phase Factory's code handles keeps its kind. */
export function kindLocked(phases: StoredPhaseInfo[], phaseKey: string, codeBehaviour: CodeBehaviour): boolean {
  return phases[0]?.key === phaseKey || codeBehaviour?.[phaseKey] !== undefined;
}

/** Whether a phase can be removed: not one Factory's code handles, not the last, and not leaving a non-resting first. */
export function canRemovePhase(phases: StoredPhaseInfo[], phaseKey: string, codeBehaviour: CodeBehaviour): boolean {
  if (codeBehaviour?.[phaseKey] !== undefined || phases.length < 2) return false;
  return phases[0]?.key !== phaseKey || phases[1]?.kind === 'resting';
}

/** A phase with other moves. Its outcomes follow them: one going to a phase it no longer moves to is dropped. */
export function withNextPhases(phase: StoredPhaseInfo, nextPhases: string[]): StoredPhaseInfo {
  if (!phase.outcomes?.length) return { ...phase, nextPhases };
  const outcomes = phase.outcomes.filter(outcome => nextPhases.includes(outcome.to));
  return { ...phase, nextPhases, outcomes: outcomes.length > 0 ? outcomes : null };
}

/** Takes a phase out, and out of every move other phases list. Unset moves already mean "every other phase". */
export function removePhase(phases: StoredPhaseInfo[], phaseKey: string): StoredPhaseInfo[] {
  return phases
    .filter(phase => phase.key !== phaseKey)
    .map(phase => {
      if (phase.nextPhases?.includes(phaseKey)) {
        return withNextPhases(
          phase,
          phase.nextPhases.filter(key => key !== phaseKey),
        );
      }
      // Unset moves stay unset, but an outcome can't keep going to the removed phase.
      if (phase.outcomes?.some(outcome => outcome.to === phaseKey)) {
        const outcomes = phase.outcomes.filter(outcome => outcome.to !== phaseKey);
        return { ...phase, outcomes: outcomes.length > 0 ? outcomes : null };
      }
      return phase;
    });
}

export type PhaseOutcome = NonNullable<StoredPhaseInfo['outcomes']>[number];

/** Outcomes a working phase may list, as the server limits them. */
export const MAX_OUTCOMES = 20;
const MAX_OUTCOME_LABEL = 128;

/** The outcomes a phase that lists none offers, as the server reads it: one per next phase, named after it. */
export function defaultOutcomes(phase: StoredPhaseInfo, phases: readonly StoredPhaseInfo[]): PhaseOutcome[] {
  return nextPhasesOf(phase, phases).flatMap(key => {
    const target = phases.find(other => other.key === key);
    return target ? [{ key, label: target.name, to: key }] : [];
  });
}

/** Why the server would refuse one of a phase's outcomes, by its position in the list. */
export function outcomeProblems(outcomes: readonly PhaseOutcome[]): Array<{ key?: string; label?: string }> {
  return outcomes.map((outcome, index) => {
    const taken = outcomes.filter((_, other) => other !== index).map(other => other.key);
    const key = keyProblem(outcome.key, taken);
    const label =
      outcome.label.trim() === ''
        ? 'Enter a label.'
        : outcome.label.length > MAX_OUTCOME_LABEL
          ? `Use at most ${MAX_OUTCOME_LABEL} characters.`
          : undefined;
    return { ...(key ? { key } : {}), ...(label ? { label } : {}) };
  });
}

/** The next outcome a person adds: a move none of the outcomes takes yet, under a key not in use. */
export function newOutcome(
  phase: StoredPhaseInfo,
  phases: readonly StoredPhaseInfo[],
  outcomes: readonly PhaseOutcome[],
): PhaseOutcome | undefined {
  const next = nextPhasesOf(phase, phases);
  const to = next.find(key => !outcomes.some(outcome => outcome.to === key)) ?? next[0];
  const target = phases.find(other => other.key === to);
  if (!to || !target) return undefined;
  const taken = new Set(outcomes.map(outcome => outcome.key));
  const base = keyFromName(target.name) || to;
  let key = base;
  for (let n = 2; taken.has(key); n++) {
    const suffix = `-${n}`;
    key = `${base.slice(0, MAX_BOARD_IDENTIFIER_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`;
  }
  return { key, label: target.name, to };
}

/**
 * The outcome a phase's exit tool reports when it succeeds, as the server picks it: the `advance` outcome, else
 * the only outcome into a working phase. Undefined when neither picks one; the agent then reports one itself.
 */
export function exitToolOutcome(
  outcomes: readonly PhaseOutcome[],
  phases: readonly StoredPhaseInfo[],
): PhaseOutcome | undefined {
  const advance = outcomes.find(outcome => outcome.key === 'advance');
  if (advance) return advance;
  const working = outcomes.filter(outcome => phases.find(other => other.key === outcome.to)?.kind === 'working');
  return working.length === 1 ? working[0] : undefined;
}

/** A phase as another kind. Only a working phase has a runner, automation, an exit tool and tools; terminal moves nowhere. */
export function withKind(phase: StoredPhaseInfo, kind: PhaseKind, phases: StoredPhaseInfo[]): StoredPhaseInfo {
  return {
    key: phase.key,
    name: phase.name,
    description: phase.description,
    kind,
    nextPhases: kind === 'terminal' ? [] : nextPhasesOf(phase, phases),
    ...(kind === 'working' ? { runner: { context: 'work' } } : {}),
  };
}

/** A key for a name: lower case, with every run of other characters as one hyphen. */
export function keyFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, MAX_BOARD_IDENTIFIER_LENGTH)
    .replace(/-+$/, '');
}

/** Why the server would refuse this key, if it would. */
export function keyProblem(key: string, taken: readonly string[] = []): string | undefined {
  if (key === '') return 'Enter a key.';
  if (key.length > MAX_BOARD_IDENTIFIER_LENGTH) return `Use at most ${MAX_BOARD_IDENTIFIER_LENGTH} characters.`;
  if (!BOARD_IDENTIFIER_RE.test(key))
    return 'Use letters, digits, hyphens and underscores, starting with a letter or digit.';
  if (taken.includes(key)) return 'This key is already in use.';
  return undefined;
}

/** The board a new one starts from: cards wait in Backlog, an agent works them in Doing, and they end in Done. */
export function starterBoard(): BoardDraft {
  return {
    name: '',
    description: null,
    phases: [
      { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
      { key: 'doing', name: 'Doing', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
      { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
    ],
  };
}

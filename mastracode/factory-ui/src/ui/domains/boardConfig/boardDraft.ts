import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { BOARD_IDENTIFIER_RE, MAX_BOARD_IDENTIFIER_LENGTH } from '@mastra/factory/rules/validation';

import type { StoredBoardInfo, StoredPhaseInfo } from '../../../api/types';
import { rawRuleProblem, ruleProblem } from '../settings/services/rules';

export const MAX_INSTRUCTIONS = 1000;
export const MAX_OBJECTIVE = 2000;
export const MAX_GOAL_RUNS = 50;

export type CardRule = NonNullable<StoredPhaseInfo['autoStartWhen']>;
export type PhaseKind = StoredPhaseInfo['kind'];
export type RuleField = 'autoStartWhen' | 'autoApproveWhen';
type CodeBehaviour = StoredBoardInfo['codeBehaviour'];

/** Factory tools a phase can grant the session working a card there. */
export const PHASE_TOOLS = [
  { id: 'factory_record_review_verdict', label: 'Record a review verdict' },
  { id: 'factory_review_source', label: 'Review the source of a change request' },
] as const;

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
export function nextPhasesOf(phase: StoredPhaseInfo, phases: StoredPhaseInfo[]): string[] {
  if (phase.nextPhases != null) return phase.nextPhases;
  return phase.kind === 'terminal' ? [] : phases.filter(other => other.key !== phase.key).map(other => other.key);
}

/** Rules typed as JSON, by `phaseKey.field`, for the phases whose rule editor shows JSON. */
export type RawRules = Partial<Record<string, string>>;

export const rawRuleKey = (phaseKey: string, field: RuleField) => `${phaseKey}.${field}`;

/** Unset uses Factory's default; otherwise a whole number of runs the server accepts. */
export function goalRunsValid(maxRuns: number | undefined): boolean {
  return maxRuns === undefined || (Number.isInteger(maxRuns) && maxRuns >= 1 && maxRuns <= MAX_GOAL_RUNS);
}

/** A board the server would take: named, with named phases, nothing over its limit and no rule it would refuse. */
export function draftHasProblem(draft: BoardDraft, rawRules: RawRules = {}): boolean {
  return draft.name.trim() === '' || draft.phases.some(phase => phaseHasProblem(phase, rawRules));
}

/**
 * Whether the server would refuse this phase as drafted: a rule it can't read, typed JSON that doesn't parse, text
 * over its limit, or a goal run count out of range.
 */
export function phaseHasProblem(phase: StoredPhaseInfo, rawRules: RawRules = {}): boolean {
  const goal = phase.runner?.goal;
  // A rule only counts while its switch is on; the JSON typed for it, when there is some, is what would be saved.
  const ruleRefused = (field: RuleField, active: boolean, rule: CardRule | null | undefined) => {
    if (!active) return false;
    const text = rawRules[rawRuleKey(phase.key, field)];
    const problem =
      text === undefined ? ruleProblem(cardRuleGroupSchema, rule) : rawRuleProblem(cardRuleGroupSchema, text);
    return problem !== undefined;
  };
  return (
    phase.name.trim() === '' ||
    (phase.runner?.instructions?.length ?? 0) > MAX_INSTRUCTIONS ||
    (goal?.objective.length ?? 0) > MAX_OBJECTIVE ||
    !goalRunsValid(goal?.maxRuns) ||
    ruleRefused('autoStartWhen', phase.autoStart === true, phase.autoStartWhen) ||
    ruleRefused('autoApproveWhen', phase.exitTool?.autoApprove === true, phase.exitTool?.autoApproveWhen)
  );
}

/** Moves a phase to a new position. Cards start in the first phase, so it stays first. */
export function movePhase(phases: StoredPhaseInfo[], from: number, to: number): StoredPhaseInfo[] {
  if (from <= 0 || from >= phases.length) return phases;
  const target = Math.min(Math.max(to, 1), phases.length - 1);
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

/** Takes a phase out, and out of every move other phases list. Unset moves already mean "every other phase". */
export function removePhase(phases: StoredPhaseInfo[], phaseKey: string): StoredPhaseInfo[] {
  return phases
    .filter(phase => phase.key !== phaseKey)
    .map(phase =>
      phase.nextPhases?.includes(phaseKey)
        ? { ...phase, nextPhases: phase.nextPhases.filter(key => key !== phaseKey) }
        : phase,
    );
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

import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';

import type { StoredBoardInfo, StoredPhaseInfo } from '../../../api/types';

export const MAX_INSTRUCTIONS = 1000;

export type CardRule = NonNullable<StoredPhaseInfo['autoStartWhen']>;
export type CodeBehaviour = NonNullable<StoredBoardInfo['codeBehaviour']>[string];

/** What the config page edits and saves; everything else on the board stays as stored. */
export interface BoardDraft {
  name: string;
  description: string | null;
  phases: StoredPhaseInfo[];
}

export function draftOf(board: StoredBoardInfo): BoardDraft {
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

type RuleIssue = { path: PropertyKey[]; message: string; code: string; errors?: RuleIssue[][] };

/** Zod issues as `path: message`, following the closest branch of a condition-or-group union. */
function describeIssues(issues: RuleIssue[], prefix: PropertyKey[] = []): string[] {
  return issues.flatMap(issue => {
    const path = [...prefix, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors?.length) {
      const closest = issue.errors.reduce((best, branch) => (branch.length < best.length ? branch : best));
      return describeIssues(closest, path);
    }
    return [`${path.map(String).join('.') || 'rule'}: ${issue.message}`];
  });
}

/** Why the server would refuse this rule, if it would. */
export function validateRule(value: unknown): { rule: CardRule } | { problem: string } {
  const parsed = cardRuleGroupSchema.safeParse(value);
  if (parsed.success) return { rule: parsed.data };
  return { problem: describeIssues(parsed.error.issues).join('; ') };
}

export function ruleProblem(rule: CardRule | null | undefined): string | undefined {
  if (rule == null) return undefined;
  const checked = validateRule(rule);
  return 'problem' in checked ? checked.problem : undefined;
}

/** Whether the server would refuse this phase as drafted: a rule it can't read, or instructions over the limit. */
export function phaseHasProblem(phase: StoredPhaseInfo): boolean {
  return (
    (phase.runner?.instructions?.length ?? 0) > MAX_INSTRUCTIONS ||
    ruleProblem(phase.autoStart ? phase.autoStartWhen : null) !== undefined ||
    ruleProblem(phase.exitTool?.autoApprove ? phase.exitTool.autoApproveWhen : null) !== undefined
  );
}

/** Moves a phase to a new position. The first phase is where new cards land, so it stays first and nothing moves above it. */
export function movePhase(phases: StoredPhaseInfo[], from: number, to: number): StoredPhaseInfo[] {
  const target = Math.min(Math.max(to, 1), phases.length - 1);
  if (from < 1 || from >= phases.length || from === target) return phases;
  const next = [...phases];
  next.splice(target, 0, ...next.splice(from, 1));
  return next;
}

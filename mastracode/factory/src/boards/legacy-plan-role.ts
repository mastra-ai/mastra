import { factoryLaneForRole } from '../rules/types.js';

/*
 * Compatibility for the Work board's old `plan` role. Planning moved into the
 * `work` context, so Work's lanes no longer follow from its contexts alone, and
 * cards planned before the move hold their planner under `plan`. Delete these
 * once no card holds a `plan` session and no queued decision names `plan`.
 */

const LEGACY_PLAN_ROLE = 'plan';

/**
 * The Work lane a role's run belongs to: `plan` plans, `work` builds. Undefined
 * on other boards, and when a board installed as `work` in place of the built-in
 * one does not declare that lane as a working phase.
 */
export function workLaneForRole(
  boardId: string,
  role: string,
  board: { isWorking(phase: string): boolean } | undefined,
): string | undefined {
  const lane = boardId === 'work' ? factoryLaneForRole(role) : undefined;
  return lane !== undefined && board?.isWorking(lane) ? lane : undefined;
}

/**
 * Whether a Work stage carries a run decided for `role`. Planning, Building and
 * Review share the `work` context, so the skill tells them apart: Planning
 * carries `factory-plan` runs (and runs for the old `plan` role), Building and
 * Review the other `work` runs.
 * Undefined on other boards.
 */
export function workStageCarries(
  boardId: string,
  stage: string,
  role: string,
  skillName: unknown,
  contextOf: (stage: string) => string | undefined,
): boolean | undefined {
  // A board installed as `work` in place of the built-in one is matched by context, like any other board.
  if (boardId !== 'work' || contextOf('planning') !== 'work') return undefined;
  if (role === LEGACY_PLAN_ROLE) return stage === 'planning';
  if (role !== 'work') return contextOf(stage) === role;
  if (contextOf(stage) !== 'work') return false;
  return (stage === 'planning') === (skillName === 'factory-plan');
}

/** The session key a Work build falls back to when the card has no `work` session yet. */
export function legacyPlanRoleFor(boardId: string, role: string): string | undefined {
  return boardId === 'work' && role === 'work' ? LEGACY_PLAN_ROLE : undefined;
}

/** Whether a Work card in Planning still holds its planner under the old `plan` key. */
export function holdsLegacyPlanner(boardId: string, stage: string, sessions: Record<string, unknown>): boolean {
  return boardId === 'work' && stage === 'planning' && sessions[LEGACY_PLAN_ROLE] !== undefined;
}

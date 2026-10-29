import { factoryLaneForRole } from '../rules/types.js';
import type { InstalledBoard } from './registry.js';
import { workBoard } from './work.js';

/*
 * Compatibility for the Work board's old `plan` role. Planning moved into the
 * `work` context, so Work's lanes no longer follow from its contexts alone, and
 * cards planned before the move hold their planner under `plan`. Delete these
 * once no card holds a `plan` session and no queued decision names `plan`.
 */

const LEGACY_PLAN_ROLE = 'plan';

/*
 * Only the built-in Work board gets these rules: the code board, or a project's stored copy of it,
 * which carries Work's own transition policy. A board installed as `work` in place of it is
 * matched by its own contexts, like any other board.
 */
function builtInWork(board: unknown): InstalledBoard | undefined {
  if (board === workBoard) return workBoard;
  const candidate = board as InstalledBoard | undefined;
  return candidate?.id === 'work' && candidate.transitionPolicy === workBoard.transitionPolicy ? candidate : undefined;
}

/** The built-in Work lane a role's run belongs to: `plan` plans, `work` builds. Undefined on other boards. */
export function workLaneForRole(board: unknown, role: string): string | undefined {
  const work = builtInWork(board);
  const lane = work ? factoryLaneForRole(role) : undefined;
  // An edited Work board may have dropped the lane; its own contexts decide then.
  return lane && work!.phases[lane] ? lane : undefined;
}

/**
 * Whether a built-in Work stage carries a run decided for `role`. Planning,
 * Building and Review share the `work` context, so the skill tells them apart:
 * Planning carries `factory-plan` runs (and runs for the old `plan` role),
 * Building and Review the other `work` runs. Undefined on other boards.
 */
export function workStageCarries(board: unknown, stage: string, role: string, skillName: unknown): boolean | undefined {
  const work = builtInWork(board);
  if (!work) return undefined;
  if (role === LEGACY_PLAN_ROLE) return stage === 'planning';
  if (role !== 'work') return work.roleForPhase(stage) === role;
  if (work.roleForPhase(stage) !== 'work') return false;
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

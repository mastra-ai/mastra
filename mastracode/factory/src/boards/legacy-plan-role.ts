import { factoryLaneForRole } from '../rules/types.js';

/*
 * Compatibility for the Work board's old `plan` role. Planning moved into the
 * `work` context, so Work's lanes no longer follow from its contexts alone, and
 * cards planned before the move hold their planner under `plan`. Delete these
 * once no card holds a `plan` session and no queued decision names `plan`.
 */

const LEGACY_PLAN_ROLE = 'plan';

/** The Work lane a role's run belongs to: `plan` plans, `work` builds. Undefined on other boards. */
export function workLaneForRole(boardId: string, role: string): string | undefined {
  return boardId === 'work' ? factoryLaneForRole(role) : undefined;
}

/** The session key a Work build falls back to when the card has no `work` session yet. */
export function legacyPlanRoleFor(boardId: string, role: string): string | undefined {
  return boardId === 'work' && role === 'work' ? LEGACY_PLAN_ROLE : undefined;
}

/** Whether a Work card in Planning still holds its planner under the old `plan` key. */
export function holdsLegacyPlanner(boardId: string, stage: string, sessions: Record<string, unknown>): boolean {
  return boardId === 'work' && stage === 'planning' && sessions[LEGACY_PLAN_ROLE] !== undefined;
}

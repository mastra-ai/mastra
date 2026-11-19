import { boardPath } from '../factory/boardCatalog';

export interface BoardConfigLocation {
  factoryId: string;
  boardId: string;
  /** The phase being configured; unset on the board's Overview page. */
  phaseKey?: string;
  /** The factory skills page or one of its skill pages, opened from this board's settings. Skills are factory-wide; the board only keeps the sidebar in place. */
  skills?: true;
  /** The board's rules: what it takes when an item arrives and where its cards move. */
  rules?: true;
  /** The intake page, opened from this board's settings. Like skills, intake is not one board's. */
  intake?: true;
}

/** A board's configuration: its Overview page, or one phase's page. */
export function boardConfigPath(factoryId: string, boardId: string, phaseKey?: string): string {
  const path = `${boardPath(factoryId, boardId)}/config`;
  return phaseKey ? `${path}/${encodeURIComponent(phaseKey)}` : path;
}

/**
 * The factory skills page, beside this board's settings in the sidebar. It sits outside `config/` because any
 * phase key, including `skills`, can name a phase page there.
 */
export function boardSkillsPath(factoryId: string, boardId: string): string {
  return `${boardPath(factoryId, boardId)}/skills`;
}

export function boardSkillPath(factoryId: string, boardId: string, skillName: string): string {
  return `${boardSkillsPath(factoryId, boardId)}/${encodeURIComponent(skillName)}`;
}

/** The form that creates a skill. Not under `skills/`, where `new` could be a skill's name. */
export function newSkillPath(factoryId: string, boardId: string): string {
  return `${boardPath(factoryId, boardId)}/new-skill`;
}

/** Narrows the Rules page to the rules moving cards into one phase, or to those sending cards to other boards. */
export type RulesFocus = { into: string } | 'leaving';

export const RULES_INTO_PARAM = 'into';
/** A param of its own, so no phase key can be mistaken for it. */
export const RULES_LEAVING_PARAM = 'leaving';

/** The board's rules. Outside `config/` for the same reason as the skills page. */
export function boardRulesPath(factoryId: string, boardId: string, focus?: RulesFocus): string {
  const path = `${boardPath(factoryId, boardId)}/rules`;
  if (!focus) return path;
  if (focus === 'leaving') return `${path}?${RULES_LEAVING_PARAM}`;
  return `${path}?${new URLSearchParams({ [RULES_INTO_PARAM]: focus.into })}`;
}

/** The order intake asks boards to take a new item, on the intake page. */
export const INTAKE_ORDER_ANCHOR = 'intake-order';

/** Items no board took, on the intake page. */
export const NOT_ROUTED_ANCHOR = 'not-routed';

/** What comes in: sources, intake order and items no board took. Outside `config/` like the skills page. */
export function boardIntakePath(
  factoryId: string,
  boardId: string,
  anchor?: typeof INTAKE_ORDER_ANCHOR | typeof NOT_ROUTED_ANCHOR,
): string {
  const path = `${boardPath(factoryId, boardId)}/intake`;
  return anchor ? `${path}#${anchor}` : path;
}

/** The form that creates a board. Not under `boards/`, where `new` could be a board key. */
export function newBoardPath(factoryId: string): string {
  return `/factories/${factoryId}/new-board`;
}

const BOARD_CONFIG_PATH =
  /^\/factories\/([^/]+)\/(?:(work)|boards\/([^/]+))\/(?:config(?:\/([^/]+))?|(skills(?:\/[^/]+)?|new-skill)|(rules)|(intake))\/?$/;

/** Reads a board configuration path, so the sidebar outside the page outlet knows what is open. */
export function parseBoardConfigPath(pathname: string): BoardConfigLocation | undefined {
  const match = BOARD_CONFIG_PATH.exec(pathname);
  if (!match) return undefined;
  const [, factoryId, builtinBoard, customBoard, phaseKey, skills, rules, intake] = match;
  // A hand-typed URL can carry a broken escape; it then names no board page.
  try {
    return {
      factoryId: decodeURIComponent(factoryId ?? ''),
      boardId: builtinBoard ?? decodeURIComponent(customBoard ?? ''),
      ...(phaseKey ? { phaseKey: decodeURIComponent(phaseKey) } : {}),
      ...(skills ? { skills: true } : {}),
      ...(rules ? { rules: true } : {}),
      ...(intake ? { intake: true } : {}),
    };
  } catch {
    return undefined;
  }
}

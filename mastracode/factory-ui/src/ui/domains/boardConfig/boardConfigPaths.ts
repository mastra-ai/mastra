import { boardPath } from '../factory/boardCatalog';

export interface BoardConfigLocation {
  factoryId: string;
  boardId: string;
  /** The phase being configured; unset on the board's General page. */
  phaseKey?: string;
  /** The factory skills page, opened from this board's settings. Skills are factory-wide; the board only keeps the sidebar in place. */
  skills?: true;
  /** The board's rules: what it takes when an item arrives and where its cards move. */
  rules?: true;
  /** The intake page, opened from this board's settings. Like skills, intake is not one board's. */
  intake?: true;
}

/** A board's configuration: its General page, or one phase's page. */
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

/** The board's rules. Outside `config/` for the same reason as the skills page. */
export function boardRulesPath(factoryId: string, boardId: string): string {
  return `${boardPath(factoryId, boardId)}/rules`;
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
  /^\/factories\/([^/]+)\/(?:(work)|boards\/([^/]+))\/(?:config(?:\/([^/]+))?|(skills)|(rules)|(intake))\/?$/;

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

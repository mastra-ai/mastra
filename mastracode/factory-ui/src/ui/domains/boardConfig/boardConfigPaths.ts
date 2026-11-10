import { boardPath } from '../factory/boardCatalog';

export interface BoardConfigLocation {
  factoryId: string;
  boardId: string;
  /** The phase being configured; unset on the board's General page. */
  phaseKey?: string;
  /** The factory skills page, opened from this board's settings. Skills are factory-wide; the board only keeps the sidebar in place. */
  skills?: true;
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

const BOARD_CONFIG_PATH =
  /^\/factories\/([^/]+)\/(?:(work|review)|boards\/([^/]+))\/(?:config(?:\/([^/]+))?|(skills))\/?$/;

/** Reads a board configuration path, so the sidebar outside the page outlet knows what is open. */
export function parseBoardConfigPath(pathname: string): BoardConfigLocation | undefined {
  const match = BOARD_CONFIG_PATH.exec(pathname);
  if (!match) return undefined;
  const [, factoryId, builtinBoard, customBoard, phaseKey, skills] = match;
  const boardId = builtinBoard ?? decodeURIComponent(customBoard ?? '');
  return {
    factoryId: decodeURIComponent(factoryId ?? ''),
    boardId,
    ...(phaseKey ? { phaseKey: decodeURIComponent(phaseKey) } : {}),
    ...(skills ? { skills: true as const } : {}),
  };
}

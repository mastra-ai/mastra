import { boardPath } from '../factory/boardCatalog';

export interface BoardConfigLocation {
  factoryId: string;
  boardId: string;
  /** The phase selected on the board's canvas. */
  phaseKey?: string;
  /** The factory skills page or one of its skill pages, opened from this board's settings. Skills are factory-wide. */
  skills?: true;
  /** The routing page, opened from this board's settings. Like skills, routing is not one board's. */
  intake?: true;
}

/** What the side panel shows besides the board or a phase: a rule, a new rule, or an item being tested. */
export type CanvasFocus =
  | { rule: string; test?: string }
  | { newRule: { on?: string; into?: string; board?: string } }
  | { test: string };

const RULE_PARAM = 'rule';
const NEW_RULE = 'new';
const RULE_ON_PARAM = 'on';
const RULE_INTO_PARAM = 'into';
const RULE_BOARD_PARAM = 'board';
const TEST_PARAM = 'test';

function focusSearch(focus: CanvasFocus | undefined): string {
  if (!focus) return '';
  const params = new URLSearchParams();
  if ('newRule' in focus) {
    params.set(RULE_PARAM, NEW_RULE);
    const { on, into, board } = focus.newRule;
    if (on) params.set(RULE_ON_PARAM, on);
    if (into) params.set(RULE_INTO_PARAM, into);
    if (board) params.set(RULE_BOARD_PARAM, board);
  } else {
    if ('rule' in focus) params.set(RULE_PARAM, focus.rule);
    if (focus.test) params.set(TEST_PARAM, focus.test);
  }
  return `?${params}`;
}

export function readCanvasFocus(params: URLSearchParams): CanvasFocus | undefined {
  const rule = params.get(RULE_PARAM);
  const test = params.get(TEST_PARAM) ?? undefined;
  if (rule === NEW_RULE) {
    return {
      newRule: {
        on: params.get(RULE_ON_PARAM) ?? undefined,
        into: params.get(RULE_INTO_PARAM) ?? undefined,
        board: params.get(RULE_BOARD_PARAM) ?? undefined,
      },
    };
  }
  if (rule) return { rule, test };
  return test ? { test } : undefined;
}

/** A board's canvas, with a phase or something else selected in its side panel. */
export function boardConfigPath(factoryId: string, boardId: string, phaseKey?: string, focus?: CanvasFocus): string {
  const path = `${boardPath(factoryId, boardId)}/config`;
  return `${phaseKey ? `${path}/${encodeURIComponent(phaseKey)}` : path}${focusSearch(focus)}`;
}

/**
 * The factory skills page, opened from this board's settings. It sits outside `config/` because any phase key,
 * including `skills`, can name a phase there.
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

/** The order intake asks boards to take a new item, on the routing page. */
export const INTAKE_ORDER_ANCHOR = 'intake-order';

/** Items no board took, on the routing page. */
export const NOT_ROUTED_ANCHOR = 'not-routed';

/** Sources, the intake order and items no board took. Outside `config/` like the skills page. */
export function boardIntakePath(
  factoryId: string,
  boardId: string,
  options: { anchor?: typeof INTAKE_ORDER_ANCHOR | typeof NOT_ROUTED_ANCHOR; focus?: CanvasFocus } = {},
): string {
  const path = `${boardPath(factoryId, boardId)}/intake${focusSearch(options.focus)}`;
  return options.anchor ? `${path}#${options.anchor}` : path;
}

/** The form that creates a board. Not under `boards/`, where `new` could be a board key. */
export function newBoardPath(factoryId: string): string {
  return `/factories/${factoryId}/new-board`;
}

const BOARD_CONFIG_PATH =
  /^\/factories\/([^/]+)\/(?:(work)|boards\/([^/]+))\/(?:config(?:\/([^/]+))?|(skills(?:\/[^/]+)?|new-skill)|(intake))\/?$/;

/** Reads a board configuration path, so places outside the page outlet know what is open. */
export function parseBoardConfigPath(pathname: string): BoardConfigLocation | undefined {
  const match = BOARD_CONFIG_PATH.exec(pathname);
  if (!match) return undefined;
  const [, factoryId, builtinBoard, customBoard, phaseKey, skills, intake] = match;
  // A hand-typed URL can carry a broken escape; it then names no board page.
  try {
    return {
      factoryId: decodeURIComponent(factoryId ?? ''),
      boardId: builtinBoard ?? decodeURIComponent(customBoard ?? ''),
      ...(phaseKey ? { phaseKey: decodeURIComponent(phaseKey) } : {}),
      ...(skills ? { skills: true } : {}),
      ...(intake ? { intake: true } : {}),
    };
  } catch {
    return undefined;
  }
}

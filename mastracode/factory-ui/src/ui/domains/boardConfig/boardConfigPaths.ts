import { boardPath } from '../factory/boardCatalog';
import { focusSearch } from '@mastra/playground-ui/domains/factory';
import type { CanvasFocus } from '@mastra/playground-ui/domains/factory';

export interface BoardConfigLocation {
  factoryId: string;
  boardId: string;
  /** The phase selected on the board's canvas. */
  phaseKey?: string;
  /** The routing page, opened from this board's settings. Routing is not one board's. */
  intake?: true;
}

/** A board's canvas, with a phase or something else selected in its side panel. */
export function boardConfigPath(factoryId: string, boardId: string, phaseKey?: string, focus?: CanvasFocus): string {
  const path = `${boardPath(factoryId, boardId)}/config`;
  return `${phaseKey ? `${path}/${encodeURIComponent(phaseKey)}` : path}${focusSearch(focus)}`;
}

/** The order intake asks boards to take a new item, on the routing page. */
export const INTAKE_ORDER_ANCHOR = 'intake-order';

/** Items no board took, on the routing page. */
export const NOT_ROUTED_ANCHOR = 'not-routed';

/** Sources, the intake order and items no board took. Outside `config/`, where any phase key can name a phase. */
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

const BOARD_CONFIG_PATH = /^\/factories\/([^/]+)\/(?:(work)|boards\/([^/]+))\/(?:config(?:\/([^/]+))?|(intake))\/?$/;

/** Reads a board configuration path, so places outside the page outlet know what is open. */
export function parseBoardConfigPath(pathname: string): BoardConfigLocation | undefined {
  const match = BOARD_CONFIG_PATH.exec(pathname);
  if (!match) return undefined;
  const [, factoryId, builtinBoard, customBoard, phaseKey, intake] = match;
  // A hand-typed URL can carry a broken escape; it then names no board page.
  try {
    return {
      factoryId: decodeURIComponent(factoryId ?? ''),
      boardId: builtinBoard ?? decodeURIComponent(customBoard ?? ''),
      ...(phaseKey ? { phaseKey: decodeURIComponent(phaseKey) } : {}),
      ...(intake ? { intake: true } : {}),
    };
  } catch {
    return undefined;
  }
}

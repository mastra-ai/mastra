import type { ToolAction } from '../tools';

/**
 * Upstream access to a computer's live desktop viewer, for a server-side proxy.
 * `headers` are added to upstream requests and must never reach the browser.
 *
 * @experimental
 */
export interface MastraComputerViewer {
  url: string;
  headers: Record<string, string>;
}

/**
 * A provider of agent computers, registered with `new Mastra({ computers })`.
 * Agents reach computers only through `tools()`.
 *
 * @experimental
 */
export interface MastraComputers {
  tools(): Record<string, ToolAction<any, any, any, any>>;
  viewer(
    computerId: string,
    scope: { threadId: string; resourceId: string },
  ): Promise<MastraComputerViewer | null>;
}

import type { ToolAction } from '../tools';
import type { Mastra } from './index';

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
  /** Called by `new Mastra({ computers })` so the provider can reach storage outside tool calls. */
  __registerMastra?(mastra: Mastra): void;
  tools(): Record<string, ToolAction<any, any, any, any>>;
  viewer(computerId: string, scope: MastraComputerScope): Promise<MastraComputerViewer | null>;
  /** Who holds a computer's input. Throws when the computer isn't attached to this thread. */
  controlState?(computerId: string, scope: MastraComputerScope): Promise<MastraComputerControl>;
  /** Hands a computer's input to the user (`take`) or back to the agent (`release`). */
  control?(
    computerId: string,
    scope: MastraComputerScope,
    input: { action: 'take' | 'release'; note?: string },
  ): Promise<MastraComputerControlResult>;
}

/** @experimental */
export interface MastraComputerScope {
  threadId: string;
  resourceId: string;
}

/**
 * Who may drive a computer's input.
 *
 * @experimental
 */
export interface MastraComputerControl {
  holder: 'agent' | 'human';
  reason?: string;
}

/**
 * Result of a control change. `notified` is true only when the agent accepted the
 * notification; otherwise `reason` says why.
 *
 * @experimental
 */
export interface MastraComputerControlResult {
  holder: 'agent' | 'human';
  notified: boolean;
  reason?: 'no-change' | 'no-agent' | 'no-notifications-storage' | 'not-delivered' | 'error';
}

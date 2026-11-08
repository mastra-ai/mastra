import type { Mastra } from '../mastra/index.js';
import type { ToolAction, ToolExecutionContext } from '../tools/index.js';

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

/** @experimental */
export interface MastraComputerScope {
  threadId: string;
  resourceId: string;
}

/** Who may drive a computer's input. @experimental */
export interface MastraComputerControl {
  holder: 'agent' | 'human';
  reason?: string;
  revision: number;
}

/** Result of a control change. @experimental */
export interface MastraComputerControlResult {
  holder: 'agent' | 'human';
  revision: number;
  notified: boolean;
  reason?: 'no-change' | 'no-agent' | 'no-notifications-storage' | 'not-delivered' | 'error';
}

/** @experimental */
export type ComputerControlEnforcementResult =
  | { status: 'enforced'; enforcedRevision: number }
  | { status: 'retryable'; error: string }
  | { status: 'permanent'; error: string };

/** A subscriber that enforces authoritative core control state at an external boundary. @experimental */
export interface ComputerControlSubscriber {
  id: string;
  required: boolean;
  enforce(input: {
    computerId: string;
    scope: MastraComputerScope;
    identity: unknown;
    control: MastraComputerControl;
    signal: AbortSignal;
  }): Promise<ComputerControlEnforcementResult>;
}

/** @experimental */
export interface ComputerActionInput {
  sandboxId: string;
  action: 'read' | 'mutate';
  context: ToolExecutionContext<any, any, any>;
  signal?: AbortSignal;
}

/**
 * A provider of agent computers, registered with `new Mastra({ computers })`.
 * Agents reach computers only through `tools()`.
 *
 * @experimental
 */
export interface MastraComputers {
  /** Called by `new Mastra({ computers })` so the provider can reach shared runtime services. */
  __registerMastra?(mastra: Mastra): void;
  tools(): Record<string, ToolAction<any, any, any, any>>;
  viewer(computerId: string, scope: MastraComputerScope): Promise<MastraComputerViewer | null>;
  /** Mint an origin-bound embed URL when the provider supports external presentation. */
  embed?(
    computerId: string,
    scope: MastraComputerScope,
    options: { origin: string; mode: 'watch' | 'control' },
  ): Promise<string | null>;
  /** Who holds a computer's input. Throws when the computer isn't attached to this thread. */
  controlState?(computerId: string, scope: MastraComputerScope): Promise<MastraComputerControl>;
  /** Hands a computer's input to the user (`take`) or back to the agent (`release`). */
  control?(
    computerId: string,
    scope: MastraComputerScope,
    input: { action: 'take' | 'release'; note?: string },
  ): Promise<MastraComputerControlResult>;
  /** Register an enforcement subscriber. The disposer releases only this registration owner. */
  registerControlSubscriber?(subscriber: ComputerControlSubscriber): () => void;
  /** Run a Workspace computer action under this provider's cross-run control lease when managed. */
  runComputerAction?<T>(input: ComputerActionInput, fn: () => Promise<T>): Promise<T>;
}

/**
 * BrowserContextProcessor
 *
 * Input processor that injects browser context into agent prompts.
 * Similar to ChatChannelProcessor for channels.
 *
 * - `processInput`: Adds a system message with stable context (provider, sessionId, headless mode).
 * - `processInputStep`: At step 0, adds a new user message with browser context as a `<system-reminder>`.
 *   This preserves prompt cache by not modifying existing messages in history.
 *
 * Reads from `requestContext.get('browser')`.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   browser: new AgentBrowser({ ... }),
 *   inputProcessors: [new BrowserContextProcessor()],
 * });
 * ```
 */

import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  ProcessInputArgs,
  ProcessInputResult,
} from '../processors/index';

/**
 * Browser context stored in RequestContext.
 * Set by the browser implementation or deployer.
 */
export interface BrowserContext {
  /** Browser provider name (e.g., "agent-browser", "stagehand") */
  provider: string;

  /** Provider type: 'sdk' for direct API, 'cli' for command-line tools */
  providerType?: 'sdk' | 'cli';

  /** Session ID for tracking */
  sessionId?: string;

  /** Whether browser is running in headless mode */
  headless?: boolean;

  /** Current page URL (updated per-request) */
  currentUrl?: string;

  /** Current page title (updated per-request) */
  pageTitle?: string;

  /** Whether the browser is currently open/connected. Defaults to true when browser context is present. */
  isOpen?: boolean;

  /**
   * Reason the browser was closed, when isOpen is false.
   * Helps differentiate between agent-initiated close, user action, process restart, or error.
   */
  closeReason?: 'agent' | 'user' | 'process_restart' | 'error';

  /** Number of currently open tabs, when available. */
  tabCount?: number;

  /** Additional active page metadata exposed by the browser provider. */
  pageMetadata?: Record<string, string | number | boolean | null | undefined>;

  /**
   * CDP WebSocket URL for CLI providers.
   * When present, the agent should pass this URL to CLI commands
   * to connect them to the browser managed by Mastra.
   */
  cdpUrl?: string;

  /** Internal provider hook used to refresh browser state between agentic loop steps. */
  getState?: () => Promise<Partial<BrowserContext> | undefined>;
}

/**
 * Input processor that injects browser context into agent prompts.
 */
export class BrowserContextProcessor {
  readonly id = 'browser-context';
  readonly stateId = 'browser';

  processInput(args: ProcessInputArgs): ProcessInputResult {
    const ctx = args.requestContext?.get('browser') as BrowserContext | undefined;
    if (!ctx) return args.messageList;

    const lines = [`You have access to a browser (${ctx.provider}).`];

    if (ctx.headless === false) {
      lines.push('The browser is running in visible mode (not headless).');
    }

    if (ctx.sessionId) {
      lines.push(`Session ID: ${ctx.sessionId}`);
    }

    // For CLI providers, include CDP URL for context (injection handles the mechanics)
    if (ctx.providerType === 'cli' && ctx.cdpUrl) {
      lines.push(`CDP WebSocket URL: ${ctx.cdpUrl}`);
    }

    const systemMessages = [...args.systemMessages, { role: 'system' as const, content: lines.join(' ') }];

    return { messages: args.messages, systemMessages };
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const ctx = args.requestContext?.get('browser') as BrowserContext | undefined;
    if (!ctx) return;

    const refreshedState = await ctx.getState?.();
    const browserState = getBrowserState(refreshedState ? { ...ctx, ...refreshedState } : ctx);
    const shouldRefreshSnapshot = Boolean(args.lastSnapshot && !args.contextWindow.hasSnapshot);
    const previousState = getMostRecentBrowserState(args.activeStateSignals);

    // Suppress the signal entirely when the browser was never opened in this thread.
    // If there's no previous state (never reported as open) and the browser is currently closed,
    // the agent hasn't used the browser yet — don't emit a confusing "Browser is closed" message.
    if (!previousState && !browserState.open) return;

    const changed = getChangedBrowserState(previousState, browserState);
    if (previousState && Object.keys(changed).length === 0 && !shouldRefreshSnapshot) return;

    const isDelta = Boolean(previousState && !shouldRefreshSnapshot);
    return {
      id: 'browser',
      cacheKey: stableBrowserStateCacheKey(browserState),
      mode: isDelta ? 'delta' : 'snapshot',
      tagName: 'state',
      contents: isDelta ? formatBrowserStateDelta(changed) : formatBrowserStateSnapshot(browserState),
      value: browserState,
      ...(isDelta ? { delta: changed } : {}),
      attributes: {
        type: 'browser',
        updated: new Date().toISOString(),
      },
      metadata: {
        browser: browserState,
      },
    };
  }
}

type BrowserState = {
  open: boolean;
  activeUrl?: string;
  pageTitle?: string;
  tabCount?: number;
  pageMetadata?: Record<string, string | number | boolean | null | undefined>;
  closeReason?: 'agent' | 'user' | 'process_restart' | 'error';
};

function getBrowserState(ctx: BrowserContext): BrowserState {
  return {
    open: ctx.isOpen ?? true,
    ...(ctx.currentUrl ? { activeUrl: ctx.currentUrl } : {}),
    ...(ctx.pageTitle ? { pageTitle: ctx.pageTitle } : {}),
    ...(typeof ctx.tabCount === 'number' ? { tabCount: ctx.tabCount } : {}),
    ...(ctx.pageMetadata ? { pageMetadata: ctx.pageMetadata } : {}),
    ...(ctx.closeReason ? { closeReason: ctx.closeReason } : {}),
  };
}

function getMostRecentBrowserState(
  activeStateSignals: ComputeStateSignalArgs['activeStateSignals'],
): BrowserState | undefined {
  for (const signal of [...activeStateSignals].reverse()) {
    const browser = signal.metadata?.browser;
    if (browser && typeof browser === 'object' && !Array.isArray(browser)) {
      return browser as BrowserState;
    }
  }
  return undefined;
}

function stableBrowserStateCacheKey(state: BrowserState): string {
  return JSON.stringify(state, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[key] = (value as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return value;
  });
}

function getChangedBrowserState(previous: BrowserState | undefined, current: BrowserState): Partial<BrowserState> {
  if (!previous) return current;

  const changed: Partial<BrowserState> = {};
  for (const key of Object.keys(current) as Array<keyof BrowserState>) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      (changed as Record<string, unknown>)[key] = current[key];
    }
  }
  return changed;
}

function formatBrowserStateSnapshot(state: BrowserState): string {
  const parts = [formatOpenClosedStatus(state)];
  if (state.activeUrl) parts.push(`Active tab URL: ${state.activeUrl}.`);
  if (state.pageTitle) parts.push(`Page title: ${state.pageTitle}.`);
  if (typeof state.tabCount === 'number')
    parts.push(`${state.tabCount} open ${state.tabCount === 1 ? 'tab' : 'tabs'}.`);
  if (state.pageMetadata && Object.keys(state.pageMetadata).length > 0) {
    parts.push(`Page metadata: ${JSON.stringify(state.pageMetadata)}.`);
  }
  return parts.join(' ');
}

function formatBrowserStateDelta(delta: Partial<BrowserState>): string {
  const parts: string[] = [];
  if (typeof delta.open === 'boolean') {
    if (delta.open) {
      parts.push('browser opened');
    } else {
      parts.push(formatCloseReason(delta.closeReason));
    }
  }
  if (delta.activeUrl) parts.push(`active tab URL changed to ${delta.activeUrl}`);
  if (delta.pageTitle) parts.push(`page title changed to ${delta.pageTitle}`);
  if (typeof delta.tabCount === 'number') parts.push(`${delta.tabCount} open ${delta.tabCount === 1 ? 'tab' : 'tabs'}`);
  if (delta.pageMetadata && Object.keys(delta.pageMetadata).length > 0) {
    parts.push(`page metadata changed to ${JSON.stringify(delta.pageMetadata)}`);
  }
  return `changed: ${parts.join('; ')}`;
}

function formatOpenClosedStatus(state: BrowserState): string {
  if (state.open) return 'Browser is open.';
  switch (state.closeReason) {
    case 'process_restart':
      return 'The session process restarted, which closed the browser.';
    case 'user':
      return 'The user closed the browser.';
    case 'error':
      return 'Browser closed unexpectedly due to an error.';
    case 'agent':
      return 'Browser is closed.';
    default:
      return 'Browser is closed.';
  }
}

function formatCloseReason(reason?: 'agent' | 'user' | 'process_restart' | 'error'): string {
  switch (reason) {
    case 'process_restart':
      return 'the session process restarted, which closed the browser';
    case 'user':
      return 'the user closed the browser';
    case 'error':
      return 'browser closed unexpectedly due to an error';
    case 'agent':
      return 'browser closed';
    default:
      return 'browser closed';
  }
}

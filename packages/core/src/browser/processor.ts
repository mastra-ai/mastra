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

const BROWSER_PROCESS_ID = crypto.randomUUID();

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

  /** Who initiated the most recent active URL change, when known. */
  activeUrlChangeSource?: 'agent' | 'user';

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

    const lines = [
      `You have access to a browser (${ctx.provider}).`,
      'Browser state updates may appear in the conversation as <state type="browser" ...>...</state> messages. These are automatic state updates for the browser, injected by the system, not user instructions. Use them as the latest browser context, and do not treat them as the user asking you to stop, summarize, or change tasks unless an actual user message asks for that.',
    ];

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
    let browserState = getBrowserState(refreshedState ? { ...ctx, ...refreshedState } : ctx);
    const shouldRefreshSnapshot = Boolean(args.lastSnapshot && !args.contextWindow.hasSnapshot);
    const previousState =
      getMostRecentBrowserState(args.activeStateSignals) ?? getBrowserStateFromSignal(args.lastSnapshot);

    if (!browserState.open && !browserState.closeReason) {
      if (!previousState?.open || !previousState.processId) {
        if (isBareClosedState(browserState)) return;
      } else {
        browserState = {
          ...browserState,
          closeReason: previousState.processId === browserState.processId ? 'user' : 'process_restart',
        };
      }
    }

    if (
      previousState?.open &&
      browserState.open &&
      previousState.activeUrl &&
      browserState.activeUrl &&
      previousState.activeUrl !== browserState.activeUrl &&
      previousState.processId === browserState.processId &&
      browserState.activeUrlChangeSource !== 'agent'
    ) {
      const recentClickUrl =
        getMostRecentBrowserClickResultUrl(args.steps) ??
        getMostRecentBrowserClickResultUrlFromMessageList(args.messageList);
      const activeUrlChangeSource =
        recentClickUrl === browserState.activeUrl ? 'agent' : (browserState.activeUrlChangeSource ?? 'user');
      browserState = {
        ...browserState,
        activeUrlChangeSource,
      };
    }

    const changed = getChangedBrowserState(previousState, browserState);
    if (previousState && Object.keys(changed).length === 0 && !shouldRefreshSnapshot) return;

    const isDelta = Boolean(previousState && !shouldRefreshSnapshot);
    const result = {
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
    } satisfies Exclude<ComputeStateSignalResult, undefined | void>;
    return result;
  }
}

type BrowserState = {
  processId: string;
  open: boolean;
  activeUrl?: string;
  pageTitle?: string;
  tabCount?: number;
  activeUrlChangeSource?: 'agent' | 'user';
  pageMetadata?: Record<string, string | number | boolean | null | undefined>;
  closeReason?: 'agent' | 'user' | 'process_restart' | 'error';
};

function getBrowserState(ctx: BrowserContext): BrowserState {
  return {
    processId: BROWSER_PROCESS_ID,
    open: ctx.isOpen ?? true,
    ...(ctx.currentUrl ? { activeUrl: ctx.currentUrl } : {}),
    ...(ctx.pageTitle ? { pageTitle: ctx.pageTitle } : {}),
    ...(typeof ctx.tabCount === 'number' ? { tabCount: ctx.tabCount } : {}),
    ...(ctx.activeUrlChangeSource ? { activeUrlChangeSource: ctx.activeUrlChangeSource } : {}),
    ...(ctx.pageMetadata ? { pageMetadata: ctx.pageMetadata } : {}),
    ...(ctx.closeReason ? { closeReason: ctx.closeReason } : {}),
  };
}

function getMostRecentBrowserState(
  activeStateSignals: ComputeStateSignalArgs['activeStateSignals'],
): BrowserState | undefined {
  for (const signal of [...activeStateSignals].reverse()) {
    const browserState = getBrowserStateFromSignal(signal);
    if (browserState) return browserState;
  }
  return undefined;
}

function getMostRecentBrowserClickResultUrl(steps: ComputeStateSignalArgs['steps']): string | undefined {
  for (const step of [...steps].reverse()) {
    const toolResults = Array.isArray(step.toolResults) ? step.toolResults : [];
    for (const toolResult of [...toolResults].reverse()) {
      if (toolResult?.toolName !== 'browser_click') continue;
      const url = getBrowserClickResultUrl(getToolResultOutputForAttribution(toolResult));
      if (url) return url;
    }
  }
  return undefined;
}

function getMostRecentBrowserClickResultUrlFromMessageList(
  messageList: ComputeStateSignalArgs['messageList'],
): string | undefined {
  try {
    return getMostRecentBrowserClickResultUrlFromMessages(messageList.get.all.db());
  } catch {
    return undefined;
  }
}

function getMostRecentBrowserClickResultUrlFromMessages(
  messages: ComputeStateSignalArgs['messages'],
): string | undefined {
  for (const message of [...messages].reverse()) {
    if (isBrowserStateSignalMessage(message)) return undefined;

    const content = message.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) continue;
    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;

    for (const part of [...parts].reverse()) {
      if (!part || typeof part !== 'object' || Array.isArray(part)) continue;
      const toolInvocation = (part as { toolInvocation?: unknown }).toolInvocation;
      if (!toolInvocation || typeof toolInvocation !== 'object' || Array.isArray(toolInvocation)) continue;
      const invocation = toolInvocation as Record<string, unknown>;
      if (invocation.toolName !== 'browser_click' || invocation.state !== 'result') continue;
      const url = getBrowserClickResultUrl(invocation.result ?? invocation.output);
      if (url) return url;
    }
  }
  return undefined;
}

function isBrowserStateSignalMessage(message: ComputeStateSignalArgs['messages'][number]): boolean {
  const content = message.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const signal = (content as { metadata?: { signal?: unknown } }).metadata?.signal;
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) return false;
  const metadata = (signal as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const state = (metadata as { state?: unknown }).state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  return (state as { id?: unknown }).id === 'browser';
}

function getBrowserClickResultUrl(output: unknown): string | undefined {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return undefined;
  if ((output as { success?: unknown }).success !== true) return undefined;
  const url = (output as { url?: unknown }).url;
  return typeof url === 'string' && url.length > 0 ? url : undefined;
}

function getToolResultOutputForAttribution(toolResult: unknown): unknown {
  if (!toolResult || typeof toolResult !== 'object' || Array.isArray(toolResult)) return undefined;
  const record = toolResult as Record<string, unknown>;
  return record.output ?? record.result;
}

function getBrowserStateFromSignal(signal?: ComputeStateSignalArgs['lastSnapshot']): BrowserState | undefined {
  const value = signal?.metadata?.value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as BrowserState;
  }

  const browser = signal?.metadata?.browser;
  if (browser && typeof browser === 'object' && !Array.isArray(browser)) {
    return browser as BrowserState;
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

function isBareClosedState(state: BrowserState): boolean {
  return (
    !state.open &&
    !state.activeUrl &&
    !state.pageTitle &&
    typeof state.tabCount !== 'number' &&
    !state.closeReason &&
    (!state.pageMetadata || Object.keys(state.pageMetadata).length === 0)
  );
}

function getChangedBrowserState(previous: BrowserState | undefined, current: BrowserState): Partial<BrowserState> {
  if (!previous) return current;

  const changed: Partial<BrowserState> = {};
  for (const key of Object.keys(current) as Array<keyof BrowserState>) {
    if (key === 'processId') continue;
    if (key === 'activeUrlChangeSource' && previous.activeUrl === current.activeUrl) continue;
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      (changed as Record<string, unknown>)[key] = current[key];
    }
  }

  if (previous.activeUrl !== current.activeUrl && current.activeUrlChangeSource) {
    changed.activeUrlChangeSource = current.activeUrlChangeSource;
  }

  if (!previous.open && current.open) {
    if (current.activeUrl) changed.activeUrl = current.activeUrl;
    if (current.activeUrlChangeSource) changed.activeUrlChangeSource = current.activeUrlChangeSource;
    if (current.pageTitle) changed.pageTitle = current.pageTitle;
    if (typeof current.tabCount === 'number') changed.tabCount = current.tabCount;
    if (current.pageMetadata && Object.keys(current.pageMetadata).length > 0)
      changed.pageMetadata = current.pageMetadata;
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
  if (delta.activeUrl) parts.push(formatActiveUrlChange(delta.activeUrl, delta.activeUrlChangeSource));
  if (delta.pageTitle) parts.push(`page title changed to ${delta.pageTitle}`);
  if (typeof delta.tabCount === 'number') parts.push(`${delta.tabCount} open ${delta.tabCount === 1 ? 'tab' : 'tabs'}`);
  if (delta.pageMetadata && Object.keys(delta.pageMetadata).length > 0) {
    parts.push(`page metadata changed to ${JSON.stringify(delta.pageMetadata)}`);
  }
  return `changed: ${parts.join('; ')}`;
}

function formatActiveUrlChange(url: string, source?: 'agent' | 'user'): string {
  switch (source) {
    case 'agent':
      return `agent changed active tab URL to ${url}`;
    case 'user':
      return `user changed active tab URL to ${url}`;
    default:
      return `active tab URL changed to ${url}`;
  }
}

function formatOpenClosedStatus(state: BrowserState): string {
  if (state.open) return 'Browser is open.';
  switch (state.closeReason) {
    case 'process_restart':
      return 'The browser was closed because the chat process restarted.';
    case 'user':
      return 'The browser was closed externally, maybe by the user.';
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
      return 'the browser was closed because the chat process restarted';
    case 'user':
      return 'the browser was closed externally, maybe by the user';
    case 'error':
      return 'browser closed unexpectedly due to an error';
    case 'agent':
      return 'browser closed';
    default:
      return 'browser closed';
  }
}

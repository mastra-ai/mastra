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

import type { MastraDBMessage } from '../agent/message-list';
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  ProcessInputArgs,
  ProcessInputResult,
  ProcessInputStepArgs,
} from '../processors/index';

const REMINDER_TYPE = 'browser-context';

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
}

/**
 * Input processor that injects browser context into agent prompts.
 */
export class BrowserContextProcessor {
  readonly id = 'browser-context';

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

  async processInputStep(args: ProcessInputStepArgs) {
    // Only inject per-request context at the first step
    if (args.stepNumber !== 0) return;

    const ctx = args.requestContext?.get('browser') as BrowserContext | undefined;
    if (!ctx) return;

    const parts: string[] = [];

    if (ctx.currentUrl) {
      parts.push(`Current URL: ${ctx.currentUrl}`);
    }

    if (ctx.pageTitle) {
      parts.push(`Page title: ${ctx.pageTitle}`);
    }

    if (parts.length === 0) return;

    const reminderText = parts.join(' | ');

    // Only suppress if the trailing message is already the same browser reminder
    const existingMessages = args.messageList.get.all.db();
    if (hasTrailingBrowserReminder(existingMessages, ctx.currentUrl, ctx.pageTitle)) {
      return;
    }

    await args.sendSignal?.({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: reminderText,
      attributes: {
        type: REMINDER_TYPE,
      },
      metadata: {
        url: ctx.currentUrl,
        title: ctx.pageTitle,
      },
    });

    return args.messageList;
  }

  computeStateSignal(args: ComputeStateSignalArgs): ComputeStateSignalResult {
    const ctx = args.requestContext?.get('browser') as BrowserContext | undefined;
    if (!ctx) return;

    const browserState = getBrowserState(ctx);
    const previousState = getMostRecentBrowserState(args.activeStateSignals);
    const changed = getChangedBrowserState(previousState, browserState);
    if (previousState && Object.keys(changed).length === 0) return;

    const isDelta = Boolean(previousState);
    return {
      tagName: 'state',
      contents: isDelta ? formatBrowserStateDelta(changed) : formatBrowserStateSnapshot(browserState),
      attributes: {
        type: 'browser',
        updated: new Date().toISOString(),
      },
      metadata: {
        state: {
          delta: isDelta,
        },
        browser: browserState,
        ...(isDelta ? { delta: changed } : {}),
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
};

function getBrowserState(ctx: BrowserContext): BrowserState {
  return {
    open: ctx.isOpen ?? true,
    ...(ctx.currentUrl ? { activeUrl: ctx.currentUrl } : {}),
    ...(ctx.pageTitle ? { pageTitle: ctx.pageTitle } : {}),
    ...(typeof ctx.tabCount === 'number' ? { tabCount: ctx.tabCount } : {}),
    ...(ctx.pageMetadata ? { pageMetadata: ctx.pageMetadata } : {}),
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
  const parts = [`Browser is ${state.open ? 'open' : 'closed'}.`];
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
  if (typeof delta.open === 'boolean') parts.push(`browser ${delta.open ? 'opened' : 'closed'}`);
  if (delta.activeUrl) parts.push(`active tab URL changed to ${delta.activeUrl}`);
  if (delta.pageTitle) parts.push(`page title changed to ${delta.pageTitle}`);
  if (typeof delta.tabCount === 'number') parts.push(`${delta.tabCount} open ${delta.tabCount === 1 ? 'tab' : 'tabs'}`);
  if (delta.pageMetadata && Object.keys(delta.pageMetadata).length > 0) {
    parts.push(`page metadata changed to ${JSON.stringify(delta.pageMetadata)}`);
  }
  return `changed: ${parts.join('; ')}`;
}

interface BrowserReminderMetadata {
  type: typeof REMINDER_TYPE;
  url?: string;
  title?: string;
}

/**
 * Check if the trailing message is already a browser reminder with the same URL/title.
 * Only checks the last message to avoid suppressing reminders when the browser context
 * is no longer at the tail (e.g., user → reminder(A) → assistant → user should get a fresh reminder).
 */
function hasTrailingBrowserReminder(
  messages: MastraDBMessage[],
  url: string | undefined,
  title: string | undefined,
): boolean {
  const msg = messages[messages.length - 1];
  if (!msg || (msg.role !== 'user' && msg.role !== 'signal')) return false;

  const metadata = msg.content.metadata;
  if (typeof metadata !== 'object' || metadata === null) {
    return false;
  }

  const signal = (
    metadata as { signal?: { type?: string; attributes?: { type?: string }; metadata?: BrowserReminderMetadata } }
  ).signal;
  const reminder = signal
    ? {
        type: signal.attributes?.type,
        url: signal.metadata?.url,
        title: signal.metadata?.title,
      }
    : 'systemReminder' in metadata
      ? (metadata as { systemReminder?: BrowserReminderMetadata }).systemReminder
      : (metadata as unknown as BrowserReminderMetadata);
  return reminder?.type === REMINDER_TYPE && reminder.url === url && reminder.title === title;
}

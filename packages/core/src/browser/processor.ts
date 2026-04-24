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

import type { MessageList, MastraDBMessage } from '../agent/message-list';
import type { MastraMessageContentV2 } from '../agent/message-list/state/types';
import type { ProcessInputArgs, ProcessInputResult, ProcessInputStepArgs } from '../processors/index';

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

  processInputStep(args: ProcessInputStepArgs): MessageList | undefined {
    // Only inject per-request context at the first step
    if (args.stepNumber !== 0) return;

    const ctx = args.requestContext?.get('browser') as BrowserContext | undefined;
    if (!ctx) return;

    const parts: string[] = [];

    if (ctx.currentUrl) {
      parts.push(`Current URL: ${escapeXml(ctx.currentUrl)}`);
    }

    if (ctx.pageTitle) {
      parts.push(`Page title: ${escapeXml(ctx.pageTitle)}`);
    }

    if (parts.length === 0) return;

    const reminderText = parts.join(' | ');
    const reminderMarkup = `<system-reminder type="${REMINDER_TYPE}">${reminderText}</system-reminder>`;

    // Only suppress if the trailing message is already the same browser reminder
    const existingMessages = args.messageList.get.all.db();
    if (hasTrailingBrowserReminder(existingMessages, ctx.currentUrl, ctx.pageTitle)) {
      return;
    }

    // Add as a new user message at the end of history to preserve prompt cache
    const reminderMessage = createBrowserReminderMessage(reminderMarkup, ctx.currentUrl, ctx.pageTitle);
    args.messageList.add(reminderMessage, 'user');
    args.rotateResponseMessageId?.();

    return args.messageList;
  }
}

interface BrowserReminderMetadata {
  type: typeof REMINDER_TYPE;
  url?: string;
  title?: string;
}

function createBrowserReminderMessage(
  reminderMarkup: string,
  url: string | undefined,
  title: string | undefined,
): MastraDBMessage {
  const reminderMeta: BrowserReminderMetadata = {
    type: REMINDER_TYPE,
    url,
    title,
  };

  const content: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: reminderMarkup }],
    metadata: {
      systemReminder: reminderMeta,
    },
  };

  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    createdAt: new Date(),
  };
}

/**
 * Escape XML special characters in browser-derived values.
 * Prevents URLs or page titles containing <, &, or </system-reminder> from breaking the markup.
 */
function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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
  if (!msg || msg.role !== 'user') return false;

  const metadata = msg.content.metadata;
  if (typeof metadata !== 'object' || metadata === null || !('systemReminder' in metadata)) {
    return false;
  }

  const reminder = (metadata as { systemReminder?: BrowserReminderMetadata }).systemReminder;
  return reminder?.type === REMINDER_TYPE && reminder.url === url && reminder.title === title;
}

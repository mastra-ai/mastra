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

  /** Session ID for tracking */
  sessionId?: string;

  /** Whether browser is running in headless mode */
  headless?: boolean;

  /** Current page URL (updated per-request) */
  currentUrl?: string;

  /** Current page title (updated per-request) */
  pageTitle?: string;
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
      parts.push(`Current URL: ${ctx.currentUrl}`);
    }

    if (ctx.pageTitle) {
      parts.push(`Page title: ${ctx.pageTitle}`);
    }

    if (parts.length === 0) return;

    const reminderText = parts.join(' | ');
    const reminderMarkup = `<system-reminder type="${REMINDER_TYPE}">${reminderText}</system-reminder>`;

    // Check if we already have this exact reminder to avoid duplicates
    const existingMessages = args.messageList.get.all.db();
    if (hasExistingBrowserReminder(existingMessages, reminderMarkup)) {
      return;
    }

    // Add as a new user message at the end of history to preserve prompt cache
    const reminderMessage = createBrowserReminderMessage(reminderMarkup);
    args.messageList.add(reminderMessage, 'user');
    args.rotateResponseMessageId?.();

    return args.messageList;
  }
}

function createBrowserReminderMessage(reminderMarkup: string): MastraDBMessage {
  const content: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: reminderMarkup }],
    metadata: {
      systemReminder: {
        type: REMINDER_TYPE,
      },
    },
  };

  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    createdAt: new Date(),
  };
}

function hasExistingBrowserReminder(messages: MastraDBMessage[], reminderMarkup: string): boolean {
  for (const msg of messages) {
    if (msg.role !== 'user') continue;

    const metadata = msg.content.metadata;
    if (typeof metadata === 'object' && metadata !== null && 'systemReminder' in metadata) {
      const reminder = (metadata as { systemReminder?: { type?: string } }).systemReminder;
      if (reminder?.type === REMINDER_TYPE) {
        // Check if the content matches (same URL/title)
        const textPart = msg.content.parts?.find((p): p is { type: 'text'; text: string } => p.type === 'text');
        if (textPart?.text === reminderMarkup) {
          return true;
        }
      }
    }
  }
  return false;
}

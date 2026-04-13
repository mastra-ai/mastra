/**
 * BrowserContextProcessor
 *
 * Input processor that injects browser context into agent prompts.
 * Similar to ChatChannelProcessor for channels.
 *
 * - `processInput`: Adds a system message with stable context (provider, sessionId, headless mode).
 * - `processInputStep`: At step 0, prepends a `<system-reminder>` to the user's message
 *   with per-request data (current URL, page title).
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
  ProcessInputArgs,
  ProcessInputResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '../processors/index';

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

  /** Whether browser is currently running */
  isRunning?: boolean;
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

  processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult | undefined {
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

    if (ctx.isRunning === false) {
      parts.push('Browser is not currently running.');
    }

    if (parts.length === 0) return;

    const reminder = `<system-reminder>${parts.join(' | ')}</system-reminder>\n\n`;

    // Prepend reminder to the last user message's text parts
    const messages = [...args.messages];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      if (msg.role === 'user') {
        const content = msg.content;
        // MastraMessageContentV2: { format: 2, parts: [...] }
        const existingParts = content.parts ?? [];
        const firstTextIdx = existingParts.findIndex((p: { type: string }) => p.type === 'text');

        if (firstTextIdx >= 0) {
          const textPart = existingParts[firstTextIdx] as { type: 'text'; text: string };
          const newParts = [...existingParts];
          newParts[firstTextIdx] = { ...textPart, text: reminder + textPart.text };
          messages[i] = { ...msg, content: { ...content, parts: newParts } };
        } else {
          messages[i] = {
            ...msg,
            content: {
              ...content,
              parts: [{ type: 'text' as const, text: reminder }, ...existingParts],
            },
          };
        }
        break;
      }
    }

    return { messages };
  }
}

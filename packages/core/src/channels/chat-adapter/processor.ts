import type {
  ProcessInputArgs,
  ProcessInputResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '../../processors/index';
import type { ChannelContext } from '../types';

/**
 * Input processor that injects channel context into agent prompts.
 *
 * - `processInput`: Adds a system message with stable context (platform, isDM, userName).
 * - `processInputStep`: At step 0, prepends a `<system-reminder>` to the user's message
 *   with per-request data (messageId, eventType).
 *
 * Designed for use with `ChatAdapterChannel`. Reads from `requestContext.get('channel')`.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   inputProcessors: [new ChatChannelProcessor()],
 *   channels: {
 *     discord: new DiscordAdapter({ ... }),
 *   },
 * });
 * ```
 */
export class ChatChannelProcessor {
  readonly id = 'chat-channel-context';

  processInput(args: ProcessInputArgs): ProcessInputResult {
    const ctx = args.requestContext?.get('channel') as ChannelContext | undefined;
    if (!ctx) return args.messageList;

    const lines = [`You are communicating via ${ctx.platform}.`];

    if (ctx.isDM) {
      lines.push('This is a direct message (DM) conversation.');
    } else {
      lines.push('This message is in a public channel or thread.');
    }

    if (ctx.userName) {
      lines.push(`The user you are talking to is "${ctx.userName}".`);
    }

    if (ctx.channelId) {
      lines.push(`Channel ID: ${ctx.channelId}`);
    }

    if (ctx.threadId) {
      lines.push(`Thread ID: ${ctx.threadId}`);
    }

    const systemMessages = [...args.systemMessages, { role: 'system' as const, content: lines.join(' ') }];

    return { messages: args.messages, systemMessages };
  }

  processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    // Only inject per-request context at the first step
    if (args.stepNumber !== 0) return;

    const ctx = args.requestContext?.get('channel') as ChannelContext | undefined;
    if (!ctx) return;

    const parts: string[] = [];

    if (ctx.messageId) {
      parts.push(`Message ID: ${ctx.messageId}`);
    }

    if (ctx.eventType) {
      parts.push(`Event: ${ctx.eventType}`);
    }

    if (parts.length === 0) return;

    const reminder = `<system-reminder>${parts.join(' | ')}</system-reminder>\n\n`;

    // Prepend reminder to the last user message's text parts
    const messages = [...args.messages];

    // Find and modify the last user message
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
          // No text part — add one at the beginning
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

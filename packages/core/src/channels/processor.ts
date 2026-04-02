import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';

import type { ProcessInputStepArgs, ProcessInputStepResult } from '../processors/index';
import type { ChannelContext } from './types';

/**
 * Input processor that injects channel context into agent prompts.
 *
 * Uses `processInputStep` to add a system message on every step of the agentic loop.
 * Since system messages are reset between steps, injecting on every step ensures the
 * context is stable and prompt-cacheable.
 *
 * All output rendering (tool cards, text messages, approval prompts) is handled by
 * `AgentChannels.consumeAgentStream` which iterates the outer `fullStream`.
 */
export class ChatChannelProcessor {
  readonly id = 'chat-channel-context';

  processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    const ctx = args.requestContext?.get('channel') as ChannelContext | undefined;
    if (!ctx) return undefined;

    const lines = [`You are communicating via ${ctx.platform}.`];

    // Tell the LLM its own identity so it can recognise self-mentions in raw message text
    if (ctx.botUserName || ctx.botMention) {
      const parts: string[] = [];
      if (ctx.botUserName) parts.push(`"${ctx.botUserName}"`);
      if (ctx.botMention) parts.push(ctx.botMention);
      lines.push(
        `Your identity on this platform is ${parts.join(' / ')}. Messages containing these references are directed at you.`,
      );
    }

    if (ctx.isDM) {
      lines.push('This is a direct message (DM) conversation.');
      if (ctx.userName || ctx.userId) {
        const identity: string[] = [];
        if (ctx.userName) identity.push(`name: "${ctx.userName}"`);
        if (ctx.userId) identity.push(`ID: ${ctx.userId}`);
        lines.push(`You are talking to a user (${identity.join(', ')}).`);
      }
    } else if (ctx.eventType === 'mention') {
      lines.push('You were mentioned in this message. Respond to the user.');
    } else {
      // Subscribed thread — the bot is passively listening
      lines.push(
        'This message is in a public channel or thread you are monitoring.',
        'Not every message is directed at you. If users appear to be talking to each other, stay silent unless you are explicitly mentioned or your input is clearly needed. To stay silent, respond with an empty message.',
      );
    }

    const systemMessage: CoreMessageV4 = { role: 'system', content: lines.join('\n') };
    return { systemMessages: [...args.systemMessages, systemMessage] };
  }
}

import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';

import type { MessageList } from '../agent/message-list/index';
import type { ProcessInputStepArgs } from '../processors/index';
import type { ChannelContext } from './types';

/**
 * Input processor that injects channel context (platform, bot identity, DM vs.
 * public-channel guidance) into the agent's system prompt on every step.
 *
 * Added automatically by `AgentChannels` unless you provide your own input
 * processor with `id === 'chat-channel-context'`. Output rendering (tool cards,
 * text messages, approval prompts) is handled separately by
 * `AgentChannels.consumeAgentStream`.
 */
export class ChatChannelProcessor {
  readonly id = 'chat-channel-context';

  processInputStep({ messageList, requestContext }: ProcessInputStepArgs): { messageList: MessageList } | undefined {
    const ctx = requestContext?.get('channel') as ChannelContext | undefined;
    if (!ctx) return undefined;

    // Stable system message — same across all messages for this platform/bot combo.
    // This is prompt-cacheable since it doesn't change per turn.
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
    } else {
      // Non-DM: include the stay-silent guidance for subscribed threads.
      // For mentions, the <system-reminder> on the user message will override this.
      lines.push(
        'You are in a public channel or thread. Not every message is directed at you.',
        'Only respond with text when you are explicitly mentioned, replied to, or your input is clearly needed (e.g. a direct question to you, or a task you were asked to do).',
        'If users appear to be talking to each other, showing your previous output to a third party, reacting to your output, or having a side conversation, stay silent. Staying silent is the correct and preferred action — it is not rude or unhelpful.',
        'To stay silent, respond with an empty message. Do NOT narrate the situation. Do NOT write bracketed status notes like "[no response needed]" or "[empty message — user is showing the report to someone else]". Do NOT acknowledge with text like "Got it" or "Noted". Do NOT apologize for staying quiet. An empty response is a first-class action, not a fallback.',
        'If you want to acknowledge a message without speaking, use the `add_reaction` tool to react with an emoji instead of replying with text.',
      );
    }

    const systemMessage: CoreMessageV4 = { role: 'system', content: lines.join('\n') };
    messageList.addSystem(systemMessage, this.id);
    return { messageList };
  }
}

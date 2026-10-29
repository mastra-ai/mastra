import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';

import type { MessageList } from '../agent/message-list/index';
import { parseMemoryRequestContext } from '../memory/types';
import type { ProcessInputStepArgs } from '../processors/index';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import type { ChatChannelRenderContext } from './output-processor';
import type { ChannelContext } from './types';

/** Rebuilds a channel-backed thread's channel context; `AgentChannels` provides it. */
interface ChannelThreadResolver {
  buildChannelContextForThread(
    threadId: string,
  ): Promise<{ channel: ChannelContext; render: ChatChannelRenderContext } | null>;
}

type ResolvedChannel = { channel: ChannelContext; textHidden: boolean };

/**
 * Input processor that injects channel context (platform, bot identity, DM vs.
 * public-channel guidance) into the agent's system prompt on every step.
 *
 * Every run on a channel-backed thread gets the same system message, whether
 * it came in over the channel or not (a schedule, a Studio prompt, a signal
 * waking the agent). Messages that came in over the channel carry a `platform`
 * attribute, which is how the model tells them apart, so the prompt never has
 * to change and stays cached when a thread switches between the two.
 *
 * Added automatically by `AgentChannels` unless you provide your own input
 * processor with `id === 'chat-channel-context'`. Output rendering (tool cards,
 * text messages, approval prompts) is handled separately by
 * `AgentChannels.consumeAgentStream`.
 */
export class ChatChannelProcessor {
  readonly id = 'chat-channel-context';
  readonly #channels?: ChannelThreadResolver;

  constructor(channels?: ChannelThreadResolver) {
    this.#channels = channels;
  }

  async processInputStep({
    messageList,
    requestContext,
    tools,
    state,
  }: ProcessInputStepArgs): Promise<{ messageList: MessageList } | undefined> {
    const resolved = await this.#resolve(requestContext, state);
    if (!resolved) return undefined;

    // Stable system message — same across all steps and runs of a thread, so it is prompt-cacheable.
    const lines = channelLines(resolved.channel, resolved.textHidden, tools);
    const systemMessage: CoreMessageV4 = { role: 'system', content: lines.join('\n') };
    messageList.addSystem(systemMessage, this.id);
    return { messageList };
  }

  async #resolve(
    requestContext: ProcessInputStepArgs['requestContext'],
    state: Record<string, unknown> | undefined,
  ): Promise<ResolvedChannel | undefined> {
    const channel = requestContext?.get('channel') as ChannelContext | undefined;
    if (channel) {
      const render = requestContext?.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
      return { channel, textHidden: render?.textDisplay === 'hidden' };
    }

    // Resolved once per run; `null` remembers a thread that isn't channel-backed.
    if (state && 'thread' in state) return (state.thread as ResolvedChannel | null) ?? undefined;
    const threadId = parseMemoryRequestContext(requestContext)?.thread?.id;
    const found = threadId && this.#channels ? await this.#channels.buildChannelContextForThread(threadId) : null;
    const resolved = found ? { channel: found.channel, textHidden: found.render.textDisplay === 'hidden' } : null;
    if (state) state.thread = resolved;
    return resolved ?? undefined;
  }
}

function channelLines(ctx: ChannelContext, textHidden: boolean, tools: Record<string, unknown> | undefined): string[] {
  const lines = [`This conversation is connected to a ${ctx.platform} ${ctx.isDM ? 'direct message' : 'thread'}.`];

  // Tell the LLM its own identity so it can recognise self-mentions in raw message text
  if (ctx.botUserName || ctx.botDisplayName || ctx.botMention) {
    const parts: string[] = [];
    if (ctx.botUserName) parts.push(`"${ctx.botUserName}"`);
    if (ctx.botDisplayName && ctx.botDisplayName !== ctx.botUserName) parts.push(`"${ctx.botDisplayName}"`);
    if (ctx.botMention) parts.push(ctx.botMention);
    lines.push(
      `Your identity on this platform is ${parts.join(' / ')}. Messages containing these references are directed at you.`,
    );
  }

  if (textHidden) {
    lines.push(
      'Your text replies are not posted to this conversation. People there only see what you post with the tools you are given.',
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
    return lines;
  }

  // Non-DM: include the stay-silent guidance for subscribed threads.
  // For mentions, the <system-reminder> on the user message will override this.
  lines.push(
    'You are in a public channel or thread. Not every message is directed at you.',
    `Only ${textHidden ? 'post' : 'respond with text'} when you are explicitly mentioned, replied to, or your input is clearly needed (e.g. a direct question to you, or a task you were asked to do).`,
    'If users appear to be talking to each other, showing your previous output to a third party, reacting to your output, or having a side conversation, stay silent. Staying silent is the correct and preferred action — it is not rude or unhelpful.',
    textHidden
      ? 'To stay silent, post nothing. Do NOT post acknowledgements like "Got it" or "Noted", or apologies for staying quiet.'
      : 'To stay silent, respond with an empty message. Do NOT narrate the situation. Do NOT write bracketed status notes like "[no response needed]" or "[empty message — user is showing the report to someone else]". Do NOT acknowledge with text like "Got it" or "Noted". Do NOT apologize for staying quiet. An empty response is a first-class action, not a fallback.',
  );
  // Only point at the reaction tool when the agent actually has it;
  // otherwise models call a tool that doesn't exist.
  if (tools && 'add_reaction' in tools) {
    lines.push(
      `If you want to acknowledge a message without ${textHidden ? 'posting' : 'speaking'}, use the \`add_reaction\` tool to react with an emoji instead of replying with text.`,
    );
  }
  return lines;
}

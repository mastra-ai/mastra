import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import { describe, it, expect, vi } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { ProcessInputStepArgs } from '../processors/index';
import { RequestContext } from '../request-context';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import { ChatChannelProcessor } from './processor';
import type { ChannelContext } from './types';

function createArgs(opts: {
  channel?: ChannelContext;
  messageList?: MessageList;
  systemMessages?: CoreMessageV4[];
  tools?: Record<string, unknown>;
}): ProcessInputStepArgs {
  const requestContext = new RequestContext();
  if (opts.channel) {
    requestContext.set('channel', opts.channel);
  }

  const messageList = opts.messageList ?? new MessageList({});

  return {
    messageList,
    messages: [],
    requestContext,
    stepNumber: 0,
    steps: [],
    systemMessages: opts.systemMessages ?? [],
    tools: opts.tools,
    state: {},
    retryCount: 0,
    model: {} as any,
    abort: (() => {
      throw new Error('abort');
    }) as any,
  } as unknown as ProcessInputStepArgs;
}

describe('ChatChannelProcessor', () => {
  it('returns undefined when no channel context is set', async () => {
    const processor = new ChatChannelProcessor();
    const result = await processor.processInputStep(createArgs({}));
    expect(result).toBeUndefined();
  });

  it('preserves tagged system messages added by other processors', async () => {
    // Simulate ObservationalMemory (or any other processor) having added a
    // tagged system message to the messageList before ChatChannelProcessor runs.
    const messageList = new MessageList({});
    messageList.addSystem({ role: 'system', content: 'observational memory: user prefers dark mode' }, 'om');
    messageList.addSystem({ role: 'system', content: 'agent base instructions' }, 'instructions');

    const processor = new ChatChannelProcessor();
    const args = createArgs({
      channel: { platform: 'slack', isDM: true, userName: 'caleb' } as ChannelContext,
      messageList,
      // args.systemMessages exposes only the untagged bucket; tagged messages
      // owned by other processors remain accessible via messageList.
      systemMessages: messageList.getSystemMessages(),
    });

    await processor.processInputStep(args);

    // The tagged messages must still be retrievable by tag after processing.
    const omAfter = args.messageList.getSystemMessages('om');
    expect(omAfter).toHaveLength(1);
    expect(omAfter[0]!.content).toBe('observational memory: user prefers dark mode');

    const instructionsAfter = args.messageList.getSystemMessages('instructions');
    expect(instructionsAfter).toHaveLength(1);
    expect(instructionsAfter[0]!.content).toBe('agent base instructions');

    // And the channel system message must be present under its own tag.
    const channelAfter = args.messageList.getSystemMessages('chat-channel-context');
    expect(channelAfter).toHaveLength(1);
    expect(channelAfter[0]!.content).toContain('communicating via slack');
  });

  it('does not re-add a duplicate channel system message across steps', async () => {
    const messageList = new MessageList({});
    const processor = new ChatChannelProcessor();
    const channel: ChannelContext = { platform: 'slack', isDM: true, userName: 'caleb' } as ChannelContext;

    // Step 1
    const args1 = createArgs({ channel, messageList, systemMessages: messageList.getSystemMessages() });
    await processor.processInputStep(args1);

    // Step 2 — same channel context, system messages list is re-derived
    const args2 = createArgs({ channel, messageList, systemMessages: messageList.getSystemMessages() });
    await processor.processInputStep(args2);

    const channelMessages = messageList.getSystemMessages('chat-channel-context');
    expect(channelMessages).toHaveLength(1);
    expect(channelMessages[0]!.content).toContain('communicating via slack');
  });

  describe('bot identity', () => {
    async function identityLine(channel: Partial<ChannelContext>): Promise<string | undefined> {
      const args = createArgs({ channel: { platform: 'slack', isDM: false, ...channel } as ChannelContext });
      await new ChatChannelProcessor().processInputStep(args);
      const content = String(args.messageList.getSystemMessages('chat-channel-context')[0]!.content);
      return content.split('\n').find(line => line.startsWith('Your identity'));
    }

    it('lists the original username, current display name, and mention', async () => {
      expect(await identityLine({ botUserName: 'acme-bot', botDisplayName: 'helper', botMention: '<@UBOT>' })).toBe(
        'Your identity on this platform is "acme-bot" / "helper" / <@UBOT>. Messages containing these references are directed at you.',
      );
    });

    it('keeps the existing line when no display name is set', async () => {
      expect(await identityLine({ botUserName: 'acme-bot', botMention: '<@UBOT>' })).toBe(
        'Your identity on this platform is "acme-bot" / <@UBOT>. Messages containing these references are directed at you.',
      );
    });

    it('uses the display name when no username is set', async () => {
      expect(await identityLine({ botDisplayName: 'helper', botMention: '<@UBOT>' })).toBe(
        'Your identity on this platform is "helper" / <@UBOT>. Messages containing these references are directed at you.',
      );
    });
  });

  describe('reaction guidance', () => {
    async function channelPrompt(tools?: Record<string, unknown>): Promise<string> {
      const args = createArgs({ channel: { platform: 'slack', isDM: false } as ChannelContext, tools });
      await new ChatChannelProcessor().processInputStep(args);
      return String(args.messageList.getSystemMessages('chat-channel-context')[0]!.content);
    }

    it('points at add_reaction when the agent has it', async () => {
      expect(await channelPrompt({ add_reaction: {} })).toContain('use the `add_reaction` tool');
    });

    it('does not mention add_reaction when the agent lacks it', async () => {
      expect(await channelPrompt({ other_tool: {} })).not.toContain('add_reaction');
      expect(await channelPrompt()).not.toContain('add_reaction');
      expect(await channelPrompt()).toContain('To stay silent, respond with an empty message.');
    });
  });

  describe('with reply text hidden', () => {
    it('tells an inbound run that only what it posts with tools is seen, and to stay silent by posting nothing', async () => {
      const args = createArgs({ channel: { platform: 'slack', isDM: false } as ChannelContext });
      args.requestContext!.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { textDisplay: 'hidden' });
      await new ChatChannelProcessor().processInputStep(args);
      const prompt = String(args.messageList.getSystemMessages('chat-channel-context')[0]!.content);

      expect(prompt).toContain('Your text replies are not posted to this conversation.');
      expect(prompt).toContain('Only post when you are explicitly mentioned');
      expect(prompt).toContain('To stay silent, post nothing.');
      expect(prompt).not.toContain('empty message');
    });
  });

  describe('a run on a channel-backed thread that did not start from a message', () => {
    function linkedArgs(state: Record<string, unknown> = {}) {
      const args = createArgs({});
      args.requestContext!.set('MastraMemory', { thread: { id: 'thread-1' } });
      return { ...args, state } as ProcessInputStepArgs;
    }
    const render = (textDisplay: 'show' | 'hidden') =>
      ({
        platform: 'slack',
        textDisplay,
        adapter: { userName: 'shipyard', botUserId: 'UBOT' },
        chatThread: { isDM: false, mentionUser: (id: string) => `<@${id}>` },
      }) as never;

    it('says where its replies go when they are hidden', async () => {
      const args = linkedArgs();
      await new ChatChannelProcessor({ buildRenderContextForThread: async () => render('hidden') }).processInputStep(
        args,
      );
      const prompt = String(args.messageList.getSystemMessages('chat-channel-context')[0]!.content);

      expect(prompt).toBe(
        [
          'This conversation is linked to a slack thread, but this run did not start from a message there.',
          'Your identity on slack is "shipyard" / <@UBOT>.',
          'Your text replies are not posted there. People in that slack conversation only see what you post with the tools you are given, so post when they would want to know, like the result of work they asked for.',
        ].join('\n'),
      );
    });

    it('looks the thread up once per run, and adds nothing for a thread with no channel', async () => {
      const lookup = vi.fn(async () => null);
      const processor = new ChatChannelProcessor({ buildRenderContextForThread: lookup });
      const state = {};

      expect(await processor.processInputStep(linkedArgs(state))).toBeUndefined();
      expect(await processor.processInputStep(linkedArgs(state))).toBeUndefined();
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(lookup).toHaveBeenCalledWith('thread-1');
    });
  });
});

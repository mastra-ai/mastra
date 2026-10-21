import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { markNewChannelSession } from './channel-session-link-processor.js';
import { createChannelReactionTools, createReplyTool, REPLY_TOOL_NAME } from './reply-tool.js';

type ReplyTool = {
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
  execute: (input: { text?: string; staySilent?: true }, ctx: Record<string, unknown>) => Promise<unknown>;
};

function channelRun({ textDisplay = 'hidden' as 'hidden' | 'show' | null, post = vi.fn(async () => ({})) } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'slack', isDM: false });
  requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, {
    platform: 'slack',
    ...(textDisplay ? { textDisplay } : {}),
    chatThread: { post },
  });
  requestContext.set('controller', {
    threadId: 'thread-1',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    getState: () => ({ factoryProjectId: 'factory-1' }),
  });
  return { requestContext, post };
}

async function replyTool(requestContext: RequestContext): Promise<ReplyTool> {
  const tool = (await createReplyTool(requestContext))[REPLY_TOOL_NAME];
  expect(tool).toBeDefined();
  return tool as unknown as ReplyTool;
}

describe('reply_in_thread', () => {
  const originalPublicUrl = process.env.MASTRACODE_PUBLIC_URL;
  beforeEach(() => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
  });
  afterEach(() => {
    if (originalPublicUrl === undefined) delete process.env.MASTRACODE_PUBLIC_URL;
    else process.env.MASTRACODE_PUBLIC_URL = originalPublicUrl;
  });

  it('is offered only when the thread hides reply text, so a shown reply is never posted twice', async () => {
    await expect(createReplyTool(channelRun({ textDisplay: 'show' }).requestContext)).resolves.toEqual({});
    await expect(createReplyTool(channelRun({ textDisplay: null }).requestContext)).resolves.toEqual({});
    await expect(createReplyTool(new RequestContext())).resolves.toEqual({});
  });

  it('posts the text into the thread the run came from', async () => {
    const { requestContext, post } = channelRun();
    const tool = await replyTool(requestContext);

    await expect(tool.execute({ text: 'On it — running the tests.' }, {})).resolves.toEqual({ posted: true });

    expect(post).toHaveBeenCalledWith({ markdown: 'On it — running the tests.' });
  });

  it('stays silent on purpose without posting', async () => {
    const { requestContext, post } = channelRun();
    const tool = await replyTool(requestContext);

    await expect(tool.execute({ staySilent: true }, {})).resolves.toEqual({ posted: false });

    expect(post).not.toHaveBeenCalled();
  });

  it('takes exactly one of text or staySilent', async () => {
    const tool = await replyTool(channelRun().requestContext);

    expect(tool.inputSchema.safeParse({ text: 'hi' }).success).toBe(true);
    expect(tool.inputSchema.safeParse({ staySilent: true }).success).toBe(true);
    expect(tool.inputSchema.safeParse({}).success).toBe(false);
    expect(tool.inputSchema.safeParse({ text: '   ' }).success).toBe(false);
    expect(tool.inputSchema.safeParse({ text: 'hi', staySilent: true }).success).toBe(false);
  });

  it('ends the first reply of a new session with the session link, and only the first', async () => {
    const { requestContext, post } = channelRun();
    markNewChannelSession(requestContext);
    const tool = await replyTool(requestContext);

    await tool.execute({ text: 'On it.' }, {});
    await tool.execute({ text: 'Done.' }, {});

    expect(post).toHaveBeenNthCalledWith(1, {
      markdown:
        'On it.\n\n[Open session ↗](https://mc.example.com/factories/factory-1/workspaces/session-1/threads/thread-1)',
    });
    expect(post).toHaveBeenNthCalledWith(2, { markdown: 'Done.' });
  });

  it('keeps the session link for the retry when the first post fails', async () => {
    const post = vi.fn().mockRejectedValueOnce(new Error('rate_limited')).mockResolvedValue({});
    const { requestContext } = channelRun({ post });
    markNewChannelSession(requestContext);
    const tool = await replyTool(requestContext);

    await expect(tool.execute({ text: 'On it.' }, {})).rejects.toThrow('rate_limited');
    await tool.execute({ text: 'On it.' }, {});

    expect(post).toHaveBeenLastCalledWith({
      markdown:
        'On it.\n\n[Open session ↗](https://mc.example.com/factories/factory-1/workspaces/session-1/threads/thread-1)',
    });
  });

  it('leaves the link off follow-ups in an existing session', async () => {
    const { requestContext, post } = channelRun();
    const tool = await replyTool(requestContext);

    await tool.execute({ text: 'Done.' }, {});

    expect(post).toHaveBeenCalledWith({ markdown: 'Done.' });
  });

  it('posts into a Slack session thread on a run with no inbound message, like a web prompt or a woken run', async () => {
    const post = vi.fn(async () => ({}));
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'thread-1', sessionId: 'session-1', resourceId: 'resource-1' });
    const buildRenderContextForThread = vi.fn(async (threadId: string) =>
      threadId === 'thread-1' ? { platform: 'slack', textDisplay: 'hidden', chatThread: { post } } : null,
    );
    const tool = (
      await createReplyTool(requestContext, { channels: () => ({ buildRenderContextForThread }) as never })
    )[REPLY_TOOL_NAME] as unknown as ReplyTool;

    await tool.execute({ text: 'The build finished: all green.' }, {});

    expect(post).toHaveBeenCalledWith({ markdown: 'The build finished: all green.' });
  });
});

describe('channel reactions', () => {
  type ReactionTools = Record<string, { execute: (input: unknown, ctx: unknown) => Promise<unknown> }>;
  const adapter = () => ({ addReaction: vi.fn(async () => {}), removeReaction: vi.fn(async () => {}) });

  it('reacts in the thread an inbound message came from', async () => {
    const slack = adapter();
    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, {
      platform: 'slack',
      adapter: slack,
      chatThread: { id: 'slack:C1:171.1' },
    });
    const tools = (await createChannelReactionTools(requestContext)) as ReactionTools;

    expect(Object.keys(tools).sort()).toEqual(['add_reaction', 'remove_reaction']);
    await tools.add_reaction!.execute({ messageId: '171.2', emoji: 'eyes' }, {});
    await tools.remove_reaction!.execute({ messageId: '171.2', emoji: 'eyes' }, {});
    expect(slack.addReaction).toHaveBeenCalledWith('slack:C1:171.1', '171.2', 'eyes');
    expect(slack.removeReaction).toHaveBeenCalledWith('slack:C1:171.1', '171.2', 'eyes');
  });

  it('reacts in a Slack session thread on a run with no inbound message, like a web prompt or a woken run', async () => {
    const slack = adapter();
    const buildRenderContextForThread = vi.fn(async (threadId: string) =>
      threadId === 'thread-1' ? { platform: 'slack', adapter: slack, chatThread: { id: 'slack:C1:171.1' } } : null,
    );
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'thread-1', sessionId: 'session-1', resourceId: 'resource-1' });
    const tools = (await createChannelReactionTools(requestContext, {
      channels: () => ({ buildRenderContextForThread }) as never,
    })) as ReactionTools;

    await tools.add_reaction!.execute({ messageId: '171.5', emoji: 'white_check_mark' }, {});
    expect(slack.addReaction).toHaveBeenCalledWith('slack:C1:171.1', '171.5', 'white_check_mark');
  });

  it('offers none when the session thread is not in a chat channel', async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'fork-1', sessionId: 'session-1', resourceId: 'resource-1' });
    const channels = () => ({ buildRenderContextForThread: async () => null }) as never;
    await expect(createChannelReactionTools(requestContext, { channels })).resolves.toEqual({});
    await expect(createChannelReactionTools(new RequestContext())).resolves.toEqual({});
  });
});

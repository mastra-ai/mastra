import { AgentControllerChannels, CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
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

  it('leaves the link off follow-ups in an existing session', async () => {
    const { requestContext, post } = channelRun();
    const tool = await replyTool(requestContext);

    await tool.execute({ text: 'Done.' }, {});

    expect(post).toHaveBeenCalledWith({ markdown: 'Done.' });
  });
});

describe('channel reactions', () => {
  function channels() {
    const adapter = { addReaction: vi.fn(async () => {}), removeReaction: vi.fn(async () => {}) };
    return { adapter, channels: new AgentControllerChannels({ adapters: { slack: { adapter } as any } }) };
  }

  it('reacts in the thread the message came from', async () => {
    const { adapter, channels: attached } = channels();
    const requestContext = new RequestContext();
    requestContext.set('channel', { platform: 'slack', isDM: false, threadId: 'slack:C1:171.1' });
    const tools = createChannelReactionTools(requestContext, attached) as Record<
      string,
      { execute: (input: unknown, ctx: unknown) => Promise<unknown> }
    >;

    expect(Object.keys(tools).sort()).toEqual(['add_reaction', 'remove_reaction']);
    await tools.add_reaction!.execute({ messageId: '171.2', emoji: 'eyes' }, { requestContext });
    expect(adapter.addReaction).toHaveBeenCalledWith('slack:C1:171.1', '171.2', 'eyes');
  });

  it('offers none to a run with no inbound message to react to', () => {
    expect(createChannelReactionTools(new RequestContext(), channels().channels)).toEqual({});
  });
});

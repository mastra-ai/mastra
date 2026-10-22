import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { markNewChannelSession } from './channel-session-link-processor.js';
import { createReplyTool, FactoryReplyStreamProcessor, partialStringField, REPLY_TOOL_NAME } from './reply-tool.js';

type ReplyTool = {
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
  execute: (input: { text: string }, ctx: Record<string, unknown>) => Promise<unknown>;
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

  it('takes only non-blank text', async () => {
    const tool = await replyTool(channelRun().requestContext);

    expect(tool.inputSchema.safeParse({ text: 'hi' }).success).toBe(true);
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

describe('partialStringField', () => {
  it('decodes a string field that is still being written', () => {
    expect(partialStringField('{"te', 'text')).toBeUndefined();
    expect(partialStringField('{"text": "Hel', 'text')).toBe('Hel');
    expect(partialStringField('{"text":"line\\nnext \\"q\\" \\u00e9', 'text')).toBe('line\nnext "q" é');
    expect(partialStringField('{"text":"done"}', 'text')).toBe('done');
  });

  it('stops before an escape that is cut off', () => {
    expect(partialStringField('{"text":"a\\', 'text')).toBe('a');
    expect(partialStringField('{"text":"a\\u00', 'text')).toBe('a');
  });
});

describe('streaming reply_in_thread into the thread', () => {
  const originalPublicUrl = process.env.MASTRACODE_PUBLIC_URL;
  beforeEach(() => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
  });
  afterEach(() => {
    if (originalPublicUrl === undefined) delete process.env.MASTRACODE_PUBLIC_URL;
    else process.env.MASTRACODE_PUBLIC_URL = originalPublicUrl;
  });

  /** A Slack thread whose post reads a streamed message chunk by chunk, like chat SDK's native streaming. */
  function streamingThread({ fail = false } = {}) {
    const streamed: string[] = [];
    const whole: unknown[] = [];
    const post = vi.fn(async (message: unknown) => {
      if (typeof message === 'object' && message !== null && Symbol.asyncIterator in message) {
        for await (const chunk of message as AsyncIterable<string>) {
          streamed.push(chunk);
          if (fail) throw new Error('stream rejected');
        }
      } else whole.push(message);
      return {};
    });
    return { post, streamed, whole };
  }

  const chunk = (type: string, payload: Record<string, unknown>) =>
    ({ type, runId: 'r', from: 'AGENT', payload }) as any;
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  async function feed(requestContext: RequestContext, argsDeltas: string[]) {
    const processor = new FactoryReplyStreamProcessor();
    const state: Record<string, unknown> = {};
    const run = (part: unknown) => processor.processOutputStream({ part, state, requestContext } as any);
    await run(chunk('tool-call-input-streaming-start', { toolCallId: 'call-1', toolName: REPLY_TOOL_NAME }));
    for (const delta of argsDeltas) {
      await run(chunk('tool-call-delta', { toolCallId: 'call-1', argsTextDelta: delta }));
      await tick();
    }
  }

  it('shows the text while the model writes it, then finishes the same post with the session link', async () => {
    const thread = streamingThread();
    const { requestContext } = channelRun({ post: thread.post });
    markNewChannelSession(requestContext);
    const tool = await replyTool(requestContext);

    await feed(requestContext, ['{"text": "Hello', ' there', ', Caleb', '!"}']);
    // Visible before the tool call completes.
    expect(thread.streamed.join('')).toBe('Hello there, Caleb!');

    await expect(tool.execute({ text: 'Hello there, Caleb!' }, { agent: { toolCallId: 'call-1' } })).resolves.toEqual({
      posted: true,
    });
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.streamed.join('')).toBe(
      'Hello there, Caleb!\n\n[Open session ↗](https://mc.example.com/factories/factory-1/workspaces/session-1/threads/thread-1)',
    );
  });

  it('posts the reply whole when the streamed post fails', async () => {
    const thread = streamingThread({ fail: true });
    const { requestContext } = channelRun({ post: thread.post });
    const tool = await replyTool(requestContext);

    await feed(requestContext, ['{"text": "Hel', 'lo"}']);
    await tool.execute({ text: 'Hello' }, { agent: { toolCallId: 'call-1' } });

    expect(thread.whole).toEqual([{ markdown: 'Hello' }]);
  });

  it('leaves runs whose thread shows reply text alone', async () => {
    const thread = streamingThread();
    const { requestContext } = channelRun({ textDisplay: 'show', post: thread.post });
    await feed(requestContext, ['{"text": "Hello"}']);
    expect(thread.post).not.toHaveBeenCalled();
  });
});

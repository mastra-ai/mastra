import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../request-context';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';

import { ChannelReplyStreamProcessor, createChannelReplyTool, partialStringField, REPLY_TOOL_NAME } from './reply-tool';
import type { ChannelReplyOptions } from './reply-tool';
import { markNewChannelThread } from './thread-link-processor';

const SESSION_URL = '${SESSION_URL}';
const link: ChannelReplyOptions['link'] = { label: 'Open session ↗', link: () => SESSION_URL };

/** Rebuilds the thread from the run's thread id, as a host with an attached controller does. */
function rebuildFrom(
  buildRenderContextForThread: (threadId: string) => Promise<unknown>,
): ChannelReplyOptions['resolveRender'] {
  return async requestContext =>
    (requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as never) ??
    ((await buildRenderContextForThread((requestContext.get('controller') as { threadId: string }).threadId)) as never);
}

/** The thread the run came in on, nothing else. */
const stashed = rebuildFrom(async () => undefined);

type ReplyTool = {
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
  execute: (input: { text: string }, ctx: Record<string, unknown>) => Promise<unknown>;
};

function channelRun({
  textDisplay = 'hidden' as 'hidden' | 'show' | null,
  streaming = true,
  post = vi.fn(async () => ({})),
} = {}) {
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'slack', isDM: false });
  requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, {
    platform: 'slack',
    ...(textDisplay ? { textDisplay } : {}),
    streaming: { enabled: streaming },
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
  const tool = createChannelReplyTool(requestContext, { link, resolveRender: stashed })[REPLY_TOOL_NAME];
  expect(tool).toBeDefined();
  return tool as unknown as ReplyTool;
}

describe('reply_in_thread', () => {
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
    markNewChannelThread(requestContext);
    const tool = await replyTool(requestContext);

    await tool.execute({ text: 'On it.' }, {});
    await tool.execute({ text: 'Done.' }, {});

    expect(post).toHaveBeenNthCalledWith(1, {
      markdown: `On it.\n\n[Open session ↗](${SESSION_URL})`,
    });
    expect(post).toHaveBeenNthCalledWith(2, { markdown: 'Done.' });
  });

  it('keeps the session link for the retry when the first post fails', async () => {
    const post = vi.fn().mockRejectedValueOnce(new Error('rate_limited')).mockResolvedValue({});
    const { requestContext } = channelRun({ post });
    markNewChannelThread(requestContext);
    const tool = await replyTool(requestContext);

    await expect(tool.execute({ text: 'On it.' }, {})).rejects.toThrow('rate_limited');
    await tool.execute({ text: 'On it.' }, {});

    expect(post).toHaveBeenLastCalledWith({
      markdown: `On it.\n\n[Open session ↗](${SESSION_URL})`,
    });
  });

  it('puts the session link on only one of two overlapping first replies', async () => {
    let land!: () => void;
    const post = vi
      .fn()
      .mockImplementationOnce(() => new Promise(resolve => (land = () => resolve({}))))
      .mockResolvedValue({});
    const { requestContext } = channelRun({ post });
    markNewChannelThread(requestContext);
    const tool = await replyTool(requestContext);

    const first = tool.execute({ text: 'On it.' }, {});
    await tool.execute({ text: 'Also checking CI.' }, {});
    land();
    await first;
    await tool.execute({ text: 'Done.' }, {});

    const linked = post.mock.calls.filter(([arg]) => (arg as { markdown: string }).markdown.includes(SESSION_URL));
    expect(linked).toEqual([[{ markdown: `On it.\n\n[Open session ↗](${SESSION_URL})` }]]);
  });

  it('hands the session link to the next reply when an overlapping first reply fails', async () => {
    let fail!: () => void;
    const post = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_, reject) => (fail = () => reject(new Error('rate_limited')))))
      .mockResolvedValue({});
    const { requestContext } = channelRun({ post });
    markNewChannelThread(requestContext);
    const tool = await replyTool(requestContext);

    const first = tool.execute({ text: 'On it.' }, {});
    await tool.execute({ text: 'Also checking CI.' }, {});
    fail();
    await expect(first).rejects.toThrow('rate_limited');
    await tool.execute({ text: 'Done.' }, {});
    await tool.execute({ text: 'Anything else?' }, {});

    expect(post).toHaveBeenNthCalledWith(2, { markdown: 'Also checking CI.' });
    expect(post).toHaveBeenNthCalledWith(3, { markdown: `Done.\n\n[Open session ↗](${SESSION_URL})` });
    expect(post).toHaveBeenNthCalledWith(4, { markdown: 'Anything else?' });
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
    const tool = createChannelReplyTool(requestContext, {
      link,
      resolveRender: rebuildFrom(buildRenderContextForThread),
    })[REPLY_TOOL_NAME] as unknown as ReplyTool;

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

  async function feed(
    requestContext: RequestContext,
    argsDeltas: string[],
    options: Partial<ChannelReplyOptions> = {},
  ) {
    const processor = new ChannelReplyStreamProcessor(options.resolveRender ?? stashed);
    const state: Record<string, unknown> = {};
    const run = (part: unknown) => processor.processOutputStream({ part, state, requestContext } as any);
    await run(chunk('tool-call-input-streaming-start', { toolCallId: 'call-1', toolName: REPLY_TOOL_NAME }));
    for (const delta of argsDeltas) {
      await run(chunk('tool-call-delta', { toolCallId: 'call-1', argsTextDelta: delta }));
      await tick();
    }
    return run;
  }

  it('shows the text while the model writes it, then finishes the same post with the session link', async () => {
    const thread = streamingThread();
    const { requestContext } = channelRun({ post: thread.post });
    markNewChannelThread(requestContext);
    const tool = await replyTool(requestContext);

    await feed(requestContext, ['{"text": "Hello', ' there', ', Caleb', '!"}']);
    // Visible before the tool call completes.
    expect(thread.streamed.join('')).toBe('Hello there, Caleb!');

    await expect(tool.execute({ text: 'Hello there, Caleb!' }, { agent: { toolCallId: 'call-1' } })).resolves.toEqual({
      posted: true,
    });
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.streamed.join('')).toBe(`Hello there, Caleb!\n\n[Open session ↗](${SESSION_URL})`);
  });

  it('streams on a run with no inbound message, like a web prompt or a woken run', async () => {
    const thread = streamingThread();
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'thread-1', sessionId: 'session-1', resourceId: 'resource-1' });
    const buildRenderContextForThread = vi.fn(async (threadId: string) =>
      threadId === 'thread-1'
        ? { platform: 'slack', textDisplay: 'hidden', streaming: { enabled: true }, chatThread: { post: thread.post } }
        : null,
    );
    const options: ChannelReplyOptions = { link, resolveRender: rebuildFrom(buildRenderContextForThread) };
    const tool = createChannelReplyTool(requestContext, options)[REPLY_TOOL_NAME] as unknown as ReplyTool;

    await feed(requestContext, ['{"text": "Build', ' is green"}'], options);
    expect(thread.streamed.join('')).toBe('Build is green');

    await tool.execute({ text: 'Build is green' }, { agent: { toolCallId: 'call-1' } });
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.whole).toEqual([]);
  });

  for (const [ending, chunks] of [
    ['its arguments fail validation', [chunk('tool-error', { toolCallId: 'call-1', toolName: REPLY_TOOL_NAME })]],
    ['the run is aborted', [chunk('abort', {})]],
    ['the run errors', [chunk('error', { error: new Error('boom') })]],
    ['the run ends', [chunk('finish', {})]],
  ] as const) {
    it(`ends a streamed post with what was shown when ${ending} before the tool runs`, async () => {
      const thread = streamingThread();
      const { requestContext } = channelRun({ post: thread.post });

      const run = await feed(requestContext, ['{"text": "Here is the full report: part one']);
      expect(thread.streamed.join('')).toBe('Here is the full report: part one');
      for (const part of chunks) await run(part);

      // The post settles instead of staying open in Slack, and nothing more is added to it.
      await expect(thread.post.mock.results[0]!.value).resolves.toEqual({});
      expect(thread.streamed.join('')).toBe('Here is the full report: part one');
    });
  }

  it('posts the reply whole when the streamed post fails', async () => {
    const thread = streamingThread({ fail: true });
    const { requestContext } = channelRun({ post: thread.post });
    const tool = await replyTool(requestContext);

    await feed(requestContext, ['{"text": "Hel', 'lo"}']);
    await tool.execute({ text: 'Hello' }, { agent: { toolCallId: 'call-1' } });

    expect(thread.whole).toEqual([{ markdown: 'Hello' }]);
  });

  it('posts the reply whole when the adapter does not stream', async () => {
    const thread = streamingThread();
    const { requestContext } = channelRun({ streaming: false, post: thread.post });
    const tool = await replyTool(requestContext);

    await feed(requestContext, ['{"text": "Hel', 'lo"}']);
    expect(thread.post).not.toHaveBeenCalled();
    await tool.execute({ text: 'Hello' }, { agent: { toolCallId: 'call-1' } });

    expect(thread.streamed).toEqual([]);
    expect(thread.whole).toEqual([{ markdown: 'Hello' }]);
  });

  it('leaves runs whose thread shows reply text alone', async () => {
    const thread = streamingThread();
    const { requestContext } = channelRun({ textDisplay: 'show', post: thread.post });
    await feed(requestContext, ['{"text": "Hello"}']);
    expect(thread.post).not.toHaveBeenCalled();
  });
});

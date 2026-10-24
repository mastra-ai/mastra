import type http from 'node:http';

import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { RequestContext } from '../../request-context';
import { AgentChannels } from '../agent-channels';
import { getChatModule } from '../chat-lazy';
import { ChatChannelOutputProcessor, CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';

// A real Agent talks to a real `@ai-sdk/anthropic` provider, which streams
// from AIMock. AIMock's built-in Claude fixtures only emit one text block per
// response, so the web-search reply is served from a mount with the event
// sequence Anthropic sends: a server-side web_search call, its results, then
// one text block per cited span.

type AnthropicEvent = Record<string, unknown>;

function textBlock(index: number, text: string, citation?: { url: string; title: string }): AnthropicEvent[] {
  const events: AnthropicEvent[] = [
    {
      type: 'content_block_start',
      index,
      content_block: citation ? { type: 'text', text: '', citations: [] } : { type: 'text', text: '' },
    },
  ];
  if (citation) {
    events.push({
      type: 'content_block_delta',
      index,
      delta: {
        type: 'citations_delta',
        citation: { type: 'web_search_result_location', cited_text: text, encrypted_index: 'idx', ...citation },
      },
    });
  }
  events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } });
  events.push({ type: 'content_block_stop', index });
  return events;
}

function message(blocks: AnthropicEvent[], stopReason = 'end_turn'): AnthropicEvent[] {
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'claude-test',
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    },
    ...blocks,
    { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 20 } },
    { type: 'message_stop' },
  ];
}

const source = { url: 'https://mastra.ai', title: 'Mastra' };

const webSearchReply = message([
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'input_json_delta', partial_json: '{"query":"what is mastra"}' },
  },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'content_block_start',
    index: 1,
    content_block: {
      type: 'web_search_tool_result',
      tool_use_id: 'srvtoolu_1',
      content: [{ type: 'web_search_result', encrypted_content: 'enc', page_age: null, ...source }],
    },
  },
  { type: 'content_block_stop', index: 1 },
  ...textBlock(2, 'Mastra is '),
  ...textBlock(3, 'a TypeScript framework for building AI agents', source),
  ...textBlock(4, ', with '),
  ...textBlock(5, 'workflows, memory and evals', source),
  ...textBlock(6, '.'),
]);

// Two text blocks with no whitespace between them. Channels must join them the
// same way the agent's own `text` does, not invent a separator.
const unseparatedReply = message([...textBlock(0, 'Done.'), ...textBlock(1, 'Next step')]);

// Text, then a channel-owned tool that acts on the conversation. The reply
// must be posted before the reaction lands.
const reactionReply = message(
  [
    ...textBlock(0, 'Checking that.'),
    {
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'toolu_1', name: 'add_reaction', input: {} },
    },
    {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '{"messageId":"u1","emoji":"eyes"}' },
    },
    { type: 'content_block_stop', index: 1 },
  ],
  'tool_use',
);

const replies: Record<string, AnthropicEvent[]> = {
  'web-search': webSearchReply,
  unseparated: unseparatedReply,
  reaction: reactionReply,
};

function createRecording() {
  const posts: unknown[] = [];
  let nextMessageId = 1;
  const adapter: any = {
    name: 'test',
    postMessage: vi.fn().mockResolvedValue({ id: 'fallback', text: '' }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok')),
    initialize: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn().mockResolvedValue([]),
    encodeThreadId: vi.fn((...parts: string[]) => parts.join(':')),
    decodeThreadId: vi.fn((id: string) => id.split(':')),
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((t: string) => t),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  };
  const chatThread: any = {
    id: 'test:c1:t1',
    channelId: 'test:c1',
    isDM: false,
    post: vi.fn(async (content: unknown) => {
      posts.push(content);
      return { id: `m${nextMessageId++}`, text: typeof content === 'string' ? content : '' };
    }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  };
  return { posts, adapter, chatThread };
}

// Static posts are `{ markdown }`; streaming posts are a plan whose stream
// yields the text pieces. Reduce both to the text the user sees per message,
// skipping tool cards (static mode posts one for the web_search call).
async function postedTexts(posts: unknown[]): Promise<string[]> {
  const texts: string[] = [];
  for (const post of posts as any[]) {
    if (post?.type === 'card') continue;
    if (post?.stream) {
      let text = '';
      for await (const piece of post.stream as AsyncIterable<unknown>) {
        if (typeof piece === 'string') text += piece;
      }
      texts.push(text);
    } else {
      texts.push(post.markdown ?? post);
    }
  }
  return texts;
}

describe.each([
  { label: 'static (default for all adapters)', adapterOptions: { streaming: false } },
  { label: "streaming with toolDisplay 'hidden'", adapterOptions: { streaming: true, toolDisplay: 'hidden' } },
])('channel replies with multiple text blocks per step: $label', ({ adapterOptions }) => {
  let llm: LLMock;
  let baseURL: string;

  beforeAll(async () => {
    await getChatModule();
    llm = new LLMock({ port: 0 });
    llm.mount('/anthropic', {
      async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        let body = '';
        for await (const chunk of req) body += chunk;
        const prompt = JSON.stringify(JSON.parse(body).messages);
        const reply = prompt.includes('tool_result')
          ? message([])
          : replies[Object.keys(replies).find(key => prompt.includes(key))!]!;
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        for (const event of reply) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        res.end();
        return true;
      },
    });
    await llm.start();
    baseURL = `${llm.url.replace(/\/+$/, '')}/anthropic/v1`;
  });

  afterAll(async () => {
    await llm.stop();
  });

  async function runReply(prompt: string, recording = createRecording()) {
    const channels = new AgentChannels({
      adapters: { test: { adapter: recording.adapter, ...adapterOptions } as any },
    });
    const anthropic = createAnthropic({ apiKey: 'aimock-test-key', baseURL });
    const agent = new Agent({
      id: 'channel-text-blocks-agent',
      name: 'channel-text-blocks-agent',
      instructions: 'Answer with citations.',
      model: anthropic('claude-test'),
      tools: { web_search: anthropic.tools.webSearch_20250305(), ...(channels.getTools() as any) },
      outputProcessors: [new ChatChannelOutputProcessor(channels)],
    });

    const requestContext = new RequestContext();
    requestContext.set('channel', { platform: 'test', threadId: recording.chatThread.id });
    requestContext.set(
      CHAT_CHANNEL_RENDER_CONTEXT_KEY,
      (channels as any)._buildRenderContext(recording.chatThread, 'test', {}),
    );

    const output = await agent.stream(prompt, { requestContext });
    await output.consumeStream();
    return { text: await output.text, posted: await postedTexts(recording.posts) };
  }

  it('posts an Anthropic web_search answer with per-citation text blocks as one message', async () => {
    const { text, posted } = await runReply('web-search: what is mastra?');

    expect(text).toBe('Mastra is a TypeScript framework for building AI agents, with workflows, memory and evals.');
    expect(posted).toEqual([text]);
  });

  it('joins text blocks exactly as the agent text does, without adding a separator', async () => {
    const { text, posted } = await runReply('unseparated: finish up');

    expect(text).toBe('Done.Next step');
    expect(posted).toEqual([text]);
  });

  it('posts the reply before a channel tool like add_reaction runs', async () => {
    // Record when each reply finishes landing relative to the reaction.
    const events: string[] = [];
    const recording = createRecording();
    recording.chatThread.post.mockImplementation(async (content: any) => {
      if (content?.stream) {
        let text = '';
        for await (const piece of content.stream as AsyncIterable<unknown>) {
          if (typeof piece === 'string') text += piece;
        }
        if (text) events.push(`post:${text}`);
      } else if (content?.type !== 'card') {
        events.push(`post:${content?.markdown ?? content}`);
      }
      return { id: 'm1', text: '' };
    });
    recording.adapter.addReaction.mockImplementation(async (_t: string, messageId: string, emoji: string) => {
      events.push(`reaction:${messageId}:${emoji}`);
    });

    await runReply('reaction: look at this', recording);

    expect(events).toEqual(['post:Checking that.', 'reaction:u1:eyes']);
  });
});

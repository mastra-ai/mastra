import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { AgentChannels } from '../agent-channels';
import { ChatChannelOutputProcessor, CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';

// A real Agent run whose tool emits `writer.custom({ type: 'data-computer' })`
// must reach the adapter's `onDataPart` hook through the channel output processor.
describe('onDataPart with a real agent run', () => {
  it('delivers writer.custom data parts emitted by a tool', async () => {
    const posts: unknown[] = [];
    const adapter: any = {
      name: 'test',
      postMessage: async () => ({ id: 'x', text: '' }),
      editMessage: async () => {},
      startTyping: async () => {},
      renderFormatted: (t: string) => t,
    };
    const chatThread: any = {
      id: 'test:c1:t1',
      channelId: 'test:c1',
      isDM: false,
      post: async (content: unknown) => {
        posts.push(content);
        return { id: `m${posts.length}`, text: '' };
      },
      startTyping: async () => {},
    };
    const seen: Array<{ part: unknown; threadId?: string; resourceId?: string }> = [];
    const channels = new AgentChannels({
      adapters: {
        test: {
          adapter,
          onDataPart: (part, ctx) => {
            seen.push({ part, threadId: ctx.threadId, resourceId: ctx.resourceId });
          },
        },
      },
    });

    const computerTool = createTool({
      id: 'computerTool',
      description: 'attaches a computer',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        await context?.writer?.custom({ type: 'data-computer', data: { computerId: 'c1', status: 'attached' } });
        return { ok: true };
      },
    });

    let calls = 0;
    const agent = new Agent({
      id: 'a',
      name: 'A',
      instructions: 'x',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
            ...(calls++ === 0
              ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'computerTool', input: '{}', providerExecuted: false }]
              : []),
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      }),
      tools: { computerTool },
      outputProcessors: [new ChatChannelOutputProcessor() as any],
    });

    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, (channels as any)._buildRenderContext(chatThread, 'test'));
    requestContext.set('MastraMemory', { thread: { id: 'thread-1' }, resourceId: 'slack:U1' });

    const stream = await agent.stream('go', { requestContext });
    await stream.consumeStream();
    expect(calls).toBe(2);

    expect(seen).toEqual([
      {
        part: { type: 'data-computer', data: { computerId: 'c1', status: 'attached' }, id: undefined },
        threadId: 'thread-1',
        resourceId: 'slack:U1',
      },
    ]);
  });
});

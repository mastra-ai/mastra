import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';

import { STREAM_AGENT_CONTROLLER_SESSION_ROUTE } from './agent-controller';

async function readThroughThreadChunk(reader: ReadableStreamDefaultReader<unknown>, chunkType: string) {
  const events: unknown[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`Stream closed before ${chunkType}`);
    if (typeof value !== 'object' || value === null || !('chunk' in value)) continue;
    events.push(value);
    const chunk = value.chunk;
    if (typeof chunk === 'object' && chunk !== null && 'type' in chunk && chunk.type === chunkType) return events;
  }
}

it('replays the native thread stream to late subscribers without repeating or aborting the tool', async () => {
  const checkout = Promise.withResolvers<void>();
  const toolStarted = Promise.withResolvers<void>();
  const storage = new InMemoryStore();
  let modelCalls = 0;
  const executeCheckout = vi.fn(async () => {
    toolStarted.resolve();
    await checkout.promise;
    return 'Checked out';
  });
  const agent = new Agent({
    id: 'checkout-agent',
    name: 'Checkout agent',
    instructions: 'Check out the pull request.',
    memory: new MockMemory({ storage }),
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({
        stream: new ReadableStream({
          start(stream) {
            stream.enqueue({ type: 'stream-start', warnings: [] });
            if (modelCalls++ === 0) {
              stream.enqueue({ type: 'text-start', id: 'intro' });
              stream.enqueue({ type: 'text-delta', id: 'intro', delta: 'Checking out the pull request.' });
              stream.enqueue({ type: 'text-end', id: 'intro' });
              stream.enqueue({ type: 'tool-call', toolCallId: 'checkout-1', toolName: 'checkout', input: '{}' });
              stream.enqueue({
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
            } else {
              stream.enqueue({ type: 'text-start', id: 'done' });
              stream.enqueue({ type: 'text-delta', id: 'done', delta: 'Checkout complete.' });
              stream.enqueue({ type: 'text-end', id: 'done' });
              stream.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
            }
            stream.close();
          },
        }),
      }),
    }),
    tools: {
      checkout: createTool({
        id: 'checkout',
        description: 'Check out the pull request',
        inputSchema: z.object({}),
        execute: executeCheckout,
      }),
    },
  });
  const controller = new AgentController({
    id: 'code',
    storage,
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [{ id: 'build', agent, default: true }],
    initialState: { yolo: true },
  });
  const mastra = new Mastra({ agentControllers: { code: controller }, storage, logger: false });
  await controller.init();
  const session = await controller.createSession({ id: 'mid-run', resourceId: 'mid-run', ownerId: 'code' });
  await mastra.startWorkers();
  await session.thread.create();
  const run = session.sendMessage({ content: 'Check out this pull request' });
  const passiveSubscribe = vi.spyOn(session, 'subscribeToThread');
  let firstReader: ReadableStreamDefaultReader<unknown> | undefined;
  let secondReader: ReadableStreamDefaultReader<unknown> | undefined;
  try {
    await toolStarted.promise;
    expect(await session.thread.listActiveMessages()).toEqual([]);
    const firstStream = await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
      mastra,
      controllerId: 'code',
      resourceId: 'mid-run',
      includeThreadStream: 'true',
      requestContext: new RequestContext(),
      abortSignal: new AbortController().signal,
    });
    if (!(firstStream instanceof ReadableStream)) throw new Error('Expected session stream');
    firstReader = firstStream.getReader();
    const replayed = await readThroughThreadChunk(firstReader, 'tool-call');
    expect(replayed).toContainEqual(
      expect.objectContaining({
        type: 'thread_chunk',
        chunk: expect.objectContaining({
          type: 'data-user-message',
          data: expect.objectContaining({ contents: 'Check out this pull request' }),
        }),
      }),
    );
    expect(replayed).toContainEqual(
      expect.objectContaining({
        type: 'thread_chunk',
        chunk: expect.objectContaining({
          type: 'text-delta',
          payload: expect.objectContaining({ text: 'Checking out the pull request.' }),
        }),
      }),
    );
    expect(replayed.at(-1)).toMatchObject({
      type: 'thread_chunk',
      chunk: { type: 'tool-call', payload: { toolCallId: 'checkout-1' } },
    });
    const firstSubscription = await passiveSubscribe.mock.results[0]?.value;
    if (!firstSubscription) throw new Error('Expected passive thread subscription');
    const firstUnsubscribe = vi.spyOn(firstSubscription, 'unsubscribe');
    await firstReader.cancel();
    expect(firstUnsubscribe).toHaveBeenCalledOnce();

    const abortController = new AbortController();
    const secondStream = await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
      mastra,
      controllerId: 'code',
      resourceId: 'mid-run',
      includeThreadStream: 'true',
      requestContext: new RequestContext(),
      abortSignal: abortController.signal,
    });
    if (!(secondStream instanceof ReadableStream)) throw new Error('Expected session stream');
    secondReader = secondStream.getReader();
    expect(await readThroughThreadChunk(secondReader, 'tool-call')).toEqual(replayed);
    const secondSubscription = await passiveSubscribe.mock.results[1]?.value;
    if (!secondSubscription) throw new Error('Expected second passive thread subscription');
    const secondUnsubscribe = vi.spyOn(secondSubscription, 'unsubscribe');
    abortController.abort();
    expect(secondUnsubscribe).toHaveBeenCalledOnce();
    expect(executeCheckout).toHaveBeenCalledOnce();

    checkout.resolve();
    await run;
    expect(session.displayState.get().activeTools.get('checkout-1')).toMatchObject({
      status: 'completed',
      result: 'Checked out',
    });
    expect(executeCheckout).toHaveBeenCalledOnce();
  } finally {
    checkout.resolve();
    await run;
    await firstReader?.cancel();
    await secondReader?.cancel();
    await mastra.shutdown();
    vi.restoreAllMocks();
  }
}, 30_000);

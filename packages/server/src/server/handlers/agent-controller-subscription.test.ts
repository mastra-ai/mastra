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

it('opens a browser stream during a real tool execution with the current message, then streams its completion', async () => {
  const checkout = Promise.withResolvers<void>();
  const toolStarted = Promise.withResolvers<void>();
  const storage = new InMemoryStore();
  let modelCalls = 0;
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
        execute: async () => {
          toolStarted.resolve();
          await checkout.promise;
          return 'Checked out';
        },
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
  let reader: ReadableStreamDefaultReader<unknown> | undefined;
  try {
    await toolStarted.promise;
    await vi.waitFor(() => expect(session.displayState.get().activeTools.get('checkout-1')?.status).toBe('running'));
    const stream = await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
      mastra,
      controllerId: 'code',
      resourceId: 'mid-run',
      requestContext: new RequestContext(),
      abortSignal: new AbortController().signal,
    });
    expect(stream).toBeInstanceOf(ReadableStream);
    if (!(stream instanceof ReadableStream)) throw new Error('Expected session stream');
    reader = stream.getReader();
    const initial = await reader.read();
    expect(initial.value).toMatchObject({
      type: 'display_state_changed',
      displayState: {
        isRunning: true,
        activeTools: { 'checkout-1': { name: 'checkout', status: 'running' } },
        currentMessage: {
          role: 'assistant',
          content: {
            parts: expect.arrayContaining([
              {
                type: 'tool-invocation',
                toolInvocation: expect.objectContaining({ toolCallId: 'checkout-1', state: 'call' }),
              },
            ]),
          },
        },
      },
    });
    checkout.resolve();
    await run;
    const events: unknown[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      events.push(value);
      if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'agent_end') break;
    }
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_end', toolCallId: 'checkout-1' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'message_end' }));
    expect(initial.value).toMatchObject({
      displayState: { isRunning: true, activeTools: { 'checkout-1': { status: 'running' } } },
    });
    await reader.cancel();
    const reconnected = await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
      mastra,
      controllerId: 'code',
      resourceId: 'mid-run',
      requestContext: new RequestContext(),
      abortSignal: new AbortController().signal,
    });
    if (!(reconnected instanceof ReadableStream)) throw new Error('Expected session stream');
    reader = reconnected.getReader();
    expect((await reader.read()).value).toMatchObject({
      type: 'display_state_changed',
      displayState: { isRunning: false },
    });
  } finally {
    checkout.resolve();
    await run;
    await reader?.cancel();
    await mastra.shutdown();
  }
}, 30_000);

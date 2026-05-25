import { formatDataStreamPart, processDataStream } from '@ai-sdk/ui-utils';
import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v3';

import { MastraClient } from '../client';
import type { Body } from '../route-types.generated';
import type { ClientOptions, SendAgentSignalParams, SubscribeAgentThreadParams } from '../types';
import { processClientTools } from '../utils/process-client-tools';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { Agent } from './agent';

class TestAgent extends Agent {
  override async processStreamResponse(
    processedParams: any,
    _controller: ReadableStreamDefaultController<Uint8Array>,
    route: string = 'stream',
  ): Promise<Response> {
    return (this['request'] as typeof this.request)(`/agents/test-agent/${route}`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    }) as Promise<Response>;
  }
}

describe('Agent signal routes', () => {
  const mockClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  const createSseResponse = (chunks: any[]) =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );

  const mockSignalAndSubscriptionRequests = async (
    agent: Agent,
    runId: string,
    subscriptionChunks: any[],
    signalParams: SendAgentSignalParams,
  ) => {
    const mockRequest = vi.fn(async (path: string) => {
      if (path.endsWith('/signals')) {
        return { accepted: true, runId };
      }

      if (path.endsWith('/threads/subscribe')) {
        return createSseResponse(subscriptionChunks);
      }

      throw new Error(`Unexpected request path: ${path}`);
    });
    agent['request'] = mockRequest as (typeof agent)['request'];
    await agent.sendSignal(signalParams);
    return mockRequest;
  };

  it('sends run-targeted signals with active behavior unchanged', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const params = {
      signal: { type: 'user-message', contents: 'pause here' },
      runId: 'run-123',
      ifActive: { behavior: 'persist' },
    } as SendAgentSignalParams;
    const routeBody: Body<'POST /agents/:agentId/signals'> = params;

    await agent.sendSignal(params);

    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/signals', {
      method: 'POST',
      body: routeBody,
    });
  });

  it('sends thread-targeted signals with active and idle behavior unchanged', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const params = {
      signal: { type: 'system-reminder', contents: '<system-reminder>review PR comment</system-reminder>' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifActive: { behavior: 'discard' },
      ifIdle: {
        behavior: 'wake',
        streamOptions: {
          maxSteps: 3,
          instructions: 'Use the PR context.',
        },
      },
    } as SendAgentSignalParams;
    const routeBody: Body<'POST /agents/:agentId/signals'> = params;

    await agent.sendSignal(params);

    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/signals', {
      method: 'POST',
      body: routeBody,
    });
  });

  it('processes clientTools and requestContext in ifIdle.streamOptions when sending thread signals', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const clientTools = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: vi.fn(),
      },
    };

    const params = {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: {
        streamOptions: {
          maxSteps: 3,
          instructions: 'Use the tool when needed.',
          requestContext: { userId: 'user-123' },
          clientTools,
        },
      },
    } as unknown as SendAgentSignalParams;

    await agent.sendSignal(params);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const sentBody = mockRequest.mock.calls[0][1].body;
    expect(sentBody.ifIdle.streamOptions.clientTools).toEqual(processClientTools(clientTools as any));
    expect(sentBody.ifIdle.streamOptions.requestContext).toEqual({ userId: 'user-123' });
    expect(sentBody.ifIdle.streamOptions.maxSteps).toBe(3);
    expect(sentBody.ifIdle.streamOptions.instructions).toBe('Use the tool when needed.');
    expect(sentBody.signal).toEqual(params.signal);
    expect(sentBody.resourceId).toBe('resource-123');
    expect(sentBody.threadId).toBe('thread-123');
  });

  it('subscribes to threads with the same body shape as the server route', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const response = new Response(new ReadableStream());
    const mockRequest = vi.fn().mockResolvedValue(response);
    agent['request'] = mockRequest as (typeof agent)['request'];

    const params = {
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } satisfies SubscribeAgentThreadParams;
    const routeBody: Body<'POST /agents/:agentId/threads/subscribe'> = params;

    await agent.subscribeToThread(params);

    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/threads/subscribe', {
      method: 'POST',
      body: routeBody,
      stream: true,
    });
  });

  it('only forwards thread coordinates in the subscribe request body', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const response = new Response(new ReadableStream());
    const mockRequest = vi.fn().mockResolvedValue(response);
    agent['request'] = mockRequest as (typeof agent)['request'];

    await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    expect(mockRequest.mock.calls[0][1].body).toEqual({ resourceId: 'resource-123', threadId: 'thread-123' });
  });

  it('executes clientTools after tool-calls finish and continues with tool-result messages', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');

    const assistantMessages = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'myTool', args: { x: 'hi' } }],
      },
    ];
    const toolCallChunk = {
      type: 'tool-call',
      runId: 'run-abc',
      payload: { toolCallId: 'call-1', toolName: 'myTool', args: { x: 'hi' } },
    };
    const finishChunk = {
      type: 'finish',
      runId: 'run-abc',
      payload: {
        stepResult: { reason: 'tool-calls' },
        messages: { nonUser: assistantMessages },
      },
    };
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);

    const executeSpy = vi.fn(async () => ({ ok: true }));
    const clientTools = {
      myTool: {
        id: 'myTool',
        description: 'tool',
        inputSchema: z.object({ x: z.string() }),
        execute: executeSpy,
      },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-abc', [toolCallChunk, finishChunk], {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    const received: any[] = [];
    await subscribed.processDataStream({
      onChunk: async chunk => {
        received.push(chunk);
      },
    });

    // The client tool ran with the streamed args only once the run finished with tool-calls.
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect((executeSpy.mock.calls[0] as any[])[0]).toEqual({ x: 'hi' });

    // A synthetic tool-result chunk was emitted after the finish chunk.
    const finishIndex = received.findIndex(c => c.type === 'finish');
    const toolResultIndex = received.findIndex(c => c.type === 'tool-result');
    expect(toolResultIndex).toBeGreaterThan(finishIndex);
    const toolResultChunk = received[toolResultIndex];
    expect(toolResultChunk.payload).toEqual({
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'myTool',
      result: { ok: true },
    });

    // A continuation run was POSTed with the assistant tool-call message plus the tool result.
    expect(streamUntilIdleSpy).toHaveBeenCalled();
    const continuationCall = streamUntilIdleSpy.mock.calls.at(-1) as [any[], { memory?: unknown }];
    expect(continuationCall[0]).toEqual([
      ...assistantMessages,
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'myTool',
            result: { ok: true },
          },
        ],
      },
    ]);
    expect(continuationCall[1]?.memory).toEqual({ thread: 'thread-123', resource: 'resource-123' });
  });

  it('executes multiple client tools after one tool-calls finish', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const assistantMessages = [
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'firstTool', args: { value: 'one' } },
          { type: 'tool-call', toolCallId: 'call-2', toolName: 'secondTool', args: { value: 'two' } },
        ],
      },
    ];
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-multi',
        payload: { toolCallId: 'call-1', toolName: 'firstTool', args: { value: 'one' } },
      },
      {
        type: 'tool-call',
        runId: 'run-multi',
        payload: { toolCallId: 'call-2', toolName: 'secondTool', args: { value: 'two' } },
      },
      {
        type: 'finish',
        runId: 'run-multi',
        payload: { stepResult: { reason: 'tool-calls' }, messages: { nonUser: assistantMessages } },
      },
    ];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);
    const firstExecute = vi.fn(async () => ({ first: true }));
    const secondExecute = vi.fn(async () => ({ second: true }));
    const clientTools = {
      firstTool: { id: 'firstTool', description: 'first', inputSchema: z.object({}), execute: firstExecute },
      secondTool: { id: 'secondTool', description: 'second', inputSchema: z.object({}), execute: secondExecute },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-multi', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    const received: any[] = [];
    await subscribed.processDataStream({ onChunk: async chunk => void received.push(chunk) });

    expect(firstExecute).toHaveBeenCalledTimes(1);
    expect(secondExecute).toHaveBeenCalledTimes(1);
    expect(received.filter(chunk => chunk.type === 'tool-result')).toHaveLength(2);
    const [continuationMessages] = streamUntilIdleSpy.mock.calls.at(-1) as [any[]];
    expect(continuationMessages).toEqual([
      ...assistantMessages,
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'firstTool', result: { first: true } }],
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'call-2', toolName: 'secondTool', result: { second: true } }],
      },
    ]);
  });

  it('ignores unknown tools without starting a continuation', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-unknown',
        payload: { toolCallId: 'call-unknown', toolName: 'serverOnlyTool', args: {} },
      },
      {
        type: 'finish',
        runId: 'run-unknown',
        payload: {
          stepResult: { reason: 'tool-calls' },
          messages: {
            nonUser: [
              {
                role: 'assistant',
                content: [{ type: 'tool-call', toolCallId: 'call-unknown', toolName: 'serverOnlyTool', args: {} }],
              },
            ],
          },
        },
      },
    ];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);
    const executeSpy = vi.fn(async () => ({ ok: true }));
    const clientTools = {
      myTool: { id: 'myTool', description: 'known', inputSchema: z.object({}), execute: executeSpy },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-unknown', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    const received: any[] = [];
    await subscribed.processDataStream({ onChunk: async chunk => void received.push(chunk) });

    expect(executeSpy).not.toHaveBeenCalled();
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    expect(received.find(chunk => chunk.type === 'tool-result')).toBeUndefined();
  });

  it('emits error tool-results when client tool execution throws', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const assistantMessages = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-error', toolName: 'myTool', args: {} }],
      },
    ];
    const chunks = [
      { type: 'tool-call', runId: 'run-error', payload: { toolCallId: 'call-error', toolName: 'myTool', args: {} } },
      {
        type: 'finish',
        runId: 'run-error',
        payload: { stepResult: { reason: 'tool-calls' }, messages: { nonUser: assistantMessages } },
      },
    ];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);

    const clientTools = {
      myTool: {
        id: 'myTool',
        description: 'throws',
        inputSchema: z.object({}),
        execute: vi.fn(async () => {
          throw new Error('boom');
        }),
      },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-error', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    const received: any[] = [];
    await subscribed.processDataStream({ onChunk: async chunk => void received.push(chunk) });

    const toolResult = received.find(chunk => chunk.type === 'tool-result');
    expect(toolResult?.payload).toEqual({
      type: 'tool-result',
      toolCallId: 'call-error',
      toolName: 'myTool',
      result: { error: 'Error: boom' },
    });
    const [continuationMessages] = streamUntilIdleSpy.mock.calls.at(-1) as [any[]];
    expect(continuationMessages.at(-1)).toEqual({
      role: 'tool',
      content: [
        { type: 'tool-result', toolCallId: 'call-error', toolName: 'myTool', result: { error: 'Error: boom' } },
      ],
    });
  });

  it('scopes pending client tool calls by runId', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const assistantMessages = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-a', toolName: 'myTool', args: { run: 'a' } }],
      },
    ];
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-a',
        payload: { toolCallId: 'call-a', toolName: 'myTool', args: { run: 'a' } },
      },
      {
        type: 'finish',
        runId: 'run-b',
        payload: {
          stepResult: { reason: 'tool-calls' },
          messages: {
            nonUser: [
              {
                role: 'assistant',
                content: [{ type: 'tool-call', toolCallId: 'call-b', toolName: 'myTool', args: { run: 'b' } }],
              },
            ],
          },
        },
      },
      {
        type: 'finish',
        runId: 'run-a',
        payload: { stepResult: { reason: 'tool-calls' }, messages: { nonUser: assistantMessages } },
      },
    ];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);
    const executeSpy = vi.fn(async args => ({ args }));
    const clientTools = {
      myTool: { id: 'myTool', description: 'tool', inputSchema: z.object({}), execute: executeSpy },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-a', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    await subscribed.processDataStream({ onChunk: async () => {} });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect((executeSpy.mock.calls[0] as any[])[0]).toEqual({ run: 'a' });
    expect(streamUntilIdleSpy).toHaveBeenCalledTimes(1);
    const [continuationMessages] = streamUntilIdleSpy.mock.calls.at(-1) as [any[]];
    expect(continuationMessages[0]).toEqual(assistantMessages[0]);
  });

  it('continues receiving later run chunks through the same subscription stream', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const assistantMessages = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'myTool', args: {} }],
      },
    ];
    const continuationTextChunk = { type: 'text-delta', runId: 'run-continuation', payload: { text: 'done' } };
    const continuationFinishChunk = {
      type: 'finish',
      runId: 'run-continuation',
      payload: { stepResult: { reason: 'stop' }, messages: { nonUser: [] } },
    };
    const chunks = [
      { type: 'tool-call', runId: 'run-first', payload: { toolCallId: 'call-1', toolName: 'myTool', args: {} } },
      {
        type: 'finish',
        runId: 'run-first',
        payload: { stepResult: { reason: 'tool-calls' }, messages: { nonUser: assistantMessages } },
      },
      continuationTextChunk,
      continuationFinishChunk,
    ];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);

    const clientTools = {
      myTool: {
        id: 'myTool',
        description: 'tool',
        inputSchema: z.object({}),
        execute: vi.fn(async () => ({ ok: true })),
      },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-first', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    const received: any[] = [];
    await subscribed.processDataStream({ onChunk: async chunk => void received.push(chunk) });

    expect(streamUntilIdleSpy).toHaveBeenCalledTimes(1);
    expect(received).toContainEqual(continuationTextChunk);
    expect(received).toContainEqual(continuationFinishChunk);
  });

  it('uses send-owned runtime options for subscribed client-tool execution and continuation', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const assistantMessages = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-latest', toolName: 'latestTool', args: {} }],
      },
    ];
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-latest',
        payload: { toolCallId: 'call-latest', toolName: 'latestTool', args: {} },
      },
      {
        type: 'finish',
        runId: 'run-latest',
        payload: { stepResult: { reason: 'tool-calls' }, messages: { nonUser: assistantMessages } },
      },
    ];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);
    const executeSpy = vi.fn(async (_args, context: any) => ({ userId: context.requestContext.userId }));
    const clientTools = {
      latestTool: { id: 'latestTool', description: 'latest', inputSchema: z.object({}), execute: executeSpy },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-latest', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: {
        streamOptions: {
          clientTools,
          requestContext: { userId: 'latest-user' } as any,
          maxSteps: 7,
          instructions: 'latest instructions',
        },
      },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    await subscribed.processDataStream({ onChunk: async () => {} });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy.mock.results[0]).toBeDefined();
    const [, executeContext] = executeSpy.mock.calls[0] as any[];
    expect(executeContext.requestContext).toEqual({ userId: 'latest-user' });
    const [, continuationOptionsArg] = streamUntilIdleSpy.mock.calls.at(-1) as [unknown, any];
    expect(continuationOptionsArg).toEqual(
      expect.objectContaining({
        maxSteps: 7,
        instructions: 'latest instructions',
        requestContext: { userId: 'latest-user' },
        clientTools: processClientTools(clientTools as any),
      }),
    );
  });

  it('preserves subscribed client-tool observability payloads', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const observability = {
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    };
    const assistantMessages = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-observe', toolName: 'observeTool', args: {} }],
      },
    ];
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-observe',
        payload: { toolCallId: 'call-observe', toolName: 'observeTool', args: {}, observability },
      },
      {
        type: 'finish',
        runId: 'run-observe',
        payload: { stepResult: { reason: 'tool-calls' }, messages: { nonUser: assistantMessages } },
      },
    ];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);
    const executeSpy = vi.fn(async (_args, context: any) => {
      await context.observe.span('client work', async () => null);
      return { ok: true };
    });
    const clientTools = {
      observeTool: { id: 'observeTool', description: 'observe', inputSchema: z.object({}), execute: executeSpy },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-observe', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    const received: any[] = [];
    await subscribed.processDataStream({ onChunk: async chunk => void received.push(chunk) });

    const toolResult = received.find(chunk => chunk.type === 'tool-result');
    expect(toolResult?.payload.__mastraObservability).toEqual(
      expect.objectContaining({
        parentContext: observability,
        payload: expect.objectContaining({ toolName: 'observeTool' }),
      }),
    );
    const [continuationMessages] = streamUntilIdleSpy.mock.calls.at(-1) as [any[]];
    const continuationToolContent = continuationMessages.at(-1).content[0];
    expect(continuationToolContent).toBe(toolResult.payload);
    expect(continuationToolContent.__mastraObservability).toEqual(toolResult.payload.__mastraObservability);
  });

  it('does not execute client tools when no clientTools are provided', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');

    const toolCallChunk = {
      type: 'tool-call',
      runId: 'run-abc',
      payload: { toolCallId: 'call-1', toolName: 'myTool', args: {} },
    };
    agent['request'] = vi.fn().mockResolvedValue(createSseResponse([toolCallChunk])) as (typeof agent)['request'];
    const streamUntilIdleSpy = vi
      .spyOn(agent, 'streamUntilIdle')
      .mockResolvedValue({ body: { cancel: vi.fn() } } as never);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    const received: any[] = [];
    await subscribed.processDataStream({
      onChunk: async chunk => {
        received.push(chunk);
      },
    });

    // No client tools, so no continuation and no synthetic tool-result.
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    expect(received.find(c => c.type === 'tool-result')).toBeUndefined();
  });
});

describe('Agent.stream', () => {
  const mockClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should transform params.structuredOutput.schema using zodToJsonSchema when provided', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const schema = z.object({ name: z.string() });
    const params = {
      messages: 'test message',
      structuredOutput: {
        schema,
      },
    };

    await agent.stream(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.structuredOutput.schema).toEqual(zodToJsonSchema(schema));
  });

  it('should process requestContext through parseClientRequestContext', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const requestContext = { userId: 'user-123' } as any;
    const params = {
      messages: 'test message',
      requestContext,
    };

    await agent.stream(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.requestContext).toEqual({ userId: 'user-123' });
  });

  it('should process clientTools through processClientTools', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const clientTools = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: vi.fn(),
      },
    };

    const params = {
      messages: 'test message',
      clientTools,
    };

    await agent.stream(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.clientTools).toEqual(processClientTools(clientTools));
  });

  it('should handle vNext step-finish and finish chunks without stepResult payloads', async () => {
    const encoder = new TextEncoder();
    const chunks = [{ type: 'text-delta', payload: { text: 'hello' } }, { type: 'step-finish' }, { type: 'finish' }];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.close();
      },
    });
    const updates: any[] = [];
    const onFinish = vi.fn();
    const agent = new TestAgent(mockClientOptions, 'test-agent');

    await expect(
      (agent as any).processChatResponse_vNext({
        stream,
        update: (update: any) => updates.push(update),
        onFinish,
        lastMessage: undefined,
      }),
    ).resolves.toBeUndefined();

    expect(updates[updates.length - 1].message.content).toBe('hello');
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        finishReason: 'unknown',
      }),
    );
  });
});

describe('Agent.streamUntilIdle', () => {
  const mockClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should transform params.structuredOutput.schema using zodToJsonSchema when provided', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const schema = z.object({ name: z.string() });
    const params = {
      messages: 'test message',
      structuredOutput: {
        schema,
      },
    };

    await agent.streamUntilIdle(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.structuredOutput.schema).toEqual(zodToJsonSchema(schema));
  });

  it('should process requestContext through parseClientRequestContext', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const requestContext = { userId: 'user-123' } as any;
    const params = {
      messages: 'test message',
      requestContext,
    };

    await agent.streamUntilIdle(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.requestContext).toEqual({ userId: 'user-123' });
  });

  it('should process clientTools through processClientTools', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const clientTools = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: vi.fn(),
      },
    };

    const params = {
      messages: 'test message',
      clientTools,
    };

    await agent.streamUntilIdle(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.clientTools).toEqual(processClientTools(clientTools));
  });

  it('should post to the /stream-until-idle route', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    await agent.streamUntilIdle('test message');

    const [url] = mockRequest.mock.calls[0];
    expect(url).toBe('/agents/test-agent/stream-until-idle');
  });
});

describe('Agent Voice Resource', () => {
  let client: MastraClient;
  let agent: Agent;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
    agent = client.getAgent('test-agent');
  });

  it('should create an agent with version options', async () => {
    const versionedAgent = client.getAgent('test-agent', { versionId: 'version-123' });

    expect(versionedAgent).toBeInstanceOf(Agent);
  });

  it('should get available speakers', async () => {
    const mockResponse = [{ voiceId: 'speaker1' }];
    mockFetchResponse(mockResponse);

    const result = await agent.voice.getSpeakers();

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speakers`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should include versionId when getting speakers', async () => {
    const versionedAgent = client.getAgent('test-agent', { versionId: 'version-123' });
    const mockResponse = [{ voiceId: 'speaker1' }];
    mockFetchResponse(mockResponse);

    await versionedAgent.voice.getSpeakers();

    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speakers?versionId=version-123`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it(`should call speak without options`, async () => {
    const mockAudioStream = new ReadableStream();
    mockFetchResponse(mockAudioStream, { isStream: true });

    const result = await agent.voice.speak('test');

    expect(result).toBeInstanceOf(Response);
    expect(result.body).toBeInstanceOf(ReadableStream);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speak`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it(`should call speak with options`, async () => {
    const mockAudioStream = new ReadableStream();
    mockFetchResponse(mockAudioStream, { isStream: true });

    const result = await agent.voice.speak('test', { speaker: 'speaker1' });
    expect(result).toBeInstanceOf(Response);
    expect(result.body).toBeInstanceOf(ReadableStream);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speak`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it(`should call listen with audio file`, async () => {
    const transcriptionResponse = { text: 'Hello world' };
    mockFetchResponse(transcriptionResponse);

    const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

    const result = await agent.voice.listen(audioBlob, { filetype: 'wav' });
    expect(result).toEqual(transcriptionResponse);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, config] = (global.fetch as any).mock.calls[0];
    expect(url).toBe(`${clientOptions.baseUrl}/api/agents/test-agent/voice/listen`);
    expect(config.method).toBe('POST');
    expect(config.headers).toMatchObject(clientOptions.headers);

    const formData = config.body;
    expect(formData).toBeInstanceOf(FormData);
    const audioContent = formData.get('audio');
    expect(audioContent).toBeInstanceOf(Blob);
    expect(audioContent.type).toBe('audio/wav');
  });

  it(`should call listen with audio blob and options`, async () => {
    const transcriptionResponse = { text: 'Hello world' };
    mockFetchResponse(transcriptionResponse);

    const audioBlob = new Blob(['test audio data'], { type: 'audio/mp3' });

    const result = await agent.voice.listen(audioBlob, { filetype: 'mp3' });

    expect(result).toEqual(transcriptionResponse);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, config] = (global.fetch as any).mock.calls[0];
    expect(url).toBe(`${clientOptions.baseUrl}/api/agents/test-agent/voice/listen`);
    expect(config.method).toBe('POST');
    expect(config.headers).toMatchObject(clientOptions.headers);

    const formData = config.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    const audioContent = formData.get('audio');
    expect(audioContent).toBeInstanceOf(Blob);
    expect(formData.get('options')).toBe(JSON.stringify({ filetype: 'mp3' }));
  });
});

describe('Agent Client Methods', () => {
  let client: MastraClient;
  let agent: Agent;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
    agent = client.getAgent('test-agent');
  });

  it('should get all agents', async () => {
    const mockResponse = {
      agent1: { name: 'Agent 1', model: 'gpt-4' },
      agent2: { name: 'Agent 2', model: 'gpt-3.5' },
    };
    mockFetchResponse(mockResponse);
    const result = await client.listAgents();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get all agents with requestContext', async () => {
    const mockResponse = {
      agent1: { name: 'Agent 1', model: 'gpt-4' },
      agent2: { name: 'Agent 2', model: 'gpt-3.5' },
    };
    const requestContext = { userId: '123', sessionId: 'abc' };
    const expectedBase64 = btoa(JSON.stringify(requestContext));
    const expectedEncodedBase64 = encodeURIComponent(expectedBase64);

    mockFetchResponse(mockResponse);
    const result = await client.listAgents(requestContext);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents?requestContext=${expectedEncodedBase64}`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get agent details', async () => {
    const mockResponse = { id: 'test-agent', name: 'Test Agent', instructions: 'Be helpful' };
    mockFetchResponse(mockResponse);

    const result = await agent.details();

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should list override versions for a code agent', async () => {
    const mockResponse = {
      versions: [{ id: 'version-1', agentId: 'test-agent', versionNumber: 1 }],
      page: 0,
      perPage: 10,
      hasMore: false,
    };
    mockFetchResponse(mockResponse);

    const result = await agent.listVersions({
      page: 0,
      perPage: 10,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions?page=0&perPage=10&orderBy%5Bfield%5D=createdAt&orderBy%5Bdirection%5D=DESC`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should create an override version for a code agent', async () => {
    const createParams = {
      instructions: 'Updated instructions',
      tools: { weather: { enabled: true, description: 'Weather tool' } },
      changeMessage: 'Update override config',
    };
    const mockResponse = {
      id: 'version-new',
      agentId: 'test-agent',
      versionNumber: 2,
      instructions: createParams.instructions,
      tools: createParams.tools,
      changeMessage: createParams.changeMessage,
      createdAt: '2024-01-02T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.createVersion(createParams);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(createParams),
        headers: expect.objectContaining({
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('should create an override version without params', async () => {
    const mockResponse = {
      id: 'version-auto',
      agentId: 'test-agent',
      versionNumber: 3,
      createdAt: '2024-01-03T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.createVersion();

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
  });

  it('should get a specific override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      id: versionId,
      agentId: 'test-agent',
      versionNumber: 1,
      instructions: 'You are a helpful assistant',
      changedFields: ['instructions'],
      changeMessage: 'Updated instructions',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.getVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should activate an override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      success: true,
      message: 'Version 1 is now active',
      activeVersionId: versionId,
    };
    mockFetchResponse(mockResponse);

    const result = await agent.activateVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}/activate`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should restore an override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      id: 'version-new',
      agentId: 'test-agent',
      versionNumber: 4,
      instructions: 'You are a helpful assistant',
      changedFields: ['instructions'],
      changeMessage: 'Restored from version 1',
      createdAt: '2024-01-04T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.restoreVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}/restore`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should delete an override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      success: true,
      message: 'Version deleted successfully',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.deleteVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should compare override versions for a code agent', async () => {
    const mockResponse = {
      diffs: [
        {
          field: 'instructions',
          oldValue: 'Old instructions',
          newValue: 'New instructions',
        },
      ],
    };
    mockFetchResponse(mockResponse);

    const result = await agent.compareVersions('version-1', 'version-2');

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/compare?from=version-1&to=version-2`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });
});

describe('Agent - Storage Duplicate Messages Issue', () => {
  let agent: Agent;
  let mockRequest: ReturnType<typeof vi.fn>;

  const mockClientOptions: ClientOptions = {
    baseUrl: 'https://api.test.com',
  };

  beforeEach(() => {
    mockRequest = vi.fn();
    agent = new Agent(mockClientOptions, 'test-agent-id');
    agent['request'] = mockRequest as (typeof agent)['request'];
  });

  it('should not re-send the original user message when executing client-side tools', async () => {
    const clientTool = createTool({
      id: 'clientTool',
      description: 'A client-side tool',
      execute: vi.fn().mockResolvedValue('Tool result'),
      inputSchema: undefined,
    });

    const initialMessage = 'Test message';

    mockRequest.mockResolvedValueOnce({
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolName: 'clientTool',
            args: { test: 'args' },
            toolCallId: 'tool-1',
          },
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                toolName: 'clientTool',
                args: { test: 'args' },
                toolCallId: 'tool-1',
              },
            ],
          },
        ],
      },
    });

    mockRequest.mockResolvedValueOnce({
      finishReason: 'stop',
      response: {
        messages: [
          {
            role: 'assistant',
            content: 'Final response',
          },
        ],
      },
    });

    await agent.generate(initialMessage, {
      clientTools: { clientTool },
      memory: { thread: 'test-thread-123', resource: 'test-resource-123' },
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const secondCallArgs = mockRequest.mock.calls[1][1];
    const messagesInSecondCall = secondCallArgs.body.messages;

    const userMessages = messagesInSecondCall.filter((msg: any) => msg.role === 'user');

    expect(userMessages).toHaveLength(0);
    expect(messagesInSecondCall).toHaveLength(2);
    expect(messagesInSecondCall[0].role).toBe('assistant');
    expect(messagesInSecondCall[1].role).toBe('tool');
  });

  it('should handle multiple tool calls without duplicating the user message', async () => {
    const clientTool = createTool({
      id: 'clientTool',
      description: 'A client-side tool',
      execute: vi
        .fn()
        .mockResolvedValueOnce('First result')
        .mockResolvedValueOnce('Second result')
        .mockResolvedValueOnce('Third result')
        .mockResolvedValueOnce('Fourth result'),
      inputSchema: undefined,
    });

    const initialMessage = 'Test message that triggers multiple tools';

    mockRequest.mockResolvedValueOnce({
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolName: 'clientTool',
            args: { iteration: 1 },
            toolCallId: 'tool-1',
          },
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                toolName: 'clientTool',
                args: { iteration: 1 },
                toolCallId: 'tool-1',
              },
            ],
          },
        ],
      },
    });

    mockRequest.mockResolvedValueOnce({
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolName: 'clientTool',
            args: { iteration: 2 },
            toolCallId: 'tool-2',
          },
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                toolName: 'clientTool',
                args: { iteration: 2 },
                toolCallId: 'tool-2',
              },
            ],
          },
        ],
      },
    });

    mockRequest.mockResolvedValueOnce({
      finishReason: 'stop',
      response: {
        messages: [
          {
            role: 'assistant',
            content: 'Final response',
          },
        ],
      },
    });

    await agent.generate(initialMessage, {
      clientTools: { clientTool },
      memory: { thread: 'test-thread-123', resource: 'test-resource-123' },
    });

    expect(mockRequest).toHaveBeenCalledTimes(3);

    const secondCallMessages = mockRequest.mock.calls[1][1].body.messages;
    const thirdCallMessages = mockRequest.mock.calls[2][1].body.messages;

    expect(secondCallMessages.filter((msg: any) => msg.role === 'user')).toHaveLength(0);
    expect(thirdCallMessages.filter((msg: any) => msg.role === 'user')).toHaveLength(0);
  });
});

describe('streaming behavior', () => {
  it('should parse data stream chunks', async () => {
    const chunks: any[] = [];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(formatDataStreamPart('data', [{ type: 'text-delta', textDelta: 'hello' }])),
        );
        controller.close();
      },
    });

    await processDataStream({
      stream,
      onDataPart: chunk => {
        chunks.push(chunk);
      },
    });

    expect(chunks).toHaveLength(1);
  });
});

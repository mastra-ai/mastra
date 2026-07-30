import { formatDataStreamPart, processDataStream } from '@ai-sdk/ui-utils';
import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v3';

import { MastraClient } from '../client';
import type { Body } from '../route-types.generated';
import type {
  ClientOptions,
  QueueAgentMessageParams,
  SendAgentMessageParams,
  SendAgentSignalParams,
  SubscribeAgentThreadParams,
} from '../types';
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

  const continuationToolResultMessage = (toolCallId: string, toolName: string, input: unknown, output: unknown) => ({
    role: 'assistant',
    content: [
      { type: 'tool-call', toolCallId, toolName, input },
      { type: 'tool-result', toolCallId, toolName, output: { type: 'json', value: output } },
    ],
  });

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

  it('sends messages to the send-message route with string payloads unchanged', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const params = {
      message: 'hello',
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } satisfies SendAgentMessageParams;
    const routeBody: Body<'POST /agents/:agentId/send-message'> = params;

    await agent.sendMessage(params);

    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/send-message', {
      method: 'POST',
      body: routeBody,
    });
  });

  it('sends messages to the send-message route with object payloads unchanged', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const params = {
      message: {
        contents: 'hello',
        attributes: { source: 'test' },
        metadata: { client: 'sdk' },
        providerOptions: { mastra: { channel: 'web' } },
      },
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } satisfies SendAgentMessageParams;
    const routeBody: Body<'POST /agents/:agentId/send-message'> = params;

    await agent.sendMessage(params);

    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/send-message', {
      method: 'POST',
      body: routeBody,
    });
  });

  it('queues messages to the queue-message route with parts payloads unchanged', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'queued-run-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const params = {
      message: [
        { type: 'text', text: 'describe this' },
        { type: 'file', data: 'file-data', mediaType: 'text/plain' },
      ],
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { maxSteps: 3 } },
    } satisfies QueueAgentMessageParams;
    const routeBody: Body<'POST /agents/:agentId/queue-message'> = params;

    await agent.queueMessage(params);

    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/queue-message', {
      method: 'POST',
      body: routeBody,
    });
  });

  it('processes clientTools and requestContext in ifIdle.streamOptions when sending messages', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'message-run-123' });
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
      message: 'hello',
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
    } as unknown as SendAgentMessageParams;

    await agent.sendMessage(params);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const sentBody = mockRequest.mock.calls[0][1].body;
    expect(sentBody.ifIdle.streamOptions.clientTools).toEqual(processClientTools(clientTools as any));
    expect(sentBody.ifIdle.streamOptions.requestContext).toEqual({ userId: 'user-123' });
    expect(sentBody.ifIdle.streamOptions.maxSteps).toBe(3);
    expect(sentBody.ifIdle.streamOptions.instructions).toBe('Use the tool when needed.');
    expect(agent['getSignalRuntimeOptions']({ runId: 'message-run-123' })?.clientTools).toBe(clientTools);
  });

  it('processes clientTools and requestContext in ifIdle.streamOptions when queueing messages', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'queued-run-123' });
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
      message: 'hello later',
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: {
        streamOptions: {
          maxSteps: 3,
          instructions: 'Use the queued tool when needed.',
          requestContext: { userId: 'user-123' },
          clientTools,
        },
      },
    } as unknown as QueueAgentMessageParams;

    await agent.queueMessage(params);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const sentBody = mockRequest.mock.calls[0][1].body;
    expect(sentBody.ifIdle.streamOptions.clientTools).toEqual(processClientTools(clientTools as any));
    expect(sentBody.ifIdle.streamOptions.requestContext).toEqual({ userId: 'user-123' });
    expect(sentBody.ifIdle.streamOptions.maxSteps).toBe(3);
    expect(sentBody.ifIdle.streamOptions.instructions).toBe('Use the queued tool when needed.');
    expect(agent['getSignalRuntimeOptions']({ runId: 'queued-run-123' })?.clientTools).toBe(clientTools);
  });

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

  it('approves tool calls through the subscription-native route', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-123', toolCallId: 'tool-call-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const result = await agent.sendToolApproval({
      resourceId: 'resource-123',
      threadId: 'thread-123',
      toolCallId: 'tool-call-123',
      approved: true,
      requestContext: { userId: 'user-123' },
    });

    expect(result).toEqual({ accepted: true, runId: 'run-123', toolCallId: 'tool-call-123' });
    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/send-tool-approval', {
      method: 'POST',
      body: {
        resourceId: 'resource-123',
        threadId: 'thread-123',
        toolCallId: 'tool-call-123',
        approved: true,
        requestContext: { userId: 'user-123' },
      },
    });
  });

  it('declines tool calls through the subscription-native route', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-123', toolCallId: 'tool-call-123' });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const result = await agent.sendToolApproval({
      resourceId: 'resource-123',
      threadId: 'thread-123',
      toolCallId: 'tool-call-123',
      approved: false,
      requestContext: { userId: 'user-123' },
    });

    expect(result).toEqual({ accepted: true, runId: 'run-123', toolCallId: 'tool-call-123' });
    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/send-tool-approval', {
      method: 'POST',
      body: {
        resourceId: 'resource-123',
        threadId: 'thread-123',
        toolCallId: 'tool-call-123',
        approved: false,
        requestContext: { userId: 'user-123' },
      },
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

  it('cleans provisional runtime options if sending a signal fails before a run id is returned', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent-cleanup-fail');
    const mockRequest = vi.fn().mockRejectedValue(new Error('network down'));
    agent['request'] = mockRequest as (typeof agent)['request'];

    await expect(
      agent.sendSignal({
        signal: { type: 'user-message', contents: 'hello' },
        resourceId: 'resource-cleanup-fail',
        threadId: 'thread-cleanup-fail',
        ifIdle: {
          streamOptions: {
            maxSteps: 3,
          },
        },
      } as SendAgentSignalParams),
    ).rejects.toThrow('network down');

    expect(
      agent['getSignalRuntimeOptions']({ resourceId: 'resource-cleanup-fail', threadId: 'thread-cleanup-fail' }),
    ).toBeUndefined();
  });

  it('expires runtime options if a subscribed finish is never received', async () => {
    vi.useFakeTimers();
    try {
      const agent = new Agent(mockClientOptions, 'test-agent-cleanup-ttl');
      const mockRequest = vi.fn().mockResolvedValue({ accepted: true, runId: 'run-cleanup-ttl' });
      agent['request'] = mockRequest as (typeof agent)['request'];

      await agent.sendSignal({
        signal: { type: 'user-message', contents: 'hello' },
        resourceId: 'resource-cleanup-ttl',
        threadId: 'thread-cleanup-ttl',
        ifIdle: {
          streamOptions: {
            maxSteps: 3,
          },
        },
      } as SendAgentSignalParams);

      expect(agent['getSignalRuntimeOptions']({ runId: 'run-cleanup-ttl' })).toEqual({ maxSteps: 3 });

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(agent['getSignalRuntimeOptions']({ runId: 'run-cleanup-ttl' })).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
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

  it('aborts active thread runs through the abort route', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue({ aborted: true });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const params = {
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } satisfies SubscribeAgentThreadParams;
    const routeBody: Body<'POST /agents/:agentId/threads/abort'> = params;

    await expect(agent.abortThread(params)).resolves.toEqual({ aborted: true });

    expect(mockRequest).toHaveBeenCalledWith('/agents/test-agent/threads/abort', {
      method: 'POST',
      body: routeBody,
    });
  });

  it('unsubscribes a thread subscription without aborting the shared client signal', async () => {
    const sharedAbort = new AbortController();
    const agent = new Agent({ ...mockClientOptions, abortSignal: sharedAbort.signal }, 'test-agent');
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel,
      }),
    );
    const mockRequest = vi.fn().mockResolvedValue(response);
    agent['request'] = mockRequest as (typeof agent)['request'];

    const subscription = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);
    const processing = subscription.processDataStream({ onChunk: vi.fn() });

    subscription.unsubscribe();

    await expect(processing).resolves.toBeUndefined();
    expect(sharedAbort.signal.aborted).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('keeps abort separate from unsubscribe on thread subscriptions', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const response = new Response(new ReadableStream());
    const mockRequest = vi.fn(async (path: string) => {
      if (path.endsWith('/threads/subscribe')) return response;
      if (path.endsWith('/threads/abort')) return { aborted: true };
      throw new Error(`Unexpected request path: ${path}`);
    });
    agent['request'] = mockRequest as (typeof agent)['request'];

    const subscription = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    await expect(subscription.abort()).resolves.toBe(true);
    expect(mockRequest).toHaveBeenLastCalledWith('/agents/test-agent/threads/abort', {
      method: 'POST',
      body: { resourceId: 'resource-123', threadId: 'thread-123' },
    });
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);

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
      args: { x: 'hi' },
      result: { ok: true },
    });

    // Thread-backed continuations only send the browser tool result; memory already has the assistant tool-call message.
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    expect(sendToolApprovalSpy).toHaveBeenCalled();
    const continuationCall = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    expect(continuationCall[0].messages).toEqual([
      continuationToolResultMessage('call-1', 'myTool', { x: 'hi' }, { ok: true }),
    ]);
    expect(continuationCall[0].streamOptions?.memory).toEqual({ thread: 'thread-123', resource: 'resource-123' });
  });

  it('applies client tool toModelOutput and attaches it to the continuation tool-result providerOptions', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');

    const assistantMessages = [
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'screenshotTool', args: { url: 'https://a.com' } },
        ],
      },
    ];
    const toolCallChunk = {
      type: 'tool-call',
      runId: 'run-abc',
      payload: { toolCallId: 'call-1', toolName: 'screenshotTool', args: { url: 'https://a.com' } },
    };
    const finishChunk = {
      type: 'finish',
      runId: 'run-abc',
      payload: {
        stepResult: { reason: 'tool-calls' },
        messages: { nonUser: assistantMessages },
      },
    };
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);

    const clientTools = {
      screenshotTool: {
        id: 'screenshotTool',
        description: 'Take a screenshot',
        inputSchema: z.object({ url: z.string() }),
        execute: vi.fn(async () => ({ ok: true, _b64: 'base64imagedata' })),
        toModelOutput: (output: unknown) => ({
          type: 'content',
          value: [
            { type: 'text', text: 'Here is the current screenshot.' },
            { type: 'media', data: (output as { _b64: string })._b64, mediaType: 'image/jpeg' },
          ],
        }),
      },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-abc', [toolCallChunk, finishChunk], {
      signal: { type: 'user-message', contents: 'take a screenshot' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    await subscribed.processDataStream({ onChunk: vi.fn() });

    expect(sendToolApprovalSpy).toHaveBeenCalled();
    const [continuation] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    const toolResultPart = continuation.messages[0].content.find((p: any) => p.type === 'tool-result');

    // Raw result preserved in output for storage/app logic
    expect(toolResultPart.output).toEqual({ type: 'json', value: { ok: true, _b64: 'base64imagedata' } });
    // Transformed output travels via providerOptions for the next model call
    expect(toolResultPart.providerOptions).toEqual({
      mastra: {
        modelOutput: {
          type: 'content',
          value: [
            { type: 'text', text: 'Here is the current screenshot.' },
            { type: 'media', data: 'base64imagedata', mediaType: 'image/jpeg' },
          ],
        },
      },
    });
  });

  it('continues with the raw result and no providerOptions when client tool toModelOutput throws', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');

    const assistantMessages = [
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'screenshotTool', args: { url: 'https://a.com' } },
        ],
      },
    ];
    const toolCallChunk = {
      type: 'tool-call',
      runId: 'run-abc',
      payload: { toolCallId: 'call-1', toolName: 'screenshotTool', args: { url: 'https://a.com' } },
    };
    const finishChunk = {
      type: 'finish',
      runId: 'run-abc',
      payload: {
        stepResult: { reason: 'tool-calls' },
        messages: { nonUser: assistantMessages },
      },
    };
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);

    const clientTools = {
      screenshotTool: {
        id: 'screenshotTool',
        description: 'Take a screenshot',
        inputSchema: z.object({ url: z.string() }),
        execute: vi.fn(async () => ({ ok: true, _b64: 'base64imagedata' })),
        toModelOutput: () => {
          throw new Error('toModelOutput failed');
        },
      },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-abc', [toolCallChunk, finishChunk], {
      signal: { type: 'user-message', contents: 'take a screenshot' },
      resourceId: 'resource-123',
      threadId: 'thread-123',
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({
      resourceId: 'resource-123',
      threadId: 'thread-123',
    } as SubscribeAgentThreadParams);

    await subscribed.processDataStream({ onChunk: vi.fn() });

    // The continuation is still sent even though toModelOutput threw.
    expect(sendToolApprovalSpy).toHaveBeenCalled();
    const [continuation] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    const toolResultPart = continuation.messages[0].content.find((p: any) => p.type === 'tool-result');

    // Raw result is preserved; the failed transform is simply omitted.
    expect(toolResultPart.output).toEqual({ type: 'json', value: { ok: true, _b64: 'base64imagedata' } });
    expect(toolResultPart.providerOptions).toBeUndefined();
  });

  it('keeps clientTools available across subscribed continuation runs', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-initial',
        payload: { toolCallId: 'call-1', toolName: 'myTool', args: { value: 'first' } },
      },
      {
        type: 'finish',
        runId: 'run-initial',
        payload: {
          stepResult: { reason: 'tool-calls' },
          messages: {
            nonUser: [
              {
                role: 'assistant',
                content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'myTool', args: { value: 'first' } }],
              },
            ],
          },
        },
      },
      {
        type: 'tool-call',
        runId: 'run-continuation',
        payload: { toolCallId: 'call-2', toolName: 'myTool', args: { value: 'second' } },
      },
      {
        type: 'finish',
        runId: 'run-continuation',
        payload: {
          stepResult: { reason: 'tool-calls' },
          messages: {
            nonUser: [
              {
                role: 'assistant',
                content: [{ type: 'tool-call', toolCallId: 'call-2', toolName: 'myTool', args: { value: 'second' } }],
              },
            ],
          },
        },
      },
    ];
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValueOnce({ accepted: true, runId: 'run-continuation' } as never)
      .mockResolvedValueOnce({ accepted: true, runId: 'run-final' } as never);
    const executeSpy = vi.fn(async ({ value }: { value: string }) => ({ value }));
    const clientTools = {
      myTool: { id: 'myTool', description: 'tool', inputSchema: z.object({ value: z.string() }), execute: executeSpy },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-initial', chunks, {
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

    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy.mock.calls.map(call => call[0])).toEqual([{ value: 'first' }, { value: 'second' }]);
    expect(sendToolApprovalSpy).toHaveBeenCalledTimes(2);
    expect(received.filter(chunk => chunk.type === 'tool-result').map(chunk => chunk.payload.toolCallId)).toEqual([
      'call-1',
      'call-2',
    ]);
  });

  it('sends all same-tool client results from a subscribed tool-call finish', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-initial',
        payload: { toolCallId: 'call-1', toolName: 'myTool', args: { value: 'first' } },
      },
      {
        type: 'tool-call',
        runId: 'run-initial',
        payload: { toolCallId: 'call-2', toolName: 'myTool', args: { value: 'second' } },
      },
      {
        type: 'finish',
        runId: 'run-initial',
        payload: {
          stepResult: { reason: 'tool-calls' },
          messages: {
            nonUser: [
              {
                role: 'assistant',
                content: [
                  { type: 'tool-call', toolCallId: 'call-1', toolName: 'myTool', args: { value: 'first' } },
                  { type: 'tool-call', toolCallId: 'call-2', toolName: 'myTool', args: { value: 'second' } },
                ],
              },
            ],
          },
        },
      },
    ];
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValueOnce({ accepted: true, runId: 'run-continuation' } as never);
    const executeSpy = vi.fn(async ({ value }: { value: string }) => ({ value }));
    const clientTools = {
      myTool: { id: 'myTool', description: 'tool', inputSchema: z.object({ value: z.string() }), execute: executeSpy },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-initial', chunks, {
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

    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy.mock.calls.map(call => call[0])).toEqual([{ value: 'first' }, { value: 'second' }]);
    expect(received.filter(chunk => chunk.type === 'tool-result').map(chunk => chunk.payload.toolCallId)).toEqual([
      'call-1',
      'call-2',
    ]);
    const [continuationCall] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    expect(continuationCall.messages).toEqual([
      continuationToolResultMessage('call-1', 'myTool', { value: 'first' }, { value: 'first' }),
      continuationToolResultMessage('call-2', 'myTool', { value: 'second' }, { value: 'second' }),
    ]);
  });

  it('preserves assistant non-user messages for stateless client-tool continuations', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const assistantMessages = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'myTool', args: { x: 'hi' } }],
      },
    ];
    const chunks = [
      {
        type: 'tool-call',
        runId: 'run-stateless',
        payload: { toolCallId: 'call-1', toolName: 'myTool', args: { x: 'hi' } },
      },
      {
        type: 'finish',
        runId: 'run-stateless',
        payload: { stepResult: { reason: 'tool-calls' }, messages: { nonUser: assistantMessages } },
      },
    ];
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);
    const clientTools = {
      myTool: {
        id: 'myTool',
        description: 'tool',
        inputSchema: z.object({ x: z.string() }),
        execute: vi.fn(async () => ({ ok: true })),
      },
    };

    await mockSignalAndSubscriptionRequests(agent, 'run-stateless', chunks, {
      signal: { type: 'user-message', contents: 'hello' },
      ifIdle: { streamOptions: { clientTools } },
    } as SendAgentSignalParams);

    const subscribed = await agent.subscribeToThread({} as SubscribeAgentThreadParams);
    await subscribed.processDataStream({ onChunk: async () => {} });

    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    const [continuation] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    expect(continuation.messages).toEqual([
      ...assistantMessages,
      continuationToolResultMessage('call-1', 'myTool', { x: 'hi' }, { ok: true }),
    ]);
    expect(continuation.streamOptions?.memory).toBeUndefined();
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);
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
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    const [continuation] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    const continuationMessages = continuation.messages;
    expect(continuationMessages).toEqual([
      continuationToolResultMessage('call-1', 'firstTool', { value: 'one' }, { first: true }),
      continuationToolResultMessage('call-2', 'secondTool', { value: 'two' }, { second: true }),
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);
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
    expect(sendToolApprovalSpy).not.toHaveBeenCalled();
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);

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
      args: {},
      result: { error: 'Error: boom' },
    });
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    const [continuation] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    const continuationMessages = continuation.messages;
    expect(continuationMessages.at(-1)).toEqual(
      continuationToolResultMessage('call-error', 'myTool', {}, { error: 'Error: boom' }),
    );
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);
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
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    const [continuation] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    const continuationMessages = continuation.messages;
    expect(continuationMessages).toEqual([
      continuationToolResultMessage('call-a', 'myTool', { run: 'a' }, { args: { run: 'a' } }),
    ]);
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);

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

    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    expect(sendToolApprovalSpy).toHaveBeenCalledTimes(1);
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);
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
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    const [continuationArg] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    expect(continuationArg.streamOptions).toEqual(
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
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);
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
    expect(streamUntilIdleSpy).not.toHaveBeenCalled();
    const [continuation] = sendToolApprovalSpy.mock.calls.at(-1) as [any];
    const continuationMessages = continuation.messages;
    const continuationToolContent = continuationMessages.at(-1).content[1];
    expect(continuationToolContent).toEqual({
      type: 'tool-result',
      toolCallId: 'call-observe',
      toolName: 'observeTool',
      output: { type: 'json', value: { ok: true } },
      __mastraObservability: toolResult.payload.__mastraObservability,
    });
  });

  it('does not execute client tools when no clientTools are provided', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');

    const toolCallChunk = {
      type: 'tool-call',
      runId: 'run-abc',
      payload: { toolCallId: 'call-1', toolName: 'myTool', args: {} },
    };
    agent['request'] = vi.fn().mockResolvedValue(createSseResponse([toolCallChunk])) as (typeof agent)['request'];
    const streamUntilIdleSpy = vi.spyOn(agent, 'streamUntilIdle');
    const sendToolApprovalSpy = vi
      .spyOn(agent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'continuation-run' } as never);

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
    expect(sendToolApprovalSpy).not.toHaveBeenCalled();
    expect(received.find(c => c.type === 'tool-result')).toBeUndefined();
  });

  it('can reconnect when processing a thread subscription stream ends', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const firstChunk = { type: 'text-delta', runId: 'run-1', from: 'AGENT', payload: { id: 'text-1', text: 'first' } };
    const secondChunk = {
      type: 'text-delta',
      runId: 'run-2',
      from: 'AGENT',
      payload: { id: 'text-2', text: 'second' },
    };
    const encode = (chunk: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encode(firstChunk));
              controller.close();
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encode(secondChunk));
              controller.close();
            },
          }),
        ),
      );
    agent['request'] = mockRequest as (typeof agent)['request'];

    const response = await agent.subscribeToThread({ resourceId: 'resource-123', threadId: 'thread-123' });
    const onChunk = vi.fn().mockResolvedValue(undefined);

    await response.processDataStream({ onChunk, reconnect: { maxRetries: 1, delayMs: 0 } });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, firstChunk);
    expect(onChunk).toHaveBeenNthCalledWith(2, secondChunk);
  });

  it('does not reconnect when the onChunk callback throws', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const firstChunk = { type: 'text-delta', runId: 'run-1', from: 'AGENT', payload: { id: 'text-1', text: 'first' } };
    const encode = (chunk: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
    const mockRequest = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encode(firstChunk));
            controller.close();
          },
        }),
      ),
    );
    agent['request'] = mockRequest as (typeof agent)['request'];

    const response = await agent.subscribeToThread({ resourceId: 'resource-123', threadId: 'thread-123' });
    const callbackError = new Error('boom from onChunk');
    const onChunk = vi.fn().mockRejectedValue(callbackError);

    // Consumer should receive the original error they threw, unwrapped.
    await expect(response.processDataStream({ onChunk, reconnect: { maxRetries: 5, delayMs: 0 } })).rejects.toBe(
      callbackError,
    );

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledTimes(1);
  });

  it('retries failed resubscribe requests within the reconnect limit', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent');
    const firstChunk = { type: 'text-delta', runId: 'run-1', from: 'AGENT', payload: { id: 'text-1', text: 'first' } };
    const secondChunk = {
      type: 'text-delta',
      runId: 'run-2',
      from: 'AGENT',
      payload: { id: 'text-2', text: 'second' },
    };
    const encode = (chunk: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
    const responseFor = (chunk: unknown) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encode(chunk));
            controller.close();
          },
        }),
      );
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce(responseFor(firstChunk))
      .mockRejectedValueOnce(new Error('temporary reconnect failure'))
      .mockResolvedValueOnce(responseFor(secondChunk));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const response = await agent.subscribeToThread({ resourceId: 'resource-123', threadId: 'thread-123' });
    const onChunk = vi.fn();

    await response.processDataStream({ onChunk, reconnect: { maxRetries: 2, delayMs: 0 } });

    expect(mockRequest).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, firstChunk);
    expect(onChunk).toHaveBeenNthCalledWith(2, secondChunk);
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

  it('serializes a request-scoped model override', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    await agent.stream('test message', { model: 'google/gemini-2.5-flash' });

    expect(mockRequest.mock.calls[0][1].body.model).toBe('google/gemini-2.5-flash');
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

  it('should list suspended runs with suspendedAt as an ISO string', async () => {
    const suspendedAt = new Date('2026-06-12T10:00:00.000Z');
    mockFetchResponse({
      runs: [
        {
          runId: 'run-123',
          status: 'suspended',
          threadId: 'thread-123',
          resourceId: 'resource-123',
          suspendedAt: suspendedAt.toISOString(),
          toolCalls: [
            { toolCallId: 'tool-call-123', toolName: 'findUserTool', args: { name: 'Dero' }, requiresApproval: true },
          ],
        },
      ],
      total: 1,
    });

    const result = await agent.listSuspendedRuns();

    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/suspended-runs`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.runs[0]!.runId).toBe('run-123');
    expect(result.runs[0]!.suspendedAt).toBe(suspendedAt.toISOString());
    expect(result.runs[0]!.toolCalls[0]!.requiresApproval).toBe(true);
  });

  it('should pass suspended-run filters as query params', async () => {
    mockFetchResponse({ runs: [], total: 0 });

    const fromDate = new Date('2026-01-01T00:00:00.000Z');
    await agent.listSuspendedRuns({
      threadId: 'thread-123',
      resourceId: 'resource-123',
      fromDate,
      perPage: 5,
      page: 1,
    });

    const requestedUrl = new URL((global.fetch as any).mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe('/api/agents/test-agent/suspended-runs');
    expect(requestedUrl.searchParams.get('threadId')).toBe('thread-123');
    expect(requestedUrl.searchParams.get('resourceId')).toBe('resource-123');
    expect(requestedUrl.searchParams.get('fromDate')).toBe(fromDate.toISOString());
    expect(requestedUrl.searchParams.get('perPage')).toBe('5');
    expect(requestedUrl.searchParams.get('page')).toBe('1');
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

describe('Agent.processStreamResponse client-tool synthetic chunks', () => {
  const mockClientOptions: ClientOptions = {
    baseUrl: 'https://api.test.com',
  };

  function makeStreamingResponse(chunks: unknown[]): Response {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  }

  async function readAllText(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let out = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  }

  function parseSseDataLines(raw: string): any[] {
    return raw
      .split('\n\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice('data:'.length).trim())
      .filter(payload => payload && payload !== '[DONE]')
      .map(payload => JSON.parse(payload));
  }

  it('emits a synthetic tool-result chunk into the controller after a client tool resolves', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent-id');

    const toolCallId = 'tool-call-1';
    const firstResponse = makeStreamingResponse([
      { type: 'step-start', payload: { messageId: 'msg-1' } },
      {
        type: 'tool-call',
        payload: {
          toolCallId,
          toolName: 'testTool',
          args: { x: 1 },
        },
      },
      {
        type: 'finish',
        payload: { stepResult: { reason: 'tool-calls' } },
      },
    ]);
    // Second (recursive) call: a simple finish-stop response.
    const secondResponse = makeStreamingResponse([
      { type: 'step-start', payload: { messageId: 'msg-2' } },
      { type: 'text-delta', payload: { text: 'done' } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' } } },
    ]);

    const mockRequest = vi.fn().mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse);
    agent['request'] = mockRequest as (typeof agent)['request'];

    const executeMock = vi.fn().mockResolvedValue({ ok: true, n: 42 });
    const clientTools = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        execute: executeMock,
      },
    };

    let outerController!: ReadableStreamDefaultController<Uint8Array>;
    const outerStream = new ReadableStream<Uint8Array>({
      start(controller) {
        outerController = controller;
      },
    });

    const processPromise = agent.processStreamResponse(
      {
        messages: [{ role: 'user', content: 'hi' }],
        clientTools,
        runId: 'run-xyz',
      },
      outerController,
    );

    const captured = await readAllText(outerStream);
    await processPromise;

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0]![0]).toEqual({ x: 1 });

    const parsed = parseSseDataLines(captured);
    const synthetic = parsed.find(chunk => chunk?.type === 'tool-result' && chunk?.payload?.toolCallId === toolCallId);
    expect(synthetic).toBeDefined();
    expect(synthetic).toMatchObject({
      type: 'tool-result',
      runId: 'run-xyz',
      from: 'AGENT',
      payload: {
        toolCallId,
        toolName: 'testTool',
        result: { ok: true, n: 42 },
        isError: false,
        providerExecuted: false,
      },
    });

    // The synthetic chunk should appear after the server-side `finish` chunk
    // (we await pipePromise before enqueuing it).
    const finishIdx = parsed.findIndex(chunk => chunk?.type === 'finish');
    const toolResultIdx = parsed.findIndex(
      chunk => chunk?.type === 'tool-result' && chunk?.payload?.toolCallId === toolCallId,
    );
    expect(finishIdx).toBeGreaterThanOrEqual(0);
    expect(toolResultIdx).toBeGreaterThan(finishIdx);

    // And the recursive call must have happened.
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('uses the observed stream runId for synthetic chunks on the public stream API', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent-id');

    const toolCallId = 'tool-call-public';
    const firstResponse = makeStreamingResponse([
      { type: 'step-start', runId: 'actual-run-id', payload: { messageId: 'msg-1' } },
      {
        type: 'tool-call',
        runId: 'actual-run-id',
        payload: {
          toolCallId,
          toolName: 'testTool',
          args: { x: 1 },
        },
      },
      {
        type: 'finish',
        runId: 'actual-run-id',
        payload: { stepResult: { reason: 'tool-calls' } },
      },
    ]);
    const secondResponse = makeStreamingResponse([
      { type: 'step-start', runId: 'continued-run-id', payload: { messageId: 'msg-2' } },
      { type: 'finish', runId: 'continued-run-id', payload: { stepResult: { reason: 'stop' } } },
    ]);

    const mockRequest = vi.fn().mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse);
    agent['request'] = mockRequest as (typeof agent)['request'];

    const streamResponse = await agent.stream([{ role: 'user', content: 'hi' }], {
      clientTools: {
        testTool: {
          id: 'testTool',
          description: 'A test tool',
          execute: vi.fn().mockResolvedValue({ ok: true }),
        },
      },
    });

    const chunks: any[] = [];
    await streamResponse.processDataStream({
      onChunk: async chunk => {
        chunks.push(chunk);
      },
    });

    const synthetic = chunks.find(chunk => chunk?.type === 'tool-result' && chunk?.payload?.toolCallId === toolCallId);
    expect(synthetic).toMatchObject({
      type: 'tool-result',
      runId: 'actual-run-id',
      from: 'AGENT',
      payload: {
        toolCallId,
        toolName: 'testTool',
        result: { ok: true },
      },
    });
  });

  it('does not treat final tool-call chunks as streaming partial tool calls', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent-id');

    const stream = makeStreamingResponse([
      { type: 'step-start', runId: 'run-call', payload: { messageId: 'msg-call' } },
      {
        type: 'tool-call',
        runId: 'run-call',
        payload: {
          toolCallId: 'tool-call-final',
          toolName: 'testTool',
          args: { x: 1 },
        },
      },
      { type: 'finish', runId: 'run-call', payload: { stepResult: { reason: 'tool-calls' } } },
    ]).body!;

    const updates: any[] = [];
    await (agent as any).processChatResponse_vNext({
      stream,
      update: (update: any) => updates.push(update),
      lastMessage: undefined,
    });

    const message = updates[updates.length - 1].message;
    expect(message.toolInvocations).toHaveLength(1);
    expect(message.toolInvocations[0]).toMatchObject({
      state: 'call',
      toolCallId: 'tool-call-final',
      toolName: 'testTool',
      args: { x: 1 },
    });
    expect(message.parts.filter((part: any) => part.type === 'tool-invocation')).toHaveLength(1);
    expect(message.parts.find((part: any) => part.type === 'tool-invocation').toolInvocation).toMatchObject({
      state: 'call',
      toolCallId: 'tool-call-final',
    });
  });

  it('emits a synthetic tool-error chunk into the controller when a client tool rejects', async () => {
    const agent = new Agent(mockClientOptions, 'test-agent-id');

    const toolCallId = 'tool-call-err';
    const firstResponse = makeStreamingResponse([
      { type: 'step-start', payload: { messageId: 'msg-1' } },
      {
        type: 'tool-call',
        payload: {
          toolCallId,
          toolName: 'badTool',
          args: { y: 2 },
        },
      },
      {
        type: 'finish',
        payload: { stepResult: { reason: 'tool-calls' } },
      },
    ]);
    const secondResponse = makeStreamingResponse([
      { type: 'step-start', payload: { messageId: 'msg-2' } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' } } },
    ]);

    const mockRequest = vi.fn().mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse);
    agent['request'] = mockRequest as (typeof agent)['request'];

    const executeMock = vi.fn().mockRejectedValue(new Error('boom'));
    const clientTools = {
      badTool: {
        id: 'badTool',
        description: 'A failing tool',
        execute: executeMock,
      },
    };

    let outerController!: ReadableStreamDefaultController<Uint8Array>;
    const outerStream = new ReadableStream<Uint8Array>({
      start(controller) {
        outerController = controller;
      },
    });

    const processPromise = agent.processStreamResponse(
      {
        messages: [{ role: 'user', content: 'hi' }],
        clientTools,
        runId: 'run-err',
      },
      outerController,
    );

    const captured = await readAllText(outerStream);
    await processPromise;

    const parsed = parseSseDataLines(captured);
    const synthetic = parsed.find(chunk => chunk?.type === 'tool-error' && chunk?.payload?.toolCallId === toolCallId);
    expect(synthetic).toBeDefined();
    expect(synthetic).toMatchObject({
      type: 'tool-error',
      runId: 'run-err',
      from: 'AGENT',
      payload: {
        toolCallId,
        toolName: 'badTool',
        providerExecuted: false,
      },
    });
    // Error must be serialized as a plain object (not lost as `{}`).
    expect(synthetic.payload.error).toMatchObject({ name: 'Error', message: 'boom' });

    // Recursive call must still fire with the error result patched in.
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});

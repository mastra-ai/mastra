// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v3';

// Capture spies that every constructed MastraClient instance will expose via
// getAgent(). This lets us assert what the React hook actually forwards to the
// underlying client-js Agent methods.
const sendSignalMock = vi.fn(async () => ({ accepted: true, runId: 'run-mock' }));
let nextApproveToolCallChunks: Array<any> = [];
const approveToolCallProcessDataStreamMock = vi.fn(
  async ({ onChunk }: { onChunk: (chunk: any) => Promise<void> | void }) => {
    for (const chunk of nextApproveToolCallChunks) {
      await onChunk(chunk);
    }
  },
);
const approveToolCallMock = vi.fn(async () => ({
  body: { cancel: vi.fn() },
  processDataStream: approveToolCallProcessDataStreamMock,
}));
const approveToolCallForThreadMock = vi.fn(async () => ({
  accepted: true,
  runId: 'run-approval',
  toolCallId: 'tool-call-approval-1',
}));
const declineToolCallMock = vi.fn(async () => ({
  body: { cancel: vi.fn() },
  processDataStream: async () => {
    /* no chunks */
  },
}));
const declineToolCallForThreadMock = vi.fn(async () => ({
  accepted: true,
  runId: 'run-approval',
  toolCallId: 'tool-call-approval-1',
}));
const streamUntilIdleMock = vi.fn(async () => ({
  body: { cancel: vi.fn() },
  processDataStream: async () => {
    /* no chunks */
  },
}));

// Controllable subscribe-to-thread stream: each test installs an async chunk
// producer that simulates the server pushing chunks over the open subscription.
let nextSubscribeChunks: Array<any> = [];
let keepSubscriptionOpen = false;
let omitThreadSubscriptionUnsubscribe = false;
const constructedClientOptions: any[] = [];
const threadSubscriptionAbortMock = vi.fn(async () => true);
const threadSubscriptionUnsubscribeMock = vi.fn();
const subscribeToThreadMock = vi.fn(async (_params: any) => {
  const chunks = nextSubscribeChunks;
  const subscription: {
    abort: typeof threadSubscriptionAbortMock;
    unsubscribe?: typeof threadSubscriptionUnsubscribeMock;
    processDataStream: ({ onChunk }: { onChunk: (chunk: any) => Promise<void> | void }) => Promise<void>;
  } = {
    abort: threadSubscriptionAbortMock,
    processDataStream: async ({ onChunk }: { onChunk: (chunk: any) => Promise<void> | void }) => {
      for (const chunk of chunks) {
        await onChunk(chunk);
      }
      if (keepSubscriptionOpen) {
        await new Promise(() => {});
      }
    },
  };
  if (!omitThreadSubscriptionUnsubscribe) {
    subscription.unsubscribe = threadSubscriptionUnsubscribeMock;
  }
  return subscription;
});
const generateMock = vi.fn(async () => ({
  response: { uiMessages: [] },
  finishReason: 'stop',
}));

vi.mock('@mastra/client-js', () => ({
  MastraClient: class MockMastraClient {
    options: any;
    constructor(options: any) {
      this.options = options;
      constructedClientOptions.push(options);
    }
    getAgent() {
      return {
        sendSignal: sendSignalMock,
        approveToolCall: approveToolCallMock,
        approveToolCallForThread: approveToolCallForThreadMock,
        declineToolCall: declineToolCallMock,
        declineToolCallForThread: declineToolCallForThreadMock,
        streamUntilIdle: streamUntilIdleMock,
        subscribeToThread: subscribeToThreadMock,
        generate: generateMock,
      };
    }
  },
}));

const { useChat } = await import('./hooks');
const { MastraClientProvider } = await import('../mastra-client-context');

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(MastraClientProvider, { baseUrl: 'http://localhost:4111', children });

describe('useChat forwards clientTools', () => {
  const clientTools = {
    testTool: {
      id: 'testTool',
      description: 'A test tool',
      inputSchema: z.object({ input: z.string() }),
      execute: vi.fn(),
    },
  };

  beforeEach(() => {
    sendSignalMock.mockClear();
    approveToolCallMock.mockClear();
    approveToolCallForThreadMock.mockClear();
    declineToolCallMock.mockClear();
    declineToolCallForThreadMock.mockClear();
    approveToolCallProcessDataStreamMock.mockClear();
    streamUntilIdleMock.mockClear();
    subscribeToThreadMock.mockClear();
    threadSubscriptionAbortMock.mockClear();
    threadSubscriptionUnsubscribeMock.mockClear();
    generateMock.mockClear();
    nextSubscribeChunks = [];
    nextApproveToolCallChunks = [];
    keepSubscriptionOpen = false;
    omitThreadSubscriptionUnsubscribe = false;
    constructedClientOptions.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('marks subscription streams idle while waiting for tool approval', async () => {
    nextSubscribeChunks = [
      {
        type: 'start',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { messageId: 'msg-approval' },
      },
      {
        type: 'tool-call',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'London' } },
      },
      {
        type: 'tool-call-approval',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'London' } },
      },
    ];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const lastMessage = result.current.messages.at(-1);
      expect(lastMessage?.metadata?.mode).toBe('stream');
      if (lastMessage?.metadata?.mode !== 'stream') throw new Error('expected stream metadata');
      expect(lastMessage.metadata.requireApprovalMetadata?.weatherTool).toEqual({
        toolCallId: 'tool-call-approval-1',
        toolName: 'weatherTool',
        args: { city: 'London' },
      });
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(true);
  });

  it('sends a new message for server-side queueing while waiting for subscription tool approval', async () => {
    nextSubscribeChunks = [
      {
        type: 'start',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { messageId: 'msg-approval' },
      },
      {
        type: 'tool-call',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'Vancouver' } },
      },
      {
        type: 'tool-call-approval',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'Vancouver' } },
      },
    ];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(true));
    sendSignalMock.mockClear();

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'paris',
        threadId: 'thread-1',
      });
    });

    expect(sendSignalMock).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.objectContaining({ contents: 'paris' }), threadId: 'thread-1' }),
    );
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(true);
  });

  it('uses subscription-native approval while subscribed to the thread', async () => {
    nextSubscribeChunks = [
      {
        type: 'start',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { messageId: 'msg-approval' },
      },
      {
        type: 'tool-call',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'London' } },
      },
      {
        type: 'tool-call-approval',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'London' } },
      },
    ];
    keepSubscriptionOpen = true;

    const { result, unmount } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await waitFor(() => {
      const lastMessage = result.current.messages.at(-1);
      expect(lastMessage?.metadata?.mode).toBe('stream');
      if (lastMessage?.metadata?.mode !== 'stream') throw new Error('expected stream metadata');
      expect(lastMessage.metadata.requireApprovalMetadata?.weatherTool).toBeDefined();
    });

    await act(async () => {
      await result.current.approveToolCall('tool-call-approval-1');
    });

    expect(approveToolCallForThreadMock).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      toolCallId: 'tool-call-approval-1',
      requestContext: undefined,
    });
    expect(approveToolCallMock).not.toHaveBeenCalled();
    expect(approveToolCallProcessDataStreamMock).not.toHaveBeenCalled();
    expect(result.current.isAwaitingToolApproval).toBe(false);

    unmount();
  });

  it('keeps subscription approval pending when the server ACK fails', async () => {
    nextSubscribeChunks = [
      {
        type: 'start',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { messageId: 'msg-approval' },
      },
      {
        type: 'tool-call-approval',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'London' } },
      },
    ];
    keepSubscriptionOpen = true;
    approveToolCallForThreadMock.mockRejectedValueOnce(new Error('approval failed'));

    const { result, unmount } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(true));

    await expect(
      act(async () => {
        await result.current.approveToolCall('tool-call-approval-1');
      }),
    ).rejects.toThrow('approval failed');

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(true);

    unmount();
  });

  it('keeps remaining parallel subscription approvals clickable after approving one tool call', async () => {
    nextSubscribeChunks = [
      {
        type: 'start',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { messageId: 'msg-approval' },
      },
      {
        type: 'tool-call-approval',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-approval-1', args: { city: 'London' } },
      },
      {
        type: 'tool-call-approval',
        runId: 'run-approval',
        from: 'AGENT',
        payload: { toolName: 'locationTool', toolCallId: 'tool-call-approval-2', args: { city: 'Paris' } },
      },
    ];
    keepSubscriptionOpen = true;

    const { result, unmount } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(true));

    await act(async () => {
      await result.current.approveToolCall('tool-call-approval-1');
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(true);

    await act(async () => {
      await result.current.approveToolCall('tool-call-approval-2');
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(false);

    unmount();
  });

  it('restores parallel pending approval state from initial messages', async () => {
    keepSubscriptionOpen = true;
    const initialMessages = [
      {
        id: 'msg-approval',
        role: 'assistant',
        parts: [],
        metadata: {
          mode: 'stream',
          requireApprovalMetadata: {
            weatherTool: {
              runId: 'run-approval',
              toolCallId: 'tool-call-approval-1',
              toolName: 'weatherTool',
            },
            locationTool: {
              runId: 'run-approval',
              toolCallId: 'tool-call-approval-2',
              toolName: 'locationTool',
            },
          },
        },
      },
    ] as any;

    const { result, unmount } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages,
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalledTimes(1));
    expect(result.current.isAwaitingToolApproval).toBe(true);

    await act(async () => {
      await result.current.approveToolCall('tool-call-approval-1');
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(true);

    await act(async () => {
      await result.current.approveToolCall('tool-call-approval-2');
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(false);

    unmount();
  });

  it('unsubscribes without aborting when thread signals are disabled after subscribing', async () => {
    keepSubscriptionOpen = true;
    const { rerender } = renderHook(
      ({ enableThreadSignals }: { enableThreadSignals: boolean }) =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals,
        }),
      { wrapper, initialProps: { enableThreadSignals: true } },
    );

    await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalledTimes(1));

    act(() => {
      rerender({ enableThreadSignals: false });
    });

    await waitFor(() => expect(threadSubscriptionUnsubscribeMock).toHaveBeenCalledTimes(1));
    expect(threadSubscriptionAbortMock).not.toHaveBeenCalled();
  });

  it('falls back to the subscription AbortController when unsubscribe is unavailable', async () => {
    keepSubscriptionOpen = true;
    omitThreadSubscriptionUnsubscribe = true;
    const { rerender } = renderHook(
      ({ enableThreadSignals }: { enableThreadSignals: boolean }) =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals,
        }),
      { wrapper, initialProps: { enableThreadSignals: true } },
    );

    await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalledTimes(1));
    const subscriptionSignal = constructedClientOptions.find(options => options.abortSignal)
      ?.abortSignal as AbortSignal;
    expect(subscriptionSignal.aborted).toBe(false);

    act(() => {
      rerender({ enableThreadSignals: false });
    });

    await waitFor(() => expect(subscriptionSignal.aborted).toBe(true));
    expect(threadSubscriptionUnsubscribeMock).not.toHaveBeenCalled();
    expect(threadSubscriptionAbortMock).not.toHaveBeenCalled();
  });

  it('aborts and unsubscribes on explicit cancel', async () => {
    keepSubscriptionOpen = true;
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.cancelRun();
    });

    expect(threadSubscriptionAbortMock).toHaveBeenCalledTimes(1);
    expect(threadSubscriptionUnsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('keeps hook-prop clientTools on sendSignal when threadId is provided', async () => {
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          clientTools,
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'hi',
        threadId: 'thread-1',
      });
    });

    expect(subscribeToThreadMock).toHaveBeenCalled();
    const subscribeCalls = subscribeToThreadMock.mock.calls as unknown as Array<[any]>;
    const params = subscribeCalls[0]?.[0];
    expect(params).toEqual({ resourceId: 'resource-1', threadId: 'thread-1' });
    const signalCalls = sendSignalMock.mock.calls as unknown as Array<[any]>;
    expect(signalCalls[0]?.[0].ifIdle.streamOptions.clientTools).toBe(clientTools);
  });

  it('keeps per-send clientTools and continuation options on sendSignal', async () => {
    keepSubscriptionOpen = true;
    const perSendClientTools = {
      testTool: {
        id: 'testTool',
        description: 'per-send tool',
        execute: vi.fn(),
      },
    };
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          clientTools,
          enableThreadSignals: true,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'first',
        threadId: 'thread-1',
        modelSettings: {
          maxSteps: 3,
          instructions: 'use the hook tool',
        },
        requestContext: { userId: 'user-123' } as any,
      });
    });

    const subscribeCalls = subscribeToThreadMock.mock.calls as unknown as Array<[any]>;
    const subscribeParams = subscribeCalls[0]?.[0];
    expect(subscribeParams).toEqual({ resourceId: 'resource-1', threadId: 'thread-1' });

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'second',
        threadId: 'thread-1',
        clientTools: perSendClientTools,
        modelSettings: {
          maxSteps: 5,
          instructions: 'use the per-send tool',
          temperature: 0.2,
        },
        requestContext: { userId: 'user-456' } as any,
      });
    });

    expect(subscribeToThreadMock).toHaveBeenCalledTimes(1);
    expect(subscribeParams).toEqual({ resourceId: 'resource-1', threadId: 'thread-1' });

    expect(sendSignalMock).toHaveBeenCalledTimes(2);
    const signalCalls = sendSignalMock.mock.calls as unknown as Array<[any]>;
    expect(signalCalls[0]?.[0].ifIdle.streamOptions).toEqual(
      expect.objectContaining({
        maxSteps: 3,
        instructions: 'use the hook tool',
        requestContext: { userId: 'user-123' },
        clientTools,
      }),
    );
    expect(signalCalls[1]?.[0].ifIdle.streamOptions).toEqual(
      expect.objectContaining({
        maxSteps: 5,
        instructions: 'use the per-send tool',
        requestContext: { userId: 'user-456' },
        clientTools: perSendClientTools,
      }),
    );
    expect(streamUntilIdleMock).not.toHaveBeenCalled();
  });

  it('forwards hook-prop clientTools through the legacy streamUntilIdle path when no threadId is set', async () => {
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          clientTools,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'hi',
      });
    });

    expect(streamUntilIdleMock).toHaveBeenCalledTimes(1);
    const calls = streamUntilIdleMock.mock.calls as unknown as Array<[unknown, { clientTools: unknown }]>;
    expect(calls[0]?.[1].clientTools).toBe(clientTools);
    expect(sendSignalMock).not.toHaveBeenCalled();
  });
});

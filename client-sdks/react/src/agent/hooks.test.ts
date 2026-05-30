// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v3';

// Capture spies that every constructed MastraClient instance will expose via
// getAgent(). This lets us assert what the React hook actually forwards to the
// underlying client-js Agent methods.
const sendSignalMock = vi.fn(async () => ({ accepted: true, runId: 'run-mock' }));
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
const subscribeToThreadMock = vi.fn(async (_params: any) => {
  const chunks = nextSubscribeChunks;
  return {
    processDataStream: async ({ onChunk }: { onChunk: (chunk: any) => Promise<void> | void }) => {
      for (const chunk of chunks) {
        await onChunk(chunk);
      }
      if (keepSubscriptionOpen) {
        await new Promise(() => {});
      }
    },
  };
});
const generateMock = vi.fn(async () => ({
  response: { uiMessages: [] },
  finishReason: 'stop',
}));
let nextNetworkChunks: Array<any> = [];
let nextApproveNetworkChunks: Array<any> = [];
let nextDeclineNetworkChunks: Array<any> = [];
const networkResponse = (chunks: Array<any>) => ({
  processDataStream: async ({ onChunk }: { onChunk: (chunk: any) => Promise<void> | void }) => {
    for (const chunk of chunks) {
      await onChunk(chunk);
    }
  },
});
const networkMock = vi.fn(async () => networkResponse(nextNetworkChunks));
const approveNetworkToolCallMock = vi.fn(async () => networkResponse(nextApproveNetworkChunks));
const declineNetworkToolCallMock = vi.fn(async () => networkResponse(nextDeclineNetworkChunks));

vi.mock('@mastra/client-js', () => ({
  MastraClient: class MockMastraClient {
    options: any;
    constructor(options: any) {
      this.options = options;
    }
    getAgent() {
      return {
        sendSignal: sendSignalMock,
        streamUntilIdle: streamUntilIdleMock,
        subscribeToThread: subscribeToThreadMock,
        generate: generateMock,
        network: networkMock,
        approveNetworkToolCall: approveNetworkToolCallMock,
        declineNetworkToolCall: declineNetworkToolCallMock,
      };
    }
  },
}));

const { useChat } = await import('./hooks');
const { MastraClientProvider } = await import('../mastra-client-context');

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(MastraClientProvider, { baseUrl: 'http://localhost:4111', children });

const toolExecutionStartChunk = (toolName: string, toolCallId: string) => ({
  type: 'tool-execution-start',
  runId: 'run-net-1',
  from: 'AGENT',
  payload: { runId: 'run-net-1', args: { toolName, toolCallId, args: { city: 'sf' } } },
});

const toolExecutionEndChunk = (toolCallId: string, result: unknown) => ({
  type: 'tool-execution-end',
  runId: 'run-net-1',
  from: 'AGENT',
  payload: { toolCallId, result },
});

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
    streamUntilIdleMock.mockClear();
    subscribeToThreadMock.mockClear();
    generateMock.mockClear();
    networkMock.mockClear();
    approveNetworkToolCallMock.mockClear();
    declineNetworkToolCallMock.mockClear();
    nextSubscribeChunks = [];
    nextNetworkChunks = [];
    nextApproveNetworkChunks = [];
    nextDeclineNetworkChunks = [];
    keepSubscriptionOpen = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
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

  it('accumulates approveNetworkToolCall chunks into messages and forwards onNetworkChunk', async () => {
    const onNetworkChunk = vi.fn();
    nextApproveNetworkChunks = [
      toolExecutionStartChunk('sendEmail', 'tc-approval'),
      toolExecutionEndChunk('tc-approval', 'sent'),
    ];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({ mode: 'network', message: 'approve it', onNetworkChunk });
    });
    onNetworkChunk.mockClear();

    await act(async () => {
      await result.current.approveNetworkToolCall('sendEmail', 'run-net-1');
    });

    await waitFor(() => expect(result.current.messages.length).toBeGreaterThanOrEqual(2));
    expect(onNetworkChunk).toHaveBeenCalledTimes(2);
    const message = result.current.messages[result.current.messages.length - 1];
    expect(message.role).toBe('assistant');
    expect(message.content.format).toBe(2);
    expect(message.content.metadata?.mode).toBe('network');
    const part = message.content.parts[0] as Record<string, unknown>;
    expect(part.type).toBe('dynamic-tool');
    expect(part.toolName).toBe('sendEmail');
    expect(part.state).toBe('output-available');
    expect(part.output).toBe('sent');
  });

  it('accumulates declineNetworkToolCall chunks into messages and forwards onNetworkChunk', async () => {
    const onNetworkChunk = vi.fn();
    nextDeclineNetworkChunks = [
      toolExecutionStartChunk('askHuman', 'tc-decline'),
      toolExecutionEndChunk('tc-decline', { declined: true }),
    ];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({ mode: 'network', message: 'decline it', onNetworkChunk });
    });
    onNetworkChunk.mockClear();

    await act(async () => {
      await result.current.declineNetworkToolCall('askHuman', 'run-net-1');
    });

    await waitFor(() => expect(result.current.messages.length).toBeGreaterThanOrEqual(2));
    expect(onNetworkChunk).toHaveBeenCalledTimes(2);
    const message = result.current.messages[result.current.messages.length - 1];
    expect(message.role).toBe('assistant');
    expect(message.content.format).toBe(2);
    expect(message.content.metadata?.mode).toBe('network');
    const part = message.content.parts[0] as Record<string, unknown>;
    expect(part.type).toBe('dynamic-tool');
    expect(part.toolName).toBe('askHuman');
    expect(part.state).toBe('output-available');
    expect(part.output).toEqual({ declined: true });
  });

  it('seeds the user message exactly once when sendMessage uses network mode', async () => {
    nextNetworkChunks = [
      toolExecutionStartChunk('lookupWeather', 'tc-net-dedupe'),
      toolExecutionEndChunk('tc-net-dedupe', 'sunny'),
    ];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({ mode: 'network', message: 'what is the weather' });
    });

    const userMessages = result.current.messages.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    const firstUserPart = userMessages[0]?.content.parts[0] as Record<string, unknown>;
    expect(firstUserPart.type).toBe('text');
    expect(firstUserPart.text).toBe('what is the weather');
  });
});

// =============================================================================
// INITIAL-MESSAGE RELOAD — REGRESSIONS
// =============================================================================
//
// The deleted `resolveInitialMessages` normalized persisted (reloaded) messages
// before they entered chat state. `useChat` now passes `initialMessages` through
// untouched, dropping two behaviors that the playground render layer still
// depends on.

describe('useChat initial-message reload', () => {
  it('exposes requireApprovalMetadata for a reloaded message with persisted pendingToolApprovals', async () => {
    // The server persists a pending tool approval as content.metadata.pendingToolApprovals
    // (no requireApprovalMetadata, no mode). The approval UI (tool-fallback) only reads
    // requireApprovalMetadata, so the reload path must derive it — otherwise the
    // Approve/Decline buttons vanish on refresh and the run cannot be resumed.
    const initial: MastraDBMessage[] = [
      {
        id: 'm-approval',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'tc-1',
                toolName: 'sendEmail',
                state: 'approval-requested',
                args: { to: 'x' },
              },
            } as unknown as MastraDBMessage['content']['parts'][number],
          ],
          metadata: {
            pendingToolApprovals: {
              sendEmail: { toolCallId: 'tc-1', toolName: 'sendEmail', args: { to: 'x' }, runId: 'run-1' },
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useChat({ agentId: 'test-agent', initialMessages: initial }), { wrapper });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    const metadata = result.current.messages[0]?.content.metadata as Record<string, any> | undefined;
    expect(metadata?.requireApprovalMetadata?.sendEmail?.toolCallId).toBe('tc-1');
  });

  it('drops a persisted assistant message flagged completionResult.suppressFeedback on reload', async () => {
    const initial: MastraDBMessage[] = [
      {
        id: 'u-1',
        role: 'user',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
      },
      {
        id: 'm-suppressed',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'internal completion feedback' }],
          metadata: { completionResult: { passed: true, suppressFeedback: true } },
        },
      },
    ];

    const { result } = renderHook(() => useChat({ agentId: 'test-agent', initialMessages: initial }), { wrapper });

    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    const texts = result.current.messages.flatMap(m =>
      m.content.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text as string),
    );
    expect(texts).not.toContain('internal completion feedback');
  });
});

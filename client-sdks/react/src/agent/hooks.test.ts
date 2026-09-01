// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { TaskItem } from '@mastra/core/signals';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MESSAGE_ID_KEY } from '../lib/mastra-db';
import type { MastraDBMessageMetadata } from '../lib/mastra-db';
import type { ClientToolsInput } from './types';

// Capture spies that every constructed MastraClient instance will expose via
// getAgent(). This lets us assert what the React hook actually forwards to the
// underlying client-js Agent methods.
const sendSignalMock = vi.fn(async (_params?: unknown) => ({ accepted: true, runId: 'run-mock' }));
const sendMessageMock = vi.fn(async (_params?: unknown) => ({ accepted: true, runId: 'run-mock' }));
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
const resumeStreamMock = vi.fn(async () => ({
  body: { cancel: vi.fn() },
  processDataStream: approveToolCallProcessDataStreamMock,
}));
const sendToolApprovalMock = vi.fn(async () => ({
  accepted: true,
  runId: 'run-approval',
  toolCallId: 'tool-call-approval-1',
}));
const approveToolCallGenerateMock = vi.fn(async () => ({ response: { uiMessages: [] } }));
const declineToolCallGenerateMock = vi.fn(async () => ({ response: { uiMessages: [] } }));
const declineToolCallMock = vi.fn(async () => ({
  body: { cancel: vi.fn() },
  processDataStream: async () => {
    /* no chunks */
  },
}));
let nextStreamChunks: unknown[] = [];
const streamMock = vi.fn(async () => ({
  body: { cancel: vi.fn() },
  processDataStream: async ({ onChunk }: { onChunk: (chunk: unknown) => Promise<void> | void }) => {
    for (const chunk of nextStreamChunks) {
      await onChunk(chunk);
    }
  },
}));

// Controllable subscribe-to-thread stream: each test installs an async chunk
// producer that simulates the server pushing chunks over the open subscription.
let nextSubscribeChunks: Array<any> = [];
let keepSubscriptionOpen = false;
let omitThreadSubscriptionUnsubscribe = false;
let subscriptionChunkHandler: ((chunk: any) => Promise<void> | void) | undefined;
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
      subscriptionChunkHandler = onChunk;
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
      constructedClientOptions.push(options);
    }
    getAgent() {
      return {
        sendSignal: sendSignalMock,
        sendMessage: sendMessageMock,
        approveToolCall: approveToolCallMock,
        resumeStream: resumeStreamMock,
        sendToolApproval: sendToolApprovalMock,
        approveToolCallGenerate: approveToolCallGenerateMock,
        declineToolCallGenerate: declineToolCallGenerateMock,
        declineToolCall: declineToolCallMock,
        stream: streamMock,
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
  const clientTools: ClientToolsInput = {
    testTool: {
      id: 'testTool',
      description: 'A test tool',
      execute: vi.fn(),
    },
  };

  beforeEach(() => {
    sendSignalMock.mockClear();
    sendMessageMock.mockClear();
    approveToolCallMock.mockClear();
    resumeStreamMock.mockClear();
    sendToolApprovalMock.mockClear();
    approveToolCallGenerateMock.mockClear();
    declineToolCallGenerateMock.mockClear();
    declineToolCallMock.mockClear();
    approveToolCallProcessDataStreamMock.mockClear();
    streamMock.mockClear();
    subscribeToThreadMock.mockClear();
    threadSubscriptionAbortMock.mockClear();
    threadSubscriptionUnsubscribeMock.mockClear();
    generateMock.mockClear();
    networkMock.mockClear();
    approveNetworkToolCallMock.mockClear();
    declineNetworkToolCallMock.mockClear();
    nextSubscribeChunks = [];
    nextStreamChunks = [];
    nextNetworkChunks = [];
    nextApproveNetworkChunks = [];
    nextDeclineNetworkChunks = [];
    nextApproveToolCallChunks = [];
    keepSubscriptionOpen = false;
    omitThreadSubscriptionUnsubscribe = false;
    subscriptionChunkHandler = undefined;
    constructedClientOptions.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses the legacy stream path by default when threadId is provided', async () => {
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
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

    expect(subscribeToThreadMock).not.toHaveBeenCalled();
    expect(sendSignalMock).not.toHaveBeenCalled();
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('retains the model override for stream approval', async () => {
    const { result } = renderHook(() => useChat({ agentId: 'test-agent' }), { wrapper });

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'hi',
        model: 'google/gemini-2.5-flash',
      });
      await result.current.approveToolCall('tool-call-approval-1');
    });

    expect(streamMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: 'google/gemini-2.5-flash' }),
    );
    expect(approveToolCallMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'google/gemini-2.5-flash' }));
  });

  it('retains the locally generated run ID when a legacy terminal chunk omits run identity', async () => {
    nextStreamChunks = [{ type: 'finish', payload: {} }];
    const { result } = renderHook(
      () => useChat({ agentId: 'test-agent', threadId: 'thread-1', enableThreadSignals: false }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({ mode: 'stream', message: 'hi' });
      await result.current.approveToolCall('tool-call-approval-1');
    });

    expect(approveToolCallMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: expect.any(String), toolCallId: 'tool-call-approval-1' }),
    );
  });

  it('uses resumeStream for custom resume data on the legacy stream transport', async () => {
    const { result } = renderHook(
      () => useChat({ agentId: 'test-agent', threadId: 'thread-1', enableThreadSignals: false }),
      { wrapper },
    );
    const resumeData = {
      action: 'approved',
      path: '.mastracode/plans/ship.md',
      title: 'Ship',
      plan: '# Ship',
    };

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'hi',
      });
      await result.current.approveToolCall('submit-plan-call', resumeData);
    });

    expect(resumeStreamMock).toHaveBeenCalledWith(
      resumeData,
      expect.objectContaining({ toolCallId: 'submit-plan-call' }),
    );
    expect(approveToolCallMock).not.toHaveBeenCalled();
  });

  it('resets approval state when custom resume data is rejected on the legacy stream transport', async () => {
    const { result } = renderHook(
      () => useChat({ agentId: 'test-agent', threadId: 'thread-1', enableThreadSignals: false }),
      { wrapper },
    );
    const error = new Error('resume failed');
    let rejectResume!: (error: Error) => void;
    resumeStreamMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectResume = reject;
        }),
    );

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'hi',
      });
    });

    const approval = result.current.approveToolCall('submit-plan-call', { action: 'approved' });
    await waitFor(() => {
      expect(result.current.toolCallApprovals).toHaveProperty('submit-plan-call', { status: 'approved' });
      expect(result.current.isRunning).toBe(true);
    });

    let rejection: unknown;
    await act(async () => {
      rejectResume(error);
      try {
        await approval;
      } catch (caught) {
        rejection = caught;
      }
    });

    expect(rejection).toBe(error);
    expect(result.current.toolCallApprovals).not.toHaveProperty('submit-plan-call');
    expect(result.current.isRunning).toBe(false);
  });

  it('resets decline state when a legacy stream continuation is rejected', async () => {
    const { result } = renderHook(
      () => useChat({ agentId: 'test-agent', threadId: 'thread-1', enableThreadSignals: false }),
      { wrapper },
    );
    const error = new Error('decline failed');
    declineToolCallMock.mockRejectedValueOnce(error);

    await act(async () => {
      await result.current.sendMessage({ mode: 'stream', message: 'hi' });
    });

    let rejection: unknown;
    await act(async () => {
      try {
        await result.current.declineToolCall('tool-call-decline-1');
      } catch (caught) {
        rejection = caught;
      }
    });

    expect(rejection).toBe(error);
    expect(result.current.toolCallApprovals).not.toHaveProperty('tool-call-decline-1');
    expect(result.current.isRunning).toBe(false);
  });

  it.each(['approve', 'decline'] as const)('resets %s state when a generate continuation is rejected', async action => {
    const { result } = renderHook(() => useChat({ agentId: 'test-agent' }), { wrapper });
    const error = new Error(`${action} generate failed`);
    const continuationMock = action === 'approve' ? approveToolCallGenerateMock : declineToolCallGenerateMock;
    continuationMock.mockRejectedValueOnce(error);
    generateMock.mockResolvedValueOnce({
      response: { uiMessages: [] },
      finishReason: 'suspended',
      suspendPayload: {
        toolCallId: 'tool-call-generate-1',
        toolName: 'weatherTool',
        args: { city: 'London' },
      },
    });

    await act(async () => {
      await result.current.sendMessage({ mode: 'generate', message: 'hi' });
    });
    expect(result.current.isAwaitingToolApproval).toBe(true);

    let rejection: unknown;
    await act(async () => {
      try {
        if (action === 'approve') {
          await result.current.approveToolCallGenerate('tool-call-generate-1');
        } else {
          await result.current.declineToolCallGenerate('tool-call-generate-1');
        }
      } catch (caught) {
        rejection = caught;
      }
    });

    expect(rejection).toBe(error);
    expect(result.current.toolCallApprovals).not.toHaveProperty('tool-call-generate-1');
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(true);
  });

  it('pins a suspended generate approval to its original run while a later generate completes', async () => {
    generateMock
      .mockResolvedValueOnce({
        response: { uiMessages: [] },
        finishReason: 'suspended',
        suspendPayload: {
          toolCallId: 'tool-call-generate-1',
          toolName: 'weatherTool',
          args: { city: 'London' },
        },
      })
      .mockResolvedValueOnce({ response: { uiMessages: [] }, finishReason: 'stop' });
    const { result } = renderHook(() => useChat({ agentId: 'test-agent' }), { wrapper });

    await act(async () => {
      await result.current.sendMessage({ mode: 'generate', message: 'first' });
    });
    const firstRunId = generateMock.mock.calls[0]?.[1]?.runId;
    expect(firstRunId).toEqual(expect.any(String));
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(true);

    await act(async () => {
      await result.current.sendMessage({ mode: 'generate', message: 'second' });
    });
    const secondRunId = generateMock.mock.calls[1]?.[1]?.runId;
    expect(secondRunId).not.toBe(firstRunId);
    expect(result.current.isAwaitingToolApproval).toBe(true);

    await act(async () => {
      await result.current.approveToolCallGenerate('tool-call-generate-1');
    });

    expect(approveToolCallGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: firstRunId, toolCallId: 'tool-call-generate-1' }),
    );
    expect(result.current.isAwaitingToolApproval).toBe(false);
  });

  it.each(['approve', 'decline'] as const)('resets %s state when a network continuation is rejected', async action => {
    const { result } = renderHook(() => useChat({ agentId: 'test-agent' }), { wrapper });
    const error = new Error(`${action} network failed`);
    const continuationMock = action === 'approve' ? approveNetworkToolCallMock : declineNetworkToolCallMock;
    continuationMock.mockRejectedValueOnce(error);

    await act(async () => {
      await result.current.sendMessage({ mode: 'network', message: 'hi' });
    });

    let rejection: unknown;
    await act(async () => {
      try {
        if (action === 'approve') {
          await result.current.approveNetworkToolCall('tool-1', 'run-net-1');
        } else {
          await result.current.declineNetworkToolCall('tool-1', 'run-net-1');
        }
      } catch (caught) {
        rejection = caught;
      }
    });

    expect(rejection).toBe(error);
    expect(result.current.networkToolCallApprovals).not.toHaveProperty('run-net-1-tool-1');
    expect(result.current.isRunning).toBe(false);
  });

  it('retains the model override for network approval', async () => {
    const { result } = renderHook(() => useChat({ agentId: 'test-agent' }), { wrapper });

    await act(async () => {
      await result.current.sendMessage({
        mode: 'network',
        message: 'hi',
        model: 'google/gemini-2.5-flash',
      });
      await result.current.approveNetworkToolCall('tool', 'run-net-1');
    });

    expect(networkMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: 'google/gemini-2.5-flash' }),
    );
    expect(approveNetworkToolCallMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'google/gemini-2.5-flash' }),
    );
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
      const metadata = lastMessage?.content?.metadata as MastraDBMessageMetadata | undefined;
      expect(metadata?.mode).toBe('stream');
      if (metadata?.mode !== 'stream') throw new Error('expected stream metadata');
      expect(metadata.requireApprovalMetadata?.weatherTool).toEqual({
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
    sendMessageMock.mockClear();

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'paris',
        threadId: 'thread-1',
      });
    });

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          metadata: expect.objectContaining({ [CLIENT_MESSAGE_ID_KEY]: expect.any(String) }),
        }),
        threadId: 'thread-1',
      }),
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
      const metadata = lastMessage?.content?.metadata as MastraDBMessageMetadata | undefined;
      expect(metadata?.mode).toBe('stream');
      if (metadata?.mode !== 'stream') throw new Error('expected stream metadata');
      expect(metadata.requireApprovalMetadata?.weatherTool).toBeDefined();
    });

    await act(async () => {
      await result.current.approveToolCall('tool-call-approval-1');
    });

    expect(sendToolApprovalMock).toHaveBeenCalledWith({
      runId: 'run-approval',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      toolCallId: 'tool-call-approval-1',
      approved: true,
      requestContext: undefined,
    });
    expect(approveToolCallMock).not.toHaveBeenCalled();
    expect(approveToolCallProcessDataStreamMock).not.toHaveBeenCalled();
    expect(result.current.isAwaitingToolApproval).toBe(false);

    unmount();
  });

  it('pins subscription-native decline to the subscribed run', async () => {
    nextSubscribeChunks = [
      {
        type: 'start',
        runId: 'run-decline',
        from: 'AGENT',
        payload: { messageId: 'msg-decline' },
      },
      {
        type: 'tool-call-approval',
        runId: 'run-decline',
        from: 'AGENT',
        payload: { toolName: 'weatherTool', toolCallId: 'tool-call-decline-1', args: { city: 'Paris' } },
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
      await result.current.declineToolCall('tool-call-decline-1');
    });

    expect(sendToolApprovalMock).toHaveBeenCalledWith({
      runId: 'run-decline',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      toolCallId: 'tool-call-decline-1',
      approved: false,
      requestContext: undefined,
    });
    expect(declineToolCallMock).not.toHaveBeenCalled();
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
    sendToolApprovalMock.mockRejectedValueOnce(new Error('approval failed'));

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
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [],
          metadata: {
            mode: 'stream',
            requireApprovalMetadata: {
              weatherTool: {
                runId: 'run-approval',
                toolCallId: 'tool-call-approval-1',
                toolName: 'weatherTool',
                args: {},
              },
              locationTool: {
                runId: 'run-approval',
                toolCallId: 'tool-call-approval-2',
                toolName: 'locationTool',
                args: {},
              },
            },
          },
        },
      },
    ] satisfies MastraDBMessage[];

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

  it('converts persisted pendingToolApprovals into requireApprovalMetadata on initial load', async () => {
    const initialMessages = [
      {
        id: 'msg-reload-approval',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [],
          metadata: {
            pendingToolApprovals: {
              'tool-call-reload-1': {
                runId: 'run-reload',
                toolCallId: 'tool-call-reload-1',
                toolName: 'weatherTool',
                args: { city: 'London' },
              },
            },
          },
        },
      },
    ] satisfies MastraDBMessage[];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages,
        }),
      { wrapper },
    );

    await waitFor(() => {
      const lastMessage = result.current.messages.at(-1);
      const metadata = lastMessage?.content?.metadata as MastraDBMessageMetadata | undefined;
      expect(metadata?.mode).toBe('stream');
      expect(metadata?.requireApprovalMetadata?.['tool-call-reload-1']).toEqual({
        runId: 'run-reload',
        toolCallId: 'tool-call-reload-1',
        toolName: 'weatherTool',
        args: { city: 'London' },
      });
    });
    expect(result.current.isAwaitingToolApproval).toBe(true);
  });

  it('drops already-completed pendingToolApprovals from requireApprovalMetadata on initial load', async () => {
    const initialMessages = [
      {
        id: 'msg-reload-completed',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tool-call-done',
                toolName: 'weatherTool',
                args: { city: 'London' },
                result: { temperature: 20 },
              },
            },
          ],
          metadata: {
            pendingToolApprovals: {
              'tool-call-done': {
                runId: 'run-reload',
                toolCallId: 'tool-call-done',
                toolName: 'weatherTool',
                args: { city: 'London' },
              },
            },
          },
        },
      },
    ] satisfies MastraDBMessage[];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages,
        }),
      { wrapper },
    );

    await waitFor(() => {
      const lastMessage = result.current.messages.at(-1);
      const metadata = lastMessage?.content?.metadata as MastraDBMessageMetadata | undefined;
      expect(metadata?.mode).toBe('stream');
      expect(metadata?.requireApprovalMetadata).toBeUndefined();
    });
    expect(result.current.isAwaitingToolApproval).toBe(false);
  });

  it('filters suppressed completion messages out of initial load', async () => {
    const initialMessages = [
      {
        id: 'msg-visible',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'hello' }],
          metadata: { mode: 'stream' },
        },
      },
      {
        id: 'msg-suppressed',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'suppressed feedback' }],
          metadata: {
            mode: 'stream',
            completionResult: { suppressFeedback: true },
          },
        },
      },
    ] satisfies MastraDBMessage[];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.messages.map(message => message.id)).toEqual(['msg-visible']);
    });
  });

  it('strips transient pending status from initial messages on reload', async () => {
    const initialMessages = [
      {
        id: 'msg-was-pending',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'hello' }],
          metadata: {
            mode: 'stream',
            status: 'pending',
            [CLIENT_MESSAGE_ID_KEY]: 'client-msg-leftover',
          },
        },
      },
    ] satisfies MastraDBMessage[];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages,
        }),
      { wrapper },
    );

    await waitFor(() => {
      const lastMessage = result.current.messages.at(-1);
      const metadata = lastMessage?.content?.metadata as MastraDBMessageMetadata | undefined;
      expect(metadata?.status).toBeUndefined();
      expect(metadata?.[CLIENT_MESSAGE_ID_KEY]).toBeUndefined();
    });
    expect(result.current.messages.map(message => message.id)).toEqual(['msg-was-pending']);
  });

  it('strips a leftover clientMessageId even when the reloaded message is not pending', async () => {
    // The correlation key is sent to the server with the message and can be
    // persisted, so a reloaded (non-pending) message may still carry it. It must
    // never survive into rendered state; the row key falls back to the stable id.
    const initialMessages = [
      {
        id: 'msg-confirmed',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'hello' }],
          metadata: {
            mode: 'stream',
            [CLIENT_MESSAGE_ID_KEY]: 'client-msg-leftover',
          },
        },
      },
    ] satisfies MastraDBMessage[];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages,
        }),
      { wrapper },
    );

    await waitFor(() => {
      const lastMessage = result.current.messages.at(-1);
      const metadata = lastMessage?.content?.metadata as MastraDBMessageMetadata | undefined;
      expect(metadata?.[CLIENT_MESSAGE_ID_KEY]).toBeUndefined();
    });
    expect(result.current.messages.map(message => message.id)).toEqual(['msg-confirmed']);
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

  // Regression test for https://github.com/mastra-ai/mastra/issues/18768:
  // an aborted mount-time subscribe used to stay cached (so no send ever
  // retried the subscribe fetch) and the rejection escaped stream() uncaught,
  // leaving isRunning stuck true until a full reload.
  it('retries an aborted thread subscription on send and never leaves isRunning stuck', async () => {
    const abortError = Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' });
    // Reject both the mount-time subscribe AND the send-time retry so we
    // exercise the retry and the isRunning cleanup on failure.
    subscribeToThreadMock.mockRejectedValueOnce(abortError).mockRejectedValueOnce(abortError);

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

    // Mount-time subscription attempt fails and is swallowed (isAbortError).
    await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalledTimes(1));
    expect(result.current.isRunning).toBe(false);

    let sendError: unknown;
    await act(async () => {
      try {
        await result.current.sendMessage({ mode: 'stream', message: 'hello', threadId: 'thread-1' });
      } catch (error) {
        sendError = error;
      }
    });

    // The send path released the dead cached rejection and retried the
    // subscribe fetch instead of re-awaiting the stale promise.
    expect(subscribeToThreadMock).toHaveBeenCalledTimes(2);
    expect((sendError as Error | undefined)?.name).toBe('AbortError');
    expect(result.current.isRunning).toBe(false);
  });

  it('resets isRunning when the signal send request itself fails', async () => {
    sendMessageMock.mockRejectedValueOnce(new Error('network down'));

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

    let sendError: unknown;
    await act(async () => {
      try {
        await result.current.sendMessage({ mode: 'stream', message: 'hello', threadId: 'thread-1' });
      } catch (error) {
        sendError = error;
      }
    });

    expect((sendError as Error | undefined)?.message).toBe('network down');
    expect(result.current.isRunning).toBe(false);
  });

  it('uses the legacy stream path when thread signals are explicitly disabled', async () => {
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          enableThreadSignals: false,
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

    expect(subscribeToThreadMock).not.toHaveBeenCalled();
    expect(sendSignalMock).not.toHaveBeenCalled();
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('keeps hook-prop clientTools on sendMessage when threadId is provided', async () => {
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
    const messageCalls = sendMessageMock.mock.calls as unknown as Array<[any]>;
    expect(messageCalls[0]?.[0].ifIdle.streamOptions.clientTools).toBe(clientTools);
  });

  it('keeps per-send clientTools and continuation options on sendMessage', async () => {
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
      await subscriptionChunkHandler?.({ type: 'finish', runId: 'run-mock', payload: {} });
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

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    const messageCalls = sendMessageMock.mock.calls as unknown as Array<[any]>;
    expect(messageCalls[0]?.[0].ifIdle.streamOptions).toEqual(
      expect.objectContaining({
        maxSteps: 3,
        instructions: 'use the hook tool',
        requestContext: { userId: 'user-123' },
        clientTools,
      }),
    );
    expect(messageCalls[1]?.[0].ifIdle.streamOptions).toEqual(
      expect.objectContaining({
        maxSteps: 5,
        instructions: 'use the per-send tool',
        requestContext: { userId: 'user-456' },
        clientTools: perSendClientTools,
      }),
    );
    expect(streamMock).not.toHaveBeenCalled();
  });

  it('forwards hook-prop clientTools through the legacy stream (untilIdle) path when no threadId is set', async () => {
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

    expect(streamMock).toHaveBeenCalledTimes(1);
    const calls = streamMock.mock.calls as unknown as Array<[unknown, { clientTools: unknown }]>;
    expect(calls[0]?.[1].clientTools).toBe(clientTools);
    expect(sendMessageMock).not.toHaveBeenCalled();
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

describe('useChat version selection', () => {
  beforeEach(() => {
    sendSignalMock.mockClear();
    sendMessageMock.mockClear();
    approveToolCallMock.mockClear();
    resumeStreamMock.mockClear();
    declineToolCallMock.mockClear();
    sendToolApprovalMock.mockClear();
    approveToolCallGenerateMock.mockClear();
    declineToolCallGenerateMock.mockClear();
    approveNetworkToolCallMock.mockClear();
    declineNetworkToolCallMock.mockClear();
    streamMock.mockClear();
    subscribeToThreadMock.mockClear();
    generateMock.mockClear();
    networkMock.mockClear();
    nextSubscribeChunks = [];
    nextStreamChunks = [];
    nextNetworkChunks = [];
    nextApproveToolCallChunks = [];
    nextApproveNetworkChunks = [];
    nextDeclineNetworkChunks = [];
    keepSubscriptionOpen = false;
    omitThreadSubscriptionUnsubscribe = false;
    subscriptionChunkHandler = undefined;
    constructedClientOptions.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when a label-selected run starts', () => {
    it.each([
      ['generate', generateMock],
      ['stream', streamMock],
      ['network', networkMock],
    ] as const)('preserves the label selector in %s mode', async (mode, requestMock) => {
      const versions = {
        self: { label: 'candidate' },
        agents: { researcher: { versionId: 'researcher-v1' } },
      } as const;
      const { result } = renderHook(() => useChat({ agentId: 'test-agent', versions }), { wrapper });

      await act(async () => {
        await result.current.sendMessage({ mode, message: 'hi' });
      });

      expect(requestMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ versions }));
    });

    it('preserves the label selector in a message-started run', async () => {
      const versions = { self: { label: 'candidate' } } as const;
      const { result } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions,
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalled());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi', threadId: 'thread-1' });
      });

      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ ifIdle: { streamOptions: expect.objectContaining({ versions }) } }),
      );
    });

    it('preserves the label selector in a signal-started run', async () => {
      const versions = { self: { label: 'candidate' } } as const;
      sendMessageMock.mockRejectedValueOnce({ status: 404 });
      const { result } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions,
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalled());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi', threadId: 'thread-1' });
      });

      expect(sendSignalMock).toHaveBeenCalledWith(
        expect.objectContaining({ ifIdle: { streamOptions: expect.objectContaining({ versions }) } }),
      );
    });

    it.each([
      ['ENTITY_NOT_FOUND', 404, { self: { label: 'removed' } }],
      ['LABEL_NOT_FOUND', 404, { self: { label: 'removed' } }],
      ['VERSION_NOT_FOUND', 404, { self: { versionId: 'removed-version' } }],
      ['VERSION_LABELS_UNSUPPORTED', 501, { self: { label: 'unsupported' } }],
    ] as const)('does not retry a stable %s rejection through another signal route', async (code, status, versions) => {
      const selectorError = {
        status,
        body: { error: { code, message: 'The selected run target no longer exists.' } },
      };
      sendMessageMock.mockRejectedValueOnce(selectorError);
      const { result, unmount } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions,
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalled());

      let sendError: unknown;
      await act(async () => {
        try {
          await result.current.sendMessage({ mode: 'stream', message: 'hi', threadId: 'thread-1' });
        } catch (error) {
          sendError = error;
        }
      });

      expect(sendError).toBe(selectorError);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(sendSignalMock).not.toHaveBeenCalled();
      expect(streamMock).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe('when a send supplies an exact selector', () => {
    it.each([
      ['generate', generateMock],
      ['stream', streamMock],
      ['network', networkMock],
    ] as const)('uses the exact selector instead of the hook-level label in %s mode', async (mode, requestMock) => {
      const { result } = renderHook(
        () => useChat({ agentId: 'test-agent', versions: { self: { label: 'candidate' } } }),
        { wrapper },
      );

      await act(async () => {
        await result.current.sendMessage({
          mode,
          message: 'hi',
          versions: { self: { versionId: 'root-v1' } },
        });
      });

      expect(requestMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ versions: { self: { versionId: 'root-v1' } } }),
      );
    });

    it('uses the exact selector for a message-started run', async () => {
      const versions = { self: { versionId: 'root-v1' } } as const;
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
      await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalled());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi', threadId: 'thread-1', versions });
      });

      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ ifIdle: { streamOptions: expect.objectContaining({ versions }) } }),
      );
      unmount();
    });

    it('uses the exact selector for a signal-started run', async () => {
      const versions = { self: { versionId: 'root-v1' } } as const;
      sendMessageMock.mockRejectedValueOnce({ status: 404 });
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
      await waitFor(() => expect(subscribeToThreadMock).toHaveBeenCalled());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi', threadId: 'thread-1', versions });
      });

      expect(sendSignalMock).toHaveBeenCalledWith(
        expect.objectContaining({ ifIdle: { streamOptions: expect.objectContaining({ versions }) } }),
      );
      unmount();
    });
  });

  describe('when trusted resolution metadata arrives', () => {
    it('exposes the first exact root identity with the requested selector', async () => {
      nextStreamChunks = [
        {
          type: 'resolved-version-overrides',
          payload: {
            self: { versionId: 'root-v1' },
            agents: { researcher: { versionId: 'researcher-v1' } },
            versionContinuationToken: 'opaque-token',
          },
        },
        {
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v2' } },
        },
      ];
      const onRunVersionIdentity = vi.fn();
      const { result } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            versions: { self: { label: 'candidate' } },
            onRunVersionIdentity,
          }),
        { wrapper },
      );

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi' });
      });

      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });
    });

    it('does not forward private resolution metadata to the chunk callback', async () => {
      nextStreamChunks = [
        {
          type: 'resolved-version-overrides',
          payload: {
            self: { versionId: 'root-v1' },
            versionContinuationToken: 'opaque-token',
          },
        },
      ];
      const onChunk = vi.fn();
      const { result } = renderHook(
        () => useChat({ agentId: 'test-agent', versions: { self: { label: 'candidate' } } }),
        { wrapper },
      );

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi', onChunk });
      });

      expect(onChunk).not.toHaveBeenCalled();
    });

    it('notifies consumers once with the sanitized identity', async () => {
      nextStreamChunks = [
        {
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v1' }, versionContinuationToken: 'opaque-token' },
        },
        {
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v2' } },
        },
      ];
      const onRunVersionIdentity = vi.fn();
      const { result } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            versions: { self: { label: 'candidate' } },
            onRunVersionIdentity,
          }),
        { wrapper },
      );

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi' });
      });

      expect(onRunVersionIdentity).toHaveBeenCalledOnce();
      expect(onRunVersionIdentity).toHaveBeenCalledWith({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });
    });

    it('reads generate response metadata without exposing continuation data', async () => {
      generateMock.mockResolvedValueOnce({
        response: { uiMessages: [] },
        finishReason: 'stop',
        resolvedVersionOverrides: {
          self: { versionId: 'root-v1' },
          versionContinuationToken: 'opaque-token',
        },
      });
      const onRunVersionIdentity = vi.fn();
      const { result } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            versions: { self: { versionId: 'requested-root-v1' } },
            onRunVersionIdentity,
          }),
        { wrapper },
      );

      await act(async () => {
        await result.current.sendMessage({ mode: 'generate', message: 'hi' });
      });

      expect(onRunVersionIdentity).toHaveBeenCalledWith({
        requested: { versionId: 'requested-root-v1' },
        resolvedVersionId: 'root-v1',
      });
    });

    it('reads network metadata without forwarding the private chunk', async () => {
      nextNetworkChunks = [
        {
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v1' }, versionContinuationToken: 'opaque-token' },
        },
      ];
      const onNetworkChunk = vi.fn();
      const { result } = renderHook(
        () => useChat({ agentId: 'test-agent', versions: { self: { label: 'candidate' } } }),
        { wrapper },
      );

      await act(async () => {
        await result.current.sendMessage({ mode: 'network', message: 'hi', onNetworkChunk });
      });

      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });
      expect(onNetworkChunk).not.toHaveBeenCalled();
    });

    it('reads metadata from a thread subscription after a message starts a run', async () => {
      keepSubscriptionOpen = true;
      const onRunVersionIdentity = vi.fn();
      const { result, unmount } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions: { self: { label: 'candidate' } },
            onRunVersionIdentity,
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscriptionChunkHandler).toBeDefined());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi', threadId: 'thread-1' });
        await subscriptionChunkHandler?.({
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v1' }, versionContinuationToken: 'opaque-token' },
        });
      });

      expect(onRunVersionIdentity).toHaveBeenCalledWith({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });
      unmount();
    });
  });

  describe('when a thread run receives another user turn', () => {
    it('does not let an overlapping late start acknowledgement replace the newer active run', async () => {
      keepSubscriptionOpen = true;
      let releaseFirstAcknowledgement = () => {};
      let markFirstRunTerminated = () => {};
      const firstAcknowledgementGate = new Promise<void>(resolve => {
        releaseFirstAcknowledgement = resolve;
      });
      const firstRunTerminated = new Promise<void>(resolve => {
        markFirstRunTerminated = resolve;
      });
      sendMessageMock
        .mockImplementationOnce(async () => {
          await subscriptionChunkHandler?.({
            type: 'start',
            runId: 'run-fast',
            payload: { messageId: 'message-fast' },
          });
          await subscriptionChunkHandler?.({ type: 'finish', runId: 'run-fast', payload: {} });
          markFirstRunTerminated();
          await firstAcknowledgementGate;
          return { accepted: true, runId: 'run-fast' };
        })
        .mockResolvedValueOnce({ accepted: true, runId: 'run-next' })
        .mockResolvedValueOnce({ accepted: true, runId: 'run-next' });
      const { result, unmount } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions: { self: { label: 'candidate' } },
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscriptionChunkHandler).toBeDefined());

      let firstSend = Promise.resolve();
      await act(async () => {
        firstSend = result.current.sendMessage({ mode: 'stream', message: 'fast run', threadId: 'thread-1' });
        await firstRunTerminated;
      });
      await act(async () => {
        await result.current.sendMessage({
          mode: 'stream',
          message: 'new run',
          threadId: 'thread-1',
          versions: { self: { label: 'next' } },
        });
      });
      await act(async () => {
        releaseFirstAcknowledgement();
        await firstSend;
      });
      await act(async () => {
        await result.current.sendMessage({
          mode: 'stream',
          message: 'continue new run',
          threadId: 'thread-1',
          versions: { self: { label: 'deleted-old-target' } },
        });
      });

      const continuationRequest = sendMessageMock.mock.calls[2]?.[0];
      expect(continuationRequest).toMatchObject({ runId: 'run-next' });
      expect(continuationRequest).not.toHaveProperty('ifIdle');
      unmount();
    });

    it('does not reuse a run id that terminated before its start request was acknowledged', async () => {
      keepSubscriptionOpen = true;
      sendMessageMock
        .mockImplementationOnce(async () => {
          await subscriptionChunkHandler?.({
            type: 'start',
            runId: 'run-fast',
            payload: { messageId: 'message-fast' },
          });
          await subscriptionChunkHandler?.({ type: 'finish', runId: 'run-fast', payload: {} });
          return { accepted: true, runId: 'run-fast' };
        })
        .mockResolvedValueOnce({ accepted: true, runId: 'run-next' });
      const { result, unmount } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions: { self: { label: 'candidate' } },
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscriptionChunkHandler).toBeDefined());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'fast run', threadId: 'thread-1' });
        await result.current.sendMessage({
          mode: 'stream',
          message: 'after fast run',
          threadId: 'thread-1',
          versions: { self: { label: 'next' } },
        });
      });

      const nextRequest = sendMessageMock.mock.calls[1]?.[0];
      expect(nextRequest).not.toHaveProperty('runId');
      expect(nextRequest).toMatchObject({
        ifIdle: { streamOptions: { versions: { self: { label: 'next' } } } },
      });
      unmount();
    });

    it('preserves message-started identity while active and replaces it after the thread becomes idle', async () => {
      keepSubscriptionOpen = true;
      sendMessageMock
        .mockResolvedValueOnce({ accepted: true, runId: 'run-1' })
        .mockResolvedValueOnce({ accepted: true, runId: 'run-1' })
        .mockResolvedValueOnce({ accepted: true, runId: 'run-2' });
      const { result, unmount } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions: { self: { label: 'candidate' } },
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscriptionChunkHandler).toBeDefined());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'start', threadId: 'thread-1' });
        await subscriptionChunkHandler?.({
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v1' } },
        });
        await subscriptionChunkHandler?.({ type: 'start', runId: 'run-1', payload: { messageId: 'message-1' } });
      });
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });

      await act(async () => {
        await result.current.sendMessage({
          mode: 'stream',
          message: 'while active',
          threadId: 'thread-1',
          versions: { self: { label: 'next' } },
        });
      });
      const activeRequest = sendMessageMock.mock.calls[1]?.[0];
      expect(activeRequest).toMatchObject({ runId: 'run-1' });
      expect(activeRequest).not.toHaveProperty('ifIdle');
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });

      await act(async () => {
        await subscriptionChunkHandler?.({ type: 'finish', runId: 'run-1', payload: {} });
        await result.current.sendMessage({
          mode: 'stream',
          message: 'after idle',
          threadId: 'thread-1',
          versions: { self: { label: 'next' } },
        });
      });
      const idleRequest = sendMessageMock.mock.calls[2]?.[0];
      expect(idleRequest).not.toHaveProperty('runId');
      expect(idleRequest).toMatchObject({
        ifIdle: { streamOptions: { versions: { self: { label: 'next' } } } },
      });
      expect(result.current.runVersionIdentity).toBeUndefined();

      await act(async () => {
        await subscriptionChunkHandler?.({
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v2' } },
        });
      });
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'next' },
        resolvedVersionId: 'root-v2',
      });
      unmount();
    });

    it('preserves signal-started identity while active and replaces it after the thread becomes idle', async () => {
      keepSubscriptionOpen = true;
      sendMessageMock.mockRejectedValue({ status: 404 });
      sendSignalMock
        .mockResolvedValueOnce({ accepted: true, runId: 'run-1' })
        .mockResolvedValueOnce({ accepted: true, runId: 'run-1' })
        .mockResolvedValueOnce({ accepted: true, runId: 'run-2' });
      const { result, unmount } = renderHook(
        () =>
          useChat({
            agentId: 'test-agent',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            enableThreadSignals: true,
            versions: { self: { label: 'candidate' } },
          }),
        { wrapper },
      );
      await waitFor(() => expect(subscriptionChunkHandler).toBeDefined());

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'start', threadId: 'thread-1' });
        await subscriptionChunkHandler?.({
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v1' } },
        });
        await subscriptionChunkHandler?.({ type: 'start', runId: 'run-1', payload: { messageId: 'message-1' } });
      });
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });

      await act(async () => {
        await result.current.sendMessage({
          mode: 'stream',
          message: 'while active',
          threadId: 'thread-1',
          versions: { self: { label: 'next' } },
        });
      });
      const activeRequest = sendSignalMock.mock.calls[1]?.[0];
      expect(activeRequest).toMatchObject({ runId: 'run-1' });
      expect(activeRequest).not.toHaveProperty('ifIdle');
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'candidate' },
        resolvedVersionId: 'root-v1',
      });

      await act(async () => {
        await subscriptionChunkHandler?.({ type: 'finish', runId: 'run-1', payload: {} });
        await result.current.sendMessage({
          mode: 'stream',
          message: 'after idle',
          threadId: 'thread-1',
          versions: { self: { label: 'next' } },
        });
      });
      const idleRequest = sendSignalMock.mock.calls[2]?.[0];
      expect(idleRequest).not.toHaveProperty('runId');
      expect(idleRequest).toMatchObject({
        ifIdle: { streamOptions: { versions: { self: { label: 'next' } } } },
      });
      expect(result.current.runVersionIdentity).toBeUndefined();

      await act(async () => {
        await subscriptionChunkHandler?.({
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v2' } },
        });
      });
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'next' },
        resolvedVersionId: 'root-v2',
      });
      unmount();
    });
  });

  describe('when resolution metadata arrives out of order', () => {
    it('ignores an older generate response after a newer run starts', async () => {
      type GenerateResponse = {
        response: { uiMessages: never[] };
        finishReason: string;
        resolvedVersionOverrides: { self: { versionId: string } };
      };
      let resolveFirst: (response: GenerateResponse) => void = () => {};
      let resolveSecond: (response: GenerateResponse) => void = () => {};
      generateMock
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveFirst = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveSecond = resolve;
            }),
        );
      const onRunVersionIdentity = vi.fn();
      const { result } = renderHook(() => useChat({ agentId: 'test-agent', onRunVersionIdentity }), { wrapper });

      let firstSend: Promise<void> | undefined;
      await act(async () => {
        firstSend = result.current.sendMessage({
          mode: 'generate',
          message: 'first',
          versions: { self: { label: 'first' } },
        });
        await Promise.resolve();
      });
      let secondSend: Promise<void> | undefined;
      await act(async () => {
        secondSend = result.current.sendMessage({
          mode: 'generate',
          message: 'second',
          versions: { self: { label: 'second' } },
        });
        await Promise.resolve();
      });

      await act(async () => {
        resolveFirst({
          response: { uiMessages: [] },
          finishReason: 'stop',
          resolvedVersionOverrides: { self: { versionId: 'root-v1' } },
        });
        await firstSend;
      });
      expect(result.current.runVersionIdentity).toBeUndefined();

      await act(async () => {
        resolveSecond({
          response: { uiMessages: [] },
          finishReason: 'stop',
          resolvedVersionOverrides: { self: { versionId: 'root-v2' } },
        });
        await secondSend;
      });
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'second' },
        resolvedVersionId: 'root-v2',
      });
      expect(onRunVersionIdentity).toHaveBeenCalledOnce();
    });

    it('ignores an older stream chunk after a newer run starts', async () => {
      let firstChunkHandler: ((chunk: unknown) => Promise<void> | void) | undefined;
      let secondChunkHandler: ((chunk: unknown) => Promise<void> | void) | undefined;
      let finishFirstStream: () => void = () => {};
      let finishSecondStream: () => void = () => {};
      streamMock
        .mockResolvedValueOnce({
          body: { cancel: vi.fn() },
          processDataStream: ({ onChunk }: { onChunk: (chunk: unknown) => Promise<void> | void }) => {
            firstChunkHandler = onChunk;
            return new Promise<void>(resolve => {
              finishFirstStream = resolve;
            });
          },
        })
        .mockResolvedValueOnce({
          body: { cancel: vi.fn() },
          processDataStream: ({ onChunk }: { onChunk: (chunk: unknown) => Promise<void> | void }) => {
            secondChunkHandler = onChunk;
            return new Promise<void>(resolve => {
              finishSecondStream = resolve;
            });
          },
        });
      const { result } = renderHook(() => useChat({ agentId: 'test-agent' }), { wrapper });

      let firstSend: Promise<void> | undefined;
      await act(async () => {
        firstSend = result.current.sendMessage({
          mode: 'stream',
          message: 'first',
          versions: { self: { label: 'first' } },
        });
        await waitFor(() => expect(firstChunkHandler).toBeDefined());
      });
      let secondSend: Promise<void> | undefined;
      await act(async () => {
        secondSend = result.current.sendMessage({
          mode: 'stream',
          message: 'second',
          versions: { self: { label: 'second' } },
        });
        await waitFor(() => expect(secondChunkHandler).toBeDefined());
      });

      await act(async () => {
        await firstChunkHandler?.({
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v1' } },
        });
        finishFirstStream();
        await firstSend;
      });
      expect(result.current.runVersionIdentity).toBeUndefined();

      await act(async () => {
        await secondChunkHandler?.({
          type: 'resolved-version-overrides',
          payload: { self: { versionId: 'root-v2' } },
        });
        finishSecondStream();
        await secondSend;
      });
      expect(result.current.runVersionIdentity).toEqual({
        requested: { label: 'second' },
        resolvedVersionId: 'root-v2',
      });
    });
  });

  describe('when the chat scope changes', () => {
    it('clears the prior thread identity instead of showing it as history', async () => {
      nextStreamChunks = [{ type: 'resolved-version-overrides', payload: { self: { versionId: 'root-v1' } } }];
      const { result, rerender } = renderHook(
        ({ threadId }: { threadId: string }) =>
          useChat({
            agentId: 'test-agent',
            threadId,
            versions: { self: { label: 'candidate' } },
          }),
        { wrapper, initialProps: { threadId: 'thread-1' } },
      );
      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi' });
      });
      expect(result.current.runVersionIdentity).toBeDefined();

      rerender({ threadId: 'thread-2' });

      await waitFor(() => expect(result.current.runVersionIdentity).toBeUndefined());
    });
  });

  describe('when a selected run continues after tool approval', () => {
    it('does not add the mutable selector to the continuation', async () => {
      const { result } = renderHook(
        () => useChat({ agentId: 'test-agent', versions: { self: { label: 'candidate' } } }),
        { wrapper },
      );

      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi' });
        await result.current.approveToolCall('tool-call-1');
      });

      expect(approveToolCallMock.mock.calls[0]?.[0]).not.toHaveProperty('versions');
    });

    it('does not add the mutable selector to stream decline or resume calls', async () => {
      const { result } = renderHook(
        () => useChat({ agentId: 'test-agent', versions: { self: { label: 'candidate' } } }),
        { wrapper },
      );
      await act(async () => {
        await result.current.sendMessage({ mode: 'stream', message: 'hi' });
        await result.current.declineToolCall('tool-call-1');
        await result.current.approveToolCall('tool-call-2', { answer: 'yes' });
      });

      expect(declineToolCallMock.mock.calls[0]?.[0]).not.toHaveProperty('versions');
      expect(resumeStreamMock.mock.calls[0]?.[1]).not.toHaveProperty('versions');
    });

    it('does not add the mutable selector to generate approval continuations', async () => {
      const { result } = renderHook(
        () => useChat({ agentId: 'test-agent', versions: { self: { label: 'candidate' } } }),
        { wrapper },
      );
      await act(async () => {
        await result.current.sendMessage({ mode: 'generate', message: 'hi' });
        await result.current.approveToolCallGenerate('tool-call-1');
        await result.current.declineToolCallGenerate('tool-call-2');
      });

      expect(approveToolCallGenerateMock.mock.calls[0]?.[0]).not.toHaveProperty('versions');
      expect(declineToolCallGenerateMock.mock.calls[0]?.[0]).not.toHaveProperty('versions');
    });

    it('does not add the mutable selector to network approval continuations', async () => {
      const { result } = renderHook(
        () => useChat({ agentId: 'test-agent', versions: { self: { label: 'candidate' } } }),
        { wrapper },
      );
      await act(async () => {
        await result.current.sendMessage({ mode: 'network', message: 'hi' });
        await result.current.approveNetworkToolCall('tool-1', 'network-run-1');
        await result.current.declineNetworkToolCall('tool-2', 'network-run-1');
      });

      expect(approveNetworkToolCallMock.mock.calls[0]?.[0]).not.toHaveProperty('versions');
      expect(declineNetworkToolCallMock.mock.calls[0]?.[0]).not.toHaveProperty('versions');
    });
  });
});

describe('useChat optimistic pending user message', () => {
  beforeEach(() => {
    sendMessageMock.mockClear();
    streamMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('appends a pending user message on the signal path', async () => {
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

    await act(async () => {
      await result.current.sendMessage({ mode: 'stream', message: 'hello', threadId: 'thread-1' });
    });

    const userMessages = result.current.messages.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    const metadata = userMessages[0]?.content.metadata as MastraDBMessageMetadata | undefined;
    expect(metadata?.status).toBe('pending');
    expect(metadata?.mode).toBe('stream');

    const optimisticMessageId = userMessages[0]?.id;
    expect(optimisticMessageId).toMatch(/^client-set-/);

    // The optimistic bubble carries the same client-set id as its correlation id...
    const clientMessageId = metadata?.[CLIENT_MESSAGE_ID_KEY];
    expect(clientMessageId).toBe(optimisticMessageId);

    // ...and the same id is sent to the server in the outgoing message metadata
    // so the echo can reconcile the pending bubble.
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    const sendArgs = sendMessageMock.mock.calls[0]?.[0] as
      | { message?: { metadata?: Record<string, unknown> } }
      | undefined;
    expect(sendArgs?.message?.metadata?.[CLIENT_MESSAGE_ID_KEY]).toBe(optimisticMessageId);
  });

  it('merges a multi-message send (text + attachment) into a single pending bubble', async () => {
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

    await act(async () => {
      await result.current.sendMessage({
        mode: 'stream',
        message: 'look at this',
        threadId: 'thread-1',
        coreUserMessages: [
          { role: 'user', content: [{ type: 'image', image: 'https://example.com/cat.png', mimeType: 'image/png' }] },
        ],
      });
    });

    // The whole user turn (text + attachment) renders as one bubble, matching
    // how memory/reload resolves the persisted multi-part user message. The
    // single bubble carries the correlation id and pending status so the server
    // echo reconciles the whole turn.
    const userMessages = result.current.messages.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(1);

    const parts = userMessages[0]?.content.parts ?? [];
    expect(parts.map(p => p.type)).toEqual(['text', 'file']);
    expect(parts[0]).toMatchObject({ type: 'text', text: 'look at this' });
    expect(parts[1]).toMatchObject({ type: 'file', data: 'https://example.com/cat.png' });

    const metadata = userMessages[0]?.content.metadata as MastraDBMessageMetadata | undefined;
    expect(metadata?.status).toBe('pending');
    expect(userMessages[0]?.id).toMatch(/^client-set-/);
    expect(metadata?.[CLIENT_MESSAGE_ID_KEY]).toBe(userMessages[0]?.id);
  });

  it('keys two sequential sends as independent pending messages', async () => {
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

    await act(async () => {
      await result.current.sendMessage({ mode: 'stream', message: 'first', threadId: 'thread-1' });
    });
    await act(async () => {
      await result.current.sendMessage({ mode: 'stream', message: 'second', threadId: 'thread-1' });
    });

    const userMessages = result.current.messages.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(2);
    expect(new Set(userMessages.map(m => m.id)).size).toBe(2);
    for (const message of userMessages) {
      expect(message.id).toMatch(/^client-set-/);
      const metadata = message.content.metadata as MastraDBMessageMetadata | undefined;
      expect(metadata?.status).toBe('pending');
      expect(metadata?.[CLIENT_MESSAGE_ID_KEY]).toBe(message.id);
    }
  });

  it('does not mark the user message pending on the legacy stream path', async () => {
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.sendMessage({ mode: 'stream', message: 'hello', threadId: 'thread-1' });
    });

    const userMessages = result.current.messages.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    const metadata = userMessages[0]?.content.metadata as MastraDBMessageMetadata | undefined;
    expect(metadata?.status).toBeUndefined();
    expect(metadata?.[CLIENT_MESSAGE_ID_KEY]).toBeUndefined();
  });
});

describe('useChat task state', () => {
  beforeEach(() => {
    sendSignalMock.mockClear();
    sendMessageMock.mockClear();
    streamMock.mockClear();
    subscribeToThreadMock.mockClear();
    threadSubscriptionAbortMock.mockClear();
    threadSubscriptionUnsubscribeMock.mockClear();
    nextSubscribeChunks = [];
    keepSubscriptionOpen = false;
    omitThreadSubscriptionUnsubscribe = false;
  });

  const firstTask: TaskItem = {
    id: 'task-plan-menu',
    content: 'Plan menu',
    status: 'in_progress',
    activeForm: 'Planning menu',
  };
  const secondTask: TaskItem = {
    id: 'task-shop',
    content: 'Create shopping list',
    status: 'pending',
    activeForm: 'Creating shopping list',
  };

  const taskSignalChunk = (tasks: TaskItem[], tagName = 'current-task-list') => ({
    type: 'data-signal',
    runId: 'run-tasks',
    from: 'AGENT',
    data: {
      id: 'tasks',
      type: 'state',
      tagName,
      metadata: { value: { tasks } },
    },
  });

  it('returns an empty tasks array initially', () => {
    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
        }),
      { wrapper },
    );

    expect(result.current.tasks).toEqual([]);
  });

  it('updates tasks when a data-signal snapshot chunk arrives', async () => {
    nextSubscribeChunks = [taskSignalChunk([firstTask])];

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

    await waitFor(() => expect(result.current.tasks).toEqual([firstTask]));
  });

  it('updates tasks when a data-signal delta chunk arrives', async () => {
    const updatedFirstTask = { ...firstTask, status: 'completed' as const, activeForm: 'Planning menu' };
    nextSubscribeChunks = [
      taskSignalChunk([firstTask]),
      taskSignalChunk([updatedFirstTask, secondTask], 'task-list-update'),
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

    await waitFor(() => expect(result.current.tasks).toEqual([updatedFirstTask, secondTask]));
  });

  it('updates tasks when a task tool-result chunk arrives', async () => {
    nextSubscribeChunks = [
      {
        type: 'tool-result',
        runId: 'run-tasks',
        from: 'AGENT',
        payload: {
          toolCallId: 'tool-call-task-write',
          toolName: 'task_write',
          result: { tasks: [firstTask, secondTask] },
        },
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

    await waitFor(() => expect(result.current.tasks).toEqual([firstTask, secondTask]));
  });

  it('clears tasks when task_write emits an empty task list', async () => {
    nextSubscribeChunks = [taskSignalChunk([firstTask]), taskSignalChunk([])];

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

    await waitFor(() => expect(result.current.tasks).toEqual([]));
  });

  it('seeds tasks from initialMessages on thread load', () => {
    const initialMessages: MastraDBMessage[] = [
      {
        id: 'msg-task-signal',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'data-signal',
              data: {
                id: 'tasks',
                type: 'state',
                tagName: 'current-task-list',
                metadata: { value: { tasks: [firstTask] } },
              },
            },
          ],
        },
      },
    ];

    const { result } = renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages,
        }),
      { wrapper },
    );

    expect(result.current.tasks).toEqual([firstTask]);
  });

  it('resets tasks when initialMessages changes', () => {
    const initialMessages: MastraDBMessage[] = [
      {
        id: 'msg-task-signal',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'data-signal',
              data: {
                id: 'tasks',
                type: 'state',
                tagName: 'current-task-list',
                metadata: { value: { tasks: [firstTask] } },
              },
            },
          ],
        },
      },
    ];

    const { result, rerender } = renderHook(
      ({ messages }) =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          initialMessages: messages,
        }),
      { wrapper, initialProps: { messages: initialMessages } },
    );

    expect(result.current.tasks).toEqual([firstTask]);

    rerender({ messages: [] });

    expect(result.current.tasks).toEqual([]);
  });
});

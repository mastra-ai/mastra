// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
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
    streamUntilIdleMock.mockClear();
    subscribeToThreadMock.mockClear();
    generateMock.mockClear();
    nextSubscribeChunks = [];
    keepSubscriptionOpen = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses thread signals by default when threadId is provided', async () => {
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

    expect(subscribeToThreadMock).toHaveBeenCalledTimes(1);
    expect(sendSignalMock).toHaveBeenCalledTimes(1);
    expect(streamUntilIdleMock).not.toHaveBeenCalled();
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
    expect(streamUntilIdleMock).toHaveBeenCalledTimes(1);
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

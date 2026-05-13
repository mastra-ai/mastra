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
const subscribeToThreadMock = vi.fn(async (_params: any) => {
  const chunks = nextSubscribeChunks;
  return {
    processDataStream: async ({ onChunk }: { onChunk: (chunk: any) => Promise<void> | void }) => {
      for (const chunk of chunks) {
        await onChunk(chunk);
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards hook-prop clientTools through subscribeToThread when threadId is provided', async () => {
    renderHook(
      () =>
        useChat({
          agentId: 'test-agent',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          clientTools,
        }),
      { wrapper },
    );

    // subscribeToThread opens on mount whenever threadId is set; assert that
    // clientTools were forwarded so client-js owns the tool-execution loop.
    expect(subscribeToThreadMock).toHaveBeenCalled();
    const subscribeCalls = subscribeToThreadMock.mock.calls as unknown as Array<[any]>;
    const params = subscribeCalls[0]?.[0];
    expect(params.threadId).toBe('thread-1');
    expect(params.clientTools).toBe(clientTools);
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

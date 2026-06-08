// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useChat } from '@mastra/react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancelRun: vi.fn(),
  runtimeProps: undefined as any,
  threadRuntimeState: undefined as any,
  sendMessage: vi.fn(),
  markCycleIdActivated: vi.fn(),
  setStreamProgress: vi.fn(),
  chatState: {
    isAwaitingToolApproval: false,
    isRunning: false,
  },
}));

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: ReactNode }) => children,
  useExternalStoreRuntime: vi.fn((props: any) => {
    mocks.runtimeProps = props;
    return props;
  }),
}));

vi.mock('@mastra/client-js', () => ({
  MastraClient: vi.fn(function () {
    return {
      getAgent: vi.fn(() => ({})),
    };
  }),
}));

vi.mock('@mastra/core/di', () => ({
  RequestContext: class {
    values = new Map<string, unknown>();

    set(key: string, value: unknown) {
      this.values.set(key, value);
    }
  },
}));

vi.mock('@mastra/playground-ui', () => ({
  fileToBase64: vi.fn(),
}));

vi.mock('@mastra/react', () => ({
  toAssistantUIMessage: vi.fn((message: unknown) => message),
  useChat: vi.fn(() => ({
    approveNetworkToolCall: vi.fn(),
    approveToolCall: vi.fn(),
    approveToolCallGenerate: vi.fn(),
    cancelRun: mocks.cancelRun,
    declineNetworkToolCall: vi.fn(),
    declineToolCall: vi.fn(),
    declineToolCallGenerate: vi.fn(),
    isRunning: mocks.chatState.isRunning,
    isAwaitingToolApproval: mocks.chatState.isAwaitingToolApproval,
    messages: [],
    networkToolCallApprovals: {},
    sendMessage: mocks.sendMessage,
    setMessages: vi.fn(),
    toolCallApprovals: {},
  })),
  useMastraClient: vi.fn(() => ({
    options: {},
  })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

vi.mock('@/domains/agents/context', () => ({
  useObservationalMemoryContext: vi.fn(() => ({
    markCycleIdActivated: mocks.markCycleIdActivated,
    setIsObservingFromStream: vi.fn(),
    setIsReflectingFromStream: vi.fn(),
    setStreamProgress: mocks.setStreamProgress,
    signalObservationsUpdated: vi.fn(),
  })),
}));

vi.mock('@/domains/agents/context/agent-working-memory-context', () => ({
  useWorkingMemory: vi.fn(() => ({
    refetch: vi.fn(),
  })),
}));

vi.mock('@/domains/memory/hooks', () => ({
  useMemoryConfig: vi.fn(() => ({
    data: {
      config: {
        observationalMemory: false,
      },
    },
  })),
}));

vi.mock('@/domains/observability/context/tracing-settings-context', () => ({
  useTracingSettings: vi.fn(() => ({
    settings: undefined,
  })),
}));

vi.mock('@/lib/ai-ui/hooks/use-adapters', () => ({
  useAdapters: vi.fn(() => ({
    adapters: undefined,
    isReady: true,
  })),
}));

vi.mock('@/lib/ai-ui/thread-runtime-state', () => ({
  ThreadRuntimeStateProvider: ({ children, value }: { children: ReactNode; value: any }) => {
    mocks.threadRuntimeState = value;
    return children;
  },
}));

vi.mock('../tool-call-provider', () => ({
  ToolCallProvider: ({ children }: { children: ReactNode }) => children,
}));

import { MastraRuntimeProvider } from '../mastra-runtime-provider';

describe('MastraRuntimeProvider', () => {
  beforeEach(() => {
    vi.mocked(useChat).mockClear();
    mocks.cancelRun.mockReset();
    mocks.runtimeProps = undefined;
    mocks.threadRuntimeState = undefined;
    mocks.chatState.isAwaitingToolApproval = false;
    mocks.chatState.isRunning = false;
    mocks.sendMessage.mockReset();
    mocks.markCycleIdActivated.mockReset();
    mocks.setStreamProgress.mockReset();
    delete (window as any).MASTRA_AGENT_SIGNALS;
  });

  // This package runs vitest with globals disabled, so @testing-library/react's
  // auto-cleanup never registers. Unmount between tests explicitly, otherwise
  // every render() leaks a mounted provider and getSignalCallbacks/threadRuntimeState
  // (both last-writer-wins sinks) would read a stale instance.
  afterEach(() => cleanup());

  it('opts Playground into thread signals by default', () => {
    render(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    expect(useChat).toHaveBeenCalledWith(expect.objectContaining({ enableThreadSignals: true }));
  });

  it('preserves the explicit thread signals opt-out', () => {
    (window as any).MASTRA_AGENT_SIGNALS = 'false';

    render(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    expect(useChat).toHaveBeenCalledWith(expect.objectContaining({ enableThreadSignals: false }));
  });

  it('disables thread signals when the agent does not support memory', () => {
    render(
      <MastraRuntimeProvider
        agentId="agent-1"
        threadId="thread-1"
        initialMessages={[]}
        modelVersion="v2"
        supportsMemory={false}
      >
        <div />
      </MastraRuntimeProvider>,
    );

    expect(useChat).toHaveBeenCalledWith(expect.objectContaining({ enableThreadSignals: false }));
  });

  it('persists a visible error when a vNext stream finishes with pending tool calls', async () => {
    mocks.sendMessage.mockImplementation(async ({ onChunk }) => {
      await onChunk({
        type: 'finish',
        runId: 'run-1',
        payload: {
          stepResult: {
            reason: 'tool-calls',
          },
        },
      });
    });

    render(
      <MastraRuntimeProvider
        agentId="agent-1"
        threadId="thread-1"
        initialMessages={[]}
        modelVersion="v2"
        settings={{ modelSettings: { maxSteps: 3 } } as any}
      >
        <div />
      </MastraRuntimeProvider>,
    );

    await act(async () => {
      await mocks.runtimeProps.onNew({
        content: [{ type: 'text', text: 'run until maxSteps' }],
      });
    });

    await waitFor(() => {
      expect(mocks.runtimeProps.messages).toHaveLength(1);
    });

    expect(mocks.runtimeProps.messages[0]).toMatchObject({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Agent stopped because it reached maxSteps (3) while tool calls were still pending. Increase maxSteps in advanced settings and try again.',
        },
      ],
      metadata: { status: 'error' },
    });
  });

  const getSignalCallbacks = () => {
    const calls = vi.mocked(useChat).mock.calls;
    const lastArgs = calls[calls.length - 1]?.[0] as
      | { onSignalSent?: (id: string, preview: string) => void; onSignalEcho?: (id: string) => void }
      | undefined;
    if (!lastArgs?.onSignalSent || !lastArgs.onSignalEcho) {
      throw new Error('useChat was not called with signal callbacks — render the provider before reading them');
    }
    return { onSignalSent: lastArgs.onSignalSent, onSignalEcho: lastArgs.onSignalEcho };
  };

  it('shows then clears a pending signal when the echo arrives after the send (normal order)', async () => {
    render(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    const { onSignalSent, onSignalEcho } = getSignalCallbacks();

    await act(async () => {
      onSignalSent('signal-1', 'ok');
    });

    expect(mocks.threadRuntimeState.hasPendingMessages).toBe(true);
    expect(mocks.threadRuntimeState.pendingSignals).toEqual([{ id: 'signal-1', preview: 'ok' }]);

    await act(async () => {
      onSignalEcho('signal-1');
    });

    expect(mocks.threadRuntimeState.pendingSignals).toEqual([]);
    expect(mocks.threadRuntimeState.hasPendingMessages).toBe(false);
  });

  it('clears a pending signal even when the echo arrives before the send announces it (race)', async () => {
    render(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    const { onSignalSent, onSignalEcho } = getSignalCallbacks();

    // On the idle path the server starts the run (and emits the `data-user-message`
    // echo over the already-open thread subscription) before the send-message HTTP
    // response returns. So `onSignalEcho` can fire before `onSignalSent` has added
    // the pending entry. The badge must not linger afterwards.
    await act(async () => {
      onSignalEcho('signal-1');
      onSignalSent('signal-1', 'ok');
    });

    expect(mocks.threadRuntimeState.pendingSignals).toEqual([]);
    expect(mocks.threadRuntimeState.hasPendingMessages).toBe(false);
  });

  it('tracks premature echoes per id without suppressing unrelated signals', async () => {
    render(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    const { onSignalSent, onSignalEcho } = getSignalCallbacks();

    // signal-1 loses the race (echo first); signal-2 is a normal in-order send.
    await act(async () => {
      onSignalEcho('signal-1');
      onSignalSent('signal-1', 'first');
      onSignalSent('signal-2', 'second');
    });

    expect(mocks.threadRuntimeState.pendingSignals).toEqual([{ id: 'signal-2', preview: 'second' }]);
    expect(mocks.threadRuntimeState.hasPendingMessages).toBe(true);

    await act(async () => {
      onSignalEcho('signal-2');
    });

    expect(mocks.threadRuntimeState.pendingSignals).toEqual([]);
    expect(mocks.threadRuntimeState.hasPendingMessages).toBe(false);
  });

  it('restores OM progress when initial messages arrive after mount', async () => {
    const progress = {
      windows: {
        active: {
          messages: { tokens: 100, threshold: 1000 },
          observations: { tokens: 50, threshold: 500 },
        },
        buffered: {
          observations: {
            chunks: 1,
            messageTokens: 100,
            projectedMessageRemoval: 80,
            observationTokens: 20,
            status: 'complete',
          },
          reflection: {
            inputObservationTokens: 0,
            observationTokens: 0,
            status: 'idle',
          },
        },
      },
      recordId: 'record-1',
      threadId: 'thread-1',
      stepNumber: 1,
      generationCount: 1,
    };
    const initialMessages: MastraDBMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date('2026-05-29T00:00:00.000Z'),
        content: {
          format: 2,
          parts: [
            { type: 'data-om-activation', data: { cycleId: 'cycle-1' } },
            { type: 'data-om-status', data: progress },
          ],
        },
      },
    ];

    const { rerender } = render(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    rerender(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={initialMessages} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    await waitFor(() => {
      expect(mocks.markCycleIdActivated).toHaveBeenCalledWith('cycle-1');
      expect(mocks.setStreamProgress).toHaveBeenCalledWith(progress);
    });
  });
});

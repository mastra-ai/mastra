// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useChat } from '@mastra/react';
import { act, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('no longer wires composer pending-signal callbacks or exposes pending widget state', () => {
    render(
      <MastraRuntimeProvider agentId="agent-1" threadId="thread-1" initialMessages={[]} modelVersion="v2">
        <div />
      </MastraRuntimeProvider>,
    );

    const chatArgs = vi.mocked(useChat).mock.calls.at(-1)?.[0];
    expect(chatArgs?.onSignalSent).toBeUndefined();
    expect(chatArgs?.onSignalEcho).toBeUndefined();
    expect(typeof chatArgs?.onThreadSignalsUnsupported).toBe('function');

    expect(mocks.threadRuntimeState).not.toHaveProperty('pendingSignals');
    expect(mocks.threadRuntimeState).not.toHaveProperty('hasPendingMessages');
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

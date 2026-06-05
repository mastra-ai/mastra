// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drive useChat output from the test.
const chatState: { isRunning: boolean; messages: unknown[] } = { isRunning: false, messages: [] };
const chatListeners = new Set<() => void>();
const sentMessages: unknown[] = [];
const useChatCalls: Array<Record<string, unknown>> = [];

const triggerRerender = () => {
  for (const listener of chatListeners) listener();
};

vi.mock('@mastra/react', () => {
  const useChat = (options: Record<string, unknown>) => {
    useChatCalls.push(options);
    // Force consumers to subscribe so they re-render when state changes.
    const [, setTick] = useState(0);
    const ref = useRef<() => void>(() => {});
    ref.current = () => setTick(t => t + 1);
    useEffect(() => {
      const listener = () => ref.current();
      chatListeners.add(listener);
      return () => {
        chatListeners.delete(listener);
      };
    }, []);
    return {
      messages: chatState.messages,
      isRunning: chatState.isRunning,
      setMessages: () => {},
      sendMessage: (payload: unknown) => {
        sentMessages.push(payload);
      },
    };
  };
  return { useChat, useMastraClient: () => ({}) };
});

import { useStreamMessages, useStreamRunning, useStreamSend } from '../stream-chat-context';
import { StreamChatProvider } from '../stream-chat-provider';

const createQueryClient = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Seed useCurrentUser so the provider doesn't trigger a real fetch in unit tests.
  queryClient.setQueryData(['auth', 'me'], { id: 'user-1' });
  return queryClient;
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
);

const renderWithProviders = (ui: ReactElement) => render(ui, { wrapper: Wrapper });

interface RenderTrackerProps {
  hook: () => unknown;
  onRender: () => void;
}

const RenderTracker = ({ hook, onRender }: RenderTrackerProps) => {
  hook();
  onRender();
  return null;
};

const setRunning = (next: boolean) => {
  chatState.isRunning = next;
  act(() => triggerRerender());
};

const setMessages = (next: unknown[]) => {
  chatState.messages = next;
  act(() => triggerRerender());
};

describe('StreamChatProvider', () => {
  beforeEach(() => {
    chatState.isRunning = false;
    chatState.messages = [];
    sentMessages.length = 0;
    useChatCalls.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
    cleanup();
    vi.useRealTimers();
  });

  it('opts the agent builder into thread signals by default', () => {
    renderWithProviders(
      <StreamChatProvider agentId="a" threadId="t" initialMessages={[]}>
        <RenderTracker hook={useStreamRunning} onRender={() => {}} />
      </StreamChatProvider>,
    );

    expect(useChatCalls.at(-1)).toMatchObject({ enableThreadSignals: true });
  });

  it('preserves the explicit thread signals opt-out', () => {
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';

    renderWithProviders(
      <StreamChatProvider agentId="a" threadId="t" initialMessages={[]}>
        <RenderTracker hook={useStreamRunning} onRender={() => {}} />
      </StreamChatProvider>,
    );

    expect(useChatCalls.at(-1)).toMatchObject({ enableThreadSignals: false });
  });

  it('only re-renders running subscribers when isRunning changes (not when messages change)', () => {
    const runningRender = vi.fn();

    renderWithProviders(
      <StreamChatProvider agentId="a" threadId="t" initialMessages={[]} debounceTime={100}>
        <RenderTracker hook={useStreamRunning} onRender={runningRender} />
      </StreamChatProvider>,
    );

    const baseline = runningRender.mock.calls.length;

    // Messages change should NOT cause running subscriber to re-render.
    setMessages([{ id: '1' }]);
    expect(runningRender.mock.calls.length).toBe(baseline);

    setMessages([{ id: '1' }, { id: '2' }]);
    expect(runningRender.mock.calls.length).toBe(baseline);

    // isRunning change SHOULD cause running subscriber to re-render — but only
    // after the 100 ms debounce window has elapsed (flicker suppression).
    setRunning(true);
    expect(runningRender.mock.calls.length).toBe(baseline); // debounced, no flicker yet
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(runningRender.mock.calls.length).toBe(baseline + 1);

    setRunning(false);
    expect(runningRender.mock.calls.length).toBe(baseline + 1); // debounced, no flicker yet
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(runningRender.mock.calls.length).toBe(baseline + 2);
  });

  it('only re-renders messages subscribers when messages change (not when isRunning changes)', () => {
    const messagesRender = vi.fn();

    renderWithProviders(
      <StreamChatProvider agentId="a" threadId="t" initialMessages={[]}>
        <RenderTracker hook={useStreamMessages} onRender={messagesRender} />
      </StreamChatProvider>,
    );

    const baseline = messagesRender.mock.calls.length;

    setRunning(true);
    expect(messagesRender.mock.calls.length).toBe(baseline);

    setRunning(false);
    expect(messagesRender.mock.calls.length).toBe(baseline);

    setMessages([{ id: '1' }]);
    expect(messagesRender.mock.calls.length).toBe(baseline + 1);
  });

  it('exposes a stable send handle and forwards threadId + clientTools to sendMessage', () => {
    const sendIdentities: Array<(message: string) => void> = [];

    const SendCapture = () => {
      const send = useStreamSend();
      const seen = useRef(false);
      if (!seen.current) {
        sendIdentities.push(send);
        seen.current = true;
      }
      return null;
    };

    const tools = { myTool: { id: 'myTool' } };

    renderWithProviders(
      <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} clientTools={tools}>
        <SendCapture />
      </StreamChatProvider>,
    );

    expect(sendIdentities).toHaveLength(1);

    // Fire a few state updates and re-mount the capture by re-rendering — identity must not change.
    setRunning(true);
    setMessages([{ id: 'a' }]);

    sendIdentities[0]('hello world');

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      message: 'hello world',
      threadId: 'thread-xyz',
      clientTools: tools,
    });
  });

  it('forwards extraInstructions to sendMessage as modelSettings.instructions', () => {
    const SendCapture = ({ onReady }: { onReady: (send: (message: string) => void) => void }) => {
      const send = useStreamSend();
      const seen = useRef(false);
      if (!seen.current) {
        onReady(send);
        seen.current = true;
      }
      return null;
    };

    let send: ((message: string) => void) | null = null;

    renderWithProviders(
      <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} extraInstructions="snapshot-text">
        <SendCapture onReady={fn => (send = fn)} />
      </StreamChatProvider>,
    );

    send!('hi');

    expect(sentMessages).toHaveLength(1);
    const payload = sentMessages[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      message: 'hi',
      threadId: 'thread-xyz',
      modelSettings: {
        instructions: 'snapshot-text',
        providerOptions: { openai: { reasoningEffort: 'low' } },
      },
    });
    expect(payload).not.toHaveProperty('instructions');
  });

  it('omits modelSettings.instructions when extraInstructions is absent or empty', () => {
    const SendCapture = ({ onReady }: { onReady: (send: (message: string) => void) => void }) => {
      const send = useStreamSend();
      const seen = useRef(false);
      if (!seen.current) {
        onReady(send);
        seen.current = true;
      }
      return null;
    };

    let send: ((message: string) => void) | null = null;

    const { rerender } = renderWithProviders(
      <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]}>
        <SendCapture onReady={fn => (send = fn)} />
      </StreamChatProvider>,
    );

    send!('first');
    expect((sentMessages[0] as { modelSettings?: { instructions?: string } }).modelSettings).not.toHaveProperty(
      'instructions',
    );
    expect(sentMessages[0]).toMatchObject({
      modelSettings: { providerOptions: { openai: { reasoningEffort: 'low' } } },
    });

    rerender(
      <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} extraInstructions="">
        <SendCapture onReady={fn => (send = fn)} />
      </StreamChatProvider>,
    );

    send!('second');
    expect((sentMessages[1] as { modelSettings?: { instructions?: string } }).modelSettings).not.toHaveProperty(
      'instructions',
    );
    expect(sentMessages[1]).toMatchObject({
      modelSettings: { providerOptions: { openai: { reasoningEffort: 'low' } } },
    });
  });

  it('does not call sendMessage when extraInstructions changes between sends', () => {
    const SendCapture = ({ onReady }: { onReady: (send: (message: string) => void) => void }) => {
      const send = useStreamSend();
      const seen = useRef(false);
      if (!seen.current) {
        onReady(send);
        seen.current = true;
      }
      return null;
    };

    let send: ((message: string) => void) | null = null;

    const { rerender } = renderWithProviders(
      <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} extraInstructions="v1">
        <SendCapture onReady={fn => (send = fn)} />
      </StreamChatProvider>,
    );

    expect(sentMessages).toHaveLength(0);

    rerender(
      <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} extraInstructions="v2">
        <SendCapture onReady={fn => (send = fn)} />
      </StreamChatProvider>,
    );

    expect(sentMessages).toHaveLength(0);

    send!('go');
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      modelSettings: {
        instructions: 'v2',
        providerOptions: { openai: { reasoningEffort: 'low' } },
      },
    });
  });

  it('keeps the chat messages state limited to the user message after a send (snapshot is invisible)', () => {
    const MessagesCapture = ({ onMessages }: { onMessages: (messages: unknown[]) => void }) => {
      const messages = useStreamMessages();
      onMessages(messages);
      return null;
    };

    const SendCapture = ({ onReady }: { onReady: (send: (message: string) => void) => void }) => {
      const send = useStreamSend();
      const seen = useRef(false);
      if (!seen.current) {
        onReady(send);
        seen.current = true;
      }
      return null;
    };

    let send: ((message: string) => void) | null = null;
    const captured: unknown[][] = [];

    renderWithProviders(
      <StreamChatProvider agentId="a" threadId="thread-xyz" initialMessages={[]} extraInstructions="snapshot-text">
        <SendCapture onReady={fn => (send = fn)} />
        <MessagesCapture onMessages={m => captured.push(m)} />
      </StreamChatProvider>,
    );

    send!('hi from user');

    // Simulate the underlying useChat appending the optimistic user message.
    setMessages([{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi from user' }] }]);

    const last = captured[captured.length - 1];
    expect(last).toHaveLength(1);
    const serialized = JSON.stringify(last);
    expect(serialized).not.toContain('snapshot-text');
  });
});

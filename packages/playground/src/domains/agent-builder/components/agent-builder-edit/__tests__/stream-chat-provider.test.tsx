// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drive useChat output from the test.
const chatState: { isRunning: boolean; messages: unknown[] } = { isRunning: false, messages: [] };
const chatListeners = new Set<() => void>();
const sentMessages: unknown[] = [];

const triggerRerender = () => {
  for (const listener of chatListeners) listener();
};

vi.mock('@mastra/react', () => {
  const useChat = () => {
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
  });

  afterEach(() => {
    cleanup();
  });

  it('only re-renders running subscribers when isRunning changes (not when messages change)', () => {
    const runningRender = vi.fn();

    render(
      <StreamChatProvider agentId="a" threadId="t" initialMessages={[]}>
        <RenderTracker hook={useStreamRunning} onRender={runningRender} />
      </StreamChatProvider>,
    );

    const baseline = runningRender.mock.calls.length;

    // Messages change should NOT cause running subscriber to re-render.
    setMessages([{ id: '1' }]);
    expect(runningRender.mock.calls.length).toBe(baseline);

    setMessages([{ id: '1' }, { id: '2' }]);
    expect(runningRender.mock.calls.length).toBe(baseline);

    // isRunning change SHOULD cause running subscriber to re-render.
    setRunning(true);
    expect(runningRender.mock.calls.length).toBe(baseline + 1);

    setRunning(false);
    expect(runningRender.mock.calls.length).toBe(baseline + 2);
  });

  it('only re-renders messages subscribers when messages change (not when isRunning changes)', () => {
    const messagesRender = vi.fn();

    render(
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

    render(
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
});

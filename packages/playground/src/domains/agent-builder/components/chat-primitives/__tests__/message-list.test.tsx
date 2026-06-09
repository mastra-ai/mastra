// @vitest-environment jsdom
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageList } from '../message-list';

const buildAssistantMessage = (parts: MastraMessagePart[]): MastraDBMessage =>
  ({
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts,
    },
  }) as unknown as MastraDBMessage;

const buildUserMessage = (text: string): MastraDBMessage =>
  ({
    id: 'user-1',
    role: 'user',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text } as unknown as MastraMessagePart],
    },
  }) as unknown as MastraDBMessage;

describe('MessageList pending indicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // The pending dot is deferred 300ms (anti-flash); advance past the delay
  // before asserting it is visible.
  const flushPendingDelay = () => {
    act(() => {
      vi.advanceTimersByTime(300);
    });
  };

  it('shows the pending indicator while running with no messages', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isRunning={true} />);
    flushPendingDelay();
    expect(queryByTestId('agent-builder-chat-pending')).not.toBeNull();
  });

  it('does not render the pending indicator during the 300ms grace period', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isRunning={true} />);
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
  });

  it('does not show the pending indicator when not running', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isRunning={false} />);
    flushPendingDelay();
    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
  });

  it('hides the pending indicator when the last assistant message has a streaming reasoning part', () => {
    const messages: MastraDBMessage[] = [
      buildAssistantMessage([
        {
          type: 'reasoning',
          state: 'streaming',
          text: 'thinking',
        } as unknown as MastraMessagePart,
      ]),
    ];
    const { queryByTestId } = render(<MessageList messages={messages} isRunning={true} />);
    flushPendingDelay();
    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
  });

  it('shows the pending indicator after a user message while waiting for the assistant', () => {
    const messages: MastraDBMessage[] = [buildUserMessage('hello')];
    const { queryByTestId } = render(<MessageList messages={messages} isRunning={true} />);
    flushPendingDelay();
    expect(queryByTestId('agent-builder-chat-pending')).not.toBeNull();
  });

  it('does not show the pending indicator while the initial skeleton is rendered', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isRunning={true} isLoading={true} />);
    flushPendingDelay();
    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
  });

  it('shows the pending indicator after a tool call has completed but no new part is streaming', () => {
    // Regression: once any tool call lands in `output-available`, the previous
    // implementation of `hasStreamingPart` returned true unconditionally for
    // tool parts, hiding the indicator during server-side retry pauses.
    const messages: MastraDBMessage[] = [
      buildAssistantMessage([
        {
          type: 'dynamic-tool',
          toolCallId: 'call-skill-1',
          toolName: 'skill',
          state: 'output-available',
          input: { name: 'generic-assistant' },
          output: { success: true },
        } as unknown as MastraMessagePart,
      ]),
    ];
    const { queryByTestId } = render(<MessageList messages={messages} isRunning={true} />);
    flushPendingDelay();
    expect(queryByTestId('agent-builder-chat-pending')).not.toBeNull();
  });

  it('shows the pending indicator after a legacy tool-* part terminates in output-error', () => {
    // Regression: `hasStreamingPart` must treat both `dynamic-tool` and legacy
    // `tool-*` parts as terminated when they land in `output-available` or
    // `output-error`, so the indicator stays visible during retry pauses.
    const messages: MastraDBMessage[] = [
      buildAssistantMessage([
        {
          type: 'tool-skill',
          toolCallId: 'call-skill-err',
          toolName: 'skill',
          state: 'output-error',
          input: { name: 'generic-assistant' },
          errorText: 'boom',
        } as unknown as MastraMessagePart,
      ]),
    ];
    const { queryByTestId } = render(<MessageList messages={messages} isRunning={true} />);
    flushPendingDelay();
    expect(queryByTestId('agent-builder-chat-pending')).not.toBeNull();
  });

  it('hides the pending indicator while a tool call is still streaming its input', () => {
    const messages: MastraDBMessage[] = [
      buildAssistantMessage([
        {
          type: 'dynamic-tool',
          toolCallId: 'call-in-flight',
          toolName: 'skill',
          state: 'input-available',
          input: { name: 'generic-assistant' },
        } as unknown as MastraMessagePart,
      ]),
    ];
    const { queryByTestId } = render(<MessageList messages={messages} isRunning={true} />);
    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
  });
});

describe('MessageList deferred skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('does not render the skeleton during the 300ms grace period', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isLoading={true} skeletonTestId="msg-skeleton" />);
    expect(queryByTestId('msg-skeleton')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(queryByTestId('msg-skeleton')).toBeNull();
  });

  it('renders the skeleton after the 300ms grace period elapses', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isLoading={true} skeletonTestId="msg-skeleton" />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(queryByTestId('msg-skeleton')).not.toBeNull();
  });

  it('never shows the skeleton if data resolves within the grace period', () => {
    const { queryByTestId, rerender } = render(
      <MessageList messages={[]} isLoading={true} skeletonTestId="msg-skeleton" />,
    );

    act(() => {
      vi.advanceTimersByTime(150);
    });

    const messages: MastraDBMessage[] = [buildUserMessage('hi')];
    rerender(<MessageList messages={messages} isLoading={false} skeletonTestId="msg-skeleton" />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(queryByTestId('msg-skeleton')).toBeNull();
  });
});

// @vitest-environment jsdom
import type { MastraUIMessage } from '@mastra/react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageList } from '../message-list';

const buildAssistantMessage = (parts: MastraUIMessage['parts']): MastraUIMessage => ({
  id: 'msg-1',
  role: 'assistant',
  parts,
});

describe('MessageList pending indicator', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the pending indicator while running with no messages', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isRunning={true} />);
    expect(queryByTestId('agent-builder-chat-pending')).not.toBeNull();
  });

  it('does not show the pending indicator when not running', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isRunning={false} />);
    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
  });

  it('hides the pending indicator when the last assistant message has a streaming reasoning part', () => {
    const messages: MastraUIMessage[] = [
      buildAssistantMessage([
        {
          type: 'reasoning',
          state: 'streaming',
          text: 'thinking',
        } as MastraUIMessage['parts'][number],
      ]),
    ];
    const { queryByTestId } = render(<MessageList messages={messages} isRunning={true} />);
    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
  });

  it('shows the pending indicator after a user message while waiting for the assistant', () => {
    const messages: MastraUIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello', state: 'done' } as MastraUIMessage['parts'][number]],
      },
    ];
    const { queryByTestId } = render(<MessageList messages={messages} isRunning={true} />);
    expect(queryByTestId('agent-builder-chat-pending')).not.toBeNull();
  });

  it('does not show the pending indicator while the initial skeleton is rendered', () => {
    const { queryByTestId } = render(<MessageList messages={[]} isRunning={true} isLoading={true} />);
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
    const { queryByTestId } = render(
      <MessageList messages={[]} isLoading={true} skeletonTestId="msg-skeleton" />,
    );
    expect(queryByTestId('msg-skeleton')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(queryByTestId('msg-skeleton')).toBeNull();
  });

  it('renders the skeleton after the 300ms grace period elapses', () => {
    const { queryByTestId } = render(
      <MessageList messages={[]} isLoading={true} skeletonTestId="msg-skeleton" />,
    );

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

    const messages: MastraUIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hi', state: 'done' } as MastraUIMessage['parts'][number]],
      },
    ];
    rerender(<MessageList messages={messages} isLoading={false} skeletonTestId="msg-skeleton" />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(queryByTestId('msg-skeleton')).toBeNull();
  });
});

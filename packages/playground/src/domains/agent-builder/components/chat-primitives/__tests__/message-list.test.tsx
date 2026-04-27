// @vitest-environment jsdom
import type { MastraUIMessage } from '@mastra/react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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

// @vitest-environment jsdom
import { AssistantRuntimeProvider, ThreadPrimitive, useExternalStoreRuntime } from '@assistant-ui/react';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { UserMessage } from '../user-messages';
import { toAssistantUIMessage } from '@/services/to-assistant-ui-message';

const renderUserMessage = (message: MastraDBMessage) => {
  const Harness = () => {
    const runtime = useExternalStoreRuntime({
      isRunning: false,
      messages: [toAssistantUIMessage(message)],
      convertMessage: m => m,
      onNew: async () => {},
    });

    return (
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage: () => null }} />
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    );
  };

  return render(<Harness />);
};

const userMessage = (metadata: Record<string, unknown>): MastraDBMessage => ({
  id: 'user-1',
  role: 'user',
  createdAt: new Date('2026-05-29T00:00:00.000Z'),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: {
    format: 2,
    parts: [{ type: 'text', text: 'optimistic hello' }],
    metadata,
  },
});

afterEach(() => cleanup());

describe('UserMessage pending styling', () => {
  it('marks the bubble as pending when the user text part carries status pending', () => {
    const { container } = renderUserMessage(userMessage({ status: 'pending' }));

    const root = container.querySelector('[data-message-id="user-1"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-message-pending')).toBe('true');
  });

  it('does not mark the bubble as pending for a normal user message', () => {
    const { container } = renderUserMessage(userMessage({}));

    const root = container.querySelector('[data-message-id="user-1"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-message-pending')).toBeNull();
  });
});

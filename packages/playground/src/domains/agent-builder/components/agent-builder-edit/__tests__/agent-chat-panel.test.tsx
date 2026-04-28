// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentChatPanel } from '../agent-chat-panel';

const sentMessages: Array<{ message: string; threadId?: string }> = [];
const chatState: { isRunning: boolean; messages: unknown[] } = { isRunning: false, messages: [] };

vi.mock('@mastra/react', () => ({
  useChat: () => ({
    messages: chatState.messages,
    isRunning: chatState.isRunning,
    setMessages: () => {},
    sendMessage: (payload: { message: string; threadId?: string }) => {
      sentMessages.push(payload);
    },
  }),
  useMastraClient: () => ({}),
}));

vi.mock('@/hooks/use-agent-messages', () => ({
  useAgentMessages: () => ({ data: { messages: [] }, isLoading: false }),
}));

const renderPanel = () =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <AgentChatPanel agentId="agent-test" agentName="My Agent" agentDescription="It does things" />
      </MemoryRouter>
    </TooltipProvider>,
  );

describe('AgentChatPanel', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    chatState.isRunning = false;
    chatState.messages = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state with name and description when there are no messages', () => {
    const { getByTestId } = renderPanel();
    const empty = getByTestId('agent-builder-agent-chat-empty-state');
    expect(empty.textContent).toContain('My Agent');
    expect(empty.textContent).toContain('It does things');
  });

  it('disables the composer when isRunning is true', () => {
    chatState.isRunning = true;
    const { getByTestId } = renderPanel();
    const input = getByTestId('agent-builder-agent-chat-input') as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
  });

  it('forwards the trimmed draft and threadId through send', () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId('agent-builder-agent-chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  hello world  ' } });
    const submit = getByTestId('agent-builder-agent-chat-submit');
    fireEvent.click(submit);

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toBe('hello world');
    expect(sentMessages[0].threadId).toBe('agent-test');
  });
});

// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentChatPanel } from '../agent-chat-panel';

const sentMessages: Array<{ message: string; threadId?: string }> = [];
const agentMessagesCalls: Array<{ agentId: string; threadId: string; memory?: boolean }> = [];
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
  useAgentMessages: (options: { agentId: string; threadId: string; memory?: boolean }) => {
    agentMessagesCalls.push(options);
    return { data: { messages: [] }, isLoading: false };
  },
}));

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: undefined, isLoading: false }),
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
    agentMessagesCalls.length = 0;
    chatState.isRunning = false;
    chatState.messages = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state with name, description, and animated starter prompt cards', () => {
    const { getByTestId, getAllByTestId } = renderPanel();
    const empty = getByTestId('agent-builder-agent-chat-empty-state');
    expect(empty.textContent).toContain('My Agent');
    expect(empty.textContent).toContain('It does things');
    expect(empty.textContent).toContain('What can you do?');
    expect(empty.textContent).toContain('Show available tools');
    expect(empty.textContent).toContain('Suggest a task');
    expect(empty.textContent).toContain('Run a self-check');

    const cards = getAllByTestId(/agent-builder-agent-chat-starter-/);
    expect(cards).toHaveLength(4);
    cards.forEach((card, index) => {
      expect(card.className).toContain('starter-chip');
      expect((card as HTMLElement).style.animationDelay).toBe(`${280 + index * 40}ms`);
    });
  });

  it('fills the composer without sending when a starter prompt is clicked', () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId('agent-builder-agent-chat-input') as HTMLTextAreaElement;
    const card = getByTestId('agent-builder-agent-chat-starter-suggest-a-task');

    fireEvent.click(card);

    expect(input.value).toBe('Suggest a useful task I can try with you, including an example prompt.');
    expect(sentMessages).toHaveLength(0);
  });

  it('disables the composer when isRunning is true', () => {
    chatState.isRunning = true;
    const { getByTestId } = renderPanel();
    const input = getByTestId('agent-builder-agent-chat-input') as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
  });

  it('renders the composer with success border token styling', () => {
    const { getByTestId } = renderPanel();
    const composer = getByTestId('agent-builder-agent-chat-composer');
    expect(composer.className).toContain('border-accent1Dark');
    expect(composer.className).toContain('focus-within:border-accent1');
  });

  it('loads and sends runtime agent messages on the raw agent thread', () => {
    const { getByTestId } = renderPanel();

    expect(agentMessagesCalls[0]).toMatchObject({
      agentId: 'agent-test',
      threadId: 'agent-test',
      memory: true,
    });

    const input = getByTestId('agent-builder-agent-chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  hello world  ' } });
    const submit = getByTestId('agent-builder-agent-chat-submit');
    fireEvent.click(submit);

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toBe('hello world');
    expect(sentMessages[0].threadId).toBe('agent-test');
  });
});

// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultAgentFixture } from '../../../fixtures';
import { AgentPreviewChat } from '../agent-preview-chat';

const renderChat = (props: { isLoading?: boolean } = {}) =>
  render(
    <TooltipProvider>
      <AgentPreviewChat agent={defaultAgentFixture} {...props} />
    </TooltipProvider>,
  );

describe('AgentPreviewChat', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the empty state with agent name when not loading', () => {
    renderChat();

    expect(screen.getByTestId('agent-preview-chat-empty')).toBeTruthy();
    expect(screen.queryByTestId('agent-preview-chat-loading')).toBeNull();
  });

  it('renders a skeleton placeholder when loading', () => {
    renderChat({ isLoading: true });

    expect(screen.getByTestId('agent-preview-chat-loading')).toBeTruthy();
    expect(screen.queryByTestId('agent-preview-chat-empty')).toBeNull();
    expect(screen.queryByTestId('agent-preview-chat-input')).toBeNull();
  });
});

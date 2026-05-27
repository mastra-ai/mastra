// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentBuilderViewLayout } from '../agent-builder-view-layout';

describe('AgentBuilderViewLayout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the top bar above the chat panel', () => {
    const { getByTestId } = render(
      <AgentBuilderViewLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
      />,
    );

    const topBar = getByTestId('stub-top-bar');
    const chatPanel = getByTestId('agent-builder-panel-chat');
    expect(topBar).not.toBeNull();
    expect(chatPanel).not.toBeNull();

    // DOM order: top bar appears before the chat panel.
    const position = topBar.compareDocumentPosition(chatPanel);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the chat slot inside the chat panel', () => {
    const { getByTestId } = render(
      <AgentBuilderViewLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
      />,
    );

    const chatPanel = getByTestId('agent-builder-panel-chat');
    const chatContent = getByTestId('stub-chat');
    expect(chatPanel.contains(chatContent)).toBe(true);
  });

  it('never renders a configure panel or tab strip', () => {
    const { queryByTestId } = render(
      <AgentBuilderViewLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
      />,
    );

    expect(queryByTestId('agent-builder-panel-configure')).toBeNull();
    expect(queryByTestId('agent-builder-tab-chat')).toBeNull();
    expect(queryByTestId('agent-builder-tab-configure')).toBeNull();
  });

  it('renders an optional browser overlay outside the chat panel', () => {
    const { getByTestId } = render(
      <AgentBuilderViewLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        browserOverlay={<div data-testid="stub-browser">browser</div>}
      />,
    );

    const overlay = getByTestId('stub-browser');
    const chatPanel = getByTestId('agent-builder-panel-chat');
    expect(overlay).not.toBeNull();
    expect(chatPanel.contains(overlay)).toBe(false);
  });

  it('omits the browser overlay when none is provided', () => {
    const { queryByTestId } = render(
      <AgentBuilderViewLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
      />,
    );
    expect(queryByTestId('stub-browser')).toBeNull();
  });
});

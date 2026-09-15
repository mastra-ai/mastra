import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentBuilderEditLayout } from '../agent-builder-edit-layout';

describe('AgentBuilderEditLayout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the top bar, chat panel, and profile panel side-by-side', () => {
    const { getByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
      />,
    );

    expect(getByTestId('stub-top-bar')).not.toBeNull();
    expect(getByTestId('agent-builder-panel-chat')).not.toBeNull();
    expect(getByTestId('agent-builder-panel-profile')).not.toBeNull();
    expect(getByTestId('stub-chat')).not.toBeNull();
    expect(getByTestId('stub-profile')).not.toBeNull();
  });

  it('renders split variant by default with both panels', () => {
    const { getByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
      />,
    );

    expect(getByTestId('agent-builder-panel-chat')).not.toBeNull();
    expect(getByTestId('agent-builder-panel-profile')).not.toBeNull();
  });

  it('renders centered variant: only the chat is shown, profile panel is absent', () => {
    const { getByTestId, queryByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
        variant="centered"
      />,
    );

    expect(getByTestId('agent-builder-panel-chat')).not.toBeNull();
    expect(getByTestId('stub-chat')).not.toBeNull();
    expect(queryByTestId('agent-builder-panel-profile')).toBeNull();
    expect(queryByTestId('stub-profile')).toBeNull();
  });

  it('renders the chatFooter slot inside the chat column when provided', () => {
    const { getByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
        chatFooter={<div data-testid="stub-chat-footer">footer</div>}
      />,
    );

    const chatPanel = getByTestId('agent-builder-panel-chat');
    const footerWrapper = getByTestId('agent-builder-chat-footer');
    expect(chatPanel.contains(footerWrapper)).toBe(true);
    expect(getByTestId('stub-chat-footer')).not.toBeNull();
  });

  it('hides the chat-footer wrapper on desktop so it never shifts the composer', () => {
    // The footer is a mobile-only slot. Its wrapper must contribute zero height
    // at lg+ — otherwise steps that pass a footer (e.g. identity) render the
    // composer higher than steps that don't.
    const { getByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
        chatFooter={<div data-testid="stub-chat-footer">footer</div>}
      />,
    );

    expect(getByTestId('agent-builder-chat-footer').classList.contains('lg:hidden')).toBe(true);
  });

  it('does not render the chat-footer wrapper when chatFooter is omitted', () => {
    const { queryByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
      />,
    );

    expect(queryByTestId('agent-builder-chat-footer')).toBeNull();
  });

  it('hides the chat column on mobile when hideMobileChat is true (split variant)', () => {
    const { getByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
        hideMobileChat
      />,
    );

    const chatPanel = getByTestId('agent-builder-panel-chat');
    expect(chatPanel.classList.contains('hidden')).toBe(true);
    expect(chatPanel.classList.contains('lg:block')).toBe(true);
    // Profile is still rendered and visible.
    expect(getByTestId('agent-builder-panel-profile')).not.toBeNull();
  });

  it('does not hide the chat column when hideMobileChat is false', () => {
    const { getByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
      />,
    );

    const chatPanel = getByTestId('agent-builder-panel-chat');
    expect(chatPanel.classList.contains('hidden')).toBe(false);
    expect(chatPanel.classList.contains('lg:block')).toBe(false);
  });

  it('ignores hideMobileChat in centered variant (chat must stay visible)', () => {
    const { getByTestId } = render(
      <AgentBuilderEditLayout
        topBar={<div data-testid="stub-top-bar">top</div>}
        chat={<div data-testid="stub-chat">chat</div>}
        profile={<div data-testid="stub-profile">profile</div>}
        variant="centered"
        hideMobileChat
      />,
    );

    const chatPanel = getByTestId('agent-builder-panel-chat');
    expect(chatPanel.classList.contains('hidden')).toBe(false);
    expect(chatPanel.classList.contains('lg:block')).toBe(false);
  });
});

// @vitest-environment jsdom
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
});

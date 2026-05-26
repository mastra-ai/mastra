// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentBuilderRoot } from '../index';

const { useAgentBuilderInternalRedirectMock } = vi.hoisted(() => ({
  useAgentBuilderInternalRedirectMock: vi.fn(),
}));

vi.mock('@/domains/agent-builder/hooks/use-agent-builder-internal-redirect', () => ({
  useAgentBuilderInternalRedirect: useAgentBuilderInternalRedirectMock,
}));

vi.mock('@mastra/playground-ui', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('react-router', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

const renderRoot = () =>
  render(
    <MemoryRouter>
      <AgentBuilderRoot />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  useAgentBuilderInternalRedirectMock.mockReset();
});

describe('AgentBuilderRoot', () => {
  it('renders a spinner while the redirect hook is loading', () => {
    useAgentBuilderInternalRedirectMock.mockReturnValue({ isLoading: true, hasAgents: false });

    renderRoot();

    expect(screen.getByTestId('spinner')).not.toBeNull();
    expect(screen.queryByTestId('navigate')).toBeNull();
  });

  it('still shows the spinner when loading even if hasAgents is true', () => {
    useAgentBuilderInternalRedirectMock.mockReturnValue({ isLoading: true, hasAgents: true });

    renderRoot();

    expect(screen.getByTestId('spinner')).not.toBeNull();
    expect(screen.queryByTestId('navigate')).toBeNull();
  });

  it('navigates to the agents list when agents already exist', () => {
    useAgentBuilderInternalRedirectMock.mockReturnValue({ isLoading: false, hasAgents: true });

    renderRoot();

    const navigate = screen.getByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents');
    expect(screen.queryByTestId('spinner')).toBeNull();
  });

  it('navigates to the create page when no agents exist', () => {
    useAgentBuilderInternalRedirectMock.mockReturnValue({ isLoading: false, hasAgents: false });

    renderRoot();

    const navigate = screen.getByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents/create');
    expect(screen.queryByTestId('spinner')).toBeNull();
  });
});

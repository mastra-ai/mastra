// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { AgentBuilderStarter } from '../agent-builder-starter';

const renderStarter = () =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <AgentBuilderStarter />
      </MemoryRouter>
    </TooltipProvider>,
  );

describe('AgentBuilderStarter', () => {
  afterEach(() => {
    cleanup();
    navigateMock.mockReset();
  });

  it('renders the submit button with the primary IconButton variant', () => {
    const { getByTestId } = renderStarter();
    const submit = getByTestId('agent-builder-starter-submit');
    expect(submit.className).toContain('bg-accent1');
  });

  it('navigates to the agent edit page with the user message in router state on submit', () => {
    const { getByTestId } = renderStarter();
    const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;
    const submit = getByTestId('agent-builder-starter-submit');

    fireEvent.change(input, { target: { value: 'build a tutor agent' } });
    fireEvent.click(submit);

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const [path, opts] = navigateMock.mock.calls[0];
    expect(path).toMatch(/^\/agent-builder\/agents\/[^/]+\/edit$/);
    expect(opts).toMatchObject({
      state: { userMessage: 'build a tutor agent' },
      viewTransition: true,
    });
  });
});

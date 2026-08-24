import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useStarterUserMessage } from '../use-starter-user-message';

/**
 * Renders the hook against a real router so the state-clearing navigate is
 * observed through the router's own location, not through a stubbed navigate.
 */
const Probe = () => {
  const userMessage = useStarterUserMessage();
  const location = useLocation();
  const navigationType = useNavigationType();

  return (
    <>
      <span data-testid="message">{userMessage ?? 'none'}</span>
      <span data-testid="state">{JSON.stringify(location.state)}</span>
      <span data-testid="navigation-type">{navigationType}</span>
    </>
  );
};

const renderAt = (state: unknown) =>
  render(
    (
      <MemoryRouter initialEntries={[{ pathname: '/agent-builder/agents/a-1/edit', state }]}>
        <Probe />
      </MemoryRouter>
    ) as ReactNode,
  );

describe('useStarterUserMessage', () => {
  describe('when the route carries a starter prompt', () => {
    it('hands the prompt to the caller', async () => {
      renderAt({ userMessage: 'build a tutor agent' });

      expect(screen.getByTestId('message').textContent).toBe('build a tutor agent');
    });

    it('clears the location state so a refresh cannot re-dispatch the prompt', async () => {
      renderAt({ userMessage: 'build a tutor agent' });

      await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
    });

    it('keeps the prompt after the state is cleared, since it is captured once', async () => {
      renderAt({ userMessage: 'build a tutor agent' });

      await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
      expect(screen.getByTestId('message').textContent).toBe('build a tutor agent');
    });

    it('replaces the history entry rather than pushing one, so Back leaves the page', async () => {
      renderAt({ userMessage: 'build a tutor agent' });

      await waitFor(() => expect(screen.getByTestId('navigation-type').textContent).toBe('REPLACE'));
    });
  });

  describe('when the route carries no starter prompt', () => {
    it.each([
      ['no state at all', undefined],
      ['state without a message', { somethingElse: true }],
      ['null state', null],
    ])('reports no prompt for %s', (_label, state) => {
      renderAt(state);

      expect(screen.getByTestId('message').textContent).toBe('none');
    });

    it('leaves the history entry alone', async () => {
      renderAt({ somethingElse: true });

      await waitFor(() => expect(screen.getByTestId('navigation-type').textContent).toBe('POP'));
      expect(screen.getByTestId('state').textContent).toBe(JSON.stringify({ somethingElse: true }));
    });
  });

  describe('when the starter prompt is empty', () => {
    it('still reports it, so an empty prompt is not silently swallowed', async () => {
      renderAt({ userMessage: '' });

      expect(screen.getByTestId('message').textContent).toBe('');
      await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
    });
  });
});

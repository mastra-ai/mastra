// @vitest-environment jsdom
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { GlobalShortcuts } from '@/domains/navigation/components/global-shortcuts';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
};

const renderAt = (initialEntry: string) => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <KeyboardShortcutsProvider>
            <GlobalShortcuts />
            <LocationProbe />
          </KeyboardShortcutsProvider>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );

  render(<RouterProvider router={router} />);
};

const pressGThen = (key: string) => {
  fireEvent.keyDown(window, { key: 'g' });
  fireEvent.keyDown(window, { key });
};

const locationIs = (pathname: string) =>
  waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe(pathname));

afterEach(() => {
  cleanup();
});

describe('GlobalShortcuts', () => {
  describe('when g is followed by a sidebar key', () => {
    it.each([
      ['i', '/inbox'],
      ['a', '/agents'],
      ['p', '/prompts'],
      ['w', '/workflows'],
      ['c', '/processors'],
      ['m', '/mcps'],
      ['o', '/tools'],
      ['k', '/workspaces'],
      ['r', '/request-context'],
      ['e', '/evaluation'],
      ['s', '/scorers'],
      ['d', '/datasets'],
      ['x', '/experiments'],
      ['q', '/experiments/review-queue'],
      ['n', '/metrics'],
      ['t', '/traces'],
      ['l', '/logs'],
      [',', '/settings'],
      ['h', '/resources'],
    ])('g then %s navigates to %s', async (key, pathname) => {
      renderAt('/');

      pressGThen(key);

      await locationIs(pathname);
    });
  });

  describe('when the second key is not bound', () => {
    it('stays on the current page', async () => {
      renderAt('/');

      pressGThen('z');

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(screen.getByTestId('location-probe').textContent).toBe('/');
    });
  });
});

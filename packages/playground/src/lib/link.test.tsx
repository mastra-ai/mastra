import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link } from './link';

// Studio used to wrap every page change in a view transition: the browser froze the old page
// and crossfaded it into the new one, so the sidebar's current row and the content trailed
// each click by ~250ms. Page changes now swap at once.
describe('Studio Link', () => {
  const startViewTransition = vi.fn((update: () => void) => {
    update();
    const done = Promise.resolve();
    return { finished: done, ready: done, updateCallbackDone: done, skipTransition: () => {} };
  });

  beforeEach(() => {
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition });
  });

  afterEach(() => {
    cleanup();
    startViewTransition.mockClear();
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  describe('when a link to another page is clicked', () => {
    it('opens another page without a view transition', async () => {
      const router = createMemoryRouter(
        [
          { path: '/prompts', element: <Link href="/agents">Agents</Link> },
          { path: '/agents', element: <h1>Agents page</h1> },
        ],
        { initialEntries: ['/prompts'] },
      );
      render(<RouterProvider router={router} />);

      fireEvent.click(screen.getByRole('link', { name: 'Agents' }));

      expect(await screen.findByRole('heading', { name: 'Agents page' })).toBeTruthy();
      expect(startViewTransition).not.toHaveBeenCalled();
    });
  });
});

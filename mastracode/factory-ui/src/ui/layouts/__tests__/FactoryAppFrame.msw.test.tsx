import { act, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { FactoryAppFrame } from '../FactoryAppFrame';

const FACTORY_ID = 'fp-1';

function baseHandlers() {
  return [
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${FACTORY_ID}/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  ];
}

function stubViewport(matchesMobile: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: matchesMobile && query.startsWith('(max-width'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function renderFrame(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/factories/:factoryId',
        element: <FactoryAppFrame />,
        children: [
          { path: 'overview', element: <div>overview-page</div> },
          { path: 'work', element: <div>work-page</div> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('FactoryAppFrame', () => {
  beforeEach(() => {
    server.use(...baseHandlers());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  describe('when navigating between two factory pages', () => {
    it('keeps the same sidebar DOM node mounted', async () => {
      stubViewport(false);
      const { router, client } = renderFrame(`/factories/${FACTORY_ID}/overview`);

      expect(await screen.findByText('overview-page')).toBeInTheDocument();
      await waitForMutationsIdle(client);
      const sidebar = screen.getByRole('navigation', { name: 'Main' });

      await act(() => router.navigate(`/factories/${FACTORY_ID}/work`));

      expect(await screen.findByText('work-page')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Main' })).toBe(sidebar);
    });

    it('renders the page inside the framed card', async () => {
      stubViewport(false);
      renderFrame(`/factories/${FACTORY_ID}/overview`);

      const page = await screen.findByText('overview-page');
      expect(page.closest('[data-slot="factory-card"]')).not.toBeNull();
    });
  });

  describe('when on the mobile breakpoint', () => {
    it('renders the sidebar trigger in the header once', async () => {
      stubViewport(true);
      renderFrame(`/factories/${FACTORY_ID}/overview`);

      expect(await screen.findByText('overview-page')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /sidebar|menu|navigation/i })).toHaveLength(1);
    });
  });

  describe('when on desktop with the sidebar expanded', () => {
    it('renders no header controls', async () => {
      stubViewport(false);
      renderFrame(`/factories/${FACTORY_ID}/overview`);

      expect(await screen.findByText('overview-page')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open navigation menu' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).not.toBeInTheDocument();
    });
  });
});

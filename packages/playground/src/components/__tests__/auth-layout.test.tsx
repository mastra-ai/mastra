import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthLayout } from '../auth-layout';
import { Login } from '@/pages/login';
import { SignUp } from '@/pages/signup';
import { server } from '@/test/msw-server';

vi.mock('@/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

const BASE_URL = 'http://localhost:4111';

function renderAuthRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/signup', element: <SignUp /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('AuthLayout', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when the capabilities request resolves with credentials login', () => {
    const mockCapabilities = () =>
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json({ enabled: true, login: { type: 'credentials' } }),
        ),
      );

    it('renders /login inside a single studio card', async () => {
      mockCapabilities();
      renderAuthRoute('/login');

      const page = await screen.findByTestId('login-page');
      const cards = document.querySelectorAll('[data-slot="main-card"]');
      expect(cards).toHaveLength(1);
      expect(page.closest('[data-slot="main-card"]')).toBe(cards[0]);
    });

    it('renders /signup inside the same studio card', async () => {
      mockCapabilities();
      renderAuthRoute('/signup');

      const page = await screen.findByTestId('login-page');
      expect(page.closest('[data-slot="main-card"]')).not.toBeNull();
      expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeTruthy();
    });

    it('does not render the main sidebar navigation', async () => {
      mockCapabilities();
      renderAuthRoute('/login');

      await screen.findByTestId('login-page');
      expect(screen.queryByRole('navigation', { name: /main/i })).toBeNull();
      expect(document.querySelector('[data-slot="app-shell-body"]')?.className).toContain('lg:p-2');
      expect(document.querySelector('[data-slot="app-shell-body"]')?.className).not.toContain('lg:pl-0');
    });
  });
});

import 'fake-indexeddb/auto';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../user-menu';
import { userMenuCapabilities } from './fixtures/user-menu';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('User menu', () => {
  describe('when local draft storage cannot be cleared', () => {
    it('requests server logout with one click despite local storage failure', async () => {
      const logout = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(userMenuCapabilities)),
        http.post(`${BASE_URL}/api/auth/logout`, () => {
          logout();
          // Keep this test in the menu instead of navigating away after logout.
          return HttpResponse.json({ error: 'Server unavailable' }, { status: 503 });
        }),
      );
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      render(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <UserMenu user={userMenuCapabilities.user} />
            </MemoryRouter>
          </QueryClientProvider>
        </MastraReactProvider>,
      );
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(await screen.findByRole('button', { name: 'Sign out', exact: true }));
      await waitFor(() => expect(logout).toHaveBeenCalledOnce());
      expect((await screen.findByRole('alert')).textContent).toContain('503');
      expect(screen.queryByRole('button', { name: 'Sign out anyway' })).toBeNull();
    });
  });
});

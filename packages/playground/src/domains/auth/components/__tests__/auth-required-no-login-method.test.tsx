// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { PublicAuthCapabilities } from '../../types';
import { AuthRequired } from '../auth-required';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const noLoginMethodCapabilities: PublicAuthCapabilities = {
  enabled: true,
  login: null,
};

const renderAuthRequiredAt = async (pathname: string, basename?: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[pathname]} basename={basename}>
          <AuthRequired>
            <div>protected content</div>
          </AuthRequired>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  // The gate renders children while capabilities load, so every assertion must
  // wait for the capabilities response to land and for React to commit it.
  await waitFor(() => expect(queryClient.getQueryState(['auth', 'capabilities'])?.status).toBe('success'));
  await act(async () => {});
};

afterEach(() => {
  cleanup();
  delete (window as Partial<Window>).MASTRA_CLOUD_API_ENDPOINT;
});

describe('AuthRequired', () => {
  describe('when auth is enabled and the provider exposes no login method', () => {
    it('renders the settings page so the authorization header can be saved', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));

      await renderAuthRequiredAt('/settings');

      expect(screen.queryByText('Authentication Required')).toBeNull();
      expect(screen.getByText('protected content')).toBeDefined();
    });

    it('gates every other page', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));

      await renderAuthRequiredAt('/agents');

      expect(screen.getByText('Authentication Required')).toBeDefined();
      expect(screen.queryByText('protected content')).toBeNull();
    });

    // The exemption is an exact match. Any future settings subroute must be
    // added to the component on purpose, so it cannot inherit the exemption.
    it('gates settings subroutes', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));

      await renderAuthRequiredAt('/settings/secrets');

      expect(screen.getByText('Authentication Required')).toBeDefined();
      expect(screen.queryByText('protected content')).toBeNull();
    });

    it('points the gated page at settings', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));

      await renderAuthRequiredAt('/agents');

      const link = screen.getByRole('link', { name: 'Add an authorization header in Settings' });
      expect(link.getAttribute('href')).toBe('/settings');
    });

    it('keeps the studio base path in the settings link', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));

      await renderAuthRequiredAt('/studio/agents', '/studio');

      const link = screen.getByRole('link', { name: 'Add an authorization header in Settings' });
      expect(link.getAttribute('href')).toBe('/studio/settings');
    });

    it('renders the settings page under a studio base path', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));

      await renderAuthRequiredAt('/studio/settings', '/studio');

      expect(screen.queryByText('Authentication Required')).toBeNull();
      expect(screen.getByText('protected content')).toBeDefined();
    });

    it('gates settings and hides the link on Mastra platform', async () => {
      window.MASTRA_CLOUD_API_ENDPOINT = 'https://api.mastra.ai';
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));

      await renderAuthRequiredAt('/settings');

      expect(screen.getByText('Authentication Required')).toBeDefined();
      expect(screen.queryByText('protected content')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Add an authorization header in Settings' })).toBeNull();
    });
  });
});

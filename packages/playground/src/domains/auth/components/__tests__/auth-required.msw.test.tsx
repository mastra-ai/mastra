// @vitest-environment jsdom
import type { RouteResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthRequired } from '../auth-required';
import { credentialsAuthCapabilities, jwtAuthCapabilities } from './fixtures/auth-capabilities';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function renderAuthRequired(pathname: string, capabilities: RouteResponse<'GET /auth/capabilities'>) {
  const onCapabilitiesRequest = vi.fn();
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => {
      onCapabilitiesRequest();
      return HttpResponse.json(capabilities);
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[pathname]}>
          <AuthRequired>
            <div>Studio content</div>
          </AuthRequired>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return onCapabilitiesRequest;
}

afterEach(() => cleanup());

describe('AuthRequired', () => {
  describe('when authentication is enabled without a login method', () => {
    it('renders Studio content on the Settings bootstrap route', async () => {
      const onCapabilitiesRequest = renderAuthRequired('/settings', jwtAuthCapabilities);

      await waitFor(() => expect(onCapabilitiesRequest).toHaveBeenCalledOnce());

      expect(screen.getByText('Studio content')).not.toBeNull();
      expect(screen.queryByText('Authentication Required')).toBeNull();
    });

    it('keeps protected Studio routes gated', async () => {
      renderAuthRequired('/agents', jwtAuthCapabilities);

      expect(await screen.findByText('Authentication Required')).not.toBeNull();
      expect(screen.queryByText('Studio content')).toBeNull();
    });
  });

  describe('when authentication provides a credentials login method', () => {
    it('keeps the Settings route gated behind sign-in', async () => {
      renderAuthRequired('/settings', credentialsAuthCapabilities);

      expect(await screen.findByText('Sign in to continue')).not.toBeNull();
      expect(screen.queryByText('Studio content')).toBeNull();
    });
  });
});

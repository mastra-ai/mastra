// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedCapabilities, PublicAuthCapabilities } from '../../types';
import { AuthRequired } from '../auth-required';
import type { StudioConfig } from '@/domains/configuration/types';
import { StudioConfigContext } from '@/domains/configuration/context/studio-config-state';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const noLoginMethodCapabilities: PublicAuthCapabilities = {
  enabled: true,
  login: null,
};

const authenticatedCapabilities: AuthenticatedCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: false, sso: false, rbac: false, acl: false },
  access: null,
};

/**
 * Mirrors the app wiring: the studio config lives in state, the Mastra client
 * reads its headers from that state, and setConfig updates it. Saving headers
 * on the blocked screen must therefore change the headers the capabilities
 * refetch carries.
 */
const Harness = ({ onSetConfig }: { onSetConfig?: (partial: Partial<StudioConfig>) => void }) => {
  const [config, setConfigState] = useState<StudioConfig>({ baseUrl: BASE_URL, headers: {}, apiPrefix: '/api' });

  const setConfig = (partial: Partial<StudioConfig>) => {
    onSetConfig?.(partial);
    setConfigState(prev => ({ ...prev, ...partial }));
  };

  return (
    <MastraReactProvider baseUrl={config.baseUrl} headers={config.headers} apiPrefix={config.apiPrefix}>
      <StudioConfigContext.Provider value={{ ...config, isLoading: false, setConfig }}>
        <AuthRequired>
          <div>protected content</div>
        </AuthRequired>
      </StudioConfigContext.Provider>
    </MastraReactProvider>
  );
};

const renderAuthRequiredAt = async (
  pathname: string,
  { onSetConfig }: { onSetConfig?: (partial: Partial<StudioConfig>) => void } = {},
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <Harness onSetConfig={onSetConfig} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  // The gate renders children while capabilities load, so every assertion must
  // wait for the capabilities response to land and for React to commit it.
  await waitFor(() => expect(queryClient.getQueryState(['auth', 'capabilities'])?.status).toBe('success'));
  await act(async () => {});

  return { queryClient };
};

const useNoLoginMethodHandler = () => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(noLoginMethodCapabilities)));
};

/**
 * Unauthenticated until the request carries the given Authorization header,
 * authenticated afterwards. This is how a JWT provider behaves.
 */
const useHeaderGatedHandler = (authorization: string) => {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, ({ request }) => {
      if (request.headers.get('authorization') === authorization) {
        return HttpResponse.json(authenticatedCapabilities);
      }
      return HttpResponse.json(noLoginMethodCapabilities);
    }),
  );
};

const saveAuthorizationHeader = (value: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add Header' }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Authorization'), { target: { value: 'Authorization' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Bearer <token>'), { target: { value } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save Headers' }).closest('form')!);
};

afterEach(() => {
  cleanup();
  delete (window as Partial<Window>).MASTRA_CLOUD_API_ENDPOINT;
});

describe('AuthRequired', () => {
  describe('when auth is enabled and the provider exposes no login method', () => {
    it('blocks children', async () => {
      useNoLoginMethodHandler();

      await renderAuthRequiredAt('/agents');

      expect(screen.getByText('Authentication Required')).toBeDefined();
      expect(screen.queryByText('protected content')).toBeNull();
    });

    // No route is exempted from the gate, not even settings. The blocked
    // screen itself collects the header instead (see #20226 review).
    it('blocks children on the settings route', async () => {
      useNoLoginMethodHandler();

      await renderAuthRequiredAt('/settings');

      expect(screen.getByText('Authentication Required')).toBeDefined();
      expect(screen.queryByText('protected content')).toBeNull();
    });

    it('shows the header form on the blocked screen', async () => {
      useNoLoginMethodHandler();

      await renderAuthRequiredAt('/agents');

      expect(screen.getByRole('button', { name: 'Add Header' })).toBeDefined();
    });

    describe('when Studio runs on Mastra platform', () => {
      it('shows the administrator message', async () => {
        window.MASTRA_CLOUD_API_ENDPOINT = 'https://api.mastra.ai';
        useNoLoginMethodHandler();

        await renderAuthRequiredAt('/agents');

        expect(screen.getByText('No login method is configured. Please contact your administrator.')).toBeDefined();
      });

      it('does not show the header form', async () => {
        window.MASTRA_CLOUD_API_ENDPOINT = 'https://api.mastra.ai';
        useNoLoginMethodHandler();

        await renderAuthRequiredAt('/agents');

        expect(screen.queryByRole('button', { name: 'Add Header' })).toBeNull();
      });
    });

    describe('when the user saves an authorization header on the blocked screen', () => {
      it('updates the studio config and keeps the stored base URL and API prefix', async () => {
        useNoLoginMethodHandler();
        const onSetConfig = vi.fn();

        await renderAuthRequiredAt('/agents', { onSetConfig });
        saveAuthorizationHeader('Bearer token');

        expect(onSetConfig).toHaveBeenCalledWith({
          headers: { Authorization: 'Bearer token' },
          baseUrl: BASE_URL,
          apiPrefix: '/api',
        });
      });

      it('refetches capabilities with the new header and unlocks children', async () => {
        useHeaderGatedHandler('Bearer token');

        await renderAuthRequiredAt('/agents');
        expect(screen.queryByText('protected content')).toBeNull();

        saveAuthorizationHeader('Bearer token');

        await waitFor(() => expect(screen.getByText('protected content')).toBeDefined());
      });
    });
  });
});

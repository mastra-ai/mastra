// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuthenticatedCapabilities, PublicAuthCapabilities } from '../../types';
import { AuthRequired } from '../auth-required';
import {
  MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY,
  StudioConfigProvider,
} from '@/domains/configuration/context/studio-config-context';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Node 24+ ships an experimental global `localStorage` that shadows jsdom's
// and is unusable without --localstorage-file. Install an in-memory Storage
// when the environment does not provide a working one.
const hasWorkingLocalStorage = () => {
  try {
    window.localStorage.getItem('probe');
    return true;
  } catch {
    return false;
  }
};

if (!hasWorkingLocalStorage()) {
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
}

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
 * Mirrors the app wiring: the real configuration provider owns the studio
 * config, and the Mastra client reads its headers from that config. Headers
 * saved on the blocked screen must therefore travel through the real
 * persistence flow before the capabilities refetch picks them up.
 */
const Harness = () => {
  const { baseUrl, headers, apiPrefix, isLoading } = useStudioConfig();

  if (isLoading) return null;

  return (
    <MastraReactProvider baseUrl={baseUrl} headers={headers} apiPrefix={apiPrefix}>
      <AuthRequired>
        <div>protected content</div>
      </AuthRequired>
    </MastraReactProvider>
  );
};

const renderAuthRequiredAt = async (pathname: string) => {
  server.use(http.get(`${BASE_URL}/`, () => HttpResponse.json({ status: 'ok' })));

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <StudioConfigProvider endpoint={BASE_URL}>
          <Harness />
        </StudioConfigProvider>
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
  const capabilityRequests: (string | null)[] = [];

  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, ({ request }) => {
      capabilityRequests.push(request.headers.get('authorization'));
      return HttpResponse.json(noLoginMethodCapabilities);
    }),
  );

  return capabilityRequests;
};

/**
 * Unauthenticated until the request carries the given Authorization header,
 * authenticated afterwards. This is how a JWT provider behaves.
 */
const useHeaderGatedHandler = (authorization: string) => {
  const capabilityRequests: (string | null)[] = [];

  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, ({ request }) => {
      capabilityRequests.push(request.headers.get('authorization'));
      if (request.headers.get('authorization') === authorization) {
        return HttpResponse.json(authenticatedCapabilities);
      }
      return HttpResponse.json(noLoginMethodCapabilities);
    }),
    http.get(`${BASE_URL}/api/auth/permissions/patterns`, () => HttpResponse.json([])),
  );

  return capabilityRequests;
};

const saveAuthorizationHeader = (value: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add Header' }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Authorization'), { target: { value: 'Authorization' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Bearer <token>'), { target: { value } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save Headers' }).closest('form')!);
};

afterEach(() => {
  cleanup();
  localStorage.clear();
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

    // The header form has no platform carve-out: a header-only auth provider
    // deadlocks the same way on Mastra platform, so the form must show there too.
    describe('when Studio runs on Mastra platform', () => {
      it('shows the header form on the blocked screen', async () => {
        window.MASTRA_CLOUD_API_ENDPOINT = 'https://api.mastra.ai';
        useNoLoginMethodHandler();

        await renderAuthRequiredAt('/agents');

        expect(screen.getByRole('button', { name: 'Add Header' })).toBeDefined();
      });
    });

    describe('when the user saves an authorization header on the blocked screen', () => {
      it('persists the header and keeps the stored base URL and API prefix', async () => {
        useNoLoginMethodHandler();

        await renderAuthRequiredAt('/agents');
        saveAuthorizationHeader('Bearer token');

        await waitFor(() => {
          const stored = JSON.parse(localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY)!);
          expect(stored).toMatchObject({
            headers: { Authorization: 'Bearer token' },
            baseUrl: BASE_URL,
            apiPrefix: '/api',
          });
        });
      });

      it('refetches capabilities with the persisted header and unlocks children', async () => {
        const capabilityRequests = useHeaderGatedHandler('Bearer token');

        await renderAuthRequiredAt('/agents');
        expect(screen.queryByText('protected content')).toBeNull();
        // The first request carries no header, so a refetch that still used the
        // previous client would repeat that and keep the user blocked.
        expect(capabilityRequests).toEqual([null]);

        saveAuthorizationHeader('Bearer token');

        await waitFor(() => expect(screen.getByText('protected content')).toBeDefined());
        expect(capabilityRequests).toContain('Bearer token');
      });
    });
  });
});

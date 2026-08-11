// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { StudioSettingsPage } from '../index';
import { AuthRequired } from '@/domains/auth/components/auth-required';
import type { AuthenticatedCapabilities } from '@/domains/auth/types';
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

/**
 * Tests for issue https://github.com/mastra-ai/mastra/issues/20223
 *
 * Saving the Authorization header on the settings page must re-evaluate the
 * auth gate with the saved header, otherwise the user stays locked out until
 * they reload the page by hand. The harness uses the real configuration
 * provider so the saved header has to travel through the real persistence
 * flow before the capabilities refetch picks it up.
 */
const authenticatedCapabilities: AuthenticatedCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: false, sso: false, rbac: false, acl: false },
  access: null,
};

/** Mirrors the app wiring: the Mastra client reads its headers from the studio config. */
const Bridge = () => {
  const { baseUrl, headers, apiPrefix, isLoading } = useStudioConfig();

  if (isLoading) return null;

  return (
    <MastraReactProvider baseUrl={baseUrl} headers={headers} apiPrefix={apiPrefix}>
      <AuthRequired>
        <StudioSettingsPage />
      </AuthRequired>
    </MastraReactProvider>
  );
};

const renderSettingsPage = async () => {
  const capabilityRequests: (string | null)[] = [];

  server.use(
    http.get(`${BASE_URL}/`, () => HttpResponse.json({ status: 'ok' })),
    http.get(`${BASE_URL}/api/auth/capabilities`, ({ request }) => {
      capabilityRequests.push(request.headers.get('authorization'));
      return HttpResponse.json(authenticatedCapabilities);
    }),
    http.get(`${BASE_URL}/api/auth/permissions/patterns`, () => HttpResponse.json([])),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings']}>
        <StudioConfigProvider endpoint={BASE_URL}>
          <Bridge />
        </StudioConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: /save configuration/i })).toBeDefined());
  await act(async () => {});

  return { capabilityRequests, queryClient };
};

const saveAuthorizationHeader = (value: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add Header' }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Authorization'), { target: { value: 'Authorization' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Bearer <token>'), { target: { value } });
  fireEvent.submit(screen.getByRole('button', { name: /save configuration/i }).closest('form')!);
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('StudioSettingsPage', () => {
  describe('when the settings page renders', () => {
    it('does not refetch auth capabilities before the config is saved', async () => {
      const { capabilityRequests } = await renderSettingsPage();

      expect(capabilityRequests).toHaveLength(1);
    });
  });

  describe('when the user saves an Authorization header', () => {
    it('persists the header through the real configuration provider', async () => {
      await renderSettingsPage();

      saveAuthorizationHeader('Bearer secret');

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY)!);
        expect(stored.headers).toEqual({ Authorization: 'Bearer secret' });
      });
    });

    it('refetches auth capabilities with the saved header', async () => {
      const { capabilityRequests } = await renderSettingsPage();
      expect(capabilityRequests).toEqual([null]);

      saveAuthorizationHeader('Bearer secret');

      await waitFor(() => expect(capabilityRequests).toContain('Bearer secret'));
    });
  });
});

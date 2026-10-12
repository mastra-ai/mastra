import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioConfigProvider } from '../studio-config-context';
import { useStudioConfig } from '../studio-config-state';
import { authDisabledCapabilities } from './fixtures/capabilities';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const LOCAL_STORAGE_KEY = 'mastra-studio-config';

const ConfigProbe = () => {
  const config = useStudioConfig();
  return <pre data-testid="config">{JSON.stringify(config)}</pre>;
};

const renderProvider = (defaultApiPrefix?: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <StudioConfigProvider endpoint={BASE_URL} defaultApiPrefix={defaultApiPrefix}>
        <ConfigProbe />
      </StudioConfigProvider>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('StudioConfigProvider auth header URL handoff', () => {
  it('reads auth_header once, removes it from the URL, and keeps it out of localStorage', async () => {
    const statusRequest = vi.fn<(header: string | null) => void>();
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, ({ request }) => {
        statusRequest(request.headers.get('Authorization'));
        return HttpResponse.json(authDisabledCapabilities);
      }),
    );
    window.history.replaceState(null, '', '/?auth_header=Bearer+external-token&keep=1');

    renderProvider();

    await waitFor(() => expect(statusRequest).toHaveBeenCalledWith('Bearer external-token'));
    await waitFor(() => expect(window.location.search).toBe('?keep=1'));

    await waitFor(() => {
      const storedConfig = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}');
      expect(storedConfig.headers.Authorization).toBeUndefined();
    });

    const config = JSON.parse(screen.getByTestId('config').textContent ?? '{}');
    expect(config.headers.Authorization).toBe('Bearer external-token');
  });

  it('uses URL Authorization in memory but does not persist it over stored config', async () => {
    const statusRequest = vi.fn<(header: string | null) => void>();
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, ({ request }) => {
        statusRequest(request.headers.get('Authorization'));
        return HttpResponse.json(authDisabledCapabilities);
      }),
    );
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        baseUrl: 'http://stored.example',
        headers: { Authorization: 'Bearer old-token', 'X-Trace': 'trace-1' },
        apiPrefix: '/stored-api',
      }),
    );
    window.history.replaceState(null, '', '/?auth_header=Bearer+new-token');

    renderProvider();

    await waitFor(() => expect(statusRequest).toHaveBeenCalledWith('Bearer new-token'));

    await waitFor(() => {
      const storedConfig = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}');
      expect(storedConfig).toMatchObject({
        baseUrl: 'http://stored.example',
        headers: { 'X-Trace': 'trace-1' },
        apiPrefix: '/stored-api',
      });
      expect(storedConfig.headers.Authorization).toBeUndefined();
    });

    const config = JSON.parse(screen.getByTestId('config').textContent ?? '{}');
    expect(config.headers.Authorization).toBe('Bearer new-token');
    expect(config.headers['X-Trace']).toBe('trace-1');
  });
});

const readConfig = () => JSON.parse(screen.getByTestId('config').textContent ?? '{}');

describe('StudioConfigProvider instance status probe', () => {
  it('connects when Mastra is mounted under a prefix and the host app root rejects requests', async () => {
    server.use(
      http.get(`${BASE_URL}/`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${BASE_URL}/api/mastra/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
    );

    renderProvider('/api/mastra');

    await waitFor(() => expect(readConfig().isLoading).toBe(false));
    expect(readConfig()).toMatchObject({ baseUrl: BASE_URL, apiPrefix: '/api/mastra' });
  });

  it('shows the configuration form when the prefixed API is unreachable', async () => {
    server.use(http.get(`${BASE_URL}/api/mastra/auth/capabilities`, () => new HttpResponse(null, { status: 401 })));

    renderProvider('/api/mastra');

    await waitFor(() => expect(readConfig().isLoading).toBe(false));
    expect(readConfig().baseUrl).toBe('');
  });

  it('shows the configuration form when the prefixed route answers with a non-capabilities page', async () => {
    server.use(
      http.get(`${BASE_URL}/api/mastra/auth/capabilities`, () => HttpResponse.html('<!doctype html><html></html>')),
    );

    renderProvider('/api/mastra');

    await waitFor(() => expect(readConfig().isLoading).toBe(false));
    expect(readConfig().baseUrl).toBe('');
  });

  it('normalizes a trailing slash in the API prefix', async () => {
    server.use(http.get(`${BASE_URL}/api/mastra/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)));

    renderProvider('/api/mastra/');

    await waitFor(() => expect(readConfig().isLoading).toBe(false));
    expect(readConfig().baseUrl).toBe(BASE_URL);
  });

  it('probes the capabilities route at the server root when the API prefix is empty', async () => {
    server.use(http.get(`${BASE_URL}/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)));

    renderProvider('');

    await waitFor(() => expect(readConfig().isLoading).toBe(false));
    expect(readConfig().baseUrl).toBe(BASE_URL);
  });
});

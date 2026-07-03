import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY, StudioConfigProvider } from '../studio-config-context';
import { useStudioConfig } from '../studio-config-state';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const DESKTOP_SHELL_URL = 'http://127.0.0.1:3137';

const ConfigProbe = () => {
  const config = useStudioConfig();
  return <pre data-testid="config">{JSON.stringify(config)}</pre>;
};

const renderProvider = (endpoint = BASE_URL) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <StudioConfigProvider endpoint={endpoint}>
        <ConfigProbe />
      </StudioConfigProvider>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  delete window.MASTRA_DESKTOP_ENDPOINT;
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('StudioConfigProvider auth header URL handoff', () => {
  it('reads auth_header once, removes it from the URL, and keeps it out of localStorage', async () => {
    const statusRequest = vi.fn<(header: string | null) => void>();
    server.use(
      http.get(BASE_URL, ({ request }) => {
        statusRequest(request.headers.get('Authorization'));
        return HttpResponse.text('ok');
      }),
    );
    window.history.replaceState(null, '', '/?auth_header=Bearer+external-token&keep=1');

    renderProvider();

    await waitFor(() => expect(statusRequest).toHaveBeenCalledWith('Bearer external-token'));
    await waitFor(() => expect(window.location.search).toBe('?keep=1'));

    await waitFor(() => {
      const storedConfig = JSON.parse(window.localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY) ?? '{}');
      expect(storedConfig.headers.Authorization).toBeUndefined();
    });

    const config = JSON.parse(screen.getByTestId('config').textContent ?? '{}');
    expect(config.headers.Authorization).toBe('Bearer external-token');
  });

  it('uses URL Authorization in memory but does not persist it over stored config', async () => {
    const statusRequest = vi.fn<(header: string | null) => void>();
    server.use(
      http.get(BASE_URL, ({ request }) => {
        statusRequest(request.headers.get('Authorization'));
        return HttpResponse.text('ok');
      }),
    );
    window.localStorage.setItem(
      MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY,
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
      const storedConfig = JSON.parse(window.localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY) ?? '{}');
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

describe('StudioConfigProvider desktop shell connection', () => {
  describe('when Desktop has a stale persisted Studio URL', () => {
    it('uses the injected shell endpoint and overwrites the stale localStorage entry', async () => {
      server.use(http.get(DESKTOP_SHELL_URL, () => HttpResponse.text('ok')));
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';
      window.localStorage.setItem(
        MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY,
        JSON.stringify({
          baseUrl: 'http://127.0.0.1:3133',
          headers: { 'X-Trace': 'stale' },
          apiPrefix: '/stale-api',
        }),
      );

      renderProvider(DESKTOP_SHELL_URL);

      await waitFor(() => {
        const config = JSON.parse(screen.getByTestId('config').textContent ?? '{}');
        expect(config).toMatchObject({
          baseUrl: DESKTOP_SHELL_URL,
          headers: {},
          apiPrefix: '/api',
          isLoading: false,
        });
      });

      const storedConfig = JSON.parse(window.localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY) ?? '{}');
      expect(storedConfig).toMatchObject({
        baseUrl: DESKTOP_SHELL_URL,
        headers: {},
        apiPrefix: '/api',
      });
    });
  });

  describe('when the Desktop shell status check is temporarily inactive', () => {
    it('keeps using the injected shell endpoint instead of showing the manual config fallback', async () => {
      server.use(http.get(DESKTOP_SHELL_URL, () => HttpResponse.text('starting', { status: 503 })));
      window.MASTRA_DESKTOP_ENDPOINT = '/__desktop';

      renderProvider(DESKTOP_SHELL_URL);

      await waitFor(() => {
        const config = JSON.parse(screen.getByTestId('config').textContent ?? '{}');
        expect(config).toMatchObject({
          baseUrl: DESKTOP_SHELL_URL,
          headers: {},
          apiPrefix: '/api',
          isLoading: false,
        });
      });
    });
  });
});

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioConfigProvider } from './studio-config-context';
import { useStudioConfig } from './studio-config-state';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const LOCAL_STORAGE_KEY = 'mastra-studio-config';

const ConfigProbe = () => {
  const config = useStudioConfig();
  return <pre data-testid="config">{JSON.stringify(config)}</pre>;
};

const renderProvider = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <StudioConfigProvider endpoint={BASE_URL}>
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
  it('reads auth_header once, removes it from the URL, and persists it as Authorization', async () => {
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
    expect(window.location.search).toBe('?keep=1');

    await waitFor(() => {
      const storedConfig = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}');
      expect(storedConfig.headers.Authorization).toBe('Bearer external-token');
    });

    const config = JSON.parse(screen.getByTestId('config').textContent ?? '{}');
    expect(config.headers.Authorization).toBe('Bearer external-token');
  });

  it('overrides only Authorization when stored config already exists', async () => {
    server.use(http.get(BASE_URL, () => HttpResponse.text('ok')));
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

    await waitFor(() => {
      const storedConfig = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}');
      expect(storedConfig).toMatchObject({
        baseUrl: 'http://stored.example',
        headers: { Authorization: 'Bearer new-token', 'X-Trace': 'trace-1' },
        apiPrefix: '/stored-api',
      });
    });
  });
});

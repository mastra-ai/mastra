// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authDisabledCapabilities } from '../../context/__tests__/fixtures/capabilities';
import { MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY, StudioConfigProvider } from '../../context/studio-config-context';
import { useStudioConfig, useStudioConnection } from '../../context/studio-config-state';
import { PlaygroundConfigGuard } from '../playground-config-guard';
import { server } from '@/test/msw-server';

const DEFAULT_URL = 'http://localhost:4111';
const OTHER_URL = 'http://other.example';
const probeUrl = (baseUrl: string) => `${baseUrl}/api/auth/capabilities`;

// Mirrors the app wiring in App.tsx.
const App = () => {
  const { baseUrl, isLoading } = useStudioConfig();
  const { connection } = useStudioConnection();
  if (isLoading) return null;
  if (connection.status !== 'connected') return <PlaygroundConfigGuard />;
  return <p>Studio on {baseUrl}</p>;
};

const renderApp = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudioConfigProvider endpoint={DEFAULT_URL}>
        <App />
      </StudioConfigProvider>
    </QueryClientProvider>,
  );

const serverUp = (baseUrl = DEFAULT_URL) =>
  server.use(http.get(probeUrl(baseUrl), () => HttpResponse.json(authDisabledCapabilities)));

const serverDown = (baseUrl = DEFAULT_URL) => {
  const onProbe = vi.fn<() => void>();
  server.use(
    http.get(probeUrl(baseUrl), ({ request }) => {
      if (request.mode !== 'no-cors') onProbe();
      return HttpResponse.error();
    }),
  );
  return onProbe;
};

const serverAnswers = (httpStatus: number) => {
  const onProbe = vi.fn<() => void>();
  server.use(
    http.get(probeUrl(DEFAULT_URL), () => {
      onProbe();
      return new HttpResponse(null, { status: httpStatus });
    }),
  );
  return onProbe;
};

const storeConnection = (baseUrl: string) =>
  localStorage.setItem(
    MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY,
    JSON.stringify({ baseUrl, headers: {}, apiPrefix: '/api' }),
  );

const urlField = () => screen.findByRole<HTMLInputElement>('textbox', { name: /Mastra instance URL/ });

const saveUrl = async (url: string) => {
  fireEvent.change(await urlField(), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
};

const nextRetry = () => new Promise(resolve => setTimeout(resolve, 1500));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('PlaygroundConfigGuard', () => {
  describe('when nothing answers at the URL Studio knows', () => {
    it('waits for that server instead of asking for a URL', async () => {
      serverDown();

      renderApp();

      expect(await screen.findByText(/Nothing answers at http:\/\/localhost:4111 yet/)).not.toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('connects on its own once the server is up', async () => {
      serverDown();
      renderApp();
      await screen.findByText('Waiting for your Mastra server');

      serverUp();

      expect(await screen.findByText(`Studio on ${DEFAULT_URL}`)).not.toBeNull();
    });
  });

  describe('when the server accepts the request but never answers', () => {
    it('waits for it instead of loading forever', async () => {
      const timeout = AbortSignal.timeout.bind(AbortSignal);
      vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(50));
      server.use(
        http.get(probeUrl(DEFAULT_URL), async () => {
          await delay('infinite');
          return new HttpResponse();
        }),
      );

      renderApp();

      expect(await screen.findByText(/Nothing answers at http:\/\/localhost:4111 yet/)).not.toBeNull();
    });
  });

  describe('when the server answers with an error it can recover from', () => {
    it.each([
      [500, /answers with error 500/],
      [502, /isn't up yet \(error 502\)/],
    ])('says which and keeps waiting (%i)', async (httpStatus, cause) => {
      serverAnswers(httpStatus);
      renderApp();
      await screen.findByText(cause);

      serverUp();

      expect(await screen.findByText(`Studio on ${DEFAULT_URL}`)).not.toBeNull();
    });
  });

  describe('when the user edits the connection while waiting', () => {
    it('opens the form with the current URL', async () => {
      serverDown();
      renderApp();

      fireEvent.click(await screen.findByRole('button', { name: 'Edit connection' }));

      expect((await urlField()).value).toBe(DEFAULT_URL);
    });

    it('stops checking the current server', async () => {
      const onProbe = serverDown();
      renderApp();
      fireEvent.click(await screen.findByRole('button', { name: 'Edit connection' }));
      await urlField();
      const probes = onProbe.mock.calls.length;

      await nextRetry();

      expect(onProbe).toHaveBeenCalledTimes(probes);
    });

    it('keeps the form when a check under way succeeds', async () => {
      serverDown();
      renderApp();
      const edit = await screen.findByRole('button', { name: 'Edit connection' });
      let answer: () => void = () => {};
      const answered = new Promise<void>(resolve => (answer = resolve));
      const onProbe = vi.fn<() => void>();
      server.use(
        http.get(probeUrl(DEFAULT_URL), async () => {
          onProbe();
          await answered;
          return HttpResponse.json(authDisabledCapabilities);
        }),
      );
      await waitFor(() => expect(onProbe).toHaveBeenCalled());

      fireEvent.click(edit);
      answer();
      await nextRetry();

      expect((await urlField()).value).toBe(DEFAULT_URL);
    });

    it('connects to the saved URL', async () => {
      serverDown();
      serverUp(OTHER_URL);
      renderApp();
      fireEvent.click(await screen.findByRole('button', { name: 'Edit connection' }));

      await saveUrl(OTHER_URL);

      expect(await screen.findByText(`Studio on ${OTHER_URL}`)).not.toBeNull();
    });

    it('keeps waiting on cancel', async () => {
      serverDown();
      renderApp();
      fireEvent.click(await screen.findByRole('button', { name: 'Edit connection' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      serverUp();

      expect(await screen.findByText(`Studio on ${DEFAULT_URL}`)).not.toBeNull();
    });
  });

  describe('when the server rejects the request', () => {
    it.each([
      [401, 'The server needs authorization'],
      [404, 'No Mastra server found'],
    ])('shows the form with the reason (%i)', async (httpStatus, reason) => {
      serverAnswers(httpStatus);

      renderApp();

      expect(await screen.findByText(reason)).not.toBeNull();
      expect((await urlField()).value).toBe(DEFAULT_URL);
    });

    it('does not keep asking', async () => {
      const onProbe = serverAnswers(401);
      renderApp();
      await urlField();

      await nextRetry();

      expect(onProbe).toHaveBeenCalledOnce();
    });

    it('asks again when the same connection is saved', async () => {
      serverAnswers(404);
      renderApp();
      await urlField();
      serverUp();

      await saveUrl(DEFAULT_URL);

      expect(await screen.findByText(`Studio on ${DEFAULT_URL}`)).not.toBeNull();
    });
  });

  describe('when something other than Mastra answers', () => {
    it('shows the form with the reason', async () => {
      server.use(http.get(probeUrl(DEFAULT_URL), () => HttpResponse.html('<!doctype html><html></html>')));

      renderApp();

      expect(await screen.findByText('Not a Mastra server')).not.toBeNull();
    });
  });

  describe('when the server blocks the request with CORS', () => {
    it('tells it apart from a server that is down and connects once allowed', async () => {
      // A browser rejects the request, but lets one through that doesn't read the answer.
      server.use(
        http.get(probeUrl(DEFAULT_URL), ({ request }) =>
          request.mode === 'no-cors' ? new HttpResponse() : HttpResponse.error(),
        ),
      );

      renderApp();

      expect(await screen.findByText('The server blocks this Studio')).not.toBeNull();

      serverUp();

      expect(await screen.findByText(`Studio on ${DEFAULT_URL}`)).not.toBeNull();
    });
  });

  describe('when the saved URL has no protocol', () => {
    it('shows the form with the reason', async () => {
      storeConnection('localhost:4111');

      renderApp();

      expect(await screen.findByText(/Start it with http/)).not.toBeNull();
    });
  });

  describe('when only the stored headers differ from the default connection', () => {
    it('can go back to the default one', async () => {
      localStorage.setItem(
        MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY,
        JSON.stringify({ baseUrl: DEFAULT_URL, headers: { Authorization: 'Bearer wrong' }, apiPrefix: '/api' }),
      );
      server.use(
        http.get(probeUrl(DEFAULT_URL), ({ request }) =>
          request.headers.has('Authorization')
            ? new HttpResponse(null, { status: 401 })
            : HttpResponse.json(authDisabledCapabilities),
        ),
      );
      renderApp();

      fireEvent.click(await screen.findByRole('button', { name: 'Reset to default' }));

      expect(await screen.findByText(`Studio on ${DEFAULT_URL}`)).not.toBeNull();
    });
  });

  describe('when the stored server is not the default one and does not answer', () => {
    it('waits for the stored one', async () => {
      storeConnection(OTHER_URL);
      serverDown(OTHER_URL);

      renderApp();

      expect(await screen.findByText(/Nothing answers at http:\/\/other.example yet/)).not.toBeNull();
    });

    it('can go back to the default one', async () => {
      storeConnection(OTHER_URL);
      serverDown(OTHER_URL);
      serverUp();
      renderApp();

      fireEvent.click(await screen.findByRole('button', { name: 'Reset to default' }));

      expect(await screen.findByText(`Studio on ${DEFAULT_URL}`)).not.toBeNull();
      await waitFor(() => expect(localStorage.getItem(MASTRA_STUDIO_CONFIG_LOCAL_STORAGE_KEY)).toBeNull());
    });
  });
});

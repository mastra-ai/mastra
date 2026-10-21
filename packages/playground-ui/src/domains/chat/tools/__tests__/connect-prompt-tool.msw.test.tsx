// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectPromptTool } from '../connect-prompt-tool';
import { connectPromptPayload, connectPromptSession, connectPromptStatusActive } from './fixtures/connect-prompt';
import { server } from '@/test/msw-server';

// The Nango frontend SDK opens real windows and websockets, so it is the one
// boundary mocked beyond MSW.
const nangoMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  close: vi.fn(),
  constructorOptions: [] as unknown[],
}));

vi.mock('@nangohq/frontend', async importOriginal => {
  const actual = await importOriginal<typeof import('@nangohq/frontend')>();
  class FakeNango {
    win = { close: nangoMocks.close };
    constructor(options: unknown) {
      nangoMocks.constructorOptions.push(options);
    }
    auth(...args: unknown[]) {
      return nangoMocks.auth(...args);
    }
  }
  return { ...actual, default: FakeNango };
});

const BASE_URL = 'http://localhost:4111';

function renderConnectPrompt({ output, readOnly }: { output: unknown; readOnly?: boolean }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ConnectPromptTool output={output} readOnly={readOnly} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const launchPath = `${BASE_URL}${connectPromptSession.launchUrl}`;

beforeEach(() => {
  nangoMocks.auth.mockReset();
  nangoMocks.auth.mockResolvedValue({});
  nangoMocks.close.mockReset();
  nangoMocks.constructorOptions.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConnectPromptTool', () => {
  describe('when the tool output is a connect-prompt payload', () => {
    it('renders each provider with its connection state', async () => {
      renderConnectPrompt({ output: connectPromptPayload });

      const card = await screen.findByRole('region', { name: 'Connect an account' });
      expect(card.textContent).toContain('Linear');
      expect(card.textContent).toContain('Notion');
      // Notion is already connected: no Connect action, just the state.
      expect(card.textContent).toContain('Connected');
      expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(1);
    });
  });

  describe('when the output is not a connect-prompt payload', () => {
    it('renders nothing', () => {
      const { container } = renderConnectPrompt({ output: { anything: true } });
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when rendering read-only history', () => {
    it('disables the connect action', async () => {
      renderConnectPrompt({ output: connectPromptPayload, readOnly: true });
      const button = await screen.findByRole('button', { name: 'Connect' });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('when the user connects an OAuth provider from the card', () => {
    it('authorizes headlessly with the gate-released token and marks the provider connected', async () => {
      const open = vi.spyOn(window, 'open');
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(launchPath, () =>
          HttpResponse.json({ sessionToken: 'nango_connect_session_t1', expiresAt: connectPromptSession.expiresAt }),
        ),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json(connectPromptStatusActive),
        ),
      );

      renderConnectPrompt({ output: connectPromptPayload });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      // The poll settles active and the row flips to connected.
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull());
      const card = screen.getByRole('region', { name: 'Connect an account' });
      expect(card.textContent).toContain('Connected');

      // The SDK drove the provider's own consent popup, keyed by the token the
      // launch gate released — no window ever navigated to a hosted page.
      expect(nangoMocks.constructorOptions).toContainEqual({ connectSessionToken: 'nango_connect_session_t1' });
      expect(nangoMocks.auth).toHaveBeenCalledWith('linear', { detectClosedAuthWindow: true });
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('when a provider requires auth parameters that chat cannot collect', () => {
    it('uses the hosted flow instead of starting invalid headless authorization', async () => {
      const popup = { location: { href: '' }, close: vi.fn(), closed: false };
      const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' }),
        ),
      );
      const [provider] = connectPromptPayload.providers;
      if (!provider) throw new Error('Expected a connect prompt provider fixture');
      const output = {
        ...connectPromptPayload,
        providers: [
          {
            ...provider,
            authFields: [{ name: 'workspace', target: 'params' as const, label: 'Workspace', required: true }],
          },
        ],
      };

      renderConnectPrompt({ output });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      await waitFor(() => expect(popup.location.href).toBe(launchPath));
      expect(open).toHaveBeenCalledWith('', 'mastra-connect', 'popup,width=600,height=720');
      expect(nangoMocks.auth).not.toHaveBeenCalled();
    });
  });

  describe('when authorization fails in the provider popup', () => {
    it('shows the failure reason and re-enables the connect action', async () => {
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(launchPath, () =>
          HttpResponse.json({ sessionToken: 'nango_connect_session_t1', expiresAt: connectPromptSession.expiresAt }),
        ),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' }),
        ),
      );
      const { AuthError } = await import('@nangohq/frontend');
      nangoMocks.auth.mockRejectedValueOnce(new AuthError('closed', 'window_closed'));

      renderConnectPrompt({ output: connectPromptPayload });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toMatch(/window was closed/i);
      // The flow settled, so the action is available to retry.
      expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('when the gate releases no token and the fallback popup is blocked', () => {
    it('offers a manual launch link to the launch gate', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(launchPath, () =>
          HttpResponse.json({ sessionToken: null, expiresAt: connectPromptSession.expiresAt }),
        ),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' }),
        ),
      );

      renderConnectPrompt({ output: connectPromptPayload });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      const link = await screen.findByRole('link', { name: 'Open the connect window' });
      expect(link.getAttribute('href')).toBe(launchPath);
      expect(nangoMocks.auth).not.toHaveBeenCalled();
    });
  });
});

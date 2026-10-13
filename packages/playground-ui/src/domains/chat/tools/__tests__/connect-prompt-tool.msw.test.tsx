// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectPromptTool } from '../connect-prompt-tool';
import { connectPromptPayload, connectPromptSession, connectPromptStatusActive } from './fixtures/connect-prompt';
import { server } from '@/test/msw-server';

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

/** Stubs `window.open` with a trackable popup handle, as popups don't exist in jsdom. */
function stubPopup({ blocked = false }: { blocked?: boolean } = {}) {
  const popup = { location: { href: '' }, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockReturnValue(blocked ? null : (popup as unknown as Window));
  return { popup, open };
}

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

  describe('when the user connects a provider from the card', () => {
    it('drives the popup through the launch gate and marks the provider connected', async () => {
      const { popup } = stubPopup();
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json(connectPromptStatusActive),
        ),
      );

      renderConnectPrompt({ output: connectPromptPayload });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      // The popup is sent to the server's launch gate — never the raw vendor URL.
      await waitFor(() => expect(popup.location.href).toBe(`${BASE_URL}${connectPromptSession.launchUrl}`));

      // The poll settles active and the row flips to connected.
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull());
      const card = screen.getByRole('region', { name: 'Connect an account' });
      expect(card.textContent).toContain('Connected');
    });
  });

  describe('when the popup is blocked', () => {
    it('offers a manual launch link to the launch gate', async () => {
      stubPopup({ blocked: true });
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' }),
        ),
      );

      renderConnectPrompt({ output: connectPromptPayload });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      const link = await screen.findByRole('link', { name: 'Open the connect window' });
      expect(link.getAttribute('href')).toBe(`${BASE_URL}${connectPromptSession.launchUrl}`);
    });
  });
});

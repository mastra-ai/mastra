// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectPromptSession, connectPromptStatusActive } from '../../chat/tools/__tests__/fixtures/connect-prompt';
import type { UsePendingConnectOptions } from '../use-user-connect';
import { usePendingConnect } from '../use-user-connect';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function renderPendingConnect(options?: UsePendingConnectOptions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return renderHook(() => usePendingConnect(options), { wrapper });
}

/** Stubs `window.open` with a trackable popup handle, as popups don't exist in jsdom. */
function stubPopup() {
  const popup = { location: { href: '' }, close: vi.fn(), closed: false };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  return popup;
}

const sessionHandler = http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession));
const statusPath = `${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePendingConnect', () => {
  describe('when the connection settles active', () => {
    it('clears the pending flow and records the provider as connected', async () => {
      stubPopup();
      server.use(
        sessionHandler,
        http.get(statusPath, () => HttpResponse.json(connectPromptStatusActive)),
      );

      const { result } = renderPendingConnect();
      act(() => result.current.connect('linear'));

      // The settle may land before an intermediate pending render is
      // observable; the recorded provider proves the full cycle ran.
      await waitFor(() => expect(result.current.connectedProviders.has('linear')).toBe(true));
      expect(result.current.pending).toBeNull();
      expect(result.current.settled).toEqual({ provider: 'linear', status: 'active' });
    });

    it('clears the previous outcome when a new flow starts', async () => {
      stubPopup();
      // Each session mints a fresh connection; the second one stays pending.
      let sessions = 0;
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => {
          sessions += 1;
          return HttpResponse.json(
            sessions === 1 ? connectPromptSession : { ...connectPromptSession, connectionId: 'conn-second' },
          );
        }),
        http.get(statusPath, () => HttpResponse.json(connectPromptStatusActive)),
        http.get(`${BASE_URL}/connect/connections/conn-second/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, id: 'conn-second', status: 'pending' }),
        ),
      );

      const { result } = renderPendingConnect();
      act(() => result.current.connect('linear'));
      await waitFor(() => expect(result.current.settled?.status).toBe('active'));

      act(() => result.current.connect('linear'));
      await waitFor(() => expect(result.current.pending).not.toBeNull());
      expect(result.current.settled).toBeNull();
    });
  });

  describe('when the status poll fails', () => {
    it('clears the pending flow so Connect can be retried', async () => {
      stubPopup();
      let statusCalls = 0;
      server.use(
        sessionHandler,
        http.get(statusPath, () => {
          statusCalls += 1;
          return HttpResponse.json({}, { status: 500 });
        }),
      );

      const { result } = renderPendingConnect();
      act(() => result.current.connect('linear'));

      await waitFor(() => expect(statusCalls).toBeGreaterThan(0));
      await waitFor(() => expect(result.current.pending).toBeNull());
      expect(result.current.connectedProviders.has('linear')).toBe(false);
    });
  });

  describe('when the popup closes without the flow settling', () => {
    it('abandons the pending flow after the grace period', async () => {
      const popup = stubPopup();
      server.use(
        sessionHandler,
        http.get(statusPath, () => HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' })),
      );

      const { result } = renderPendingConnect({ popupCloseGraceMs: 30 });
      act(() => result.current.connect('linear'));
      await waitFor(() => expect(result.current.pending).not.toBeNull());

      popup.closed = true;
      await waitFor(() => expect(result.current.pending).toBeNull());
      expect(result.current.connectedProviders.has('linear')).toBe(false);
      expect(result.current.settled).toEqual({ provider: 'linear', status: 'failed' });
    });
  });

  describe('when the poll budget runs out', () => {
    it('abandons the still-pending flow', async () => {
      stubPopup();
      server.use(
        sessionHandler,
        http.get(statusPath, () => HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' })),
      );

      const { result } = renderPendingConnect({ popupCloseGraceMs: 40, pendingTimeoutMs: 80 });
      act(() => result.current.connect('linear'));
      await waitFor(() => expect(result.current.pending).not.toBeNull());

      await waitFor(() => expect(result.current.pending).toBeNull());
    });
  });
});

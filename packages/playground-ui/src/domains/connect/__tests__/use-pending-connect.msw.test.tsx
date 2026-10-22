// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { AuthError } from '@nangohq/frontend';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../test/msw-server';
import { connectPromptSession, connectPromptStatusActive } from '../../chat/tools/__tests__/fixtures/connect-prompt';
import type { UsePendingConnectOptions } from '../use-user-connect';
import { usePendingConnect } from '../use-user-connect';

// The Nango frontend SDK opens real windows and websockets, so it is the one
// boundary mocked beyond MSW — exactly how the platform dashboard tests it.
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
const launchPath = `${BASE_URL}${connectPromptSession.launchUrl}`;
const launchTokenHandler = http.get(launchPath, () =>
  HttpResponse.json({ sessionToken: 'nango_connect_session_t1', expiresAt: connectPromptSession.expiresAt }),
);

/** Providers as callers hold them: the hosted path has no headless auth type. */
const hostedProvider = { id: 'linear' };
const oauthProvider = { id: 'linear', authType: 'OAUTH2' };

beforeEach(() => {
  nangoMocks.auth.mockReset();
  nangoMocks.auth.mockResolvedValue({});
  nangoMocks.close.mockReset();
  nangoMocks.constructorOptions.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePendingConnect', () => {
  describe('when the provider supports headless auth', () => {
    it('authorizes through the provider popup without the hosted page', async () => {
      const open = vi.spyOn(window, 'open');
      server.use(
        sessionHandler,
        launchTokenHandler,
        http.get(statusPath, () => HttpResponse.json(connectPromptStatusActive)),
      );

      const { result } = renderPendingConnect();
      act(() => result.current.connect(oauthProvider));

      await waitFor(() => expect(result.current.settled).toEqual({ provider: 'linear', status: 'active' }));
      // The SDK was keyed by the gate-released token and drove the provider's
      // own consent popup — no window ever navigated to a hosted page.
      expect(nangoMocks.constructorOptions).toContainEqual({ connectSessionToken: 'nango_connect_session_t1' });
      expect(nangoMocks.auth).toHaveBeenCalledWith('linear', { detectClosedAuthWindow: true });
      expect(open).not.toHaveBeenCalled();
    });

    it('falls back to the hosted popup when the gate releases no token', async () => {
      const popup = stubPopup();
      server.use(
        sessionHandler,
        http.get(launchPath, () =>
          HttpResponse.json({ sessionToken: null, expiresAt: connectPromptSession.expiresAt }),
        ),
        http.get(statusPath, () => HttpResponse.json(connectPromptStatusActive)),
      );

      const { result } = renderPendingConnect();
      act(() => result.current.connect(oauthProvider));

      await waitFor(() => expect(result.current.settled?.status).toBe('active'));
      expect(window.open).toHaveBeenCalledWith(
        `${BASE_URL}${connectPromptSession.launchUrl}`,
        'mastra-connect',
        expect.any(String),
      );
      expect(nangoMocks.auth).not.toHaveBeenCalled();
      expect(popup.close).not.toHaveBeenCalled();
    });

    it('settles failed with the SDK message when authorization is rejected', async () => {
      server.use(
        sessionHandler,
        launchTokenHandler,
        http.get(statusPath, () => HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' })),
      );
      nangoMocks.auth.mockRejectedValueOnce(new AuthError('blocked', 'blocked_by_browser'));

      const { result } = renderPendingConnect();
      act(() => result.current.connect(oauthProvider));

      await waitFor(() => expect(result.current.settled?.status).toBe('failed'));
      expect(result.current.settled?.message).toMatch(/popup was blocked/i);
      expect(result.current.pending).toBeNull();
    });

    it('submits collected credentials without opening any popup', async () => {
      const open = vi.spyOn(window, 'open');
      server.use(
        sessionHandler,
        launchTokenHandler,
        http.get(statusPath, () => HttpResponse.json(connectPromptStatusActive)),
      );

      const apiKeyProvider = { id: 'linear', authType: 'API_KEY' };
      const { result } = renderPendingConnect();
      act(() => result.current.connect(apiKeyProvider, { 'credentials:apiKey': 'sk-test' }));

      await waitFor(() => expect(result.current.settled?.status).toBe('active'));
      expect(nangoMocks.auth).toHaveBeenCalledWith('linear', { credentials: { apiKey: 'sk-test' } });
      expect(open).not.toHaveBeenCalled();
    });

    it('cancel closes the provider window and hands the action back', async () => {
      let resolveAuth: (() => void) | undefined;
      nangoMocks.auth.mockImplementation(() => new Promise<void>(resolve => (resolveAuth = resolve)));
      server.use(
        sessionHandler,
        launchTokenHandler,
        http.get(statusPath, () => HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' })),
      );

      const { result } = renderPendingConnect();
      act(() => result.current.connect(oauthProvider));
      await waitFor(() => expect(result.current.pending).not.toBeNull());

      act(() => result.current.cancel());
      expect(nangoMocks.close).toHaveBeenCalled();
      expect(result.current.pending).toBeNull();
      expect(result.current.settled).toBeNull();
      resolveAuth?.();
    });
  });

  describe('when the connection settles active', () => {
    it('clears the pending flow and records the provider as connected', async () => {
      stubPopup();
      server.use(
        sessionHandler,
        http.get(statusPath, () => HttpResponse.json(connectPromptStatusActive)),
      );

      const { result } = renderPendingConnect();
      act(() => result.current.connect(hostedProvider));

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
      act(() => result.current.connect(hostedProvider));
      await waitFor(() => expect(result.current.settled?.status).toBe('active'));

      act(() => result.current.connect(hostedProvider));
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
      act(() => result.current.connect(hostedProvider));

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
      act(() => result.current.connect(hostedProvider));
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
      act(() => result.current.connect(hostedProvider));
      await waitFor(() => expect(result.current.pending).not.toBeNull());

      await waitFor(() => expect(result.current.pending).toBeNull());
    });
  });
});

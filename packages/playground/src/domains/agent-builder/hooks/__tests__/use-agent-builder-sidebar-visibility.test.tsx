import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useAgentBuilderSidebarVisibility } from '../use-agent-builder-sidebar-visibility';
import { authDisabledCapabilities, authEnabledWritableCapabilities, rbacCapabilities } from './fixtures/auth';
import { buildBuilderSettings } from './fixtures/builder-settings';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const CAPABILITIES_URL = `${BASE_URL}/api/auth/capabilities`;
const SETTINGS_URL = `${BASE_URL}/api/editor/builder/settings`;

/** RBAC on, but nobody is signed in — no `user` on the capabilities payload. */
const signedOutCapabilities: AuthCapabilities = { enabled: true, login: null };

const renderVisibility = ({
  capabilities = authDisabledCapabilities,
  builderEnabled = true,
  capabilitiesDelayMs,
  settingsDelayMs,
}: {
  capabilities?: AuthCapabilities;
  builderEnabled?: boolean;
  capabilitiesDelayMs?: number;
  settingsDelayMs?: number;
} = {}) => {
  server.use(
    http.get(CAPABILITIES_URL, async () => {
      if (capabilitiesDelayMs) await delay(capabilitiesDelayMs);
      return HttpResponse.json(capabilities);
    }),
  );
  server.use(
    http.get(SETTINGS_URL, async () => {
      if (settingsDelayMs) await delay(settingsDelayMs);
      return HttpResponse.json(builderEnabled ? buildBuilderSettings() : { enabled: false });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return { ...renderHook(() => useAgentBuilderSidebarVisibility(), { wrapper }), queryClient };
};

describe('useAgentBuilderSidebarVisibility', () => {
  describe('when auth is disabled and the builder is configured', () => {
    it('shows the shortcut', async () => {
      const { result } = renderVisibility();

      await waitFor(() => expect(result.current.isVisible).toBe(true));
    });
  });

  describe('when a signed-in user can access the builder', () => {
    it('shows the shortcut', async () => {
      const { result } = renderVisibility({ capabilities: authEnabledWritableCapabilities });

      await waitFor(() => expect(result.current.isVisible).toBe(true));
    });
  });

  describe('when the builder is not configured', () => {
    it('hides the shortcut', async () => {
      const { result } = renderVisibility({ builderEnabled: false });

      await waitFor(() => expect(result.current.isVisible).toBe(false));
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('when the signed-in user lacks stored-agent permissions', () => {
    it('hides the shortcut', async () => {
      const { result } = renderVisibility({ capabilities: rbacCapabilities(['agents:read']) });

      await waitFor(() => expect(result.current.isVisible).toBe(false));
    });
  });

  describe('when auth is enabled but nobody is signed in', () => {
    it('keeps the shortcut hidden even once the builder reports itself enabled', async () => {
      const { result, queryClient } = renderVisibility({ capabilities: signedOutCapabilities });

      // Wait past the loading guard: the interesting decision is the one the
      // hook makes with both queries resolved and the builder switched on.
      await waitFor(() => expect(queryClient.getQueryData(['builder-settings'])).toBeDefined());
      await waitFor(() => expect(queryClient.getQueryData(['auth', 'capabilities'])).toBeDefined());

      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('while the auth capabilities are still loading', () => {
    it('hides the shortcut rather than flashing it', async () => {
      const { result } = renderVisibility({ capabilitiesDelayMs: 80 });

      expect(result.current.isVisible).toBe(false);
      await waitFor(() => expect(result.current.isVisible).toBe(true));
    });
  });

  describe('while the builder settings are still loading', () => {
    it('hides the shortcut rather than flashing it', async () => {
      const { result } = renderVisibility({ settingsDelayMs: 80 });

      expect(result.current.isVisible).toBe(false);
      await waitFor(() => expect(result.current.isVisible).toBe(true));
    });
  });

  describe('when the capabilities request fails', () => {
    it('hides the shortcut', async () => {
      server.use(http.get(CAPABILITIES_URL, () => new HttpResponse(null, { status: 500 })));
      server.use(http.get(SETTINGS_URL, () => HttpResponse.json(buildBuilderSettings())));

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </MastraReactProvider>
      );

      const { result } = renderHook(() => useAgentBuilderSidebarVisibility(), { wrapper });

      await waitFor(() => expect(queryClient.getQueryState(['auth', 'capabilities'])?.status).not.toBe('pending'));
      expect(result.current.isVisible).toBe(false);
    });
  });
});

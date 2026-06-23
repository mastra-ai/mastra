// @vitest-environment jsdom
import type { BuilderSettingsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useBuilderAgentAccess } from '../use-builder-agent-access';
import { authDisabledCapabilities, rbacCapabilities } from './fixtures/auth';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderAccess = ({
  capabilities,
  settings,
  settingsStatus = 200,
  settingsDelayMs,
}: {
  capabilities: AuthCapabilities;
  settings?: BuilderSettingsResponse;
  settingsStatus?: number;
  settingsDelayMs?: number;
}) => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));

  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, async () => {
      if (settingsDelayMs) await delay(settingsDelayMs);
      if (settingsStatus !== 200) return HttpResponse.json({ error: 'boom' }, { status: settingsStatus });
      return HttpResponse.json(settings ?? { enabled: false });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return renderHook(() => useBuilderAgentAccess(), { wrapper });
};

describe('useBuilderAgentAccess', () => {
  describe('when RBAC is enabled and the user has neither read nor write', () => {
    it('denies access with reason permission-denied', async () => {
      const { result } = renderAccess({ capabilities: rbacCapabilities([]) });

      await waitFor(() => expect(result.current.denialReason).toBe('permission-denied'));
      expect(result.current.canAccessAgentBuilder).toBe(false);
      expect(result.current.hasRequiredPermissions).toBe(false);
    });

    it('does not report loading because the settings query stays disabled', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities([]),
        settings: { enabled: true, features: { agent: { tools: true } } },
      });

      await waitFor(() => expect(result.current.hasRequiredPermissions).toBe(false));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('when RBAC is enabled and the user has read-only access (operator role)', () => {
    it('grants access without write capability', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-agents:read']),
        settings: { enabled: true, features: { agent: { tools: true } } },
      });

      await waitFor(() => expect(result.current.canAccessAgentBuilder).toBe(true));
      expect(result.current.denialReason).toBeNull();
      expect(result.current.hasRequiredPermissions).toBe(true);
      expect(result.current.canWrite).toBe(false);
      expect(result.current.canExecute).toBe(true);
    });
  });

  describe('when RBAC is enabled and the user has read and write (member role)', () => {
    it('grants full agent and skill capabilities', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-agents:read', 'stored-agents:write', 'stored-skills:read']),
        settings: { enabled: true, features: { agent: { tools: true } } },
      });

      await waitFor(() => expect(result.current.canAccessAgentBuilder).toBe(true));
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canExecute).toBe(true);
      expect(result.current.canManageSkills).toBe(true);
      expect(result.current.canUseFavorites).toBe(true);
    });

    it('exposes the agent feature flags from settings', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-agents:read', 'stored-agents:write']),
        settings: { enabled: true, features: { agent: { tools: true, memory: true, skills: false } } },
      });

      await waitFor(() => expect(result.current.canAccessAgentBuilder).toBe(true));
      expect(result.current.isBuilderEnabled).toBe(true);
      expect(result.current.hasAgentFeature).toBe(true);
      expect(result.current.agentFeatures).toEqual({ tools: true, memory: true, skills: false });
    });
  });

  describe('when the builder is disabled in settings', () => {
    it('denies access with reason not-configured', async () => {
      const { result } = renderAccess({
        capabilities: authDisabledCapabilities,
        settings: { enabled: false, features: { agent: { tools: true } } },
      });

      await waitFor(() => expect(result.current.denialReason).toBe('not-configured'));
      expect(result.current.isBuilderEnabled).toBe(false);
      expect(result.current.canAccessAgentBuilder).toBe(false);
    });
  });

  describe('when the agent feature is missing from settings', () => {
    it('denies access with reason not-configured', async () => {
      const { result } = renderAccess({
        capabilities: authDisabledCapabilities,
        settings: { enabled: true, features: {} },
      });

      await waitFor(() => expect(result.current.denialReason).toBe('not-configured'));
      expect(result.current.hasAgentFeature).toBe(false);
      expect(result.current.canAccessAgentBuilder).toBe(false);
    });
  });

  describe('when the settings fetch fails', () => {
    it('denies access with reason error', async () => {
      const { result } = renderAccess({
        capabilities: authDisabledCapabilities,
        settingsStatus: 500,
      });

      await waitFor(() => expect(result.current.denialReason).toBe('error'));
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.canAccessAgentBuilder).toBe(false);
    });
  });

  describe('when RBAC is disabled', () => {
    it('bypasses permission checks and grants every granular capability', async () => {
      const { result } = renderAccess({
        capabilities: authDisabledCapabilities,
        settings: { enabled: true, features: { agent: { agents: true } } },
      });

      await waitFor(() => expect(result.current.canAccessAgentBuilder).toBe(true));
      expect(result.current.hasRequiredPermissions).toBe(true);
      expect(result.current.denialReason).toBeNull();
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canExecute).toBe(true);
      expect(result.current.canManageSkills).toBe(true);
      expect(result.current.canUseFavorites).toBe(true);
    });
  });

  describe('when the settings query is in flight', () => {
    it('reports loading only while the query is enabled', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-agents:read']),
        settings: { enabled: true, features: { agent: { tools: true } } },
        settingsDelayMs: 50,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));
      await waitFor(() => expect(result.current.canAccessAgentBuilder).toBe(true));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('when RBAC is enabled and the user has read and skills but not write', () => {
    it('grants favorites and skill management but withholds write', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-agents:read', 'stored-skills:read']),
        settings: { enabled: true, features: { agent: { tools: true } } },
      });

      await waitFor(() => expect(result.current.canAccessAgentBuilder).toBe(true));
      expect(result.current.canWrite).toBe(false);
      expect(result.current.canExecute).toBe(true);
      expect(result.current.canManageSkills).toBe(true);
      expect(result.current.canUseFavorites).toBe(true);
    });
  });

  describe('when RBAC is enabled and the user has write but no read access', () => {
    it('denies favorites because they require read access', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-agents:write']),
        settings: { enabled: true, features: { agent: { tools: true } } },
      });

      await waitFor(() => expect(result.current.canAccessAgentBuilder).toBe(true));
      expect(result.current.canUseFavorites).toBe(false);
    });
  });
});

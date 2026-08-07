import type { WorkflowBuilderSettingsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useWorkflowBuilderAccess } from './use-workflow-builder-access';
import { authDisabledCapabilities, rbacCapabilities } from '@/domains/agent-builder/hooks/__tests__/fixtures/auth';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderAccess = ({
  capabilities,
  settings = { enabled: true },
  settingsStatus = 200,
}: {
  capabilities: AuthCapabilities;
  settings?: WorkflowBuilderSettingsResponse;
  settingsStatus?: number;
}) => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));
  server.use(
    http.get(`${BASE_URL}/api/editor/workflow-builder/settings`, () =>
      settingsStatus === 200
        ? HttpResponse.json(settings)
        : HttpResponse.json({ error: 'Unable to load settings' }, { status: settingsStatus }),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return renderHook(() => useWorkflowBuilderAccess(), { wrapper });
};

describe('useWorkflowBuilderAccess', () => {
  describe('when the user has read-only stored-workflow access', () => {
    it('allows persisted definition access without authoring or execution', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-workflows:read']),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(false);
      expect(result.current.canRun).toBe(false);
      expect(result.current.canUseBuilder).toBe(false);
      expect(result.current.denialReason).toBeNull();
    });
  });

  describe('when the user can read, write, and execute workflows', () => {
    it('allows every workflow-builder capability', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-workflows:read', 'stored-workflows:write', 'workflows:execute']),
      });

      await waitFor(() => expect(result.current.canUseBuilder).toBe(true));
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canRun).toBe(true);
      expect(result.current.denialReason).toBeNull();
    });
  });

  describe('when the workflow builder is disabled', () => {
    it('keeps persisted definitions readable while denying conversational authoring', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-workflows:read', 'stored-workflows:write']),
        settings: { enabled: false },
      });

      await waitFor(() => expect(result.current.denialReason).toBe('not-configured'));
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canUseBuilder).toBe(false);
    });
  });

  describe('when workflow-builder settings fail to load', () => {
    it('reports the settings error without removing persisted definition access', async () => {
      const { result } = renderAccess({
        capabilities: rbacCapabilities(['stored-workflows:read']),
        settingsStatus: 500,
      });

      await waitFor(() => expect(result.current.denialReason).toBe('error'));
      expect(result.current.canRead).toBe(true);
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('when RBAC is disabled', () => {
    it('allows every workflow-builder capability', async () => {
      const { result } = renderAccess({ capabilities: authDisabledCapabilities });

      await waitFor(() => expect(result.current.canUseBuilder).toBe(true));
      expect(result.current.canRead).toBe(true);
      expect(result.current.canWrite).toBe(true);
      expect(result.current.canRun).toBe(true);
    });
  });
});

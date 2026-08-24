import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useCanCreateAgent } from '../use-can-create-agent';
import { authDisabledCapabilities, rbacCapabilities } from './fixtures/auth';
import { buildBuilderSettings } from './fixtures/builder-settings';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const CMS_ROUTE = '/cms/agents/create';
const BUILDER_ROUTE = '/agent-builder/agents/create';

type ExperimentalWindow = Record<string, unknown>;

const setExperimentalFlag = (value: unknown) => {
  (window as unknown as ExperimentalWindow).MASTRA_EXPERIMENTAL_UI = value;
};

const renderCanCreate = ({
  capabilities = authDisabledCapabilities,
  builderEnabled = true,
}: { capabilities?: AuthCapabilities; builderEnabled?: boolean } = {}) => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json(builderEnabled ? buildBuilderSettings() : { enabled: false }),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return renderHook(() => useCanCreateAgent(), { wrapper });
};

afterEach(() => {
  delete (window as unknown as ExperimentalWindow).MASTRA_EXPERIMENTAL_UI;
});

describe('useCanCreateAgent', () => {
  describe('when the agent builder is available', () => {
    it('allows creating and routes to the builder', async () => {
      const { result } = renderCanCreate();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canCreateAgent).toBe(true);
      expect(result.current.createRoute).toBe(BUILDER_ROUTE);
    });
  });

  describe('when the agent builder is not configured', () => {
    it('blocks creating and falls back to the CMS route', async () => {
      const { result } = renderCanCreate({ builderEnabled: false });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canCreateAgent).toBe(false);
      expect(result.current.createRoute).toBe(CMS_ROUTE);
    });
  });

  describe('when the caller lacks stored-agent permissions', () => {
    it('blocks creating and falls back to the CMS route', async () => {
      const { result } = renderCanCreate({ capabilities: rbacCapabilities(['agents:read']) });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canCreateAgent).toBe(false);
      expect(result.current.createRoute).toBe(CMS_ROUTE);
    });
  });

  describe('when the experimental UI flag is set on window', () => {
    it('allows creating even though the builder is unavailable', async () => {
      setExperimentalFlag('true');

      const { result } = renderCanCreate({ builderEnabled: false });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canCreateAgent).toBe(true);
      // The flag unlocks the entry point but does not change where it points.
      expect(result.current.createRoute).toBe(CMS_ROUTE);
    });

    it('ignores a flag that is not the exact string "true"', async () => {
      setExperimentalFlag(true);

      const { result } = renderCanCreate({ builderEnabled: false });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canCreateAgent).toBe(false);
    });

    it('ignores an empty flag', async () => {
      setExperimentalFlag('');

      const { result } = renderCanCreate({ builderEnabled: false });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canCreateAgent).toBe(false);
    });
  });
});

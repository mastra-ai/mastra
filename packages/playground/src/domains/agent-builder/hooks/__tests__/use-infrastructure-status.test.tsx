import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useInfrastructureStatus } from '../use-infrastructure-status';
import { buildInfrastructureStatus } from './fixtures/infrastructure-status';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const INFRASTRUCTURE_URL = `${BASE_URL}/api/editor/builder/infrastructure`;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

/** Let react-query settle so "no request was made" is a real observation. */
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

/**
 * react-query's first retry is scheduled ~1s after a failure, so a shorter wait
 * cannot tell "never retried" apart from "about to retry".
 */
const settlePastFirstRetry = () => new Promise(resolve => setTimeout(resolve, 1500));

describe('useInfrastructureStatus', () => {
  describe('when the server returns the infrastructure status', () => {
    it('exposes the resolved configuration', async () => {
      server.use(
        http.get(INFRASTRUCTURE_URL, () =>
          HttpResponse.json(buildInfrastructureStatus({ registries: { skillsSh: { enabled: false } } })),
        ),
      );

      const { result } = renderHook(() => useInfrastructureStatus(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.workspace.workspaceId).toBe('workspace-1');
      expect(result.current.data?.browser.availableProviders).toEqual(['playwright']);
      expect(result.current.data?.registries.skillsSh.enabled).toBe(false);
    });

    it('caches the status under a stable key shared by every caller', async () => {
      let calls = 0;
      server.use(
        http.get(INFRASTRUCTURE_URL, () => {
          calls += 1;
          return HttpResponse.json(buildInfrastructureStatus());
        }),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useInfrastructureStatus(), { wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

      const second = renderHook(() => useInfrastructureStatus({ enabled: true }), { wrapper });

      expect(second.result.current.data?.workspace.name).toBe('Local workspace');
      expect(calls).toBe(1);
    });
  });

  describe('when no options are passed', () => {
    it('fetches straight away', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(INFRASTRUCTURE_URL, () => {
          onFetch();
          return HttpResponse.json(buildInfrastructureStatus());
        }),
      );

      const { result } = renderHook(() => useInfrastructureStatus(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(onFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the caller lacks the infrastructure:read permission', () => {
    it('stays idle instead of calling the admin-only endpoint', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(INFRASTRUCTURE_URL, () => {
          onFetch();
          return HttpResponse.json(buildInfrastructureStatus());
        }),
      );

      const { result } = renderHook(() => useInfrastructureStatus({ enabled: false }), {
        wrapper: createWrapper(),
      });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when the endpoint rejects the request', () => {
    it('surfaces the error without retrying', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(INFRASTRUCTURE_URL, () => {
          onFetch();
          return new HttpResponse(null, { status: 403 });
        }),
      );

      const { result } = renderHook(() => useInfrastructureStatus(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      await settlePastFirstRetry();
      expect(onFetch).toHaveBeenCalledTimes(1);
    });
  });
});

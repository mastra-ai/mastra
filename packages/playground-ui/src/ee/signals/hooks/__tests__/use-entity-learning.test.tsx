// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { entitiesResponse, pointsResponse, topicsResponse } from '../../services/__tests__/fixtures/entity-learning';
import { useEntities, useEntityPoints, useEntityTopics } from '../use-entity-learning';

const BASE_URL = 'https://observability.test';
const ROOT = `${BASE_URL}/api/learning`;

const server = setupServer();

type EntityLearningWindow = typeof globalThis & {
  MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
  MASTRA_ORGANIZATION_ID?: string;
  MASTRA_PLATFORM_PROJECT_ID?: string;
};

const w = window as EntityLearningWindow;

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  // The injected endpoint is the trace-ingest URL; the client must derive
  // the query-service origin from it and call /api/learning on that origin.
  w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = `${BASE_URL}/v1/traces`;
  w.MASTRA_ORGANIZATION_ID = 'org-1';
  w.MASTRA_PLATFORM_PROJECT_ID = 'proj-1';
});

afterEach(() => {
  server.resetHandlers();
  delete w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
  delete w.MASTRA_ORGANIZATION_ID;
  delete w.MASTRA_PLATFORM_PROJECT_ID;
});

afterAll(() => server.close());

describe('entity-learning hooks', () => {
  describe('useEntities', () => {
    describe('when the observability endpoint is configured', () => {
      it('fetches and selects the entities array', async () => {
        server.use(http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)));

        const { result } = renderHook(() => useEntities(), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(entitiesResponse.entities);
      });
    });

    describe('when the observability endpoint is not configured', () => {
      it('does not fire the request and stays disabled', async () => {
        delete w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
        const onEntities = vi.fn<() => void>();
        server.use(
          http.get(`${ROOT}/entities`, () => {
            onEntities();
            return HttpResponse.json(entitiesResponse);
          }),
        );

        const { result } = renderHook(() => useEntities(), { wrapper });

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(result.current.fetchStatus).toBe('idle');
        expect(onEntities).not.toHaveBeenCalled();
      });
    });
  });

  describe('useEntityTopics', () => {
    describe('when a runId is provided', () => {
      it('fetches the clusters for that run', async () => {
        let capturedUrl: URL | undefined;
        server.use(
          http.get(`${ROOT}/entities/:entityId/topics`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json(topicsResponse);
          }),
        );

        const { result } = renderHook(() => useEntityTopics('entity_support', 'sentiment', '32'), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(topicsResponse);
        expect(capturedUrl?.searchParams.get('runId')).toBe('32');
      });
    });

    describe('when runId is omitted', () => {
      it('fetches without a runId so the API resolves the latest run for the signal', async () => {
        let capturedUrl: URL | undefined;
        server.use(
          http.get(`${ROOT}/entities/:entityId/topics`, ({ request }) => {
            capturedUrl = new URL(request.url);
            return HttpResponse.json(topicsResponse);
          }),
        );

        const { result } = renderHook(() => useEntityTopics('entity_support', 'sentiment'), { wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(capturedUrl?.searchParams.get('signalName')).toBe('sentiment');
        expect(capturedUrl?.searchParams.has('runId')).toBe(false);
      });
    });

    describe('when entityId is missing', () => {
      it('stays disabled and does not fetch', async () => {
        const onTopics = vi.fn<() => void>();
        server.use(
          http.get(`${ROOT}/entities/:entityId/topics`, () => {
            onTopics();
            return HttpResponse.json(topicsResponse);
          }),
        );

        const { result } = renderHook(() => useEntityTopics(undefined, 'sentiment'), { wrapper });

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(result.current.fetchStatus).toBe('idle');
        expect(onTopics).not.toHaveBeenCalled();
      });
    });
  });

  describe('useEntityPoints', () => {
    it('forwards includeOutliers to the request and scopes via the project header', async () => {
      let capturedUrl: URL | undefined;
      let capturedProjectHeader: string | null = null;
      server.use(
        http.get(`${ROOT}/entities/:entityId/points`, ({ request }) => {
          capturedUrl = new URL(request.url);
          capturedProjectHeader = request.headers.get('X-Mastra-Project-Id');
          return HttpResponse.json(pointsResponse);
        }),
      );

      const { result } = renderHook(
        () => useEntityPoints('entity_support', { signalName: 'sentiment', runId: '32', includeOutliers: true }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(capturedUrl?.searchParams.get('includeOutliers')).toBe('true');
      // Scope comes from the session server-side; the client only narrows by
      // project via the header, never query params.
      expect(capturedUrl?.searchParams.has('organizationId')).toBe(false);
      expect(capturedProjectHeader).toBe('proj-1');
    });
  });
});

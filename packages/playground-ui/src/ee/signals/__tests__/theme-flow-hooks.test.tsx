// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useThemeFlow, useThemeSnapshots } from '../hooks';
import { TraceIntelligenceProvider } from '../trace-intelligence-provider';
import { themeFlowResponse, themeSnapshotsResponse } from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;

function TestQueryProvider({ children, queryClient }: { children: ReactNode; queryClient?: QueryClient }) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('Agent Learning theme flow hooks', () => {
  describe('when an entity and signals are selected', () => {
    it('loads snapshots through the same-origin route without client-selected scope', async () => {
      let observedRequest: Request | undefined;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          observedRequest = request;
          return HttpResponse.json(themeSnapshotsResponse);
        }),
      );

      const { result } = renderHook(() => useThemeSnapshots('support-agent', 'agent', ['goal', 'outcome']), {
        wrapper: TestQueryProvider,
      });

      await waitFor(() => expect(result.current.data).toEqual(themeSnapshotsResponse));
      if (!observedRequest) throw new Error('Expected the theme snapshots request');
      const url = new URL(observedRequest.url);
      expect(observedRequest.headers.get('X-Mastra-Organization-Id')).toBeNull();
      expect(observedRequest.headers.get('X-Mastra-Project-Id')).toBeNull();
      expect(url.searchParams.get('entityType')).toBe('agent');
      expect(url.searchParams.get('signalNames')).toBe('goal,outcome');
      expect(url.searchParams.get('presentation')).toBe('landmarks');
      expect(url.searchParams.get('limit')).toBe('24');
    });

    it('normalizes snapshot range dates into the request and query key', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const dateFrom = new Date('2026-07-01T00:00:00.000Z');
      const dateTo = new Date('2026-07-08T12:30:00.000Z');
      let observedRequest: Request | undefined;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          observedRequest = request;
          return HttpResponse.json(themeSnapshotsResponse);
        }),
      );

      const { result } = renderHook(
        () => useThemeSnapshots('support-agent', 'agent', ['goal', 'outcome'], dateFrom, dateTo),
        {
          wrapper: ({ children }) => (
            <TraceIntelligenceProvider cacheScope="project-a">
              <TestQueryProvider queryClient={queryClient}>{children}</TestQueryProvider>
            </TraceIntelligenceProvider>
          ),
        },
      );

      await waitFor(() => expect(result.current.data).toEqual(themeSnapshotsResponse));
      if (!observedRequest) throw new Error('Expected the ranged theme snapshots request');
      const url = new URL(observedRequest.url);
      expect(url.searchParams.get('from')).toBe('2026-07-01T00:00:00.000Z');
      expect(url.searchParams.get('to')).toBe('2026-07-08T12:30:00.000Z');
      expect(
        queryClient
          .getQueryCache()
          .getAll()
          .map(query => query.queryKey),
      ).toContainEqual([
        'entity-learning',
        'project-a',
        'agent',
        'support-agent',
        'theme-snapshots',
        ['goal', 'outcome'],
        '2026-07-01T00:00:00.000Z',
        '2026-07-08T12:30:00.000Z',
      ]);
    });

    it('loads the weighted flow for a snapshot', async () => {
      let observedRequest: Request | undefined;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          observedRequest = request;
          return HttpResponse.json(themeFlowResponse);
        }),
      );

      const { result } = renderHook(() => useThemeFlow('support-agent', 'agent', ['goal', 'outcome'], 'snapshot-1'), {
        wrapper: TestQueryProvider,
      });

      await waitFor(() => expect(result.current.data).toEqual(themeFlowResponse));
      if (!observedRequest) throw new Error('Expected the theme flow request');
      const url = new URL(observedRequest.url);
      expect(url.searchParams.get('snapshotId')).toBe('snapshot-1');
      expect(url.searchParams.get('themeLimitPerStage')).toBe('8');
    });
  });
});

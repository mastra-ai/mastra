// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useThemeFlow, useThemeSnapshots } from '../hooks';
import { themeFlowResponse, themeSnapshotsResponse } from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:3100';
const PROJECT_ID = 'project-1';

function TestQueryProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = BASE_URL;
  window.MASTRA_PLATFORM_PROJECT_ID = PROJECT_ID;
});

afterEach(() => {
  window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = undefined;
  window.MASTRA_PLATFORM_PROJECT_ID = undefined;
});

describe('Agent Learning theme flow hooks', () => {
  describe('when an entity and signals are selected', () => {
    it('loads snapshots with the session-scoped project header', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          const url = new URL(request.url);
          expect(request.headers.get('X-Mastra-Project-Id')).toBe(PROJECT_ID);
          expect(url.searchParams.get('entityType')).toBe('agent');
          expect(url.searchParams.get('signalNames')).toBe('goal,outcome');
          expect(url.searchParams.get('limit')).toBe('50');
          return HttpResponse.json(themeSnapshotsResponse);
        }),
      );

      const { result } = renderHook(() => useThemeSnapshots('support-agent', 'agent', ['goal', 'outcome']), {
        wrapper: TestQueryProvider,
      });

      await waitFor(() => expect(result.current.data).toEqual(themeSnapshotsResponse));
    });

    it('loads the weighted flow for a snapshot', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('snapshotId')).toBe('snapshot-1');
          expect(url.searchParams.get('themeLimitPerStage')).toBe('8');
          return HttpResponse.json(themeFlowResponse);
        }),
      );

      const { result } = renderHook(() => useThemeFlow('support-agent', 'agent', ['goal', 'outcome'], 'snapshot-1'), {
        wrapper: TestQueryProvider,
      });

      await waitFor(() => expect(result.current.data).toEqual(themeFlowResponse));
    });
  });
});

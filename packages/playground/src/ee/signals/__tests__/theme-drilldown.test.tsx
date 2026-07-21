// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useThemeDetail, useThemeExamples, useThemeHistory, useThemePaths } from '../hooks';
import {
  firstThemeExamplesResponse,
  firstThemePathsResponse,
  missingThemeDetailResponse,
  secondThemeExamplesResponse,
  secondThemePathsResponse,
  themeDetailResponse,
  themeHistoryResponse,
} from './fixtures/theme-drilldown';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;
const detailPath = `${BASE_URL}/api/learning/entities/support-agent/themes/101`;

function TestQueryProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function expectExactQuery(url: URL, expected: Record<string, string>) {
  expect(Object.fromEntries(url.searchParams)).toEqual(expected);
}

describe('Agent Learning theme drilldown hooks', () => {
  describe('when a theme is selected', () => {
    it('fetches detail, examples, and history with their exact query contracts', async () => {
      server.use(
        http.get(detailPath, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'goal',
            snapshotId: 'opaque-snapshot-cursor',
          });
          return HttpResponse.json(themeDetailResponse);
        }),
        http.get(`${detailPath}/examples`, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'goal',
            snapshotId: 'opaque-snapshot-cursor',
            limit: '20',
            offset: '0',
          });
          return HttpResponse.json(firstThemeExamplesResponse);
        }),
        http.get(`${detailPath}/history`, ({ request }) => {
          expectExactQuery(new URL(request.url), {
            entityType: 'agent',
            signalName: 'goal',
            limit: '100',
          });
          return HttpResponse.json(themeHistoryResponse);
        }),
      );

      const { result } = renderHook(
        () => ({
          detail: useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101'),
          examples: useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101'),
          history: useThemeHistory('support-agent', 'agent', 'goal', '101'),
        }),
        { wrapper: TestQueryProvider },
      );

      await waitFor(() => {
        expect(result.current.detail.data).toEqual(themeDetailResponse);
        expect(result.current.examples.data).toEqual(firstThemeExamplesResponse);
        expect(result.current.history.data).toEqual(themeHistoryResponse);
      });
    });
  });

  describe('when no theme is selected', () => {
    it('does not request detail, examples, or history', async () => {
      let requestCount = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId`, () => {
          requestCount += 1;
          return HttpResponse.json(themeDetailResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/examples`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemeExamplesResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/history`, () => {
          requestCount += 1;
          return HttpResponse.json(themeHistoryResponse);
        }),
      );

      renderHook(
        () => ({
          detail: useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', undefined),
          examples: useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', undefined),
          history: useThemeHistory('support-agent', 'agent', 'goal', undefined),
        }),
        { wrapper: TestQueryProvider },
      );

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(requestCount).toBe(0);
    });
  });

  describe('when the selected theme id is not numeric', () => {
    it('does not request theme data or paths', async () => {
      let requestCount = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/:entityId/theme-paths`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemePathsResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId`, () => {
          requestCount += 1;
          return HttpResponse.json(themeDetailResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/examples`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemeExamplesResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/:entityId/themes/:themeId/history`, () => {
          requestCount += 1;
          return HttpResponse.json(themeHistoryResponse);
        }),
      );

      renderHook(
        () => ({
          detail: useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', 'theme-101'),
          examples: useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', 'theme-101'),
          history: useThemeHistory('support-agent', 'agent', 'goal', 'theme-101'),
          paths: useThemePaths(
            'support-agent',
            'agent',
            ['goal', 'outcome', 'behavior'],
            'opaque-snapshot-cursor',
            'theme-101',
          ),
        }),
        { wrapper: TestQueryProvider },
      );

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(requestCount).toBe(0);
    });
  });

  describe('when examples paginate', () => {
    it('fetches the requested next offset', async () => {
      server.use(
        http.get(`${detailPath}/examples`, ({ request }) => {
          const offset = new URL(request.url).searchParams.get('offset');
          return HttpResponse.json(offset === '1' ? secondThemeExamplesResponse : firstThemeExamplesResponse);
        }),
      );

      const { result, rerender } = renderHook(
        ({ offset }) => useThemeExamples('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101', 20, offset),
        { wrapper: TestQueryProvider, initialProps: { offset: 0 } },
      );
      await waitFor(() => expect(result.current.data).toEqual(firstThemeExamplesResponse));

      rerender({ offset: 1 });

      await waitFor(() => expect(result.current.data).toEqual(secondThemeExamplesResponse));
    });
  });

  describe('when the detail response has no theme', () => {
    it('returns the snapshot without throwing', async () => {
      server.use(http.get(detailPath, () => HttpResponse.json(missingThemeDetailResponse)));

      const { result } = renderHook(
        () => useThemeDetail('support-agent', 'agent', 'goal', 'opaque-snapshot-cursor', '101'),
        { wrapper: TestQueryProvider },
      );

      await waitFor(() => expect(result.current.data).toEqual(missingThemeDetailResponse));
      expect(result.current.data?.theme).toBeUndefined();
    });
  });

  describe('when a drill-in starts', () => {
    it('fetches every paths page with the opaque snapshot and ordered signals', async () => {
      const observedOffsets: string[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, ({ request }) => {
          const url = new URL(request.url);
          const offset = url.searchParams.get('offset') ?? '';
          expectExactQuery(url, {
            entityType: 'agent',
            signalNames: 'goal,outcome,behavior',
            snapshotId: 'opaque-snapshot-cursor',
            limit: '500',
            offset,
          });
          observedOffsets.push(offset);
          return HttpResponse.json(offset === '1' ? secondThemePathsResponse : firstThemePathsResponse);
        }),
      );

      const { result } = renderHook(
        () => useThemePaths('support-agent', 'agent', ['goal', 'outcome', 'behavior'], 'opaque-snapshot-cursor', '101'),
        { wrapper: TestQueryProvider },
      );

      await waitFor(() => expect(result.current.data?.paths).toHaveLength(2));
      expect(observedOffsets).toEqual(['0', '1']);
      expect(result.current.data?.themes).toEqual(firstThemePathsResponse.themes);
    });
  });

  describe('when no drill-in is active', () => {
    it('does not request theme paths', async () => {
      let requestCount = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/:entityId/theme-paths`, () => {
          requestCount += 1;
          return HttpResponse.json(firstThemePathsResponse);
        }),
      );

      renderHook(
        () =>
          useThemePaths('support-agent', 'agent', ['goal', 'outcome', 'behavior'], 'opaque-snapshot-cursor', undefined),
        { wrapper: TestQueryProvider },
      );

      await new Promise(resolve => setTimeout(resolve, 20));
      expect(requestCount).toBe(0);
    });
  });
});

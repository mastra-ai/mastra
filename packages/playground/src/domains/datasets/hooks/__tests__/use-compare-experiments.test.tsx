import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useCompareExperiments } from '../use-compare-experiments';
import { makeComparison } from './fixtures/experiments';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const COMPARE_URL = `${BASE_URL}/api/datasets/dataset-1/compare`;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

/** Let react-query settle so "no request was made" is a real observation. */
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

describe('useCompareExperiments', () => {
  describe('when all three ids are supplied', () => {
    it('exposes the comparison', async () => {
      server.use(http.post(COMPARE_URL, () => HttpResponse.json(makeComparison())));

      const { result } = renderHook(() => useCompareExperiments('dataset-1', 'exp-a', 'exp-b'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.baselineId).toBe('exp-a');
      expect(result.current.data?.items[0]?.results['exp-b']?.scores).toEqual({ accuracy: 0 });
    });

    it('posts both experiment ids to the dataset compare endpoint', async () => {
      let body: unknown;
      server.use(
        http.post(COMPARE_URL, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(makeComparison());
        }),
      );

      const { result } = renderHook(() => useCompareExperiments('dataset-1', 'exp-a', 'exp-b'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(body).toMatchObject({ experimentIdA: 'exp-a', experimentIdB: 'exp-b' });
    });
  });

  describe('when regression thresholds are supplied', () => {
    it('forwards them to the server', async () => {
      let body: unknown;
      server.use(
        http.post(COMPARE_URL, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(makeComparison());
        }),
      );

      const { result } = renderHook(
        () =>
          useCompareExperiments('dataset-1', 'exp-a', 'exp-b', {
            thresholds: { accuracy: { value: 0.1, direction: 'higher-is-better' } },
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(body).toMatchObject({ thresholds: { accuracy: { value: 0.1, direction: 'higher-is-better' } } });
    });

    it('keeps each threshold set in its own cache entry', async () => {
      server.use(
        http.post(COMPARE_URL, async ({ request }) => {
          const payload = (await request.json()) as { thresholds?: Record<string, { value: number }> };
          const value = payload.thresholds?.accuracy?.value ?? 0;
          return HttpResponse.json(makeComparison({ baselineId: `baseline-${value}` }));
        }),
      );
      const wrapper = createWrapper();

      const lenient = renderHook(
        () => useCompareExperiments('dataset-1', 'exp-a', 'exp-b', { thresholds: { accuracy: { value: 0.1 } } }),
        { wrapper },
      );
      await waitFor(() => expect(lenient.result.current.data?.baselineId).toBe('baseline-0.1'));

      const strict = renderHook(
        () => useCompareExperiments('dataset-1', 'exp-a', 'exp-b', { thresholds: { accuracy: { value: 0.5 } } }),
        { wrapper },
      );
      await waitFor(() => expect(strict.result.current.data?.baselineId).toBe('baseline-0.5'));

      expect(lenient.result.current.data?.baselineId).toBe('baseline-0.1');
    });
  });

  describe.each([
    ['the dataset id', '', 'exp-a', 'exp-b'],
    ['the first experiment id', 'dataset-1', '', 'exp-b'],
    ['the second experiment id', 'dataset-1', 'exp-a', ''],
  ])('when %s is still empty', (_label, datasetId, experimentIdA, experimentIdB) => {
    it('stays idle instead of comparing', async () => {
      const onCompare = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/datasets/:datasetId/compare`, () => {
          onCompare();
          return HttpResponse.json(makeComparison());
        }),
      );

      const { result } = renderHook(() => useCompareExperiments(datasetId, experimentIdA, experimentIdB), {
        wrapper: createWrapper(),
      });

      await settle();
      expect(onCompare).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

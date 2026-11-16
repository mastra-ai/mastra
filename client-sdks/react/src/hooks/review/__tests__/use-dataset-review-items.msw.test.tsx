// @vitest-environment jsdom
import type { DatasetExperimentResult, UpdateExperimentResultParams } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';

import { server } from '../../../test/msw-server';
import { useDatasetMutations } from '../../datasets';
import { useInfiniteCompletedItems, useInfiniteReviewItems, useReviewItems } from '../use-dataset-review-items';
import type { ReviewItemsOptions } from '../use-dataset-review-items';
import {
  DATASET_ID,
  EXPERIMENT_ID,
  RESULT_ID,
  experimentsResponse,
  experiment,
  manyResults,
  resultsResponse,
  updatedResultResponse,
} from './fixtures/dataset-review-items';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const servePagedResults = (
  resultsByExperiment: Record<string, DatasetExperimentResult[]>,
  { honorStatus = true }: { honorStatus?: boolean } = {},
) => {
  const requests: string[] = [];
  server.use(
    http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments/:experimentId/results`, ({ params, request }) => {
      const query = new URL(request.url).searchParams;
      requests.push(`${String(params.experimentId)}?${query.toString()}`);
      const status = honorStatus ? query.get('status') : null;
      const results = (resultsByExperiment[String(params.experimentId)] ?? []).filter(
        r => !status || r.status === status,
      );
      const page = Number(query.get('page') ?? 0);
      const perPage = Number(query.get('perPage') ?? 10);
      return HttpResponse.json({
        results: results.slice(page * perPage, (page + 1) * perPage),
        pagination: { total: results.length, page, perPage, hasMore: (page + 1) * perPage < results.length },
      });
    }),
  );
  return requests;
};

const OTHER_EXPERIMENT_ID = 'exp-2';
const projectExperimentsResponse = {
  ...experimentsResponse,
  experiments: [...experimentsResponse.experiments, { ...experimentsResponse.experiments[0], id: OTHER_EXPERIMENT_ID }],
};

describe('useReviewItems', () => {
  const resultRequests: string[] = [];

  const setupHandlers = () => {
    resultRequests.length = 0;
    server.use(
      http.get(`${BASE_URL}/api/experiments`, () => HttpResponse.json(projectExperimentsResponse)),
      http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments/:experimentId/results`, ({ params }) => {
        resultRequests.push(String(params.experimentId));
        return HttpResponse.json({
          ...resultsResponse,
          results: resultsResponse.results.map(result => ({ ...result, experimentId: String(params.experimentId) })),
        });
      }),
    );
  };

  describe('when experiments are supplied by the parent', () => {
    it('loads agent and scorer results without discovering other experiments', async () => {
      setupHandlers();
      const discover = vi.fn(() => HttpResponse.json(projectExperimentsResponse));
      server.use(http.get(`${BASE_URL}/api/experiments`, discover));
      const { result } = renderHook(
        () =>
          useReviewItems({
            experiments: [experiment, { ...experiment, id: 'scorer-exp', targetType: 'scorer' }],
            targetType: 'agent',
            targetId: 'agent-1',
          }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.data).toHaveLength(2));
      expect(resultRequests.sort()).toEqual([EXPERIMENT_ID, 'scorer-exp'].sort());
      expect(discover).not.toHaveBeenCalled();
    });

    it('resolves an explicit empty list without discovering experiments', async () => {
      setupHandlers();
      const discover = vi.fn(() => HttpResponse.json(projectExperimentsResponse));
      server.use(http.get(`${BASE_URL}/api/experiments`, discover));
      const { result } = renderHook(() => useReviewItems({ experiments: [] }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.data).toEqual([]));
      expect(result.current.isLoading).toBe(false);
      expect(resultRequests).toEqual([]);
      expect(discover).not.toHaveBeenCalled();
    });

    it('drops old results when the supplied scope changes', async () => {
      setupHandlers();
      const { result, rerender } = renderHook(({ experiments }) => useReviewItems({ experiments }), {
        wrapper: makeWrapper(),
        initialProps: { experiments: [experiment] },
      });
      await waitFor(() => expect(result.current.data).toHaveLength(1));
      rerender({ experiments: [{ ...experiment, id: OTHER_EXPERIMENT_ID }] });
      expect(result.current.data).toBeUndefined();
      await waitFor(() => expect(result.current.data?.[0].experimentId).toBe(OTHER_EXPERIMENT_ID));
      expect(resultRequests).toEqual([EXPERIMENT_ID, OTHER_EXPERIMENT_ID]);
    });

    it('ignores cached discovery when switching to an explicit empty source', async () => {
      setupHandlers();
      const discover = vi.fn(() => HttpResponse.json(projectExperimentsResponse));
      server.use(http.get(`${BASE_URL}/api/experiments`, discover));
      const { result, rerender } = renderHook((options: ReviewItemsOptions) => useReviewItems(options), {
        wrapper: makeWrapper(),
        initialProps: {},
      });
      await waitFor(() => expect(result.current.data).toHaveLength(2));
      rerender({ experiments: [] });
      await waitFor(() => expect(result.current.data).toEqual([]));
      expect(discover).toHaveBeenCalledTimes(1);
    });

    it('reloads results when the dataset changes but the experiment ID does not', async () => {
      setupHandlers();
      server.use(
        http.get(`${BASE_URL}/api/datasets/ds-2/experiments/${EXPERIMENT_ID}/results`, () =>
          HttpResponse.json(resultsResponse),
        ),
      );
      const { result, rerender } = renderHook(({ experiments }) => useReviewItems({ experiments }), {
        wrapper: makeWrapper(),
        initialProps: { experiments: [experiment] },
      });
      await waitFor(() => expect(result.current.data?.[0].datasetId).toBe(DATASET_ID));
      rerender({ experiments: [{ ...experiment, datasetId: 'ds-2' }] });
      expect(result.current.data).toBeUndefined();
      await waitFor(() => expect(result.current.data?.[0].datasetId).toBe('ds-2'));
    });

    it('still restricts the supplied list to the selected experiment', async () => {
      setupHandlers();
      const { result } = renderHook(
        () =>
          useReviewItems({
            experiments: projectExperimentsResponse.experiments,
            experimentId: OTHER_EXPERIMENT_ID,
          }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(resultRequests).toEqual([OTHER_EXPERIMENT_ID]);
    });
  });

  describe('when the experiment result has persisted tags', () => {
    it('hydrates the persisted tags from the experiment result', async () => {
      setupHandlers();

      const { result } = renderHook(() => useReviewItems({ experimentId: EXPERIMENT_ID }), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      const item = result.current.data![0];
      expect(item.id).toBe(RESULT_ID);
      expect(item.datasetId).toBe(DATASET_ID);
      expect(item.tags).toEqual(['hallucination']);
    });
  });

  describe('when the experiment result ran against an agent', () => {
    it('keeps the target type and run timing so the result renders like on the experiment page', async () => {
      setupHandlers();

      const { result } = renderHook(() => useReviewItems({ experimentId: EXPERIMENT_ID }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(result.current.data![0]).toMatchObject({
        targetType: 'agent',
        startedAt: '2026-07-21T00:00:10.000Z',
        completedAt: '2026-07-21T00:00:20.000Z',
      });
    });
  });

  describe('when scoped to one experiment', () => {
    it('only fetches the selected experiment when scoped', async () => {
      setupHandlers();

      const { result } = renderHook(() => useReviewItems({ experimentId: EXPERIMENT_ID }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(resultRequests).toEqual([EXPERIMENT_ID]);
    });
  });

  describe('when unscoped', () => {
    it('fetches every experiment in the project when unscoped', async () => {
      setupHandlers();

      const { result } = renderHook(() => useReviewItems(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(2));
      expect(resultRequests.sort()).toEqual([EXPERIMENT_ID, OTHER_EXPERIMENT_ID].sort());
    });
  });

  describe('when the review queue loads page by page', () => {
    const flaggedIndexes = Array.from({ length: 150 }, (_, index) => index);
    const otherExperiment = { ...experiment, id: OTHER_EXPERIMENT_ID };

    it('shows the first page of every experiment, then the next page when asked', async () => {
      const requests = servePagedResults({
        [EXPERIMENT_ID]: manyResults(300, flaggedIndexes),
        [OTHER_EXPERIMENT_ID]: manyResults(20, [0, 1, 2], OTHER_EXPERIMENT_ID),
      });

      const { result } = renderHook(() => useInfiniteReviewItems({ experiments: [experiment, otherExperiment] }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(103);
      expect(result.current.hasNextPage).toBe(true);
      expect(requests.sort()).toEqual([
        `${EXPERIMENT_ID}?page=0&perPage=100&status=needs-review`,
        `${OTHER_EXPERIMENT_ID}?page=0&perPage=100&status=needs-review`,
      ]);

      requests.length = 0;
      await act(() => result.current.fetchNextPage());

      await waitFor(() => expect(result.current.data).toHaveLength(153));
      expect(result.current.data?.at(-1)?.id).toBe('exp-1-result-149');
      expect(result.current.hasNextPage).toBe(false);
      expect(requests).toEqual([`${EXPERIMENT_ID}?page=1&perPage=100&status=needs-review`]);
    });

    it('finds flagged results past the first page when the server ignores the status filter', async () => {
      servePagedResults({ [EXPERIMENT_ID]: manyResults(150, [120]) }, { honorStatus: false });

      const { result } = renderHook(() => useInfiniteReviewItems({ experiments: [experiment] }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map(item => item.id)).toEqual(['exp-1-result-120']);
      expect(result.current.hasNextPage).toBe(false);
    });

    it('stops loading hidden review pages when the sentinel is detached', async () => {
      let observer: IntersectionObserverCallback | undefined;
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(callback: IntersectionObserverCallback) {
            observer = callback;
          }
          observe() {}
          disconnect() {}
        },
      );
      const requests: number[] = [];
      let finishNextPage: (() => void) | undefined;
      server.use(
        http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, async ({ request }) => {
          const query = new URL(request.url).searchParams;
          const page = Number(query.get('page'));
          const perPage = Number(query.get('perPage'));
          requests.push(page);
          if (page === 1) await new Promise<void>(resolve => (finishNextPage = resolve));
          const results = manyResults(
            1000,
            Array.from({ length: 1000 }, (_, index) => index),
          );
          return HttpResponse.json({
            results: results.slice(page * perPage, (page + 1) * perPage),
            pagination: { total: results.length, page, perPage, hasMore: (page + 1) * perPage < results.length },
          });
        }),
      );

      const { result } = renderHook(() => useInfiniteReviewItems({ experiments: [experiment] }), {
        wrapper: makeWrapper(),
      });
      await waitFor(() => expect(result.current.data).toHaveLength(100));
      const sentinel = document.createElement('div');
      act(() => result.current.setEndOfListElement(sentinel));
      const bounds = sentinel.getBoundingClientRect();
      act(() =>
        observer?.(
          [
            {
              isIntersecting: true,
              target: sentinel,
              boundingClientRect: bounds,
              intersectionRect: bounds,
              intersectionRatio: 1,
              rootBounds: null,
              time: 0,
            },
          ],
          {} as IntersectionObserver,
        ),
      );
      await waitFor(() => expect(requests).toEqual([0, 1]));

      act(() => result.current.setEndOfListElement(null));
      await act(async () => finishNextPage?.());
      await waitFor(() => expect(result.current.data).toHaveLength(200));
      expect(requests).toEqual([0, 1]);
    });

    it('keeps every pending result when a review is completed while the next page loads', async () => {
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(private readonly callback: IntersectionObserverCallback) {}
          observe(target: Element) {
            this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as never);
          }
          disconnect() {}
        },
      );
      let stored = manyResults(250, flaggedIndexes.concat(Array.from({ length: 100 }, (_, index) => 150 + index)));
      let nextPageStarted = false;
      server.use(
        http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, async ({ request }) => {
          const query = new URL(request.url).searchParams;
          const page = Number(query.get('page'));
          const perPage = Number(query.get('perPage'));
          if (page > 0) nextPageStarted = true;
          await delay(page > 0 || nextPageStarted ? 100 : 0);
          const list = stored.filter(r => r.status === query.get('status'));
          return HttpResponse.json({
            results: list.slice(page * perPage, (page + 1) * perPage),
            pagination: { total: list.length, page, perPage, hasMore: (page + 1) * perPage < list.length },
          });
        }),
        http.patch(
          `${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results/:resultId`,
          ({ params }) => {
            stored = stored.map(r => (r.id === params.resultId ? { ...r, status: 'complete' } : r));
            return HttpResponse.json(stored.find(r => r.id === params.resultId));
          },
        ),
      );

      const { result } = renderHook(
        () => ({
          queue: useInfiniteReviewItems({ experiments: [experiment] }),
          mutations: useDatasetMutations(),
        }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.queue.data).toHaveLength(100));
      act(() => result.current.queue.setEndOfListElement(document.createElement('div')));
      await waitFor(() => expect(nextPageStarted).toBe(true));

      await act(() =>
        result.current.mutations.updateExperimentResult.mutateAsync({
          datasetId: DATASET_ID,
          experimentId: EXPERIMENT_ID,
          resultId: 'exp-1-result-0',
          status: 'complete',
        }),
      );

      await waitFor(() => {
        expect(result.current.queue.hasNextPage).toBe(false);
        expect(result.current.queue.isFetching).toBe(false);
      });
      const ids = result.current.queue.data?.map(item => item.id) ?? [];
      expect(ids).not.toContain('exp-1-result-0');
      expect(ids).toContain('exp-1-result-100');
      expect(ids).toHaveLength(249);
    });

    it('loads completed results the same way', async () => {
      servePagedResults({ [EXPERIMENT_ID]: manyResults(150, [5]) });

      const { result } = renderHook(() => useInfiniteCompletedItems({ experiments: [experiment] }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(100);
      expect(result.current.data?.every(item => item.status === 'complete')).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('when scoped to a target', () => {
    it('asks the server for the target scope and only walks the experiments it returns', async () => {
      resultRequests.length = 0;
      const experimentQueries: URLSearchParams[] = [];
      server.use(
        http.get(`${BASE_URL}/api/experiments`, ({ request }) => {
          experimentQueries.push(new URL(request.url).searchParams);
          return HttpResponse.json(experimentsResponse);
        }),
        http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments/:experimentId/results`, ({ params }) => {
          resultRequests.push(String(params.experimentId));
          return HttpResponse.json(resultsResponse);
        }),
      );

      const { result } = renderHook(() => useReviewItems({ targetType: 'agent', targetId: 'agent-1' }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(experimentQueries[0].get('targetType')).toBe('agent');
      expect(experimentQueries[0].get('targetId')).toBe('agent-1');
      expect(resultRequests).toEqual([EXPERIMENT_ID]);
    });
  });
});

describe('useDatasetMutations().updateExperimentResult', () => {
  describe('when a comment is saved', () => {
    it('sends the comment in the PATCH body so it persists server-side', async () => {
      const onPatch = vi.fn<(body: unknown) => void>();
      server.use(
        http.patch(
          `${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results/${RESULT_ID}`,
          async ({ request }) => {
            const body = await request.json();
            onPatch(body);
            return HttpResponse.json(updatedResultResponse('a fresh note'));
          },
        ),
      );

      const { result } = renderHook(() => useDatasetMutations(), { wrapper: makeWrapper() });

      const params: UpdateExperimentResultParams = {
        datasetId: DATASET_ID,
        experimentId: EXPERIMENT_ID,
        resultId: RESULT_ID,
        comment: 'a fresh note',
      };
      const updated = await result.current.updateExperimentResult.mutateAsync(params);

      expect(onPatch).toHaveBeenCalledWith({ comment: 'a fresh note' });
      expect(updated.comment).toBe('a fresh note');
    });
  });
});

// @vitest-environment jsdom
import type { UpdateExperimentResultParams } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useReviewItems, type ReviewItemsOptions } from '../use-dataset-review-items';
import {
  DATASET_ID,
  EXPERIMENT_ID,
  RESULT_ID,
  experimentsResponse,
  experiment,
  resultsResponse,
  updatedResultResponse,
} from './fixtures/dataset-review-items';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

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

  it('only fetches the selected experiment when scoped', async () => {
    setupHandlers();

    const { result } = renderHook(() => useReviewItems({ experimentId: EXPERIMENT_ID }), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(resultRequests).toEqual([EXPERIMENT_ID]);
  });

  it('fetches every experiment in the project when unscoped', async () => {
    setupHandlers();

    const { result } = renderHook(() => useReviewItems(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(resultRequests.sort()).toEqual([EXPERIMENT_ID, OTHER_EXPERIMENT_ID].sort());
  });

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

describe('useDatasetMutations().updateExperimentResult', () => {
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

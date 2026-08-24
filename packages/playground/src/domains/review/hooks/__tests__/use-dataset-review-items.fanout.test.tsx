// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useDatasetCompletedItems, useDatasetReviewItems } from '../use-dataset-review-items';
import {
  DATASET_ID,
  EXPERIMENT_ID,
  SECOND_EXPERIMENT_ID,
  experimentsResponse,
  makeResult,
  orphanExperimentResponse,
  resultsPage,
  twoExperimentsResponse,
} from './fixtures/dataset-review-items';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const EXPERIMENTS_URL = `${BASE_URL}/api/datasets/${DATASET_ID}/experiments`;
const resultsUrl = (experimentId: string) => `${EXPERIMENTS_URL}/${experimentId}/results`;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  wrapper.queryClient = queryClient;
  return wrapper;
};

/** Lets react-query settle so "no request was made" is a real observation. */
const settle = () => act(async () => new Promise(resolve => setTimeout(resolve, 60)));

afterEach(() => cleanup());

describe('useDatasetReviewItems', () => {
  describe('the results it keeps', () => {
    it('keeps only the rows still awaiting review', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () =>
          HttpResponse.json(
            resultsPage([
              makeResult({ id: 'needs-1', status: 'needs-review' }),
              makeResult({ id: 'done-1', status: 'complete' }),
              makeResult({ id: 'failed-1', status: 'failed' }),
            ]),
          ),
        ),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map(item => item.id)).toEqual(['needs-1']);
    });

    it('gathers rows from every experiment on the dataset', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(twoExperimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () => HttpResponse.json(resultsPage([makeResult({ id: 'from-exp-1' })]))),
        http.get(resultsUrl(SECOND_EXPERIMENT_ID), () =>
          HttpResponse.json(resultsPage([makeResult({ id: 'from-exp-2' })])),
        ),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(2));
      expect(result.current.data?.map(item => item.id).sort()).toEqual(['from-exp-1', 'from-exp-2']);
    });

    it('skips an experiment that lost its dataset link', async () => {
      let requested = false;
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(orphanExperimentResponse)),
        http.get(`${BASE_URL}/api/datasets/:datasetId/experiments/:experimentId/results`, () => {
          requested = true;
          return HttpResponse.json(resultsPage([makeResult()]));
        }),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
      expect(requested).toBe(false);
    });

    it('drops one failing experiment without losing the others', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(twoExperimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () => new HttpResponse(null, { status: 500 })),
        http.get(resultsUrl(SECOND_EXPERIMENT_ID), () =>
          HttpResponse.json(resultsPage([makeResult({ id: 'from-exp-2' })])),
        ),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map(item => item.id)).toEqual(['from-exp-2']);
    });
  });

  describe('the shape it hands the review card', () => {
    it('carries the identifiers the card needs to save an edit back', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () =>
          HttpResponse.json(
            resultsPage([
              makeResult({ id: 'r-1', itemId: 'item-9', input: { q: 'hi' }, output: { a: 'yo' }, error: 'boom' }),
            ]),
          ),
        ),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(result.current.data![0]).toMatchObject({
        id: 'r-1',
        itemId: 'item-9',
        experimentId: EXPERIMENT_ID,
        datasetId: DATASET_ID,
        input: { q: 'hi' },
        output: { a: 'yo' },
        error: 'boom',
      });
    });

    it('turns the score list into a lookup keyed by scorer', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () =>
          HttpResponse.json(
            resultsPage([
              makeResult({
                scores: [
                  { scorerId: 'faithfulness', score: 0.8 },
                  { scorerId: 'relevance', score: 0.5 },
                ],
              } as never),
            ]),
          ),
        ),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(result.current.data![0].scores).toEqual({ faithfulness: 0.8, relevance: 0.5 });
    });

    it('reads a missing score as zero rather than dropping the scorer', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () =>
          HttpResponse.json(resultsPage([makeResult({ scores: [{ scorerId: 'faithfulness' }] } as never)])),
        ),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(result.current.data![0].scores).toEqual({ faithfulness: 0 });
    });

    it('falls back to empty tags, comment, scores and trace when the row has none', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () =>
          HttpResponse.json(
            resultsPage([makeResult({ tags: null, comment: null, scores: null, traceId: null } as never)]),
          ),
        ),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(result.current.data![0]).toMatchObject({ tags: [], comment: '', scores: {}, traceId: undefined });
    });

    it('carries a trace id through when the row has one', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
        http.get(resultsUrl(EXPERIMENT_ID), () => HttpResponse.json(resultsPage([makeResult({ traceId: 'trace-7' })]))),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(result.current.data![0].traceId).toBe('trace-7');
    });
  });

  describe('when there is nothing to read', () => {
    it('stays idle when the dataset has no experiments', async () => {
      let requested = false;
      server.use(
        http.get(EXPERIMENTS_URL, () => HttpResponse.json({ experiments: [], pagination: { total: 0 } })),
        http.get(`${BASE_URL}/api/datasets/:datasetId/experiments/:experimentId/results`, () => {
          requested = true;
          return HttpResponse.json(resultsPage([]));
        }),
      );

      const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: createWrapper() });

      await settle();
      expect(requested).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('stays idle without a dataset id', async () => {
      let requested = false;
      server.use(
        http.get(`${BASE_URL}/api/datasets/:datasetId/experiments`, () => {
          requested = true;
          return HttpResponse.json(experimentsResponse);
        }),
      );

      const { result } = renderHook(() => useDatasetReviewItems(''), { wrapper: createWrapper() });

      await settle();
      expect(requested).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('re-reads when the set of experiments changes', async () => {
    server.use(
      http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
      http.get(resultsUrl(EXPERIMENT_ID), () => HttpResponse.json(resultsPage([makeResult()]))),
    );
    const wrapper = createWrapper();

    const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The experiment ids are part of the cache key, so a new experiment is a
    // new entry rather than a stale read of the old one.
    expect(wrapper.queryClient.getQueryData(['dataset-review-items', DATASET_ID, [EXPERIMENT_ID]])).toHaveLength(1);
    expect(
      wrapper.queryClient.getQueryData(['dataset-review-items', DATASET_ID, [EXPERIMENT_ID, SECOND_EXPERIMENT_ID]]),
    ).toBeUndefined();
  });
});

describe('useDatasetCompletedItems', () => {
  it('keeps only the rows whose review is finished', async () => {
    server.use(
      http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
      http.get(resultsUrl(EXPERIMENT_ID), () =>
        HttpResponse.json(
          resultsPage([
            makeResult({ id: 'needs-1', status: 'needs-review' }),
            makeResult({ id: 'done-1', status: 'complete' }),
          ]),
        ),
      ),
    );

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(item => item.id)).toEqual(['done-1']);
  });

  it('keeps its results in a cache entry of its own', async () => {
    server.use(
      http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
      http.get(resultsUrl(EXPERIMENT_ID), () =>
        HttpResponse.json(resultsPage([makeResult({ id: 'done-1', status: 'complete' })])),
      ),
    );
    const wrapper = createWrapper();

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(wrapper.queryClient.getQueryData(['dataset-completed-items', DATASET_ID, [EXPERIMENT_ID]])).toHaveLength(1);
    expect(wrapper.queryClient.getQueryData(['dataset-review-items', DATASET_ID, [EXPERIMENT_ID]])).toBeUndefined();
  });

  it('gathers rows from every experiment on the dataset', async () => {
    server.use(
      http.get(EXPERIMENTS_URL, () => HttpResponse.json(twoExperimentsResponse)),
      http.get(resultsUrl(EXPERIMENT_ID), () =>
        HttpResponse.json(resultsPage([makeResult({ id: 'done-1', status: 'complete' })])),
      ),
      http.get(resultsUrl(SECOND_EXPERIMENT_ID), () =>
        HttpResponse.json(resultsPage([makeResult({ id: 'done-2', status: 'complete' })])),
      ),
    );

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });

  it('drops one failing experiment without losing the others', async () => {
    server.use(
      http.get(EXPERIMENTS_URL, () => HttpResponse.json(twoExperimentsResponse)),
      http.get(resultsUrl(EXPERIMENT_ID), () => new HttpResponse(null, { status: 500 })),
      http.get(resultsUrl(SECOND_EXPERIMENT_ID), () =>
        HttpResponse.json(resultsPage([makeResult({ id: 'done-2', status: 'complete' })])),
      ),
    );

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(item => item.id)).toEqual(['done-2']);
  });

  it('skips an experiment that lost its dataset link', async () => {
    server.use(http.get(EXPERIMENTS_URL, () => HttpResponse.json(orphanExperimentResponse)));

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('carries tags, comment and scores through', async () => {
    server.use(
      http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
      http.get(resultsUrl(EXPERIMENT_ID), () =>
        HttpResponse.json(
          resultsPage([
            makeResult({
              status: 'complete',
              tags: ['verified'],
              comment: 'Looks right',
              traceId: 'trace-3',
              scores: [{ scorerId: 'faithfulness', score: 1 }],
            } as never),
          ]),
        ),
      ),
    );

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0]).toMatchObject({
      tags: ['verified'],
      comment: 'Looks right',
      traceId: 'trace-3',
      scores: { faithfulness: 1 },
    });
  });

  it('falls back to empty tags, comment and scores when the row has none', async () => {
    server.use(
      http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsResponse)),
      http.get(resultsUrl(EXPERIMENT_ID), () =>
        HttpResponse.json(
          resultsPage([
            makeResult({ status: 'complete', tags: null, comment: null, scores: null, traceId: null } as never),
          ]),
        ),
      ),
    );

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0]).toMatchObject({ tags: [], comment: '', scores: {}, traceId: undefined });
  });

  it('stays idle when the dataset has no experiments', async () => {
    server.use(http.get(EXPERIMENTS_URL, () => HttpResponse.json({ experiments: [], pagination: { total: 0 } })));

    const { result } = renderHook(() => useDatasetCompletedItems(DATASET_ID), { wrapper: createWrapper() });

    await settle();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

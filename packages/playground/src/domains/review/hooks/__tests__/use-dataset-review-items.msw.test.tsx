// @vitest-environment jsdom
import type { UpdateExperimentResultParams } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDatasetReviewItems } from '../use-dataset-review-items';
import {
  DATASET_ID,
  EXPERIMENT_ID,
  RESULT_ID,
  experimentsResponse,
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

describe('useDatasetReviewItems', () => {
  it('hydrates the persisted comment (and tags) from the experiment result', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments`, () => HttpResponse.json(experimentsResponse)),
      http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () =>
        HttpResponse.json(resultsResponse),
      ),
    );

    const { result } = renderHook(() => useDatasetReviewItems(DATASET_ID), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    const item = result.current.data![0];
    expect(item.id).toBe(RESULT_ID);
    expect(item.tags).toEqual(['hallucination']);
    // Regression guard for #19857: the comment used to be hardcoded to ''
    // on rehydrate, wiping saved comments on every reload.
    expect(item.comment).toBe('The agent ignored the second question');
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

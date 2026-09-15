import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { useDatasetMutations } from '../use-dataset-mutations';
import { successfulDeleteExperimentResponse } from './fixtures/dataset-mutations';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createTestHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return { queryClient, wrapper };
};

describe('useDatasetMutations delete experiment', () => {
  describe('when an experiment deletion succeeds', () => {
    it('invalidates every cache that can reference the deleted experiment', async () => {
      server.use(
        http.delete(`${BASE_URL}/api/experiments/experiment-1`, () =>
          HttpResponse.json(successfulDeleteExperimentResponse),
        ),
      );
      const { queryClient, wrapper } = createTestHarness();
      const affectedQueryKeys = [
        ['experiments'],
        ['dataset-experiments'],
        ['dataset-experiment'],
        ['dataset-experiment-results'],
        ['review-items'],
        ['completed-items'],
        ['experiment-review-summary'],
        ['inbox-dataset-review-items'],
        ['inbox-dataset-review-count'],
      ] as const;
      for (const queryKey of affectedQueryKeys) {
        queryClient.setQueryData(queryKey, { cached: true });
      }

      const { result } = renderHook(() => useDatasetMutations(), { wrapper });
      await result.current.deleteExperiment.mutateAsync('experiment-1');

      await waitFor(() => {
        for (const queryKey of affectedQueryKeys) {
          expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
        }
      });
    });
  });
});

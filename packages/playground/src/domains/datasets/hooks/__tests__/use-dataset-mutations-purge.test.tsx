import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDatasetMutations } from '../use-dataset-mutations';
import { successfulPurgeDatasetItemResponse } from './fixtures/dataset-mutations';
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

describe('useDatasetMutations purge item', () => {
  describe('when an item purge succeeds', () => {
    it('sends the destructive request through the client SDK', async () => {
      const capture = vi.fn<() => void>();
      server.use(
        http.delete(`${BASE_URL}/api/datasets/dataset-1/items/item-1/purge`, () => {
          capture();
          return HttpResponse.json(successfulPurgeDatasetItemResponse);
        }),
      );
      const { wrapper } = createTestHarness();

      const { result } = renderHook(() => useDatasetMutations(), { wrapper });
      await result.current.purgeItem.mutateAsync({ datasetId: 'dataset-1', itemId: 'item-1' });

      await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    });

    it('invalidates dataset, experiment result, and review caches', async () => {
      server.use(
        http.delete(`${BASE_URL}/api/datasets/dataset-1/items/item-1/purge`, () =>
          HttpResponse.json(successfulPurgeDatasetItemResponse),
        ),
      );
      const { queryClient, wrapper } = createTestHarness();
      const affectedQueryKeys = [
        ['dataset-items', 'dataset-1'],
        ['dataset-item', 'dataset-1', 'item-1'],
        ['dataset-item-versions', 'dataset-1', 'item-1'],
        ['dataset-experiment-results'],
        ['experiment-results'],
        ['review-items'],
        ['dataset-review-items'],
        ['dataset-completed-items'],
        ['experiment-review-summary'],
      ] as const;
      for (const queryKey of affectedQueryKeys) {
        queryClient.setQueryData(queryKey, { cached: true });
      }

      const { result } = renderHook(() => useDatasetMutations(), { wrapper });
      await result.current.purgeItem.mutateAsync({ datasetId: 'dataset-1', itemId: 'item-1' });

      await waitFor(() => {
        for (const queryKey of affectedQueryKeys) {
          expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
        }
      });
    });
  });
});

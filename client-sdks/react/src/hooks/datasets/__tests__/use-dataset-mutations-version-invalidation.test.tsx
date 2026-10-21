// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';

import { server } from '../../../test/msw-server';
import { useDatasetMutations } from '../use-dataset-mutations';
import { datasetItemWithRequestContext } from './fixtures/dataset-request-context';

const BASE_URL = 'http://localhost:4111';

function createHarness() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  function wrapper({ children }: PropsWithChildren) {
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MastraReactProvider>
    );
  }

  const invalidatedKeys = () => invalidate.mock.calls.map(([args]) => JSON.stringify(args?.queryKey));

  return { wrapper, invalidatedKeys };
}

describe('useDatasetMutations dataset version invalidation', () => {
  describe('when an item is added', () => {
    it('invalidates dataset versions', async () => {
      server.use(
        http.post(`${BASE_URL}/api/datasets/dataset-1/items`, () => HttpResponse.json(datasetItemWithRequestContext)),
      );

      const { wrapper, invalidatedKeys } = createHarness();
      const { result } = renderHook(() => useDatasetMutations(), { wrapper });

      await result.current.addItem.mutateAsync({ datasetId: 'dataset-1', input: { question: 'hi' } });

      await waitFor(() => expect(invalidatedKeys()).toContain(JSON.stringify(['dataset-versions', 'dataset-1'])));
    });
  });

  describe('when an item is deleted', () => {
    it('invalidates dataset versions', async () => {
      server.use(
        http.delete(`${BASE_URL}/api/datasets/dataset-1/items/item-1`, () => HttpResponse.json({ success: true })),
      );

      const { wrapper, invalidatedKeys } = createHarness();
      const { result } = renderHook(() => useDatasetMutations(), { wrapper });

      await result.current.deleteItem.mutateAsync({ datasetId: 'dataset-1', itemId: 'item-1' });

      await waitFor(() => expect(invalidatedKeys()).toContain(JSON.stringify(['dataset-versions', 'dataset-1'])));
    });
  });
});

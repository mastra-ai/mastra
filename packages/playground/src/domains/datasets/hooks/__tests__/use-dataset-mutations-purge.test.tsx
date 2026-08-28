import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDatasetMutations } from '../use-dataset-mutations';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

describe('useDatasetMutations purge item', () => {
  describe('when an item purge succeeds', () => {
    it('sends the destructive request through the client SDK', async () => {
      const capture = vi.fn<() => void>();
      server.use(
        http.delete(`${BASE_URL}/api/datasets/dataset-1/items/item-1/purge`, () => {
          capture();
          return HttpResponse.json({ success: true });
        }),
      );

      const { result } = renderHook(() => useDatasetMutations(), { wrapper });
      await result.current.purgeItem.mutateAsync({ datasetId: 'dataset-1', itemId: 'item-1' });

      await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    });
  });
});

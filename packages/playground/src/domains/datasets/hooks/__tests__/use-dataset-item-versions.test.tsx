// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { useDatasetItemVersions } from '../use-dataset-item-versions';
import { datasetItemHistoryResponse } from './fixtures/dataset-item-history';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

describe('useDatasetItemVersions', () => {
  describe('when item history contains a timeout override', () => {
    it('returns the timeout for the item edit form', async () => {
      server.use(
        http.get(`${BASE_URL}/api/datasets/dataset-1/items/item-1/history`, () =>
          HttpResponse.json(datasetItemHistoryResponse),
        ),
      );

      const { result } = renderHook(() => useDatasetItemVersions('dataset-1', 'item-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]).toMatchObject({ id: 'item-1', timeout: 30_000, isLatest: true });
    });
  });
});

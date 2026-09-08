import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { buildListExperimentsResponse, experiments } from '../../components/__tests__/fixtures/experiments';
import { EXPERIMENTS_PAGE_SIZE, useExperimentsForDatasetFilter } from '../use-experiments-for-dataset-filter';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

function trackRequests() {
  const urls: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(buildListExperimentsResponse(experiments));
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(buildListExperimentsResponse([experiments[0]]));
    }),
  );
  return urls;
}

describe('useExperimentsForDatasetFilter', () => {
  it('lists every experiment with a full page when no dataset is given', async () => {
    const urls = trackRequests();
    const { result } = renderHook(() => useExperimentsForDatasetFilter(undefined), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.experiments).toHaveLength(experiments.length);
    expect(urls).toEqual([`${TEST_BASE_URL}/api/experiments?perPage=${EXPERIMENTS_PAGE_SIZE}`]);
  });

  it('lists the dataset experiments with a full page when a dataset is given', async () => {
    const urls = trackRequests();
    const { result } = renderHook(() => useExperimentsForDatasetFilter('dataset-1'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.experiments).toHaveLength(1);
    expect(urls).toEqual([`${TEST_BASE_URL}/api/datasets/dataset-1/experiments?perPage=${EXPERIMENTS_PAGE_SIZE}`]);
  });
});

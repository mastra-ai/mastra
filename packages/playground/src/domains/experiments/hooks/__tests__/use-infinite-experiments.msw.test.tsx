import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { buildListExperimentsResponse, experiments } from '../../components/__tests__/fixtures/experiments';
import { EXPERIMENTS_LIST_PAGE_SIZE, useInfiniteExperiments } from '../use-infinite-experiments';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '@/test/render';

/** One experiment per page; the first page reports more. */
function pagedResponse(page: number) {
  const experiment = experiments[page];
  const response = buildListExperimentsResponse(experiment ? [experiment] : []);
  return { ...response, pagination: { ...response.pagination, page, hasMore: page === 0 } };
}

describe('useInfiniteExperiments', () => {
  it('loads the global list page by page while the server reports more', async () => {
    const onRequest = vi.fn<(url: URL) => void>();
    server.use(
      http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
        const url = new URL(request.url);
        onRequest(url);
        return HttpResponse.json(pagedResponse(Number(url.searchParams.get('page'))));
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useInfiniteExperiments(undefined), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onRequest.mock.calls[0][0].searchParams.get('page')).toBe('0');
    expect(onRequest.mock.calls[0][0].searchParams.get('perPage')).toBe(String(EXPERIMENTS_LIST_PAGE_SIZE));
    expect(result.current.data?.map(exp => exp.id)).toEqual([experiments[0].id]);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() =>
      expect(result.current.data?.map(exp => exp.id)).toEqual([experiments[0].id, experiments[1].id]),
    );
    expect(onRequest.mock.calls[1][0].searchParams.get('page')).toBe('1');
    expect(result.current.hasNextPage).toBe(false);
  });

  it('reads the dataset-scoped list when a dataset is given', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(buildListExperimentsResponse([experiments[0]]));
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useInfiniteExperiments('dataset-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(false);
    expect(urls).toEqual([
      `${TEST_BASE_URL}/api/datasets/dataset-1/experiments?page=0&perPage=${EXPERIMENTS_LIST_PAGE_SIZE}`,
    ]);
  });
});

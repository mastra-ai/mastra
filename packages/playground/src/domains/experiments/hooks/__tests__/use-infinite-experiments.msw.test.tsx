import type { DatasetExperiment } from '@mastra/client-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { buildListExperimentsResponse, experiments } from '../../components/__tests__/fixtures/experiments';
import { EXPERIMENTS_PER_PAGE, useInfiniteExperiments } from '../use-infinite-experiments';
import { useMockIntersectionObserver } from '@/test/intersection-observer';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '@/test/render';

type PagedResponse = ReturnType<typeof buildListExperimentsResponse>;

/** Serves `pages[n]` for `?page=n` on both list endpoints and records every request URL. */
function servePages(pages: DatasetExperiment[][]) {
  const urls: string[] = [];
  const respond = (request: Request): PagedResponse => {
    urls.push(request.url);
    const page = Number(new URL(request.url).searchParams.get('page'));
    return {
      experiments: pages[page] ?? [],
      pagination: {
        total: pages.flat().length,
        page,
        perPage: EXPERIMENTS_PER_PAGE,
        hasMore: page < pages.length - 1,
      },
    };
  };
  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => HttpResponse.json(respond(request))),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, ({ request }) =>
      HttpResponse.json(respond(request)),
    ),
  );
  return urls;
}

const ids = (list: DatasetExperiment[] | undefined) => list?.map(exp => exp.id);

describe('useInfiniteExperiments', () => {
  const { intersect } = useMockIntersectionObserver();

  describe('Given the API returns a single page', () => {
    it('when no dataset is given, then it requests the first page of the global list and flattens it', async () => {
      const urls = servePages([experiments]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useInfiniteExperiments(undefined), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(ids(result.current.data)).toEqual(ids(experiments));
      expect(result.current.hasNextPage).toBe(false);
      expect(urls).toEqual([`${TEST_BASE_URL}/api/experiments?page=0&perPage=${EXPERIMENTS_PER_PAGE}`]);
    });

    it('when a dataset is given, then it requests the first page of the dataset list', async () => {
      const urls = servePages([[experiments[0]]]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useInfiniteExperiments('dataset-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(ids(result.current.data)).toEqual([experiments[0].id]);
      expect(urls).toEqual([
        `${TEST_BASE_URL}/api/datasets/dataset-1/experiments?page=0&perPage=${EXPERIMENTS_PER_PAGE}`,
      ]);
    });

    it('when a target scope is given, then it is forwarded to the global list', async () => {
      const urls = servePages([experiments]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useInfiniteExperiments(undefined, { targetType: 'agent', targetId: 'agent-1' }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(urls).toEqual([
        `${TEST_BASE_URL}/api/experiments?page=0&perPage=${EXPERIMENTS_PER_PAGE}&targetType=agent&targetId=agent-1`,
      ]);
    });

    it('when a target scope has empty values, then they are omitted from the dataset list request', async () => {
      const urls = servePages([[experiments[0]]]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useInfiniteExperiments('dataset-1', { targetType: 'workflow', targetId: '' }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(urls).toEqual([
        `${TEST_BASE_URL}/api/datasets/dataset-1/experiments?page=0&perPage=${EXPERIMENTS_PER_PAGE}&targetType=workflow`,
      ]);
    });
  });

  describe('Given the API reports more pages', () => {
    const [first, second, third] = experiments;

    it('when the next page is fetched, then it is appended and the server is asked for page 1', async () => {
      const urls = servePages([[first, second], [third]]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useInfiniteExperiments(undefined), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(ids(result.current.data)).toEqual([first.id, second.id]);
      expect(result.current.hasNextPage).toBe(true);

      await act(() => result.current.fetchNextPage());

      await waitFor(() => expect(ids(result.current.data)).toEqual([first.id, second.id, third.id]));
      expect(result.current.hasNextPage).toBe(false);
      expect(urls.map(url => new URL(url).searchParams.get('page'))).toEqual(['0', '1']);
    });

    it('when the end-of-list sentinel comes into view, then the next page is fetched automatically', async () => {
      const urls = servePages([[first], [second]]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useInfiniteExperiments(undefined), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await waitFor(() => expect(ids(result.current.data)).toEqual([first.id, second.id]));
      expect(urls).toHaveLength(2);
    });
  });

  describe('Given the first page is empty', () => {
    it('when the hook resolves, then there is no next page and no extra request', async () => {
      const urls = servePages([[]]);
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useInfiniteExperiments(undefined), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
      expect(result.current.hasNextPage).toBe(false);
      expect(urls).toHaveLength(1);
    });
  });
});

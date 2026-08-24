import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDatasetVersions } from '../use-dataset-versions';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const VERSIONS_URL = `${BASE_URL}/api/datasets/dataset-1/versions`;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

const versionRow = (version: number) => ({
  id: `version-${version}`,
  datasetId: 'dataset-1',
  version,
  createdAt: '2026-01-01T00:00:00.000Z',
});

/** Ten rows per page, newest first — the shape the versions endpoint returns. */
const pageOf = (versions: number[], hasMore: boolean, page: number) => ({
  versions: versions.map(versionRow),
  pagination: { total: 20, page, perPage: 10, hasMore },
});

describe('useDatasetVersions', () => {
  describe('when the dataset has a single page of versions', () => {
    it('flags only the newest version as current', async () => {
      server.use(http.get(VERSIONS_URL, () => HttpResponse.json(pageOf([3, 2, 1], false, 0))));

      const { result } = renderHook(() => useDatasetVersions('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map(v => [v.version, v.isCurrent])).toEqual([
        [3, true],
        [2, false],
        [1, false],
      ]);
    });

    it('carries the row identity through to the caller', async () => {
      server.use(http.get(VERSIONS_URL, () => HttpResponse.json(pageOf([3], false, 0))));

      const { result } = renderHook(() => useDatasetVersions('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]).toEqual({
        id: 'version-3',
        datasetId: 'dataset-1',
        version: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
        isCurrent: true,
      });
    });

    it('asks for the first page, ten rows at a time', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(VERSIONS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(pageOf([1], false, 0));
        }),
      );

      const { result } = renderHook(() => useDatasetVersions('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(receivedUrl?.searchParams.get('page')).toBe('0');
      expect(receivedUrl?.searchParams.get('perPage')).toBe('10');
    });

    it('reports there is nothing more to load', async () => {
      server.use(http.get(VERSIONS_URL, () => HttpResponse.json(pageOf([1], false, 0))));

      const { result } = renderHook(() => useDatasetVersions('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('when the dataset has more versions than one page', () => {
    it('appends the next page and keeps the current flag on the newest row', async () => {
      const seenPages: string[] = [];
      server.use(
        http.get(VERSIONS_URL, ({ request }) => {
          const page = new URL(request.url).searchParams.get('page') ?? '0';
          seenPages.push(page);
          return page === '0'
            ? HttpResponse.json(pageOf([4, 3], true, 0))
            : HttpResponse.json(pageOf([2, 1], false, 1));
        }),
      );

      const { result } = renderHook(() => useDatasetVersions('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.hasNextPage).toBe(true));

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => expect(result.current.data).toHaveLength(4));
      expect(seenPages).toEqual(['0', '1']);
      expect(result.current.data?.map(v => v.version)).toEqual([4, 3, 2, 1]);
      expect(result.current.data?.filter(v => v.isCurrent).map(v => v.version)).toEqual([4]);
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('when a page comes back without a versions array', () => {
    it('treats it as empty instead of throwing', async () => {
      server.use(http.get(VERSIONS_URL, () => HttpResponse.json({ pagination: { hasMore: false } })));

      const { result } = renderHook(() => useDatasetVersions('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });
  });

  describe('when a page comes back without pagination info', () => {
    it('stops paging rather than looping forever', async () => {
      server.use(http.get(VERSIONS_URL, () => HttpResponse.json({ versions: [versionRow(1)] })));

      const { result } = renderHook(() => useDatasetVersions('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('when no dataset is selected', () => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/datasets/:datasetId/versions`, () => {
          onFetch();
          return HttpResponse.json(pageOf([1], false, 0));
        }),
      );

      const { result } = renderHook(() => useDatasetVersions(''), { wrapper: createWrapper() });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when two datasets are read through the same cache', () => {
    it('keeps each dataset history in its own cache entry', async () => {
      server.use(
        http.get(`${BASE_URL}/api/datasets/:datasetId/versions`, ({ params }) =>
          HttpResponse.json({
            versions: [{ ...versionRow(1), id: `version-${params.datasetId}` }],
            pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
          }),
        ),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useDatasetVersions('dataset-a'), { wrapper });
      await waitFor(() => expect(first.result.current.data?.[0]?.id).toBe('version-dataset-a'));

      const second = renderHook(() => useDatasetVersions('dataset-b'), { wrapper });
      await waitFor(() => expect(second.result.current.data?.[0]?.id).toBe('version-dataset-b'));

      expect(first.result.current.data?.[0]?.id).toBe('version-dataset-a');
    });
  });
});

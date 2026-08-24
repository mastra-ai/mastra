import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDataset, useDatasets } from '../use-datasets';
import { makeDataset, makeDatasetsPage } from './fixtures/datasets';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const DATASETS_URL = `${BASE_URL}/api/datasets`;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

/** Let react-query settle so "no request was made" is a real observation. */
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

describe('useDatasets', () => {
  describe('when the server returns a page of datasets', () => {
    it('exposes the datasets and the pagination envelope', async () => {
      server.use(
        http.get(DATASETS_URL, () =>
          HttpResponse.json(
            makeDatasetsPage([makeDataset({ id: 'dataset-7', name: 'Golden set' })], {
              total: 12,
              page: 2,
              perPage: 5,
              hasMore: true,
            }),
          ),
        ),
      );

      const { result } = renderHook(() => useDatasets({ page: 2, perPage: 5 }), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.datasets.map(d => d.name)).toEqual(['Golden set']);
      expect(result.current.data?.pagination).toEqual({ total: 12, page: 2, perPage: 5, hasMore: true });
    });
  });

  describe('when pagination is supplied', () => {
    it('forwards page and perPage to the server', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(DATASETS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(makeDatasetsPage([]));
        }),
      );

      const { result } = renderHook(() => useDatasets({ page: 3, perPage: 25 }), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(receivedUrl?.searchParams.get('page')).toBe('3');
      expect(receivedUrl?.searchParams.get('perPage')).toBe('25');
    });
  });

  describe('when the caller pages forward', () => {
    it('keeps showing the previous page while the next one loads', async () => {
      server.use(
        http.get(DATASETS_URL, async ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          if (page === '2') await delay(60);
          return HttpResponse.json(makeDatasetsPage([makeDataset({ id: `dataset-page-${page}` })]));
        }),
      );
      const wrapper = createWrapper();

      const { result, rerender } = renderHook(({ page }: { page: number }) => useDatasets({ page }), {
        wrapper,
        initialProps: { page: 1 },
      });
      await waitFor(() => expect(result.current.data?.datasets[0]?.id).toBe('dataset-page-1'));

      rerender({ page: 2 });

      // The list must not blank out between pages.
      expect(result.current.data?.datasets[0]?.id).toBe('dataset-page-1');
      await waitFor(() => expect(result.current.data?.datasets[0]?.id).toBe('dataset-page-2'));
    });

    it('keeps each page in its own cache entry', async () => {
      server.use(
        http.get(DATASETS_URL, ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          return HttpResponse.json(makeDatasetsPage([makeDataset({ id: `dataset-page-${page}` })]));
        }),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useDatasets({ page: 1 }), { wrapper });
      await waitFor(() => expect(first.result.current.data?.datasets[0]?.id).toBe('dataset-page-1'));

      const second = renderHook(() => useDatasets({ page: 2 }), { wrapper });
      await waitFor(() => expect(second.result.current.data?.datasets[0]?.id).toBe('dataset-page-2'));

      expect(first.result.current.data?.datasets[0]?.id).toBe('dataset-page-1');
    });
  });
});

describe('useDataset', () => {
  describe('when the dataset exists', () => {
    it('exposes the dataset record', async () => {
      server.use(
        http.get(`${DATASETS_URL}/dataset-1`, () =>
          HttpResponse.json(makeDataset({ name: 'Support questions', version: 4 })),
        ),
      );

      const { result } = renderHook(() => useDataset('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.name).toBe('Support questions');
      expect(result.current.data?.version).toBe(4);
    });
  });

  describe('when no dataset is selected', () => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${DATASETS_URL}/:datasetId`, () => {
          onFetch();
          return HttpResponse.json(makeDataset());
        }),
      );

      const { result } = renderHook(() => useDataset(''), { wrapper: createWrapper() });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when two datasets are read through the same cache', () => {
    it('keeps each dataset in its own cache entry', async () => {
      server.use(
        http.get(`${DATASETS_URL}/:datasetId`, ({ params }) =>
          HttpResponse.json(makeDataset({ id: String(params.datasetId), name: `Name ${params.datasetId}` })),
        ),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useDataset('dataset-a'), { wrapper });
      await waitFor(() => expect(first.result.current.data?.name).toBe('Name dataset-a'));

      const second = renderHook(() => useDataset('dataset-b'), { wrapper });
      await waitFor(() => expect(second.result.current.data?.name).toBe('Name dataset-b'));

      expect(first.result.current.data?.name).toBe('Name dataset-a');
    });
  });

  describe('when the dataset list and a single dataset are read together', () => {
    it('does not let one overwrite the other', async () => {
      server.use(
        http.get(DATASETS_URL, () => HttpResponse.json(makeDatasetsPage([makeDataset({ id: 'from-list' })]))),
        http.get(`${DATASETS_URL}/dataset-1`, () => HttpResponse.json(makeDataset({ id: 'from-detail' }))),
      );
      const wrapper = createWrapper();

      const list = renderHook(() => useDatasets(), { wrapper });
      const detail = renderHook(() => useDataset('dataset-1'), { wrapper });

      await waitFor(() => expect(list.result.current.data?.datasets[0]?.id).toBe('from-list'));
      await waitFor(() => expect(detail.result.current.data?.id).toBe('from-detail'));
      expect(list.result.current.data?.datasets[0]?.id).toBe('from-list');
    });
  });
});

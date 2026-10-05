// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { server } from '../../test/msw-server';
import { makeWrapper, waitForMutationsIdle } from '../../test/render';
import { useDatasetMutations } from '../datasets/use-dataset-mutations';
import { useDataset, useDatasets, useInfiniteDatasets } from '../datasets/use-datasets';
import type { MastraQueryOptions } from '../shared/query-options';

type DatasetRecord = Awaited<ReturnType<MastraClient['getDataset']>>;
type ListDatasetsResponse = Awaited<ReturnType<MastraClient['listDatasets']>>;

const dataset: DatasetRecord = {
  id: 'ds-1',
  name: 'Support questions',
  version: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const datasetsPage: ListDatasetsResponse = {
  datasets: [dataset],
  pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
};

describe('queryOptions override', () => {
  describe('when enabled is false', () => {
    it('does not fetch', async () => {
      const hit = vi.fn();
      server.use(
        http.get('*/api/datasets/:id', () => {
          hit();
          return HttpResponse.json(dataset);
        }),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDataset({ datasetId: 'ds-1', queryOptions: { enabled: false } }), {
        wrapper,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.fetchStatus).toBe('idle');
      expect(hit).not.toHaveBeenCalled();
    });
  });

  describe('when the id is empty and no enabled is passed', () => {
    it('fetches anyway because the hook does not guard on ids', async () => {
      const hit = vi.fn();
      server.use(
        http.get('*/api/datasets/:id', () => {
          hit();
          return HttpResponse.json(dataset);
        }),
      );

      const { wrapper } = makeWrapper();
      renderHook(() => useDataset({ datasetId: 'ds-1' }), { wrapper });

      await waitFor(() => expect(hit).toHaveBeenCalledTimes(1));
    });

    it('lets the caller skip the fetch with enabled', async () => {
      const hit = vi.fn();
      server.use(
        http.get('*/api/datasets/:id', () => {
          hit();
          return HttpResponse.json(dataset);
        }),
      );

      const datasetId = '';
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } }), {
        wrapper,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.fetchStatus).toBe('idle');
      expect(hit).not.toHaveBeenCalled();
    });
  });

  describe('when select is passed', () => {
    it('returns the selected value with the selected type', async () => {
      server.use(http.get('*/api/datasets/:id', () => HttpResponse.json(dataset)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useDataset({ datasetId: 'ds-1', queryOptions: { select: d => d?.name.length ?? 0 } }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.data).toBe(dataset.name.length));
      expectTypeOf(result.current.data).toEqualTypeOf<number | undefined>();
    });
  });

  describe('when queryKey and queryFn are overridden', () => {
    it('uses the caller-provided key and function', async () => {
      const { wrapper, queryClient } = makeWrapper();
      const { result } = renderHook(
        () =>
          useDatasets({
            queryOptions: { queryKey: ['custom-datasets'], queryFn: async () => datasetsPage },
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.data?.datasets[0]?.id).toBe('ds-1'));
      expect(queryClient.getQueryData(['custom-datasets'])).toEqual(datasetsPage);
    });
  });

  describe('when an infinite query select is overridden', () => {
    it('replaces the internal flattening', async () => {
      server.use(http.get('*/api/datasets', () => HttpResponse.json(datasetsPage)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useInfiniteDatasets({ queryOptions: { select: data => data.pages.length } }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.data).toBe(1));
      expectTypeOf(result.current.data).toEqualTypeOf<number | undefined>();
    });
  });

  describe('when a keyed mutation onSuccess is passed', () => {
    it('replaces the internal onSuccess (no cache invalidation)', async () => {
      server.use(http.post('*/api/datasets', () => HttpResponse.json(dataset)));
      const onSuccess = vi.fn();

      const { wrapper, queryClient } = makeWrapper();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useDatasetMutations({ queryOptions: { createDataset: { onSuccess } } }), {
        wrapper,
      });

      await result.current.createDataset.mutateAsync({ name: 'Support questions' });
      await waitForMutationsIdle(queryClient);

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(invalidate).not.toHaveBeenCalled();
    });

    it('keeps the internal invalidation when no override is passed', async () => {
      server.use(http.post('*/api/datasets', () => HttpResponse.json(dataset)));

      const { wrapper, queryClient } = makeWrapper();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useDatasetMutations(), { wrapper });

      await result.current.createDataset.mutateAsync({ name: 'Support questions' });
      await waitForMutationsIdle(queryClient);

      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['datasets'] });
    });
  });

  describe('MastraQueryOptions type', () => {
    it('is a Partial of the exact TanStack UseQueryOptions', () => {
      expectTypeOf<MastraQueryOptions<string, number>>().toEqualTypeOf<
        Partial<UseQueryOptions<string, Error, number, QueryKey>>
      >();
    });
  });
});

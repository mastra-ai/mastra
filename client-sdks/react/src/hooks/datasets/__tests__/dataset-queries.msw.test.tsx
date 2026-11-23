// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useDatasetItem, useDatasetItems } from '../use-dataset-items';
import { useDataset, useDatasets, useDatasetsByIds } from '../use-datasets';

type DatasetRecord = Awaited<ReturnType<MastraClient['listDatasets']>>['datasets'][number];
type DatasetItemRecord = Awaited<ReturnType<MastraClient['getDatasetItem']>>;
type ListDatasetsResponse = Awaited<ReturnType<MastraClient['listDatasets']>>;
type ListDatasetItemsResponse = Awaited<ReturnType<MastraClient['listDatasetItems']>>;

const dataset: DatasetRecord = {
  id: 'ds-1',
  name: 'Support questions',
  version: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const item: DatasetItemRecord = {
  id: 'item-1',
  datasetId: 'ds-1',
  datasetVersion: 1,
  input: { question: 'How do I reset my password?' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const datasetsPage: ListDatasetsResponse = {
  datasets: [dataset],
  pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
};

const itemsPage: ListDatasetItemsResponse = {
  items: [item],
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
};

afterEach(() => cleanup());

describe('useDatasets', () => {
  describe('when the server lists datasets', () => {
    it('returns the datasets page', async () => {
      server.use(http.get('*/api/datasets', () => HttpResponse.json(datasetsPage)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasets(), { wrapper });

      await waitFor(() => expect(result.current.data?.datasets.map(d => d.id)).toEqual(['ds-1']));
    });
  });
});

describe('useDatasetsByIds', () => {
  const buildDataset = (id: string): DatasetRecord => ({ ...dataset, id, name: `Dataset ${id}` });

  const useDatasetsByIdsHandler = (requestedIds: string[][]) =>
    server.use(
      http.get('*/api/datasets', ({ request }) => {
        const ids = new URL(request.url).searchParams.getAll('datasetIds');
        requestedIds.push(ids);
        const page: ListDatasetsResponse = {
          datasets: ids.filter(id => id !== 'ds-missing').map(buildDataset),
          pagination: { total: ids.length, page: 0, perPage: ids.length, hasMore: false },
        };
        return HttpResponse.json(page);
      }),
    );

  describe('when given dataset ids', () => {
    it('fetches only those datasets, once per unique id, and omits ids without a dataset', async () => {
      const requestedIds: string[][] = [];
      useDatasetsByIdsHandler(requestedIds);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetsByIds({ datasetIds: ['ds-2', 'ds-1', 'ds-2', 'ds-missing'] }), {
        wrapper,
      });

      await waitFor(() => expect(result.current.data?.map(d => d.name)).toEqual(['Dataset ds-1', 'Dataset ds-2']));
      expect(requestedIds).toEqual([['ds-1', 'ds-2', 'ds-missing']]);
    });
  });

  describe('when given more than 100 dataset ids', () => {
    it('splits them into requests of at most 100 ids and merges the datasets', async () => {
      const requestedIds: string[][] = [];
      useDatasetsByIdsHandler(requestedIds);
      const ids = Array.from({ length: 150 }, (_, index) => `ds-${String(index).padStart(3, '0')}`);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetsByIds({ datasetIds: ids }), { wrapper });

      await waitFor(() => expect(result.current.data).toHaveLength(150));
      expect(requestedIds.map(batch => batch.length).toSorted((a, b) => b - a)).toEqual([100, 50]);
    });
  });

  describe('when given no dataset ids', () => {
    it('does not send a request', async () => {
      const requestedIds: string[][] = [];
      useDatasetsByIdsHandler(requestedIds);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetsByIds({ datasetIds: [] }), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(requestedIds).toEqual([]);
    });
  });
});

describe('useDataset', () => {
  describe('when the dataset exists', () => {
    it('returns the dataset', async () => {
      server.use(http.get('*/api/datasets/ds-1', () => HttpResponse.json(dataset)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDataset({ datasetId: 'ds-1' }), { wrapper });

      await waitFor(() => expect(result.current.data?.name).toBe('Support questions'));
    });
  });
});

describe('useDatasetItem', () => {
  describe('when the item exists', () => {
    it('returns the item', async () => {
      server.use(http.get('*/api/datasets/ds-1/items/item-1', () => HttpResponse.json(item)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetItem({ datasetId: 'ds-1', itemId: 'item-1' }), { wrapper });

      await waitFor(() => expect(result.current.data?.id).toBe('item-1'));
    });
  });
});

describe('useDatasetItems', () => {
  describe('when the dataset has items', () => {
    it('flattens the pages into items with the total', async () => {
      server.use(http.get('*/api/datasets/ds-1/items', () => HttpResponse.json(itemsPage)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetItems({ datasetId: 'ds-1' }), { wrapper });

      await waitFor(() => expect(result.current.data.map(i => i.id)).toEqual(['item-1']));
      expect(result.current.total).toBe(1);
    });
  });
});

// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useDatasetItem, useDatasetItems } from '../use-dataset-items';
import { useDataset, useDatasets } from '../use-datasets';

type DatasetRecord = Awaited<ReturnType<MastraClient['getDataset']>>;
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

describe('useDataset', () => {
  describe('when the dataset exists', () => {
    it('returns the dataset', async () => {
      server.use(http.get('*/api/datasets/ds-1', () => HttpResponse.json(dataset)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDataset('ds-1'), { wrapper });

      await waitFor(() => expect(result.current.data?.name).toBe('Support questions'));
    });
  });
});

describe('useDatasetItem', () => {
  describe('when the item exists', () => {
    it('returns the item', async () => {
      server.use(http.get('*/api/datasets/ds-1/items/item-1', () => HttpResponse.json(item)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetItem('ds-1', 'item-1'), { wrapper });

      await waitFor(() => expect(result.current.data?.id).toBe('item-1'));
    });
  });
});

describe('useDatasetItems', () => {
  describe('when the dataset has items', () => {
    it('flattens the pages into items with the total', async () => {
      server.use(http.get('*/api/datasets/ds-1/items', () => HttpResponse.json(itemsPage)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetItems('ds-1'), { wrapper });

      await waitFor(() => expect(result.current.data.map(i => i.id)).toEqual(['item-1']));
      expect(result.current.total).toBe(1);
    });
  });
});

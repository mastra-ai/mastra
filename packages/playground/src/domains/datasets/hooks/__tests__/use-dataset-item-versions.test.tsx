import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDatasetItemVersion, useDatasetItemVersions } from '../use-dataset-item-versions';
import { itemHistory, makeDatasetItemVersion } from './fixtures/dataset-item-versions';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const HISTORY_URL = `${BASE_URL}/api/datasets/dataset-1/items/item-1/history`;
const VERSION_URL = (version: number) => `${BASE_URL}/api/datasets/dataset-1/items/item-1/versions/${version}`;

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

describe('useDatasetItemVersions', () => {
  describe('when the item has a history', () => {
    it('marks only the newest row as the latest version', async () => {
      server.use(
        http.get(HISTORY_URL, () =>
          HttpResponse.json(
            itemHistory([
              makeDatasetItemVersion({ id: 'v3', datasetVersion: 3 }),
              makeDatasetItemVersion({ id: 'v2', datasetVersion: 2, validTo: 3 }),
              makeDatasetItemVersion({ id: 'v1', datasetVersion: 1, validTo: 2 }),
            ]),
          ),
        ),
      );

      const { result } = renderHook(() => useDatasetItemVersions('dataset-1', 'item-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.map(v => [v.id, v.isLatest])).toEqual([
        ['v3', true],
        ['v2', false],
        ['v1', false],
      ]);
    });

    it('carries every recorded field through to the caller', async () => {
      server.use(
        http.get(HISTORY_URL, () =>
          HttpResponse.json(
            itemHistory([
              makeDatasetItemVersion({
                expectedTrajectory: [{ step: 'search' }],
                toolMocks: [{ toolName: 'search', output: { hits: 1 } }],
              }),
            ]),
          ),
        ),
      );

      const { result } = renderHook(() => useDatasetItemVersions('dataset-1', 'item-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]).toEqual({
        id: 'item-1',
        datasetId: 'dataset-1',
        datasetVersion: 3,
        input: { question: 'What is Mastra?' },
        groundTruth: { answer: 'A framework' },
        expectedTrajectory: [{ step: 'search' }],
        toolMocks: [{ toolName: 'search', output: { hits: 1 } }],
        scorerIds: ['scorer-1'],
        metadata: { source: 'import' },
        validTo: null,
        isDeleted: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        isLatest: true,
      });
    });

    it('preserves a soft-deleted row rather than hiding it', async () => {
      server.use(
        http.get(HISTORY_URL, () =>
          HttpResponse.json(itemHistory([makeDatasetItemVersion({ isDeleted: true, validTo: 4 })])),
        ),
      );

      const { result } = renderHook(() => useDatasetItemVersions('dataset-1', 'item-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.isDeleted).toBe(true);
      expect(result.current.data?.[0]?.validTo).toBe(4);
    });
  });

  describe('when the server returns no history field', () => {
    it('reports an empty list instead of throwing', async () => {
      server.use(http.get(HISTORY_URL, () => HttpResponse.json({})));

      const { result } = renderHook(() => useDatasetItemVersions('dataset-1', 'item-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });
  });

  describe.each([
    ['the dataset id', '', 'item-1'],
    ['the item id', 'dataset-1', ''],
  ])('when %s is missing', (_label, datasetId, itemId) => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/datasets/:datasetId/items/:itemId/history`, () => {
          onFetch();
          return HttpResponse.json(itemHistory([]));
        }),
      );

      const { result } = renderHook(() => useDatasetItemVersions(datasetId, itemId), { wrapper: createWrapper() });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when two items are read through the same cache', () => {
    it('keeps each item history in its own cache entry', async () => {
      server.use(
        http.get(`${BASE_URL}/api/datasets/dataset-1/items/:itemId/history`, ({ params }) =>
          HttpResponse.json(itemHistory([makeDatasetItemVersion({ id: `history-${params.itemId}` })])),
        ),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useDatasetItemVersions('dataset-1', 'item-1'), { wrapper });
      await waitFor(() => expect(first.result.current.data?.[0]?.id).toBe('history-item-1'));

      const second = renderHook(() => useDatasetItemVersions('dataset-1', 'item-2'), { wrapper });
      await waitFor(() => expect(second.result.current.data?.[0]?.id).toBe('history-item-2'));

      expect(first.result.current.data?.[0]?.id).toBe('history-item-1');
    });
  });
});

describe('useDatasetItemVersion', () => {
  describe('when the requested version is the latest one', () => {
    it('flags it as latest', async () => {
      server.use(http.get(VERSION_URL(3), () => HttpResponse.json(makeDatasetItemVersion({ datasetVersion: 3 }))));

      const { result } = renderHook(() => useDatasetItemVersion('dataset-1', 'item-1', 3, 3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.isLatest).toBe(true);
    });
  });

  describe('when the requested version is an older one', () => {
    it('does not flag it as latest', async () => {
      server.use(http.get(VERSION_URL(2), () => HttpResponse.json(makeDatasetItemVersion({ datasetVersion: 2 }))));

      const { result } = renderHook(() => useDatasetItemVersion('dataset-1', 'item-1', 2, 3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.isLatest).toBe(false);
    });
  });

  describe('when the caller does not know which version is latest', () => {
    it('does not guess that the fetched version is latest', async () => {
      server.use(http.get(VERSION_URL(3), () => HttpResponse.json(makeDatasetItemVersion({ datasetVersion: 3 }))));

      const { result } = renderHook(() => useDatasetItemVersion('dataset-1', 'item-1', 3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.isLatest).toBe(false);
    });
  });

  describe('when the stored row omits the SCD-2 bookkeeping fields', () => {
    it('normalizes validTo to null and isDeleted to false', async () => {
      server.use(
        http.get(VERSION_URL(3), () =>
          HttpResponse.json({
            id: 'item-1',
            datasetId: 'dataset-1',
            datasetVersion: 3,
            input: { question: 'q' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        ),
      );

      const { result } = renderHook(() => useDatasetItemVersion('dataset-1', 'item-1', 3, 3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.validTo).toBeNull();
      expect(result.current.data?.isDeleted).toBe(false);
    });

    it('keeps a reported validTo and isDeleted', async () => {
      server.use(
        http.get(VERSION_URL(2), () =>
          HttpResponse.json(makeDatasetItemVersion({ datasetVersion: 2, validTo: 3, isDeleted: true })),
        ),
      );

      const { result } = renderHook(() => useDatasetItemVersion('dataset-1', 'item-1', 2, 3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.validTo).toBe(3);
      expect(result.current.data?.isDeleted).toBe(true);
    });
  });

  describe.each([
    ['the dataset id is missing', '', 'item-1', 3],
    ['the item id is missing', 'dataset-1', '', 3],
    ['the version is zero', 'dataset-1', 'item-1', 0],
    ['the version is negative', 'dataset-1', 'item-1', -1],
  ])('when %s', (_label, datasetId, itemId, version) => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/datasets/:datasetId/items/:itemId/versions/:version`, () => {
          onFetch();
          return HttpResponse.json(makeDatasetItemVersion());
        }),
      );

      const { result } = renderHook(() => useDatasetItemVersion(datasetId, itemId, version, 3), {
        wrapper: createWrapper(),
      });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when two versions are read through the same cache', () => {
    it('keeps each version in its own cache entry', async () => {
      server.use(
        http.get(`${BASE_URL}/api/datasets/dataset-1/items/item-1/versions/:version`, ({ params }) =>
          HttpResponse.json(
            makeDatasetItemVersion({ id: `v-${params.version}`, datasetVersion: Number(params.version) }),
          ),
        ),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useDatasetItemVersion('dataset-1', 'item-1', 2, 3), { wrapper });
      await waitFor(() => expect(first.result.current.data?.id).toBe('v-2'));

      const second = renderHook(() => useDatasetItemVersion('dataset-1', 'item-1', 3, 3), { wrapper });
      await waitFor(() => expect(second.result.current.data?.id).toBe('v-3'));

      expect(first.result.current.data?.id).toBe('v-2');
    });
  });
});

// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useExperimentTrace } from '../../experiments/use-experiment-trace';
import { useCompareExperiments } from '../use-compare-experiments';
import { useDatasetItemVersions } from '../use-dataset-item-versions';
import { useDatasetVersions } from '../use-dataset-versions';
import { useExperiment, useExperiments } from '../use-experiments';
import { useWorkflowSchema } from '../use-workflow-schema';

type ItemHistoryResponse = Awaited<ReturnType<MastraClient['getItemHistory']>>;
type DatasetVersionsResponse = Awaited<ReturnType<MastraClient['listDatasetVersions']>>;
type ExperimentsResponse = Awaited<ReturnType<MastraClient['listExperiments']>>;
type CompareExperimentsResponse = Awaited<ReturnType<MastraClient['compareExperiments']>>;
type TraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;

const NOW = '2026-09-01T00:00:00.000Z';

const itemHistory: ItemHistoryResponse = {
  history: [
    {
      id: 'item-1',
      datasetId: 'ds-1',
      datasetVersion: 2,
      input: { question: 'v2' },
      validTo: null,
      isDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'item-1',
      datasetId: 'ds-1',
      datasetVersion: 1,
      input: { question: 'v1' },
      validTo: 2,
      isDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
};

const datasetVersions: DatasetVersionsResponse = {
  versions: [{ id: 'v-1', datasetId: 'ds-1', version: 1, createdAt: NOW }],
  pagination: { total: 1, page: 0, perPage: 20, hasMore: false },
};

const experiments: ExperimentsResponse = {
  experiments: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};

const comparison: CompareExperimentsResponse = {
  baselineId: 'exp-a',
  items: [],
};

const traceLight: TraceLightResponse = { traceId: 'trace-1', spans: [] };

afterEach(() => cleanup());

describe('useDatasetItemVersions', () => {
  describe('when the item has history', () => {
    it('marks only the newest row as latest', async () => {
      server.use(http.get('*/api/datasets/ds-1/items/item-1/history', () => HttpResponse.json(itemHistory)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetItemVersions({ datasetId: 'ds-1', itemId: 'item-1' }), { wrapper });

      await waitFor(() => expect(result.current.data?.map(v => v.isLatest)).toEqual([true, false]));
    });
  });
});

describe('useDatasetVersions', () => {
  describe('when the dataset has versions', () => {
    it('returns the versions', async () => {
      server.use(http.get('*/api/datasets/ds-1/versions', () => HttpResponse.json(datasetVersions)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDatasetVersions({ datasetId: 'ds-1' }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(JSON.stringify(result.current.data)).toContain('v-1');
    });
  });
});

describe('useExperiments', () => {
  describe('when the server lists experiments', () => {
    it('forwards pagination as query params', async () => {
      let url: URL | undefined;
      server.use(
        http.get('*/api/experiments', ({ request }) => {
          url = new URL(request.url);
          return HttpResponse.json(experiments);
        }),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExperiments({ pagination: { page: 2, perPage: 5 } }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(url?.searchParams.get('page')).toBe('2');
    });
  });
});

describe('useExperiment', () => {
  describe('when only the experiment id is known', () => {
    it('fetches the experiment by id and exposes its datasetId', async () => {
      let path: string | undefined;
      server.use(
        http.get('*/api/experiments/:experimentId', ({ request, params }) => {
          path = new URL(request.url).pathname;
          return HttpResponse.json({ id: params.experimentId, datasetId: 'ds-1', name: 'old run' });
        }),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExperiment({ experimentId: 'exp-1' }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(path).toBe('/api/experiments/exp-1');
      expect(result.current.data?.datasetId).toBe('ds-1');
    });
  });
});

describe('useCompareExperiments', () => {
  describe('when both experiments are given', () => {
    it('posts the comparison and returns the result', async () => {
      let body: unknown;
      server.use(
        http.post('*/api/datasets/ds-1/compare', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(comparison);
        }),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useCompareExperiments({ datasetId: 'ds-1', experimentIdA: 'exp-a', experimentIdB: 'exp-b' }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.data?.baselineId).toBe('exp-a'));
      expect(body).toMatchObject({ experimentIdA: 'exp-a', experimentIdB: 'exp-b' });
    });
  });

  describe('when an experiment is missing', () => {
    it('does not fetch', () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () =>
          useCompareExperiments({
            datasetId: 'ds-1',
            experimentIdA: 'exp-a',
            experimentIdB: '',
            queryOptions: { enabled: false },
          }),
        { wrapper },
      );

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useWorkflowSchema', () => {
  describe('when the workflow exposes schemas', () => {
    it('parses the input schema', async () => {
      server.use(
        http.get('*/api/workflows/wf-1', () =>
          HttpResponse.json({ inputSchema: JSON.stringify({ json: { type: 'object' } }), outputSchema: null }),
        ),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useWorkflowSchema({ workflowId: 'wf-1' }), { wrapper });

      await waitFor(() => expect(result.current.data?.inputSchema).toEqual({ type: 'object' }));
    });
  });
});

describe('useExperimentTrace', () => {
  describe('when a trace id is given', () => {
    it('loads the light trace', async () => {
      server.use(http.get('*/api/observability/traces/trace-1/light', () => HttpResponse.json(traceLight)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExperimentTrace({ traceId: 'trace-1' }), { wrapper });

      await waitFor(() => expect(result.current.data).toEqual(traceLight));
    });
  });
});

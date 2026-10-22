// @vitest-environment jsdom
import type { DatasetExperimentResult, MastraClient } from '@mastra/client-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useExperimentTrace } from '../../experiments/use-experiment-trace';
import { useCompareExperiments } from '../use-compare-experiments';
import {
  useAllDatasetExperimentResultsQueries,
  useDatasetExperimentsQueries,
  useScoresByExperimentIdsQueries,
} from '../use-dataset-experiments';
import { useDatasetItemVersions } from '../use-dataset-item-versions';
import { useDatasetVersions } from '../use-dataset-versions';
import { useExperiment, useExperiments } from '../use-experiments';
import { useWorkflowSchema } from '../use-workflow-schema';

type ItemHistoryResponse = Awaited<ReturnType<MastraClient['getItemHistory']>>;
type DatasetVersionsResponse = Awaited<ReturnType<MastraClient['listDatasetVersions']>>;
type ExperimentsResponse = Awaited<ReturnType<MastraClient['listExperiments']>>;
type ExperimentResponse = Awaited<ReturnType<MastraClient['getExperiment']>>;
type CompareExperimentsResponse = Awaited<ReturnType<MastraClient['compareExperiments']>>;
type TraceLightResponse = Awaited<ReturnType<MastraClient['getTraceLight']>>;
type DatasetExperimentResponse = Awaited<ReturnType<MastraClient['getDatasetExperiment']>>;
type ExperimentResultsResponse = Awaited<ReturnType<MastraClient['listDatasetExperimentResults']>>;
type ScoresResponse = Awaited<ReturnType<MastraClient['listScoresByRunId']>>;

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

const experiment: ExperimentResponse = {
  id: 'exp-old',
  datasetId: 'ds-1',
  datasetVersion: 1,
  targetType: 'agent',
  targetId: 'agent-1',
  status: 'completed',
  totalItems: 1,
  succeededCount: 1,
  failedCount: 0,
  skippedCount: 0,
  startedAt: NOW,
  completedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
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
  describe('when the experiment exists', () => {
    it('resolves it by id, including its dataset', async () => {
      server.use(http.get('*/api/experiments/exp-old', () => HttpResponse.json(experiment)));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExperiment({ experimentId: 'exp-old' }), { wrapper });

      await waitFor(() => expect(result.current.data?.datasetId).toBe('ds-1'));
    });
  });

  describe('when the experiment does not exist', () => {
    it('surfaces the 404 as an error', async () => {
      server.use(
        http.get('*/api/experiments/missing', () => HttpResponse.json({ error: 'not found' }, { status: 404 })),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExperiment({ experimentId: 'missing' }), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});

describe('useCompareExperiments', () => {
  describe('when given three experiment ids', () => {
    it('posts every id with the baseline and returns the result', async () => {
      let body: unknown;
      server.use(
        http.post('*/api/datasets/ds-1/compare', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(comparison);
        }),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () =>
          useCompareExperiments({
            datasetId: 'ds-1',
            experimentIds: ['exp-a', 'exp-b', 'exp-c'],
            baselineId: 'exp-a',
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.data?.baselineId).toBe('exp-a'));
      expect(body).toEqual({ experimentIds: ['exp-a', 'exp-b', 'exp-c'], baselineId: 'exp-a' });
    });
  });

  describe('when the query is disabled', () => {
    it('does not fetch', () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () =>
          useCompareExperiments({
            datasetId: 'ds-1',
            experimentIds: ['exp-a'],
            queryOptions: { enabled: false },
          }),
        { wrapper },
      );

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

const datasetExperiment = (id: string, status: ExperimentResponse['status']): DatasetExperimentResponse => ({
  ...experiment,
  id,
  status,
});

const resultRow = (experimentId: string, itemId: string): DatasetExperimentResult => ({
  id: `res-${experimentId}-${itemId}`,
  experimentId,
  itemId,
  targetType: null,
  itemDatasetVersion: 1,
  input: {},
  output: { answer: itemId },
  groundTruth: null,
  metadata: null,
  error: null,
  startedAt: NOW,
  completedAt: NOW,
  retryCount: 0,
  traceId: null,
  status: 'complete',
  tags: null,
  comment: null,
  createdAt: NOW,
});

const scoreRow = (runId: string, entityId: string): ScoresResponse['scores'][number] => ({
  id: `score-${runId}-${entityId}`,
  runId,
  entityId,
  scorerId: 'accuracy',
  scorer: { name: 'accuracy' },
  entity: {},
  output: null,
  score: 1,
  source: 'TEST',
  createdAt: NOW,
  updatedAt: NOW,
});

describe('useDatasetExperimentsQueries', () => {
  describe('when given several experiment ids', () => {
    it('returns each experiment keyed by id', async () => {
      server.use(
        http.get('*/api/datasets/ds-1/experiments/:experimentId', ({ params }) =>
          HttpResponse.json(datasetExperiment(String(params.experimentId), 'completed')),
        ),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useDatasetExperimentsQueries({ datasetId: 'ds-1', experimentIds: ['exp-a', 'exp-b', 'exp-c'] }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(Object.keys(result.current.data)).toEqual(['exp-a', 'exp-b', 'exp-c']);
      expect(result.current.data['exp-c']?.id).toBe('exp-c');
    });
  });

  describe('when one experiment does not belong to the dataset', () => {
    it('surfaces its error', async () => {
      server.use(
        http.get('*/api/datasets/ds-1/experiments/:experimentId', ({ params }) =>
          params.experimentId === 'exp-other'
            ? HttpResponse.json({ error: 'not found' }, { status: 404 })
            : HttpResponse.json(datasetExperiment(String(params.experimentId), 'completed')),
        ),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useDatasetExperimentsQueries({ datasetId: 'ds-1', experimentIds: ['exp-a', 'exp-other'] }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.data['exp-other']).toBeUndefined();
    });
  });

  describe('when one experiment is running', () => {
    it('keeps polling only that experiment', async () => {
      const calls: Record<string, number> = {};
      server.use(
        http.get('*/api/datasets/ds-1/experiments/:experimentId', ({ params }) => {
          const id = String(params.experimentId);
          calls[id] = (calls[id] ?? 0) + 1;
          return HttpResponse.json(datasetExperiment(id, id === 'exp-running' ? 'running' : 'completed'));
        }),
      );

      const { wrapper } = makeWrapper();
      renderHook(
        () => useDatasetExperimentsQueries({ datasetId: 'ds-1', experimentIds: ['exp-done', 'exp-running'] }),
        {
          wrapper,
        },
      );

      await waitFor(() => expect(calls['exp-running']).toBeGreaterThanOrEqual(2), { timeout: 5000 });
      expect(calls['exp-done']).toBe(1);
    });
  });
});

describe('useAllDatasetExperimentResultsQueries', () => {
  describe('when an experiment has more results than one page', () => {
    it('fetches every page', async () => {
      server.use(
        http.get('*/api/datasets/ds-1/experiments/:experimentId/results', ({ params, request }) => {
          const experimentId = String(params.experimentId);
          const page = Number(new URL(request.url).searchParams.get('page'));
          const response: ExperimentResultsResponse = {
            results: [resultRow(experimentId, `item-${page}`)],
            pagination: { total: 101, page, perPage: 100, hasMore: page === 0 },
          };
          return HttpResponse.json(response);
        }),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () =>
          useAllDatasetExperimentResultsQueries({
            datasetId: 'ds-1',
            experiments: [{ id: 'exp-a' }, { id: 'exp-b', status: 'completed' }],
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data['exp-a']?.map(r => r.itemId)).toEqual(['item-0', 'item-1']);
      expect(result.current.data['exp-b']?.map(r => r.itemId)).toEqual(['item-0', 'item-1']);
    });
  });
});

describe('useScoresByExperimentIdsQueries', () => {
  describe('when given several experiments', () => {
    it('groups each experiment scores by dataset item id', async () => {
      server.use(
        http.get('*/api/scores/run/:runId', ({ params }) => {
          const runId = String(params.runId);
          const response: ScoresResponse = {
            scores: [scoreRow(runId, 'item-1')],
            pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
          };
          return HttpResponse.json(response);
        }),
      );

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useScoresByExperimentIdsQueries({ experiments: [{ id: 'exp-a' }, { id: 'exp-b' }] }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data['exp-a']?.['item-1']?.[0]?.runId).toBe('exp-a');
      expect(result.current.data['exp-b']?.['item-1']?.[0]?.runId).toBe('exp-b');
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

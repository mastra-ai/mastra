import type { DatasetExperiment } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  useDatasetExperiment,
  useDatasetExperimentResults,
  useDatasetExperiments,
  useScoresByExperimentId,
} from '../use-dataset-experiments';
import { installIntersectionObserver } from '@/test/intersection-observer';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const DATASET_ID = 'ds-1';
const EXPERIMENT_ID = 'exp-1';
const EXPERIMENTS_URL = `${BASE_URL}/api/datasets/${DATASET_ID}/experiments`;
const RESULTS_URL = `${EXPERIMENTS_URL}/${EXPERIMENT_ID}/results`;
const SCORES_URL = `${BASE_URL}/api/scores/run/${EXPERIMENT_ID}`;

const makeExperiment = (overrides: Partial<DatasetExperiment> = {}): DatasetExperiment =>
  ({
    id: EXPERIMENT_ID,
    datasetId: DATASET_ID,
    datasetVersion: 1,
    agentVersion: null,
    targetType: 'agent',
    targetId: 'agent-1',
    status: 'completed',
    totalItems: 1,
    succeededCount: 1,
    failedCount: 0,
    startedAt: '2026-07-21T00:00:00.000Z',
    completedAt: '2026-07-21T00:01:00.000Z',
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:01:00.000Z',
    ...overrides,
  }) as DatasetExperiment;

const experimentsPage = (experiments: DatasetExperiment[]) => ({
  experiments,
  pagination: { total: experiments.length, page: 0, perPage: 100, hasMore: false },
});

const resultsPage = (ids: string[], total = ids.length) => ({
  results: ids.map(id => ({ id, experimentId: EXPERIMENT_ID, itemId: `item-${id}`, status: 'complete' })),
  pagination: { total, page: 0, perPage: 100, hasMore: false },
});

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  wrapper.queryClient = queryClient;
  return wrapper;
};

/** Lets react-query settle so "no request was made" is a real observation. */
const settle = () => act(async () => new Promise(resolve => setTimeout(resolve, 60)));

afterEach(() => cleanup());

describe('useDatasetExperiments', () => {
  const twoExperiments = [
    makeExperiment({ id: 'e-running', status: 'running', targetType: 'agent', targetId: 'agent-1' }),
    makeExperiment({ id: 'e-done', status: 'completed', targetType: 'workflow', targetId: 'wf-1' }),
  ];

  it('lists every experiment when no filter is given', async () => {
    server.use(http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsPage(twoExperiments))));

    const { result } = renderHook(() => useDatasetExperiments(DATASET_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.experiments).toHaveLength(2));
  });

  it('forwards the pagination the caller asked for', async () => {
    let search = '';
    server.use(
      http.get(EXPERIMENTS_URL, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(experimentsPage(twoExperiments));
      }),
    );

    const { result } = renderHook(() => useDatasetExperiments(DATASET_ID, { page: 2, perPage: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(search).toContain('page=2');
    expect(search).toContain('perPage=10');
  });

  describe('the client-side filters', () => {
    const renderFiltered = (filters: Parameters<typeof useDatasetExperiments>[2]) => {
      server.use(http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsPage(twoExperiments))));
      return renderHook(() => useDatasetExperiments(DATASET_ID, undefined, filters), { wrapper: createWrapper() });
    };

    it.each([
      ['status', { status: 'running' }, ['e-running']],
      ['target type', { targetType: 'workflow' }, ['e-done']],
      ['target id', { targetId: 'agent-1' }, ['e-running']],
    ])('narrows the list by %s', async (_label, filters, expected) => {
      const { result } = renderFiltered(filters);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.experiments.map(e => e.id)).toEqual(expected);
    });

    it('requires every filter to match', async () => {
      const { result } = renderFiltered({ status: 'running', targetType: 'workflow' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.experiments).toEqual([]);
    });

    it('ignores a filter object with no criteria in it', async () => {
      const { result } = renderFiltered({});

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.experiments).toHaveLength(2);
    });

    it('keeps the pagination envelope alongside the filtered list', async () => {
      const { result } = renderFiltered({ status: 'running' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.pagination).toMatchObject({ total: 2 });
    });

    it('keeps each filter combination in its own cache entry', async () => {
      server.use(http.get(EXPERIMENTS_URL, () => HttpResponse.json(experimentsPage(twoExperiments))));
      const wrapper = createWrapper();

      const { result } = renderHook(() => useDatasetExperiments(DATASET_ID, undefined, { status: 'running' }), {
        wrapper,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(
        wrapper.queryClient.getQueryData(['dataset-experiments', DATASET_ID, undefined, { status: 'running' }]),
      ).toBeDefined();
      expect(
        wrapper.queryClient.getQueryData(['dataset-experiments', DATASET_ID, undefined, undefined]),
      ).toBeUndefined();
    });
  });

  it('stays idle without a dataset id', async () => {
    let requested = false;
    server.use(
      http.get(`${BASE_URL}/api/datasets/:datasetId/experiments`, () => {
        requested = true;
        return HttpResponse.json(experimentsPage([]));
      }),
    );

    const { result } = renderHook(() => useDatasetExperiments(''), { wrapper: createWrapper() });

    await settle();
    expect(requested).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useDatasetExperiment', () => {
  const url = `${EXPERIMENTS_URL}/${EXPERIMENT_ID}`;

  it('reads one experiment', async () => {
    server.use(http.get(url, () => HttpResponse.json(makeExperiment())));

    const { result } = renderHook(() => useDatasetExperiment(DATASET_ID, EXPERIMENT_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data?.id).toBe(EXPERIMENT_ID));
  });

  describe('while the run is still going', () => {
    it.each([['running'], ['pending']])('keeps polling a %s experiment', async status => {
      let calls = 0;
      server.use(
        http.get(url, () => {
          calls += 1;
          return HttpResponse.json(makeExperiment({ status: status as DatasetExperiment['status'] }));
        }),
      );

      const { result } = renderHook(() => useDatasetExperiment(DATASET_ID, EXPERIMENT_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      await waitFor(() => expect(calls).toBeGreaterThan(1), { timeout: 5000 });
    });

    it('stops polling once the run is finished', async () => {
      let calls = 0;
      server.use(
        http.get(url, () => {
          calls += 1;
          return HttpResponse.json(makeExperiment({ status: 'completed' }));
        }),
      );

      const { result } = renderHook(() => useDatasetExperiment(DATASET_ID, EXPERIMENT_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const afterFirst = calls;
      await act(async () => new Promise(resolve => setTimeout(resolve, 2500)));
      expect(calls).toBe(afterFirst);
    });
  });

  describe('when either id is missing', () => {
    it.each([
      ['no dataset', '', EXPERIMENT_ID],
      ['no experiment', DATASET_ID, ''],
    ])('stays idle with %s', async (_label, datasetId, experimentId) => {
      const { result } = renderHook(() => useDatasetExperiment(datasetId, experimentId), {
        wrapper: createWrapper(),
      });

      await settle();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useDatasetExperimentResults', () => {
  it('flattens the pages into one list for the caller', async () => {
    server.use(http.get(RESULTS_URL, () => HttpResponse.json(resultsPage(['r-1', 'r-2']))));

    const { result } = renderHook(
      () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data?.map(r => r.id)).toEqual(['r-1', 'r-2']);
  });

  it('asks for a full page at a time', async () => {
    let search = '';
    server.use(
      http.get(RESULTS_URL, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(resultsPage(['r-1']));
      }),
    );

    const { result } = renderHook(
      () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(search).toContain('page=0');
    expect(search).toContain('perPage=100');
  });

  describe('deciding whether another page exists', () => {
    it('stops when the page came back empty', async () => {
      server.use(http.get(RESULTS_URL, () => HttpResponse.json(resultsPage([], 500))));

      const { result } = renderHook(
        () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });

    it('stops once it has fetched as many results as the server reports', async () => {
      server.use(http.get(RESULTS_URL, () => HttpResponse.json(resultsPage(['r-1'], 1))));

      const { result } = renderHook(
        () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });

    it('keeps going while the server reports more than it has sent', async () => {
      server.use(http.get(RESULTS_URL, () => HttpResponse.json(resultsPage(['r-1'], 250))));

      const { result } = renderHook(
        () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    });

    it('advances one page at a time', async () => {
      const pages: string[] = [];
      server.use(
        http.get(RESULTS_URL, ({ request }) => {
          pages.push(new URL(request.url).searchParams.get('page') ?? '');
          return HttpResponse.json(resultsPage(['r-1'], 250));
        }),
      );

      const { result } = renderHook(
        () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.hasNextPage).toBe(true));
      await act(async () => {
        await result.current.fetchNextPage();
      });

      expect(pages).toEqual(['0', '1']);
    });

    it('stops when the server reports no total at all', async () => {
      server.use(http.get(RESULTS_URL, () => HttpResponse.json({ results: [{ id: 'r-1' }], pagination: undefined })));

      const { result } = renderHook(
        () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  it('keeps a running experiment in a cache entry apart from a finished one', async () => {
    server.use(http.get(RESULTS_URL, () => HttpResponse.json(resultsPage(['r-1']))));
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useDatasetExperimentResults({
          datasetId: DATASET_ID,
          experimentId: EXPERIMENT_ID,
          experimentStatus: 'running',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      wrapper.queryClient.getQueryData(['dataset-experiment-results', DATASET_ID, EXPERIMENT_ID, 'running']),
    ).toBeDefined();
    expect(
      wrapper.queryClient.getQueryData(['dataset-experiment-results', DATASET_ID, EXPERIMENT_ID, undefined]),
    ).toBeUndefined();
  });

  it('hands back a ref for the end-of-list sentinel', async () => {
    server.use(http.get(RESULTS_URL, () => HttpResponse.json(resultsPage(['r-1']))));

    const { result } = renderHook(
      () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
      { wrapper: createWrapper() },
    );

    expect(typeof result.current.setEndOfListElement).toBe('function');
  });

  describe('when either id is missing', () => {
    it.each([
      ['no dataset', '', EXPERIMENT_ID],
      ['no experiment', DATASET_ID, ''],
    ])('stays idle with %s', async (_label, datasetId, experimentId) => {
      const { result } = renderHook(() => useDatasetExperimentResults({ datasetId, experimentId }), {
        wrapper: createWrapper(),
      });

      await settle();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useScoresByExperimentId', () => {
  const score = (entityId: string, id: string) => ({ id, entityId, runId: EXPERIMENT_ID, score: 1 });

  it('groups the scores by the entity they belong to', async () => {
    server.use(
      http.get(SCORES_URL, () =>
        HttpResponse.json({
          scores: [score('item-1', 's-1'), score('item-2', 's-2'), score('item-1', 's-3')],
          pagination: { total: 3, page: 0, perPage: 100, hasMore: false },
        }),
      ),
    );

    const { result } = renderHook(() => useScoresByExperimentId(EXPERIMENT_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.keys(result.current.data!).sort()).toEqual(['item-1', 'item-2']);
    expect(result.current.data!['item-1'].map(s => s.id)).toEqual(['s-1', 's-3']);
  });

  it('walks every page so no score is silently dropped', async () => {
    const seen: string[] = [];
    server.use(
      http.get(SCORES_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '0';
        seen.push(page);
        return HttpResponse.json({
          scores: [score('item-1', `s-${page}`)],
          pagination: { total: 2, page: Number(page), perPage: 100, hasMore: page === '0' },
        });
      }),
    );

    const { result } = renderHook(() => useScoresByExperimentId(EXPERIMENT_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen).toEqual(['0', '1']);
    expect(result.current.data!['item-1']).toHaveLength(2);
  });

  it('reports an empty grouping when the experiment has no scores', async () => {
    server.use(
      http.get(SCORES_URL, () =>
        HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
      ),
    );

    const { result } = renderHook(() => useScoresByExperimentId(EXPERIMENT_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
  });

  it('stays idle without an experiment id', async () => {
    const { result } = renderHook(() => useScoresByExperimentId(''), { wrapper: createWrapper() });

    await settle();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('keeps a running experiment in a cache entry apart from a finished one', async () => {
    server.use(
      http.get(SCORES_URL, () =>
        HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
      ),
    );
    const wrapper = createWrapper();

    const { result } = renderHook(() => useScoresByExperimentId(EXPERIMENT_ID, 'completed'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(wrapper.queryClient.getQueryData(['dataset-experiment-scores', EXPERIMENT_ID, 'completed'])).toBeDefined();
  });
});

describe('useDatasetExperimentResults, as the reader scrolls', () => {
  let observer: ReturnType<typeof installIntersectionObserver>;

  beforeEach(() => {
    observer = installIntersectionObserver();
  });

  afterEach(() => observer.restore());

  /** Renders the hook with its end-of-list sentinel actually mounted. */
  const renderWithSentinel = () => {
    const api: { current: ReturnType<typeof useDatasetExperimentResults> | null } = { current: null };

    const Harness = () => {
      const query = useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID });
      api.current = query;
      return <div ref={query.setEndOfListElement} data-testid="sentinel" />;
    };

    render(<Harness />, { wrapper: createWrapper() });
    return () => api.current!;
  };

  it('loads the next page once the end of the list comes into view', async () => {
    const pages: string[] = [];
    server.use(
      http.get(RESULTS_URL, ({ request }) => {
        pages.push(new URL(request.url).searchParams.get('page') ?? '');
        return HttpResponse.json(resultsPage(['r-1'], 250));
      }),
    );

    const query = renderWithSentinel();
    await waitFor(() => expect(query().hasNextPage).toBe(true));
    expect(pages).toEqual(['0']);

    await act(async () => observer.setIntersecting(true));

    await waitFor(() => expect(pages).toEqual(['0', '1']));
  });

  it('does not load anything more once the last page has arrived', async () => {
    const pages: string[] = [];
    server.use(
      http.get(RESULTS_URL, ({ request }) => {
        pages.push(new URL(request.url).searchParams.get('page') ?? '');
        return HttpResponse.json(resultsPage(['r-1'], 1));
      }),
    );

    const query = renderWithSentinel();
    await waitFor(() => expect(query().isSuccess).toBe(true));

    await act(async () => observer.setIntersecting(true));
    await act(async () => new Promise(resolve => setTimeout(resolve, 60)));

    expect(pages).toEqual(['0']);
  });

  it('stops asking once it has fetched exactly as many results as the server reports', async () => {
    server.use(
      http.get(RESULTS_URL, () =>
        HttpResponse.json(
          resultsPage(
            Array.from({ length: 100 }, (_, i) => `r-${i}`),
            100,
          ),
        ),
      ),
    );

    const { result } = renderHook(
      () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // 100 fetched of 100 reported: equal, not greater — the boundary case.
    expect(result.current.hasNextPage).toBe(false);
  });

  it('survives a page that comes back with no body at all', async () => {
    server.use(http.get(RESULTS_URL, () => HttpResponse.json(null)));

    const { result } = renderHook(
      () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('the polling the experiment views rely on', () => {
  const pollingCases = [
    ['running', true],
    ['pending', true],
    ['completed', false],
    [undefined, false],
  ] as const;

  it.each(pollingCases)('polls the results of a %s experiment: %s', async (experimentStatus, shouldPoll) => {
    let calls = 0;
    server.use(
      http.get(RESULTS_URL, () => {
        calls += 1;
        return HttpResponse.json(resultsPage(['r-1'], 1));
      }),
    );

    const { result } = renderHook(
      () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID, experimentStatus }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const afterFirst = calls;

    await act(async () => new Promise(resolve => setTimeout(resolve, 2500)));

    expect(calls > afterFirst).toBe(shouldPoll);
  });

  it.each(pollingCases)('polls the scores of a %s experiment: %s', async (experimentStatus, shouldPoll) => {
    let calls = 0;
    server.use(
      http.get(SCORES_URL, () => {
        calls += 1;
        return HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } });
      }),
    );

    const { result } = renderHook(() => useScoresByExperimentId(EXPERIMENT_ID, experimentStatus), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const afterFirst = calls;

    await act(async () => new Promise(resolve => setTimeout(resolve, 2500)));

    expect(calls > afterFirst).toBe(shouldPoll);
  });
});

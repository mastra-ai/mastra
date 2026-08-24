import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useDatasetMutations } from '../use-dataset-mutations';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const DATASET_ID = 'ds-1';
const ITEM_ID = 'item-1';
const EXPERIMENT_ID = 'exp-1';
const DATASETS_URL = `${BASE_URL}/api/datasets`;

type Seen = { method: string; path: string; body: unknown };

/**
 * Records what reached the server. Every dataset write goes through
 * `/api/datasets/...`, so one wildcard handler covers the whole hook.
 */
const captureWrites = () => {
  const seen: Seen[] = [];
  const record = async ({ request }: { request: Request }) => {
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      body = undefined;
    }
    seen.push({ method: request.method, path: new URL(request.url).pathname, body });
    return HttpResponse.json({ id: 'ok' });
  };

  server.use(
    http.post(`${DATASETS_URL}/*`, record),
    http.patch(`${DATASETS_URL}/*`, record),
    http.delete(`${DATASETS_URL}/*`, record),
    http.post(DATASETS_URL, record),
    http.patch(DATASETS_URL, record),
    http.delete(DATASETS_URL, record),
  );
  return seen;
};

/**
 * Query keys the hook is expected to touch. They are seeded as inactive
 * entries: with no observer, an invalidated query stays marked rather than
 * refetching and clearing the flag, so the assertion is deterministic.
 */
const SEEDED_KEYS: readonly unknown[][] = [
  ['datasets'],
  ['dataset', DATASET_ID],
  ['dataset', 'ds-other'],
  ['dataset-items', DATASET_ID],
  ['dataset-items', 'ds-other'],
  ['dataset-item', DATASET_ID, ITEM_ID],
  ['dataset-item-versions', DATASET_ID, ITEM_ID],
  ['dataset-versions', DATASET_ID],
  ['dataset-experiments', DATASET_ID],
  ['dataset-experiments', 'ds-other'],
  ['experiment-results', EXPERIMENT_ID],
  ['dataset-experiment-results'],
  ['review-items'],
  ['dataset-review-items'],
  ['dataset-completed-items'],
  ['experiment-review-summary'],
];

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of SEEDED_KEYS) queryClient.setQueryData(key, { seeded: true });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  const { result } = renderHook(() => useDatasetMutations(), { wrapper });
  return { result, queryClient };
};

/** The seeded keys that ended up marked stale, as readable strings. */
const invalidated = (queryClient: QueryClient) =>
  SEEDED_KEYS.filter(key => queryClient.getQueryState(key)?.isInvalidated)
    .map(key => key.join('/'))
    .sort();

afterEach(() => cleanup());

describe('useDatasetMutations, the requests it sends', () => {
  it('creates a dataset', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.createDataset.mutateAsync({ name: 'New', description: 'd' });
    });

    expect(seen).toEqual([{ method: 'POST', path: '/api/datasets', body: { name: 'New', description: 'd' } }]);
  });

  it('updates a dataset', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.updateDataset.mutateAsync({ datasetId: DATASET_ID, name: 'Renamed' });
    });

    expect(seen[0]).toMatchObject({ method: 'PATCH', path: `/api/datasets/${DATASET_ID}` });
  });

  it('deletes a dataset', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.deleteDataset.mutateAsync(DATASET_ID);
    });

    expect(seen[0]).toMatchObject({ method: 'DELETE', path: `/api/datasets/${DATASET_ID}` });
  });

  it('adds an item', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.addItem.mutateAsync({ datasetId: DATASET_ID, input: { q: 'hi' } });
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/datasets/${DATASET_ID}/items` });
  });

  it('updates an item', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.updateItem.mutateAsync({ datasetId: DATASET_ID, itemId: ITEM_ID, input: { q: 'hi' } });
    });

    expect(seen[0]).toMatchObject({ method: 'PATCH', path: `/api/datasets/${DATASET_ID}/items/${ITEM_ID}` });
  });

  it('deletes an item', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.deleteItem.mutateAsync({ datasetId: DATASET_ID, itemId: ITEM_ID });
    });

    expect(seen[0]).toMatchObject({ method: 'DELETE', path: `/api/datasets/${DATASET_ID}/items/${ITEM_ID}` });
  });

  it('inserts a batch of items through the batch endpoint', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.batchInsertItems.mutateAsync({ datasetId: DATASET_ID, items: [{ input: { q: 'hi' } }] });
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/datasets/${DATASET_ID}/items/batch` });
  });

  it('deletes a batch of items through the batch endpoint', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.batchDeleteItems.mutateAsync({ datasetId: DATASET_ID, itemIds: [ITEM_ID] });
    });

    expect(seen[0]).toMatchObject({ method: 'DELETE', path: `/api/datasets/${DATASET_ID}/items/batch` });
  });

  it('routes the deprecated deleteItems through the same batch endpoint', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.deleteItems.mutateAsync({ datasetId: DATASET_ID, itemIds: [ITEM_ID, 'item-2'] });
    });

    expect(seen[0]).toMatchObject({
      method: 'DELETE',
      path: `/api/datasets/${DATASET_ID}/items/batch`,
      body: { itemIds: [ITEM_ID, 'item-2'] },
    });
  });

  it('generates items', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.generateItems.mutateAsync({ datasetId: DATASET_ID, count: 3 } as never);
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/datasets/${DATASET_ID}/generate-items` });
  });

  it('triggers an experiment', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.triggerExperiment.mutateAsync({
        datasetId: DATASET_ID,
        targetType: 'agent',
        targetId: 'agent-1',
      } as never);
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/datasets/${DATASET_ID}/experiments` });
  });

  it('updates an experiment result, sending only the editable fields', async () => {
    const seen = captureWrites();
    const { result } = setup();

    await act(async () => {
      await result.current.updateExperimentResult.mutateAsync({
        datasetId: DATASET_ID,
        experimentId: EXPERIMENT_ID,
        resultId: 'res-1',
        status: 'complete',
        comment: 'Looks right',
      } as never);
    });

    expect(seen[0]).toEqual({
      method: 'PATCH',
      path: `/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results/res-1`,
      body: { status: 'complete', comment: 'Looks right' },
    });
  });
});

describe('useDatasetMutations, the caches it refreshes', () => {
  it('refreshes the dataset list after a create', async () => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.createDataset.mutateAsync({ name: 'New' } as never);
    });

    expect(invalidated(queryClient)).toEqual(['datasets']);
  });

  it('refreshes the list and the edited dataset after an update', async () => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.updateDataset.mutateAsync({ datasetId: DATASET_ID, name: 'Renamed' });
    });

    expect(invalidated(queryClient)).toEqual([`dataset/${DATASET_ID}`, 'datasets']);
  });

  it('refreshes only the dataset list after a delete', async () => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.deleteDataset.mutateAsync(DATASET_ID);
    });

    expect(invalidated(queryClient)).toEqual(['datasets']);
  });

  it.each([
    [
      'adding an item',
      (m: ReturnType<typeof useDatasetMutations>) =>
        m.addItem.mutateAsync({ datasetId: DATASET_ID, input: {} } as never),
    ],
    [
      'deleting an item',
      (m: ReturnType<typeof useDatasetMutations>) =>
        m.deleteItem.mutateAsync({ datasetId: DATASET_ID, itemId: ITEM_ID }),
    ],
  ])('refreshes the item list and the dataset after %s', async (_label, run) => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await run(result.current);
    });

    expect(invalidated(queryClient)).toEqual([`dataset-items/${DATASET_ID}`, `dataset/${DATASET_ID}`]);
  });

  it('refreshes the item, its history and the dataset versions after an item update', async () => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.updateItem.mutateAsync({ datasetId: DATASET_ID, itemId: ITEM_ID, input: {} } as never);
    });

    expect(invalidated(queryClient)).toEqual([
      `dataset-item-versions/${DATASET_ID}/${ITEM_ID}`,
      `dataset-item/${DATASET_ID}/${ITEM_ID}`,
      `dataset-items/${DATASET_ID}`,
      `dataset-versions/${DATASET_ID}`,
    ]);
  });

  it.each([
    [
      'a batch insert',
      (m: ReturnType<typeof useDatasetMutations>) =>
        m.batchInsertItems.mutateAsync({ datasetId: DATASET_ID, items: [] } as never),
    ],
    [
      'a batch delete',
      (m: ReturnType<typeof useDatasetMutations>) =>
        m.batchDeleteItems.mutateAsync({ datasetId: DATASET_ID, itemIds: [] } as never),
    ],
    [
      'the deprecated deleteItems',
      (m: ReturnType<typeof useDatasetMutations>) => m.deleteItems.mutateAsync({ datasetId: DATASET_ID, itemIds: [] }),
    ],
  ])('refreshes the items, the dataset and its versions after %s', async (_label, run) => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await run(result.current);
    });

    expect(invalidated(queryClient)).toEqual([
      `dataset-items/${DATASET_ID}`,
      `dataset-versions/${DATASET_ID}`,
      `dataset/${DATASET_ID}`,
    ]);
  });

  it('refreshes nothing after generating items, since they are not committed yet', async () => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.generateItems.mutateAsync({ datasetId: DATASET_ID, count: 1 } as never);
    });

    expect(invalidated(queryClient)).toEqual([]);
  });

  it('refreshes the experiment list of the dataset it was triggered on', async () => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.triggerExperiment.mutateAsync({ datasetId: DATASET_ID, targetId: 'a' } as never);
    });

    expect(invalidated(queryClient)).toEqual([`dataset-experiments/${DATASET_ID}`]);
  });

  it('refreshes every review surface after an experiment result is edited', async () => {
    captureWrites();
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.updateExperimentResult.mutateAsync({
        datasetId: DATASET_ID,
        experimentId: EXPERIMENT_ID,
        resultId: 'res-1',
        status: 'complete',
      } as never);
    });

    expect(invalidated(queryClient)).toEqual([
      'dataset-completed-items',
      'dataset-experiment-results',
      'dataset-review-items',
      `experiment-results/${EXPERIMENT_ID}`,
      'experiment-review-summary',
      'review-items',
    ]);
  });

  it('leaves every cache alone when the write fails', async () => {
    server.use(http.post(DATASETS_URL, () => new HttpResponse(null, { status: 500 })));
    const { result, queryClient } = setup();

    await act(async () => {
      await result.current.createDataset.mutateAsync({ name: 'New' } as never).catch(() => {});
    });

    expect(invalidated(queryClient)).toEqual([]);
  });
});

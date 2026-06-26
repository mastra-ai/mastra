import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDatasetMutations } from '../use-dataset-mutations';
import { datasetItemWithRequestContext, triggerExperimentResponse } from './fixtures/dataset-request-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDatasetMutations request context wiring', () => {
  it('sends run-level requestContext when triggering an experiment', async () => {
    const capture = vi.fn();
    server.use(
      http.post(`${BASE_URL}/api/datasets/dataset-1/experiments`, async ({ request }) => {
        capture(await request.json());
        return HttpResponse.json(triggerExperimentResponse);
      }),
    );

    const { result } = renderHook(() => useDatasetMutations(), { wrapper });

    await result.current.triggerExperiment.mutateAsync({
      datasetId: 'dataset-1',
      targetType: 'agent',
      targetId: 'agent-1',
      requestContext: { clinicId: 'clinic-123' },
    });

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0]).toMatchObject({
      targetType: 'agent',
      targetId: 'agent-1',
      requestContext: { clinicId: 'clinic-123' },
    });
  });

  it('sends per-item requestContext when adding an item', async () => {
    const capture = vi.fn();
    server.use(
      http.post(`${BASE_URL}/api/datasets/dataset-1/items`, async ({ request }) => {
        capture(await request.json());
        return HttpResponse.json(datasetItemWithRequestContext);
      }),
    );

    const { result } = renderHook(() => useDatasetMutations(), { wrapper });

    await result.current.addItem.mutateAsync({
      datasetId: 'dataset-1',
      input: { question: 'hi' },
      requestContext: { clinicId: 'clinic-123' },
    });

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0]).toMatchObject({
      input: { question: 'hi' },
      requestContext: { clinicId: 'clinic-123' },
    });
  });

  it('sends per-item requestContext when updating an item', async () => {
    const capture = vi.fn();
    server.use(
      http.patch(`${BASE_URL}/api/datasets/dataset-1/items/item-1`, async ({ request }) => {
        capture(await request.json());
        return HttpResponse.json(datasetItemWithRequestContext);
      }),
    );

    const { result } = renderHook(() => useDatasetMutations(), { wrapper });

    await result.current.updateItem.mutateAsync({
      datasetId: 'dataset-1',
      itemId: 'item-1',
      requestContext: { clinicId: 'clinic-456' },
    });

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0]).toMatchObject({
      requestContext: { clinicId: 'clinic-456' },
    });
  });
});

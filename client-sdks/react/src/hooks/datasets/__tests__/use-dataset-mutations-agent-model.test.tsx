// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';

import { server } from '../../../test/msw-server';
import { useDatasetMutations } from '../use-dataset-mutations';
import { triggerExperimentResponse } from './fixtures/dataset-request-context';

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

describe('useDatasetMutations triggerExperiment agentModel', () => {
  describe('when an agent experiment is triggered with an agentModel override', () => {
    it('sends the agentModel to the experiments endpoint', async () => {
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
        agentModel: { provider: 'openai', modelId: 'gpt-5-mini' },
      });

      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      expect(capture.mock.calls[0][0]).toMatchObject({
        targetType: 'agent',
        targetId: 'agent-1',
        agentModel: { provider: 'openai', modelId: 'gpt-5-mini' },
      });
    });
  });
});

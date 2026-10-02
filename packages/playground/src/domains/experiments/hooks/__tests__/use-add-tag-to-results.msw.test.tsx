// @vitest-environment jsdom
import type { DatasetExperimentResult } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAddTagToResults } from '../use-add-tag-to-results';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const DATASET_ID = 'ds-1';
const EXPERIMENT_ID = 'exp-1';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const makeResult = (id: string, tags: string[] | null): DatasetExperimentResult => ({
  id,
  experimentId: EXPERIMENT_ID,
  itemId: `item-${id}`,
  input: {},
  output: {},
  groundTruth: null,
  scores: {},
  error: null,
  status: null,
  tags,
  comment: null,
  traceId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

afterEach(() => cleanup());

describe('useAddTagToResults', () => {
  const patches: Array<{ resultId: string; body: unknown }> = [];

  const setupPatchHandler = (failFor?: string) => {
    patches.length = 0;
    server.use(
      http.patch(
        `${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results/:resultId`,
        async ({ params, request }) => {
          const resultId = String(params.resultId);
          const body = await request.json();
          patches.push({ resultId, body });
          if (resultId === failFor) return HttpResponse.json({ error: 'boom' }, { status: 500 });
          return HttpResponse.json({ ...makeResult(resultId, (body as { tags: string[] }).tags) });
        },
      ),
    );
  };

  const renderTagHook = () =>
    renderHook(() => useAddTagToResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }), {
      wrapper: makeWrapper(),
    });

  describe('given selected results with mixed existing tags', () => {
    it('merges the tag into each result that does not already have it', async () => {
      setupPatchHandler();
      const { result } = renderTagHook();

      await act(async () => {
        await result.current.addTag('beta', [
          makeResult('res-1', ['alpha']),
          makeResult('res-2', null),
          makeResult('res-3', ['beta']),
        ]);
      });

      expect(patches).toEqual([
        { resultId: 'res-1', body: { tags: ['alpha', 'beta'] } },
        { resultId: 'res-2', body: { tags: ['beta'] } },
      ]);
      expect(result.current.isPending).toBe(false);
    });
  });

  describe('given several results to tag', () => {
    it('sends every update concurrently instead of one after the other', async () => {
      patches.length = 0;
      let inFlight = 0;
      let maxInFlight = 0;
      server.use(
        http.patch(
          `${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results/:resultId`,
          async ({ params, request }) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            const body = (await request.json()) as { tags: string[] };
            // Hold the response so overlapping requests can be observed.
            await new Promise(resolve => setTimeout(resolve, 20));
            inFlight--;
            return HttpResponse.json({ ...makeResult(String(params.resultId), body.tags) });
          },
        ),
      );
      const { result } = renderTagHook();

      await act(async () => {
        await result.current.addTag('beta', [
          makeResult('res-1', null),
          makeResult('res-2', null),
          makeResult('res-3', null),
        ]);
      });

      expect(maxInFlight).toBe(3);
    });
  });

  describe('given one of the updates fails', () => {
    it('still applies the tag to the other results and resets isPending', async () => {
      setupPatchHandler('res-1');
      const { result } = renderTagHook();

      await act(async () => {
        await result.current.addTag('beta', [makeResult('res-1', null), makeResult('res-2', null)]);
      });

      // The client retries failed requests, so only assert which results were targeted.
      expect([...new Set(patches.map(p => p.resultId))]).toEqual(['res-1', 'res-2']);
      await waitFor(() => expect(result.current.isPending).toBe(false));
    });
  });

  describe('given every selected result already has the tag', () => {
    it('does not send any request', async () => {
      setupPatchHandler();
      const { result } = renderTagHook();

      await act(async () => {
        await result.current.addTag('beta', [makeResult('res-1', ['beta']), makeResult('res-2', ['x', 'beta'])]);
      });

      expect(patches).toEqual([]);
    });
  });
});

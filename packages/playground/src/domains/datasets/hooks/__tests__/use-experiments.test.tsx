import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useExperiments } from '../use-experiments';
import { makeDatasetExperiment, makeExperimentsPage } from './fixtures/experiments';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const EXPERIMENTS_URL = `${BASE_URL}/api/experiments`;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useExperiments', () => {
  describe('when the server returns a page of experiments', () => {
    it('exposes the experiments', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () =>
          HttpResponse.json(makeExperimentsPage([makeDatasetExperiment({ id: 'exp-42', name: 'Nightly run' })])),
        ),
      );

      const { result } = renderHook(() => useExperiments(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.experiments.map(e => e.id)).toEqual(['exp-42']);
      expect(result.current.data?.experiments[0]?.name).toBe('Nightly run');
    });

    it('exposes the pagination envelope', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, () =>
          HttpResponse.json(
            makeExperimentsPage([makeDatasetExperiment()], { total: 12, page: 2, perPage: 5, hasMore: true }),
          ),
        ),
      );

      const { result } = renderHook(() => useExperiments({ page: 2, perPage: 5 }), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.pagination).toEqual({ total: 12, page: 2, perPage: 5, hasMore: true });
    });
  });

  describe('when pagination is supplied', () => {
    it('forwards page and perPage to the server', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(EXPERIMENTS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(makeExperimentsPage([]));
        }),
      );

      const { result } = renderHook(() => useExperiments({ page: 3, perPage: 25 }), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(receivedUrl?.searchParams.get('page')).toBe('3');
      expect(receivedUrl?.searchParams.get('perPage')).toBe('25');
    });
  });

  describe('when no pagination is supplied', () => {
    it('asks for the unpaginated list', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(EXPERIMENTS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(makeExperimentsPage([]));
        }),
      );

      const { result } = renderHook(() => useExperiments(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(receivedUrl?.searchParams.get('page')).toBeNull();
      expect(receivedUrl?.searchParams.get('perPage')).toBeNull();
    });
  });

  describe('when two pages are read through the same cache', () => {
    it('keeps each page in its own cache entry', async () => {
      server.use(
        http.get(EXPERIMENTS_URL, ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          return HttpResponse.json(makeExperimentsPage([makeDatasetExperiment({ id: `exp-page-${page}` })]));
        }),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useExperiments({ page: 1 }), { wrapper });
      await waitFor(() => expect(first.result.current.data?.experiments[0]?.id).toBe('exp-page-1'));

      const second = renderHook(() => useExperiments({ page: 2 }), { wrapper });
      await waitFor(() => expect(second.result.current.data?.experiments[0]?.id).toBe('exp-page-2'));

      expect(first.result.current.data?.experiments[0]?.id).toBe('exp-page-1');
    });
  });
});

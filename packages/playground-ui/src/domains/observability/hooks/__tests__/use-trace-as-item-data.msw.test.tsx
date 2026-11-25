// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trajectoryWithToolCalls } from '../../components/__tests__/fixtures/add-trace-mocks';
import { createTraceDetails } from '../../components/__tests__/fixtures/trace-as-item';
import { useTraceAsItemData } from '../use-trace-as-item-data';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SPAN_URL = `${BASE_URL}/api/observability/traces/trace-1/spans/span-1`;
const TRAJECTORY_URL = `${BASE_URL}/api/observability/traces/trace-1/trajectory`;

function Wrapper({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

function setupHandlers({ trajectoryArrives }: { trajectoryArrives?: Promise<void> } = {}) {
  const requested = vi.fn<(url: string) => void>();
  server.use(
    http.get(SPAN_URL, ({ request }) => {
      requested(request.url);
      return HttpResponse.json({ span: createTraceDetails({ city: 'Seattle' }, { answer: 'rainy' }) });
    }),
    http.get(TRAJECTORY_URL, async ({ request }) => {
      requested(request.url);
      await trajectoryArrives;
      return HttpResponse.json(trajectoryWithToolCalls);
    }),
  );
  return { requested };
}

afterEach(() => cleanup());

describe('useTraceAsItemData', () => {
  describe('when enabled', () => {
    it('loads the root span and the trajectory of the trace', async () => {
      setupHandlers();

      const { result } = renderHook(() => useTraceAsItemData({ traceId: 'trace-1', rootSpanId: 'span-1' }), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect({
        input: result.current.rootSpan?.input,
        output: result.current.rootSpan?.output,
        steps: result.current.trajectory?.steps,
      }).toEqual({ input: { city: 'Seattle' }, output: { answer: 'rainy' }, steps: trajectoryWithToolCalls.steps });
    });
  });

  describe('when the root span has arrived but the trajectory has not', () => {
    it('is still loading', async () => {
      let arrive = () => {};
      const trajectoryArrives = new Promise<void>(resolve => {
        arrive = resolve;
      });
      setupHandlers({ trajectoryArrives });

      const { result } = renderHook(() => useTraceAsItemData({ traceId: 'trace-1', rootSpanId: 'span-1' }), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.rootSpan).toBeDefined());
      expect(result.current.isLoading).toBe(true);

      arrive();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  describe('when disabled', () => {
    it('requests nothing and is not loading', async () => {
      const { requested } = setupHandlers();

      const { result } = renderHook(
        () => useTraceAsItemData({ traceId: 'trace-1', rootSpanId: 'span-1', enabled: false }),
        { wrapper: Wrapper },
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      expect({ requested: requested.mock.calls.length, isLoading: result.current.isLoading }).toEqual({
        requested: 0,
        isLoading: false,
      });
    });
  });
});

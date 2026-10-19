// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import { MastraClientError } from '@mastra/client-js';
import { traceAggregateRequestSchema } from '@mastra/core/storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useTraceAggregate } from '../use-trace-aggregate';
import { groupedByEntityNameRequest, groupedByEntityNameResponse } from './fixtures/trace-aggregate';

const BASE_URL = 'http://localhost:4111';
const AGGREGATE_URL = `${BASE_URL}/api/observability/traces/aggregate`;

function makeWrapper() {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => cleanup());

describe('useTraceAggregate', () => {
  describe('when enabled', () => {
    it('posts the request unchanged and returns the grouped rows', async () => {
      const bodies: unknown[] = [];
      server.use(
        http.post(AGGREGATE_URL, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(groupedByEntityNameResponse);
        }),
      );

      const { result } = renderHook(() => useTraceAggregate({ request: groupedByEntityNameRequest }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data).toEqual(groupedByEntityNameResponse));
      expect(bodies).toEqual([groupedByEntityNameRequest]);
      expect(traceAggregateRequestSchema.safeParse(bodies[0]).success).toBe(true);
    });
  });

  describe('when disabled', () => {
    it('sends nothing while disabled', () => {
      let requests = 0;
      server.use(
        http.post(AGGREGATE_URL, () => {
          requests++;
          return HttpResponse.json(groupedByEntityNameResponse);
        }),
      );

      const { result } = renderHook(() => useTraceAggregate({ request: groupedByEntityNameRequest, enabled: false }), {
        wrapper: makeWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(requests).toBe(0);
    });
  });

  describe('when the server rejects the request', () => {
    it('fails once on a rejected request and keeps the status for the page to explain', async () => {
      let requests = 0;
      server.use(
        http.post(AGGREGATE_URL, () => {
          requests++;
          return HttpResponse.json(
            { type: 'query_too_expensive', title: 'Query too expensive', status: 422 },
            { status: 422 },
          );
        }),
      );

      const { result } = renderHook(() => useTraceAggregate({ request: groupedByEntityNameRequest }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(MastraClientError);
      expect(result.current.error instanceof MastraClientError && result.current.error.status).toBe(422);
      expect(requests).toBe(1);
    });
  });
});

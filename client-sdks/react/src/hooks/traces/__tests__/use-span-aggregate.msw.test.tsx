// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import { MastraClientError } from '@mastra/client-js';
import { spanAggregateRequestSchema } from '@mastra/core/storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useSpanAggregate } from '../use-span-aggregate';
import { agentRunsByEntityNameRequest, agentRunsByEntityNameResponse } from './fixtures/span-aggregate';

const BASE_URL = 'http://localhost:4111';
const AGGREGATE_URL = `${BASE_URL}/api/observability/spans/aggregate`;

function makeWrapper() {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => cleanup());

describe('useSpanAggregate', () => {
  describe('when enabled', () => {
    it('posts the request unchanged and returns the grouped rows', async () => {
      const bodies: unknown[] = [];
      server.use(
        http.post(AGGREGATE_URL, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(agentRunsByEntityNameResponse);
        }),
      );

      const { result } = renderHook(() => useSpanAggregate({ request: agentRunsByEntityNameRequest }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data).toEqual(agentRunsByEntityNameResponse));
      expect(bodies).toEqual([agentRunsByEntityNameRequest]);
      expect(spanAggregateRequestSchema.safeParse(bodies[0]).success).toBe(true);
    });
  });

  describe('when disabled', () => {
    it('sends nothing while disabled', () => {
      let requests = 0;
      server.use(
        http.post(AGGREGATE_URL, () => {
          requests++;
          return HttpResponse.json(agentRunsByEntityNameResponse);
        }),
      );

      const { result } = renderHook(() => useSpanAggregate({ request: agentRunsByEntityNameRequest, enabled: false }), {
        wrapper: makeWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(requests).toBe(0);
    });
  });

  describe('when the server rejects the request', () => {
    it('fails once on a rejected request and keeps the status', async () => {
      let requests = 0;
      server.use(
        http.post(AGGREGATE_URL, () => {
          requests++;
          return HttpResponse.json(
            { type: 'time_range_too_large', title: 'Time range too large', status: 422 },
            { status: 422 },
          );
        }),
      );

      const { result } = renderHook(() => useSpanAggregate({ request: agentRunsByEntityNameRequest }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error instanceof MastraClientError && result.current.error.status).toBe(422);
      expect(requests).toBe(1);
    });
  });
});

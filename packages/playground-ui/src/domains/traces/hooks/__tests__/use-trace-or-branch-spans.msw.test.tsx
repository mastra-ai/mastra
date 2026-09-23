// @vitest-environment jsdom

import { SpanType } from '@mastra/core/observability';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../../../test/msw-server';
import { useTraceOrBranchSpans } from '../use-trace-or-branch-spans';

const BASE_URL = 'http://localhost:4111';
const TRACE_ID = 'trace-alpha';
const FULL_URL = `${BASE_URL}/api/observability/traces/${TRACE_ID}`;
const LIGHT_URL = `${FULL_URL}/light`;

const timestamp = new Date('2026-06-10T00:00:00.000Z');

/** A span as `getTrace` serves it: the heavy payload fields are present. */
const fullSpan = {
  traceId: TRACE_ID,
  spanId: 'span-alpha',
  parentSpanId: null,
  name: 'weather agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: timestamp,
  endedAt: timestamp,
  input: { messages: [{ role: 'system', content: 'You are a weather assistant.' }] },
  output: { text: 'It is raining in Lyon.' },
  attributes: { model: 'gpt-4o-mini' },
  createdAt: timestamp,
  updatedAt: timestamp,
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(queryClient);
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

const renderTraceSpans = () =>
  renderHook(() => useTraceOrBranchSpans({ traceId: TRACE_ID, listMode: 'traces' }), { wrapper: makeWrapper() });

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach(queryClient => queryClient.clear());
});

describe('useTraceOrBranchSpans in traces mode', () => {
  it('reads the opened trace from the full-trace endpoint, not the light one', async () => {
    const requested: string[] = [];
    server.use(
      http.get(FULL_URL, () => {
        requested.push('full');
        return HttpResponse.json({ traceId: TRACE_ID, spans: [fullSpan] });
      }),
      http.get(LIGHT_URL, () => {
        requested.push('light');
        return HttpResponse.json({ traceId: TRACE_ID, spans: [fullSpan] });
      }),
    );

    const { result, unmount } = renderTraceSpans();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requested).toEqual(['full']);
    unmount();
  });

  it('makes the payload fields the light projection drops searchable', async () => {
    server.use(http.get(FULL_URL, () => HttpResponse.json({ traceId: TRACE_ID, spans: [fullSpan] })));

    const { result, unmount } = renderTraceSpans();
    await waitFor(() => expect(result.current.spans).toBeDefined());

    const searchText = result.current.spans?.[0]?.searchText ?? '';
    expect(searchText).toContain('you are a weather assistant');
    expect(searchText).toContain('it is raining in lyon');
    expect(searchText).toContain('gpt-4o-mini');
    unmount();
  });
});

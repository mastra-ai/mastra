import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useThreadTraces } from '../use-thread-traces';
import { traceListWithTwoTraces } from '@/pages/traces/__tests__/fixtures/traces';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const onTracesRequest = vi.fn<(url: URL) => void>();

const listTraces = (body: unknown) => {
  const handler = ({ request }: { request: Request }) => {
    onTracesRequest(new URL(request.url));
    return HttpResponse.json(body);
  };
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces`, handler),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, handler),
  );
};

beforeEach(() => onTracesRequest.mockClear());

describe('useThreadTraces', () => {
  it('lists the thread traces oldest-first, reversing the list endpoint order', async () => {
    listTraces(traceListWithTwoTraces);

    const { result } = renderHookWithProviders(() => useThreadTraces('thread-1'));

    await waitFor(() => expect(result.current.traces).toHaveLength(2));
    expect(result.current.traces.map(t => t.traceId)).toEqual(['trace-b', 'trace-a']);
    expect(result.current.hasTraces).toBe(true);
    expect(onTracesRequest.mock.calls[0]![0].searchParams.get('threadId')).toBe('thread-1');
  });

  it('reports no traces for a thread that has none', async () => {
    listTraces({ spans: [], pagination: { total: 0, page: 0, perPage: 25, hasMore: false } });

    const { result } = renderHookWithProviders(() => useThreadTraces('thread-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasTraces).toBe(false);
  });
});

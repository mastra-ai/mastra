// @vitest-environment jsdom
import { cleanup, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { traceASpans, traceBSpans } from '../../components/__tests__/fixtures/thread-traces';
import { useThreadRailTurns } from '../use-thread-rail-turns';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const TRACE_URL = `${TEST_BASE_URL}/api/observability/traces/:traceId`;

afterEach(() => cleanup());

describe('useThreadRailTurns', () => {
  it('summarises each trace into a rail stop keyed by its trace id, in input order', async () => {
    server.use(
      http.get(TRACE_URL, ({ params }) => HttpResponse.json(params.traceId === 'trace-b' ? traceBSpans : traceASpans)),
    );

    const { result } = renderHookWithProviders(() => useThreadRailTurns(['trace-a', 'trace-b']));

    await waitFor(() => expect(result.current[0]?.prompt).toBe('cook pasta'));
    expect(result.current.map(turn => turn.key)).toEqual(['trace-a', 'trace-b']);
    expect(result.current[0]?.messageId).toBe('trace-a');
  });

  it('falls back to a generic "Agent turn" stop while loading or when a trace has no messages', async () => {
    server.use(
      http.get(TRACE_URL, ({ params }) =>
        HttpResponse.json(params.traceId === 'trace-b' ? { traceId: 'trace-b', spans: [] } : traceASpans),
      ),
    );

    const { result } = renderHookWithProviders(() => useThreadRailTurns(['trace-a', 'trace-b']));

    expect(result.current.map(turn => turn.prompt)).toEqual(['Agent turn', 'Agent turn']);

    await waitFor(() => expect(result.current[0]?.prompt).toBe('cook pasta'));
    // trace-b reconstructs no message, so it keeps the fallback stop.
    expect(result.current[1]).toMatchObject({ key: 'trace-b', messageId: 'trace-b', prompt: 'Agent turn' });
  });

  it('reuses the trace-spans cache instead of refetching a trace that is already loaded', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(TRACE_URL, ({ params }) => {
        onRequest(params.traceId);
        return HttpResponse.json(traceASpans);
      }),
    );

    const { result, queryClient } = renderHookWithProviders(() => useThreadRailTurns(['trace-a']));
    await waitFor(() => expect(result.current[0]?.prompt).toBe('cook pasta'));

    expect(queryClient.getQueryData(['trace-spans', 'trace-a'])).toBeDefined();
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});

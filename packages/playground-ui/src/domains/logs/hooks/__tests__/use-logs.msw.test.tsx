// @vitest-environment jsdom
import type { ListLogsResponse } from '@mastra/core/storage';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useLogs } from '../use-logs';

const BASE_URL = 'http://localhost:4111';
const LOGS_URL = `${BASE_URL}/api/observability/logs`;
const server = setupServer();

type LogRecord = NonNullable<ListLogsResponse['logs']>[number];

const log = (overrides: Partial<LogRecord> = {}): LogRecord =>
  ({
    logId: 'log-1',
    timestamp: '2026-06-01T10:00:00.000Z',
    level: 'info',
    message: 'a log line',
    ...overrides,
  }) as LogRecord;

const page = (logs: LogRecord[], hasMore: boolean): ListLogsResponse =>
  ({ logs, pagination: { page: 0, perPage: 20, total: logs.length, hasMore } }) as ListLogsResponse;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('useLogs', () => {
  it('requests the newest page first, twenty at a time', async () => {
    const urls: string[] = [];
    server.use(
      http.get(LOGS_URL, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(page([log()], false));
      }),
    );

    const { result } = renderHook(() => useLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const params = new URL(urls[0] ?? '').searchParams;
    expect(params.get('page')).toBe('0');
    expect(params.get('perPage')).toBe('20');
    expect(params.get('field')).toBe('timestamp');
    expect(params.get('direction')).toBe('DESC');
  });

  it('forwards the caller filters', async () => {
    const urls: string[] = [];
    server.use(
      http.get(LOGS_URL, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json(page([log()], false));
      }),
    );

    const { result } = renderHook(() => useLogs({ filters: { level: 'error' } }), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(new URL(urls[0] ?? '').searchParams.get('level')).toBe('error');
  });

  it('stops paginating once the server says there is no more', async () => {
    server.use(http.get(LOGS_URL, () => HttpResponse.json(page([log()], false))));

    const { result } = renderHook(() => useLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('advances one page at a time while the server says there is more', async () => {
    const pages: number[] = [];
    server.use(
      http.get(LOGS_URL, ({ request }) => {
        const requested = Number(new URL(request.url).searchParams.get('page'));
        pages.push(requested);
        return HttpResponse.json(page([log({ logId: `log-${requested}` })], requested < 2));
      }),
    );

    const { result } = renderHook(() => useLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));

    expect([...new Set(pages)]).toEqual([0, 1, 2]);
    expect(result.current.data?.map(entry => entry.logId)).toEqual(['log-0', 'log-1', 'log-2']);
  });

  it('drops a row the next page repeats', async () => {
    // Offset pagination repeats a row whenever a log is inserted between calls.
    server.use(
      http.get(LOGS_URL, ({ request }) => {
        const requested = Number(new URL(request.url).searchParams.get('page'));
        return requested === 0
          ? HttpResponse.json(page([log({ logId: 'a' }), log({ logId: 'b' })], true))
          : HttpResponse.json(page([log({ logId: 'b' }), log({ logId: 'c' })], false));
      }),
    );

    const { result } = renderHook(() => useLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.data?.map(entry => entry.logId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps rows that have no id but differ in their fields', async () => {
    server.use(
      http.get(LOGS_URL, () =>
        HttpResponse.json(
          page(
            [
              log({ logId: undefined, message: 'first' }),
              log({ logId: undefined, message: 'first' }),
              log({ logId: undefined, message: 'second' }),
            ],
            false,
          ),
        ),
      ),
    );

    const { result } = renderHook(() => useLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The identical pair collapses; the one that differs survives.
    expect(result.current.data?.map(entry => entry.message)).toEqual(['first', 'second']);
  });

  it('tolerates a page that carries no logs at all', async () => {
    server.use(http.get(LOGS_URL, () => HttpResponse.json({ pagination: { hasMore: false } })));

    const { result } = renderHook(() => useLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('surfaces a failed request', async () => {
    server.use(http.get(LOGS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

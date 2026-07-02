// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import type { TraceRecord } from '@mastra/core/storage';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDownloadTraceJson } from '../use-download-trace-json';

// jsdom's Blob exposes no `.text()`, and the global `Response` doesn't recognize it.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

// Keep the toast side effect out of the test, but still consume the promise so its
// rejection is handled and `isPending` can settle.
vi.mock('@/lib/toast', () => ({
  toast: { promise: ({ myPromise }: { myPromise: Promise<unknown> }) => myPromise.catch(() => {}) },
}));

const BASE_URL = 'http://localhost:4111';
const TRACE_ID = '566f00c7d2e2';
const server = setupServer();

// Minimal full-trace payload. The download serializes whatever `getTrace` returns, so the
// downloaded bytes must equal this fixture — including the heavy input/output fields that the
// lightweight panel spans omit.
const timestamp = new Date('2026-06-10T00:00:00.000Z');
const traceFixture = {
  traceId: TRACE_ID,
  spans: [
    {
      spanId: 'span-1',
      traceId: TRACE_ID,
      parentSpanId: null,
      name: 'agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt: timestamp,
      input: { prompt: 'hello' },
      output: { text: 'hi there' },
      metadata: { foo: 'bar' },
      attributes: { usage: { totalTokens: 42 } },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
} satisfies TraceRecord;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

let createObjectURL: ReturnType<typeof vi.spyOn>;
let clickedDownloadAttr: string | undefined;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  clickedDownloadAttr = undefined;
  createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clickedDownloadAttr = this.download;
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => server.close());

describe('useDownloadTraceJson', () => {
  it('fetches the full trace and downloads it as trace-<id>.json', async () => {
    server.use(http.get(`${BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(traceFixture)));

    const { result } = renderHook(() => useDownloadTraceJson(), { wrapper: makeWrapper() });

    act(() => result.current.download(TRACE_ID));
    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const firstCall = createObjectURL.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error('Expected createObjectURL call');
    const [blob] = firstCall as [Blob];
    await expect(readBlobText(blob)).resolves.toBe(JSON.stringify(traceFixture, null, 2));
    expect(clickedDownloadAttr).toBe(`trace-${TRACE_ID}.json`);
  });

  it('does not download when the trace fetch fails and resets the pending state', async () => {
    server.use(
      http.get(`${BASE_URL}/api/observability/traces/:traceId`, () => new HttpResponse(null, { status: 500 })),
    );

    const { result } = renderHook(() => useDownloadTraceJson(), { wrapper: makeWrapper() });

    act(() => result.current.download(TRACE_ID));

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

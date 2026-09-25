// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useObservabilityCapabilities } from '../use-observability-capabilities';
import { legacyTraceCapabilities, traceQueryCapabilities } from './fixtures/observability-capabilities';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const CAPABILITIES_URL = `${BASE_URL}/api/observability/capabilities`;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe('useObservabilityCapabilities', () => {
  describe('when the server supports trace query', () => {
    it('reports traceQuery as available', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(traceQueryCapabilities)));

      const { result } = renderHook(() => useObservabilityCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data?.capabilities.traceQuery).toBe(true));
    });
  });

  describe('when the server does not support trace query', () => {
    it('reports traceQuery as unavailable', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(legacyTraceCapabilities)));

      const { result } = renderHook(() => useObservabilityCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data?.capabilities.traceQuery).toBe(false));
    });
  });

  describe('when the endpoint fails', () => {
    it('exposes the error', async () => {
      server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));

      const { result } = renderHook(() => useObservabilityCapabilities(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.data).toBeUndefined();
    });
  });
});

// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceInvestigate } from '../trace-investigate';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

describe('TraceInvestigate', () => {
  it('loads the full trace for the given traceId and renders its spans', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/observability/traces/trace-a`, () => {
        onRequest();
        return HttpResponse.json({
          traceId: 'trace-a',
          spans: [
            { traceId: 'trace-a', spanId: 'span-a', name: 'Studio preview agent' },
            { traceId: 'trace-a', spanId: 'span-b', name: 'llm generation' },
          ],
        });
      }),
    );

    render(<TraceInvestigate traceId="trace-a" />, { wrapper });

    expect(await screen.findByText('Studio preview agent')).toBeTruthy();
    expect(screen.getByText('llm generation')).toBeTruthy();
    expect(onRequest).toHaveBeenCalled();
  });
});

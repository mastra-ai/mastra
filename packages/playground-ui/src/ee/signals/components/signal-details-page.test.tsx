// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SignalDetailsPage } from './signal-details-page';

const BASE_URL = 'http://localhost:4111';
const server = setupServer();

vi.mock('../../../ds/components/ScatterPlotChart', () => ({
  ScatterPlotChart: () => <div>Signal chart</div>,
}));

vi.mock('../../topics', () => ({
  TopicTraceDetailsPanel: () => null,
  TopicTraceSummaryList: () => <div>Trace summaries</div>,
  TopicsLayout: ({ children, tracePanel }: { children: ReactNode; tracePanel?: ReactNode }) => (
    <main>
      {children}
      {tracePanel}
    </main>
  ),
}));

function renderSignalDetailsPage(tracePanel: ReactNode = <aside aria-label="Trace details">Trace panel</aside>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <SignalDetailsPage signalId="tasks" selectedTraceId="trace-1" tracePanel={tracePanel} onTraceSelect={() => {}} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('SignalDetailsPage', () => {
  it('shows the trace panel only while the trace list tab is active', () => {
    server.use(
      http.get(`${BASE_URL}/api/observability/traces`, () =>
        HttpResponse.json({
          pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
          spans: [{ traceId: 'trace-1', spanId: 'span-1', name: 'Test trace' }],
        }),
      ),
    );

    renderSignalDetailsPage();

    expect(screen.getByRole('complementary', { name: 'Trace details' })).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Chart' }));

    expect(screen.queryByRole('complementary', { name: 'Trace details' })).toBeNull();
    expect(screen.getByText('Signal chart')).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Trace list' }));

    expect(screen.getByRole('complementary', { name: 'Trace details' })).not.toBeNull();
  });
});

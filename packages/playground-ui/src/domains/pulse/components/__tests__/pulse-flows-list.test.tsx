// @vitest-environment jsdom

import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/msw-server';
import { emptyFlowsPage, mixedFlowsPage } from '../../__tests__/fixtures/flows';
import { PulseFlowsList } from '../pulse-flows-list';
import type { PulseFlowsListProps } from '../pulse-flows-list';

const BASE_URL = 'http://localhost:4111';
const FLOWS_URL = `${BASE_URL}/api/pulse/flows`;

const queryClients: QueryClient[] = [];

function renderList(props: PulseFlowsListProps) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(queryClient);
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <PulseFlowsList {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => {
  cleanup();
  // A leaked 1s poller (mixedFlowsPage has a running flow) would land on the
  // next test's handlers, so drop the cached queries with the tree.
  queryClients.splice(0).forEach(queryClient => queryClient.clear());
});

describe('PulseFlowsList', () => {
  it('renders one row per flow with its status chip, cost, and entity', async () => {
    server.use(http.get(FLOWS_URL, () => HttpResponse.json(mixedFlowsPage)));

    renderList({ onSelectFlow: vi.fn() });

    expect(await screen.findByText('flow-running')).not.toBeNull();
    expect(screen.getByText('flow-completed')).not.toBeNull();
    expect(screen.getByText('flow-failed')).not.toBeNull();

    // Status chips carry the derived status as user-visible text.
    expect(screen.getByText('running')).not.toBeNull();
    expect(screen.getByText('completed')).not.toBeNull();
    expect(screen.getByText('failed')).not.toBeNull();

    // Cost only shows on the flow that has one; sub-cent values keep 4 decimals.
    expect(screen.getByText('$0.0042')).not.toBeNull();

    // The running flow has no duration yet.
    expect(screen.getByText('—')).not.toBeNull();
    expect(screen.getByText('2.50s')).not.toBeNull();

    expect(screen.getAllByText('weather-agent')).toHaveLength(2);
  });

  it('reports the clicked flow id through onSelectFlow', async () => {
    server.use(http.get(FLOWS_URL, () => HttpResponse.json(mixedFlowsPage)));
    const onSelectFlow = vi.fn<(flowId: string) => void>();

    renderList({ onSelectFlow });

    fireEvent.click(await screen.findByText('flow-completed'));

    expect(onSelectFlow).toHaveBeenCalledWith('flow-completed');
  });

  it('shows the empty state when the server has no flows', async () => {
    server.use(http.get(FLOWS_URL, () => HttpResponse.json(emptyFlowsPage)));

    renderList({ onSelectFlow: vi.fn() });

    expect(await screen.findByText('No flows yet')).not.toBeNull();
  });

  it('shows the unavailable state when the server answers 501', async () => {
    server.use(http.get(FLOWS_URL, () => new HttpResponse(null, { status: 501 })));

    renderList({ onSelectFlow: vi.fn() });

    expect(await screen.findByText('Pulse is not available')).not.toBeNull();
  });
});

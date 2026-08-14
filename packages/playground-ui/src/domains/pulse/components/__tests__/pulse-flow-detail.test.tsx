// @vitest-environment jsdom

import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/msw-server';
import {
  completedFlowDetail,
  completedFlowTimeline,
  emptyTimeline,
  missingFlowDetail,
  mixedFlowsPage,
} from '../../__tests__/fixtures/flows';
import { PulseFlowDetail } from '../pulse-flow-detail';
import { PulseFlowsList } from '../pulse-flows-list';

const BASE_URL = 'http://localhost:4111';
const FLOWS_URL = `${BASE_URL}/api/pulse/flows`;

const queryClients: QueryClient[] = [];

function withProviders(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(queryClient);
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach(queryClient => queryClient.clear());
});

/** Minimal page-shaped composition: the list drives which flow the detail shows. */
function ListWithDetail() {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  return (
    <>
      <PulseFlowsList selectedFlowId={selectedFlowId} onSelectFlow={setSelectedFlowId} />
      <PulseFlowDetail flowId={selectedFlowId} />
    </>
  );
}

describe('PulseFlowDetail', () => {
  it('renders the span tree, definitions, and summary for a settled flow', async () => {
    server.use(
      http.get(`${FLOWS_URL}/flow-completed`, () => HttpResponse.json(completedFlowDetail)),
      http.get(`${FLOWS_URL}/flow-completed/timeline`, () => HttpResponse.json(emptyTimeline)),
    );

    render(withProviders(<PulseFlowDetail flowId="flow-completed" />));

    const tree = within(await screen.findByTestId('pulse-flow-tree'));
    expect(tree.getByText('agent run')).not.toBeNull();
    expect(tree.getByText('llm call')).not.toBeNull();
    expect(tree.getByText('2.50s')).not.toBeNull();
    // The child errored and never closed — it gets the anomaly marker.
    expect(tree.getByLabelText('Span has error')).not.toBeNull();

    expect(screen.getByText('Definitions:')).not.toBeNull();
    expect(screen.getByText(/agent:weather-agent, tool:get-weather/)).not.toBeNull();
    expect(screen.getByText('completed')).not.toBeNull();
    expect(screen.getByText('$0.0042')).not.toBeNull();
  });

  it('renders the timeline with one colored lane badge per source', async () => {
    server.use(
      http.get(`${FLOWS_URL}/flow-completed`, () => HttpResponse.json(completedFlowDetail)),
      http.get(`${FLOWS_URL}/flow-completed/timeline`, () => HttpResponse.json(completedFlowTimeline)),
    );

    render(withProviders(<PulseFlowDetail flowId="flow-completed" />));

    const timeline = within(await screen.findByTestId('pulse-flow-timeline'));
    for (const source of ['span', 'session', 'runtime', 'metric', 'score', 'feedback']) {
      expect(timeline.getByText(source)).not.toBeNull();
    }
    expect(timeline.getByText('agent.run_started')).not.toBeNull();
    expect(timeline.getByText('thread.message_added')).not.toBeNull();
    expect(timeline.getByText('run-1')).not.toBeNull();
  });

  it('prompts for a selection when no flow id is set', () => {
    render(withProviders(<PulseFlowDetail flowId={null} />));

    expect(screen.getByText('Select a flow')).not.toBeNull();
  });

  it('shows the not-found state when the server returns flow: null', async () => {
    server.use(
      http.get(`${FLOWS_URL}/flow-gone`, () => HttpResponse.json(missingFlowDetail)),
      http.get(`${FLOWS_URL}/flow-gone/timeline`, () => HttpResponse.json(emptyTimeline)),
    );

    render(withProviders(<PulseFlowDetail flowId="flow-gone" />));

    expect(await screen.findByText('Flow not found')).not.toBeNull();
  });

  it('shows the unavailable state when the server answers 501', async () => {
    server.use(
      http.get(`${FLOWS_URL}/flow-completed`, () => new HttpResponse(null, { status: 501 })),
      http.get(`${FLOWS_URL}/flow-completed/timeline`, () => new HttpResponse(null, { status: 501 })),
    );

    render(withProviders(<PulseFlowDetail flowId="flow-completed" />));

    expect(await screen.findByText('Pulse is not available')).not.toBeNull();
  });

  it('loads the detail for the flow selected in the list', async () => {
    server.use(
      http.get(FLOWS_URL, () => HttpResponse.json(mixedFlowsPage)),
      http.get(`${FLOWS_URL}/flow-completed`, () => HttpResponse.json(completedFlowDetail)),
      http.get(`${FLOWS_URL}/flow-completed/timeline`, () => HttpResponse.json(completedFlowTimeline)),
    );

    render(withProviders(<ListWithDetail />));

    expect(screen.getByText('Select a flow')).not.toBeNull();

    fireEvent.click(await screen.findByText('flow-completed'));

    const tree = within(await screen.findByTestId('pulse-flow-tree'));
    expect(tree.getByText('agent run')).not.toBeNull();
    expect(screen.getByText(/agent:weather-agent, tool:get-weather/)).not.toBeNull();
  });
});

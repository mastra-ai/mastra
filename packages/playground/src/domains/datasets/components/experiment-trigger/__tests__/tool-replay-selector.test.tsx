// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEligibleReplaySources, ITEM_RECORDINGS_SOURCE, ToolReplaySelector } from '../tool-replay-selector';
import {
  completedWorkflowExperiment,
  junkMarkerExperiment,
  listExperimentsResponse,
  liveExperiment,
  replayExperiment,
  runningAgentExperiment,
} from '@/domains/experiments/__tests__/fixtures/tool-replay';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MastraReactProvider>,
  );
}

const baseProps = {
  datasetId: 'dataset-1',
  fromExperimentId: '',
  onFromExperimentIdChange: vi.fn(),
  onMiss: 'error' as const,
  onMissChange: vi.fn(),
};

describe('getEligibleReplaySources', () => {
  it('keeps only completed live agent experiments', () => {
    const eligible = getEligibleReplaySources([
      liveExperiment,
      replayExperiment, // replay-marked → excluded (its traces have no tool spans)
      runningAgentExperiment, // not completed → excluded
      completedWorkflowExperiment, // workflow target → excluded
      junkMarkerExperiment, // user junk under the key is NOT a replay marker → eligible
    ]);
    expect(eligible.map(exp => exp.id)).toEqual(['exp-live-1', 'exp-junk-marker']);
  });
});

describe('ToolReplaySelector', () => {
  afterEach(cleanup);

  it('shows the safe-default reassurance and keeps passthrough behind the Advanced disclosure', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
        HttpResponse.json(listExperimentsResponse([liveExperiment, replayExperiment])),
      ),
    );

    renderWithProviders(<ToolReplaySelector {...baseProps} enabled onEnabledChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Recording source')).toBeDefined());
    expect(screen.getByText(/the item stops safely — nothing real ever runs/)).toBeDefined();
    // The dangerous passthrough option is hidden until Advanced is opened.
    expect(screen.queryByText('Allow live execution for unrecorded calls (passthrough)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByText('Allow live execution for unrecorded calls (passthrough)')).toBeDefined();
  });

  it('warns about live execution when passthrough is selected', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
        HttpResponse.json(listExperimentsResponse([liveExperiment])),
      ),
    );

    renderWithProviders(<ToolReplaySelector {...baseProps} enabled onEnabledChange={vi.fn()} onMiss="passthrough" />);

    // Advanced auto-opens for an active passthrough, so the warning is immediately visible.
    await waitFor(() => expect(screen.getByText(/Unmatched calls will execute against real systems/)).toBeDefined());
    expect(screen.getByText('Allow live execution for unrecorded calls (passthrough)')).toBeDefined();
  });

  it('switches the helper text for the item-recordings source', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
        HttpResponse.json(listExperimentsResponse([replayExperiment, completedWorkflowExperiment])),
      ),
    );

    renderWithProviders(
      <ToolReplaySelector {...baseProps} enabled onEnabledChange={vi.fn()} fromExperimentId={ITEM_RECORDINGS_SOURCE} />,
    );

    await waitFor(() => expect(screen.getByText(/Each item replays the trace it was saved from/)).toBeDefined());
    // The picker itself stays available even with zero eligible experiments —
    // the item-recordings source is always offered.
    expect(screen.getByText('Recording source')).toBeDefined();
  });

  it('renders only the toggle row while disabled', () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
        HttpResponse.json(listExperimentsResponse([liveExperiment])),
      ),
    );

    renderWithProviders(<ToolReplaySelector {...baseProps} enabled={false} onEnabledChange={vi.fn()} />);

    expect(screen.getByText('Replay tools from a previous experiment')).toBeDefined();
    expect(screen.queryByText('Source experiment')).toBeNull();
  });
});

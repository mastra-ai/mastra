// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDatasetMutations } from '../../../hooks/use-dataset-mutations';
import {
  buildToolReplayPayload,
  getEligibleReplaySources,
  ITEM_RECORDINGS_SOURCE,
  ToolReplaySelector,
} from '../tool-replay-selector';
import {
  completedWorkflowExperiment,
  junkMarkerExperiment,
  listExperimentsResponse,
  liveExperiment,
  replayExperiment,
  runningAgentExperiment,
  triggerExperimentResponse,
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

function hookWrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

const baseProps = {
  datasetId: 'dataset-1',
  fromExperimentId: '',
  onFromExperimentIdChange: vi.fn(),
  onMiss: 'error' as const,
  onMissChange: vi.fn(),
  matching: 'fifo' as const,
  onMatchingChange: vi.fn(),
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
    expect(screen.queryByText('Strict args matching (exact tool arguments only)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByText('Allow live execution for unrecorded calls (passthrough)')).toBeDefined();
    expect(screen.getByText('Strict args matching (exact tool arguments only)')).toBeDefined();
  });

  it('toggles strict matching from the Advanced disclosure', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
        HttpResponse.json(listExperimentsResponse([liveExperiment])),
      ),
    );
    const onMatchingChange = vi.fn();

    renderWithProviders(
      <ToolReplaySelector {...baseProps} enabled onEnabledChange={vi.fn()} onMatchingChange={onMatchingChange} />,
    );

    await waitFor(() => expect(screen.getByText('Recording source')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    // FIFO is the default — the strict note only appears once strict is on.
    expect(screen.queryByText(/served only for exact argument matches/)).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: 'Strict args matching (exact tool arguments only)' }));

    expect(onMatchingChange).toHaveBeenCalledWith('strict');
  });

  it('auto-opens Advanced when strict matching arrives enabled and explains the miss semantics', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments`, () =>
        HttpResponse.json(listExperimentsResponse([liveExperiment])),
      ),
    );

    renderWithProviders(<ToolReplaySelector {...baseProps} enabled onEnabledChange={vi.fn()} matching="strict" />);

    await waitFor(() => expect(screen.getByText('Strict args matching (exact tool arguments only)')).toBeDefined());
    expect(
      screen.getByText('Recorded answers are served only for exact argument matches — anything else is a miss.'),
    ).toBeDefined();
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

describe('buildToolReplayPayload', () => {
  it('includes matching only when strict — fifo stays implicit', () => {
    expect(buildToolReplayPayload({ fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' })).toEqual({
      fromExperimentId: 'exp-live-1',
      onMiss: 'error',
      matching: 'strict',
    });
    expect(buildToolReplayPayload({ fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'fifo' })).toEqual({
      fromExperimentId: 'exp-live-1',
      onMiss: 'error',
    });
  });

  it('omits fromExperimentId for the item-recordings source', () => {
    expect(
      buildToolReplayPayload({ fromExperimentId: ITEM_RECORDINGS_SOURCE, onMiss: 'passthrough', matching: 'strict' }),
    ).toEqual({ onMiss: 'passthrough', matching: 'strict' });
  });
});

describe('toolReplay trigger POST body', () => {
  it('puts matching: strict in the POST body when strict is enabled', async () => {
    const capture = vi.fn();
    server.use(
      http.post(`${BASE_URL}/api/datasets/dataset-1/experiments`, async ({ request }) => {
        capture(await request.json());
        return HttpResponse.json(triggerExperimentResponse);
      }),
    );

    const { result } = renderHook(() => useDatasetMutations(), { wrapper: hookWrapper });

    await result.current.triggerExperiment.mutateAsync({
      datasetId: 'dataset-1',
      targetType: 'agent',
      targetId: 'support-agent',
      toolReplay: buildToolReplayPayload({ fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' }),
    });

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0]).toMatchObject({
      targetType: 'agent',
      toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' },
    });
  });

  it('leaves matching out of the POST body for the fifo default', async () => {
    const capture = vi.fn();
    server.use(
      http.post(`${BASE_URL}/api/datasets/dataset-1/experiments`, async ({ request }) => {
        capture(await request.json());
        return HttpResponse.json(triggerExperimentResponse);
      }),
    );

    const { result } = renderHook(() => useDatasetMutations(), { wrapper: hookWrapper });

    await result.current.triggerExperiment.mutateAsync({
      datasetId: 'dataset-1',
      targetType: 'agent',
      targetId: 'support-agent',
      toolReplay: buildToolReplayPayload({ fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'fifo' }),
    });

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture.mock.calls[0][0].toolReplay).toEqual({ fromExperimentId: 'exp-live-1', onMiss: 'error' });
  });
});

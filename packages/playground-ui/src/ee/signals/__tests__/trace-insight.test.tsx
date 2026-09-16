// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeSnapshots } from '../hooks/use-theme-snapshots';
import { SankeySignals } from '../sankey-signals';
import {
  allThemePathsResponse,
  drilldownThemeFlowResponse,
  drilldownThemeSnapshotsResponse,
  firstThemeExamplesResponse,
  noiseExamplesResponse,
  noiseResponse,
  noSummaryTraceInsightResponse,
  secondThemeExamplesResponse,
  themeDetailResponse,
  themeHistoryResponse,
  traceInsightResponse,
} from './fixtures/theme-drilldown';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;

class ChartResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    const size = { blockSize: 680, inlineSize: 800 };
    const entry = {
      target,
      contentRect: new DOMRectReadOnly(0, 0, 800, 680),
      borderBoxSize: [size],
      contentBoxSize: [size],
      devicePixelContentBoxSize: [size],
    } satisfies ResizeObserverEntry;
    this.callback([entry], this);
  }

  unobserve() {}

  disconnect() {}
}

function ControlledSankeySignals() {
  const [selectedThemeId, setSelectedThemeId] = useState<string>();
  const [selectedFrameId, setSelectedFrameId] = useState<string>();
  const snapshotsQuery = useThemeSnapshots('support-agent', 'agent', ['goal', 'outcome', 'behavior']);
  const snapshots = [...(snapshotsQuery.data?.snapshots ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const frameId = selectedFrameId ?? snapshots[0]?.snapshotId;
  if (!frameId) return null;
  return (
    <SankeySignals
      entityId="support-agent"
      entityType="agent"
      signalNames={['goal', 'outcome', 'behavior']}
      selectedThemeId={selectedThemeId}
      onSelectedThemeIdChange={setSelectedThemeId}
      selectedFrameId={frameId}
      onFrameIdChange={setSelectedFrameId}
    />
  );
}

function renderSignals() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledSankeySignals />
    </QueryClientProvider>,
  );
}

function registerThemeDrilldownHandlers() {
  server.use(
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
      HttpResponse.json(drilldownThemeSnapshotsResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
      HttpResponse.json(drilldownThemeFlowResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, () =>
      HttpResponse.json(allThemePathsResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101`, () =>
      HttpResponse.json(themeDetailResponse),
    ),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/examples`, ({ request }) => {
      const offset = new URL(request.url).searchParams.get('offset');
      return HttpResponse.json(offset === '5' ? secondThemeExamplesResponse : firstThemeExamplesResponse);
    }),
    http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/101/history`, () =>
      HttpResponse.json(themeHistoryResponse),
    ),
  );
}

async function openThemeDetails() {
  fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
  await screen.findByRole('dialog', { name: 'Add transcript' });
}

async function openThemeExampleInsight() {
  await openThemeDetails();
  fireEvent.click(
    await screen.findByRole('button', { name: 'View trace insight for Add this transcript to my workspace.' }),
  );
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ChartResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(680);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Trace signals trace insight', () => {
  describe('when a theme example is opened', () => {
    it('requests the trace insight and shows the summary, observations, and trace signal texts', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () => HttpResponse.json(traceInsightResponse)),
      );
      renderSignals();

      await openThemeExampleInsight();

      expect(
        await screen.findByText(
          'The user asked the agent to add a meeting transcript to their workspace. The agent located the workspace, uploaded the transcript, and confirmed the addition.',
        ),
      ).not.toBeNull();
      expect(screen.getByText('Task: add a transcript to the workspace.')).not.toBeNull();
      expect(screen.getByText('The upload tool succeeded on the first attempt.')).not.toBeNull();
      expect(screen.getByText('Add a transcript to the workspace.')).not.toBeNull();
      expect(screen.getByText('Transcript added to the workspace.')).not.toBeNull();
    });

    it('renders observation severity and kind as visual cues instead of raw prefixes', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () => HttpResponse.json(traceInsightResponse)),
      );
      renderSignals();

      await openThemeExampleInsight();

      const observations = await screen.findByRole('list', { name: 'Observations' });
      expect(screen.queryByText(/severity=/)).toBeNull();
      expect(screen.queryByText(/kind=/)).toBeNull();
      expect(within(observations).getByText('Task: add a transcript to the workspace.')).not.toBeNull();
      expect(
        within(observations).getByText('The run never verified the transcript was linked to the project.'),
      ).not.toBeNull();
      expect(within(observations).getByText('task')).not.toBeNull();
      expect(within(observations).getByText('completion')).not.toBeNull();
      expect(within(observations).getByText('unresolved')).not.toBeNull();
      // Problem severity stays announced for assistive tech, not just as a tint.
      expect(within(observations).getByText('problem')).not.toBeNull();
    });

    it('links to the full trace page', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () => HttpResponse.json(traceInsightResponse)),
      );
      renderSignals();

      await openThemeExampleInsight();

      const link = await screen.findByRole('link', { name: 'Open full trace' });
      expect(link.getAttribute('href')).toBe('/traces?traceId=trace-1');
    });
  });

  describe('when no example has been opened', () => {
    it('does not request a trace insight', async () => {
      const onInsightRequest = vi.fn<() => void>();
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () => {
          onInsightRequest();
          return HttpResponse.json(traceInsightResponse);
        }),
      );
      renderSignals();

      await openThemeDetails();
      await screen.findByRole('button', { name: 'View trace insight for Add this transcript to my workspace.' });

      expect(onInsightRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the insight back control is used', () => {
    it('restores the example list at the current pagination offset', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-2/summary`, () =>
          HttpResponse.json(noSummaryTraceInsightResponse),
        ),
      );
      renderSignals();

      await openThemeDetails();
      fireEvent.click(screen.getByRole('button', { name: 'Clear theme filter' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      fireEvent.click(
        await screen.findByRole('button', { name: 'View trace insight for Save the transcript with the project.' }),
      );
      await screen.findByRole('link', { name: 'Open full trace' });

      fireEvent.click(screen.getByRole('button', { name: 'Back to examples' }));

      expect(
        await screen.findByRole('button', { name: 'View trace insight for Save the transcript with the project.' }),
      ).not.toBeNull();
      expect(screen.queryByRole('link', { name: 'Open full trace' })).toBeNull();
    });
  });

  describe('when the trace has no summary yet', () => {
    it('shows the no-insight message', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () =>
          HttpResponse.json({ ...noSummaryTraceInsightResponse, traceId: 'trace-1' }),
        ),
      );
      renderSignals();

      await openThemeExampleInsight();

      expect(await screen.findByText('No insight available yet for this trace.')).not.toBeNull();
    });
  });

  describe('when the insight request fails', () => {
    it('shows the insight error state', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );
      renderSignals();

      await openThemeExampleInsight();

      expect(await screen.findByText('Unable to load the trace insight.')).not.toBeNull();
    });
  });

  describe('when the drawer closes after viewing an insight', () => {
    it('reopens on the example list instead of the insight', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () => HttpResponse.json(traceInsightResponse)),
      );
      renderSignals();

      await openThemeExampleInsight();
      await screen.findByRole('link', { name: 'Open full trace' });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add transcript' })).toBeNull());

      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
      await screen.findByRole('dialog', { name: 'Add transcript' });

      expect(
        await screen.findByRole('button', { name: 'View trace insight for Add this transcript to my workspace.' }),
      ).not.toBeNull();
      expect(screen.queryByRole('link', { name: 'Open full trace' })).toBeNull();
    });
  });

  describe('when a noise example is opened', () => {
    it('shows the trace insight for the noise trace', async () => {
      registerThemeDrilldownHandlers();
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise`, () => HttpResponse.json(noiseResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/noise/examples`, () =>
          HttpResponse.json(noiseExamplesResponse),
        ),
        http.get(`${BASE_URL}/api/learning/traces/trace-2/summary`, () =>
          HttpResponse.json(noSummaryTraceInsightResponse),
        ),
      );
      renderSignals();

      fireEvent.click(await screen.findByLabelText(/^Noise.+2 traces \(67%\)/));
      await screen.findByRole('dialog', { name: 'Noise' });
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'View trace insight for The agent retried a fetch without establishing a recurring behavior pattern.',
        }),
      );

      expect(await screen.findByText('No insight available yet for this trace.')).not.toBeNull();
      const link = screen.getByRole('link', { name: 'Open full trace' });
      expect(link.getAttribute('href')).toBe('/traces?traceId=trace-2');
    });
  });
});

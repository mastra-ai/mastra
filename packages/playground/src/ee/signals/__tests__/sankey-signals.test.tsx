// @vitest-environment jsdom
import { buildSankeyChartGraph } from '@mastra/playground-ui/components/SankeyChart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SankeySignals } from '../sankey-signals';
import { getSignalRecordNodeId, getSignalRecordNodeLabel, themeFlowToSankeyData } from '../sankey-signals-data';
import {
  duplicateLabelThemeFlowResponse,
  emptyThemeSnapshotsResponse,
  fourStageThemeFlowResponse,
  inconsistentTraceCountThemeFlowResponse,
  multiThemeSnapshotsResponse,
  sameDayThemeSnapshotsResponse,
  singleStageThemeFlowResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
} from './fixtures/theme-flow';
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

function renderSankeySignals() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SankeySignals entityId="support-agent" signalNames={['goal', 'outcome', 'behavior', 'sentiment']} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ChartResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(680);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SankeySignals', () => {
  describe('when the snapshot request is pending', () => {
    it('shows the Signals loading state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, async () => {
          await new Promise(() => {});
          return HttpResponse.json(emptyThemeSnapshotsResponse);
        }),
      );

      renderSankeySignals();

      expect(await screen.findByRole('status', { name: 'Loading signal analysis' })).not.toBeNull();
    });
  });

  describe('when the flow request is pending', () => {
    it('shows the Signals loading state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async () => {
          await new Promise(() => {});
          return HttpResponse.json(themeFlowResponse);
        }),
      );

      renderSankeySignals();

      expect(await screen.findByRole('status', { name: 'Loading signal analysis' })).not.toBeNull();
      expect(screen.getByTestId('signals-loading-skeleton')).not.toBeNull();
    });
  });

  describe('when the flow request fails once', () => {
    it('retries the failed request and renders the analysis', async () => {
      let attempts = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () => {
          attempts += 1;
          return attempts === 1
            ? HttpResponse.json({ error: 'Flow unavailable' }, { status: 500 })
            : HttpResponse.json(themeFlowResponse);
        }),
      );

      renderSankeySignals();

      expect(await screen.findByText('Unable to load signal flow.')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('region', { name: 'Signal theme flow' })).not.toBeNull();
      expect(attempts).toBe(2);
    });
  });

  describe('when the snapshot request fails', () => {
    it('shows the signal flow error state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ error: 'Snapshot unavailable' }, { status: 500 }),
        ),
      );

      renderSankeySignals();

      expect(await screen.findByText('Unable to load signal flow.')).not.toBeNull();
    });
  });

  describe('when no theme snapshot exists', () => {
    it('shows the Signals onboarding empty state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(emptyThemeSnapshotsResponse),
        ),
      );

      renderSankeySignals();

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
    });
  });

  describe('when the flow has fewer than two populated stages', () => {
    it('shows the Signals onboarding empty state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(singleStageThemeFlowResponse),
        ),
      );

      renderSankeySignals();

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
    });
  });

  describe('when a snapshot contains four populated signal stages', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(fourStageThemeFlowResponse),
        ),
      );
    });

    it('renders the page identity without duplicating the shell documentation action', async () => {
      renderSankeySignals();

      expect(await screen.findByText('SIGNALS')).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();
      expect(screen.getByText(/Signals group recurring patterns across traces/)).not.toBeNull();
      expect(screen.queryByRole('link', { name: 'Signals documentation' })).toBeNull();
    });

    it('shows entity, snapshot ordinal, and window in the analysis header', async () => {
      renderSankeySignals();

      const header = await screen.findByTestId('signals-page-header');
      expect(within(header).getByText('support-agent · Snapshot 4 of 4 · Jul 1–8, 2026')).not.toBeNull();
    });

    it('shows exactly three metrics derived from the loaded flow', async () => {
      renderSankeySignals();

      const metrics = await screen.findByRole('list', { name: 'Signal analysis metrics' });
      expect(within(metrics).getAllByRole('listitem')).toHaveLength(3);
      expect(within(metrics).getByText('50 traces analyzed')).not.toBeNull();
      expect(within(metrics).getByText('9 themes')).not.toBeNull();
      expect(within(metrics).getByText('4 signal types')).not.toBeNull();
    });

    it('shows the selected snapshot context without controls for a single snapshot', async () => {
      renderSankeySignals();

      expect(await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces')).not.toBeNull();
      expect(screen.queryByRole('group', { name: 'Snapshot' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Play snapshots' })).toBeNull();
    });

    it('carries a theme description into the chart node label', () => {
      const { columns, records } = themeFlowToSankeyData(fourStageThemeFlowResponse);

      const record = records[0];
      const column = columns[0];
      expect(record).toBeDefined();
      expect(column).toBeDefined();
      if (!record || !column) throw new Error('Expected a signal flow record and column');
      expect(getSignalRecordNodeLabel(record, column)).toBe(
        'Resolve support request\nThe user wants help resolving a support issue.',
      );
    });

    it('delegates the signal column headings to the Sankey chart', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Signal theme flow' });
      expect(within(chart).queryByTestId('signal-column-heading')).toBeNull();
      expect(within(chart).getByText('RIBBON WIDTH = TRACE COUNT')).not.toBeNull();
      expect(within(chart).getByText('HOVER OR FOCUS TO ISOLATE FLOW')).not.toBeNull();
    });

    it('places a compact square-swatch legend at the right of the chart footer', async () => {
      renderSankeySignals();

      const legend = await screen.findByRole('list', { name: 'Signal stage legend' });
      expect(legend.getAttribute('data-alignment')).toBe('right');
      const swatches = within(legend).getAllByTestId('signal-legend-swatch');
      expect(swatches).toHaveLength(4);
      expect(new Set(swatches.map(swatch => swatch.style.backgroundColor)).size).toBe(4);
      expect(
        within(legend)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Goal', 'Outcome', 'Behavior', 'Sentiment']);
    });

    it('renders signal distributions before the flow chart', async () => {
      renderSankeySignals();

      const distributions = await screen.findByRole('region', { name: 'Signal distributions' });
      const flow = screen.getByRole('region', { name: 'Signal theme flow' });

      expect(distributions.compareDocumentPosition(flow) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    });

    it('summarizes each signal with one stacked bar and compact theme rows', async () => {
      renderSankeySignals();

      const distributions = await screen.findByRole('region', { name: 'Signal distributions' });
      const chart = screen.getByRole('region', { name: 'Signal theme flow' });
      const goal = within(distributions).getByRole('article', { name: 'Goal distribution' });
      const outcome = within(distributions).getByRole('article', { name: 'Outcome distribution' });
      const behavior = within(distributions).getByRole('article', { name: 'Behavior distribution' });
      const sentiment = within(distributions).getByRole('article', { name: 'Sentiment distribution' });

      expect(chart.classList.contains('shadow-elevated')).toBe(true);
      for (const distribution of [goal, outcome, behavior, sentiment]) {
        expect(distribution.classList.contains('shadow-elevated')).toBe(true);
      }
      expect(within(goal).getByText('Resolve support request')).not.toBeNull();
      expect(within(goal).getByText('22 · 44%')).not.toBeNull();
      expect(within(goal).getAllByTestId('distribution-stack')).toHaveLength(1);
      expect(within(outcome).getByText('31 · 62%')).not.toBeNull();
      expect(within(behavior).getByText('34 · 68%')).not.toBeNull();
      expect(within(sentiment).getByText('29 · 58%')).not.toBeNull();
    });

    it('does not force the analysis into a separate horizontal scroll region', async () => {
      renderSankeySignals();

      await screen.findByTestId('signals-page-header');
      expect(screen.queryByTestId('signals-analysis-scroll')).toBeNull();
      expect(screen.queryByTestId('signals-analysis-canvas')).toBeNull();
    });
  });

  describe('when a snapshot starts and ends on the same day', () => {
    it('shows the calendar date once', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(sameDayThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json({ ...themeFlowResponse, snapshot: sameDayThemeSnapshotsResponse.snapshots[0] }),
        ),
      );

      renderSankeySignals();

      expect(await screen.findByText('Snapshot 4/4 · Jul 15, 2026 · 50 traces')).not.toBeNull();
    });
  });

  describe('when multiple snapshots are available', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(multiThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = multiThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
    });

    it('selects the latest ordinal and labels it without parsing its cursor', async () => {
      renderSankeySignals();

      expect(await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces')).not.toBeNull();
      expect(screen.getByRole('group', { name: 'Snapshot' })).not.toBeNull();
    });

    it('scrubs to an earlier snapshot', async () => {
      const { container } = renderSankeySignals();

      await screen.findByRole('group', { name: 'Snapshot' });
      const sliderInput = container.querySelector('input[type="range"]');
      if (!sliderInput) throw new Error('Snapshot slider input was not rendered');
      fireEvent.change(sliderInput, { target: { value: '0' } });

      expect(await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces')).not.toBeNull();
    });

    it('plays forward through snapshots', async () => {
      renderSankeySignals();
      await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));
      expect(screen.getByRole('button', { name: 'Pause snapshots' })).not.toBeNull();

      expect(
        await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces', undefined, { timeout: 2000 }),
      ).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Pause snapshots' })).not.toBeNull();
    });

    it('stops scheduling snapshots after a playback request fails', async () => {
      const flowRequests: Array<string> = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (!snapshotId) return HttpResponse.json({ error: 'Missing snapshot' }, { status: 400 });
          flowRequests.push(snapshotId);
          if (snapshotId === 'snapshot-3') return HttpResponse.json({ error: 'Flow failed' }, { status: 500 });
          const snapshot = multiThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();
      await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));
      await screen.findByRole('button', { name: 'Retry' }, { timeout: 2000 });
      await new Promise(resolve => window.setTimeout(resolve, 1100));

      expect(flowRequests).toEqual(['snapshot-1', 'snapshot-3']);
    });

    it('keeps the pause control available while the next flow is loading', async () => {
      let releasePendingFlow: (() => void) | undefined;
      const pendingFlow = new Promise<void>(resolve => {
        releasePendingFlow = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, async ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = multiThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (snapshotId === 'snapshot-3') await pendingFlow;
          return HttpResponse.json({ ...fourStageThemeFlowResponse, snapshot });
        }),
      );
      renderSankeySignals();
      await screen.findByText('Snapshot 4/4 · Jul 1–8, 2026 · 50 traces');

      fireEvent.click(screen.getByRole('button', { name: 'Play snapshots' }));

      expect(
        await screen.findByText('Snapshot 3/4 · Jun 24–Jul 1, 2026 · 40 traces', undefined, { timeout: 2000 }),
      ).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Pause snapshots' })).not.toBeNull();
      expect(screen.getByRole('status', { name: 'Loading snapshot flow' })).not.toBeNull();
      releasePendingFlow?.();
    });
  });

  describe('when API count metadata disagrees with the weighted graph', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(inconsistentTraceCountThemeFlowResponse),
        ),
      );
    });

    it('uses the authoritative snapshot total in the header badge', async () => {
      renderSankeySignals();

      const metrics = await screen.findByRole('list', { name: 'Signal analysis metrics' });
      expect(within(metrics).getByText('80 traces analyzed')).not.toBeNull();
      expect(within(metrics).queryByText('50 traces analyzed')).toBeNull();
    });

    it('uses authoritative stage totals for every distribution', async () => {
      renderSankeySignals();

      const distributions = await screen.findByRole('region', { name: 'Signal distributions' });
      const expectedTotals = { Goal: 70, Outcome: 80, Behavior: 90, Sentiment: 100 };
      for (const [signalName, traceCount] of Object.entries(expectedTotals)) {
        const distribution = within(distributions).getByRole('article', { name: `${signalName} distribution` });
        expect(within(distribution).getByText(`${traceCount} traces`)).not.toBeNull();
      }
    });

    it('uses authoritative API node counts and shares in every distribution row', async () => {
      renderSankeySignals();

      const distributions = await screen.findByRole('region', { name: 'Signal distributions' });
      const expectedRows = {
        Goal: ['42 · 90%', '38 · 80%', '33 · 70%', '99 · 99%'],
        Outcome: ['51 · 90%', '40 · 80%'],
        Behavior: ['54 · 90%', '37 · 80%'],
        Sentiment: ['49 · 90%', '42 · 80%'],
      };

      for (const [signalName, rows] of Object.entries(expectedRows)) {
        const distribution = within(distributions).getByRole('article', { name: `${signalName} distribution` });
        for (const row of rows) expect(within(distribution).getByText(row)).not.toBeNull();
      }
      expect(within(distributions).getByText('Metadata only goal')).not.toBeNull();
    });

    it('shows the same graph-derived counts and percentages on chart nodes', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Signal theme flow' });
      for (const label of [
        '22 (44%)',
        '17 (34%)',
        '11 (22%)',
        '31 (62%)',
        '19 (38%)',
        '34 (68%)',
        '16 (32%)',
        '29 (58%)',
        '21 (42%)',
      ]) {
        expect(await within(chart).findByText(label)).not.toBeNull();
      }
      expect(within(chart).queryByText('Metadata only goal')).toBeNull();
    });
  });

  describe('when themes in one signal stage share a display label', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(duplicateLabelThemeFlowResponse),
        ),
      );
    });

    it('renders each API node with its own trace count', async () => {
      renderSankeySignals();

      const chart = await screen.findByRole('region', { name: 'Signal theme flow' });
      expect(within(chart).getAllByText('Shared theme label', { selector: 'text' })).toHaveLength(2);
      expect(within(chart).getByText('20 (40%)')).not.toBeNull();
      expect(within(chart).getByText('30 (60%)')).not.toBeNull();
    });
  });

  describe('when a theme snapshot has weighted links', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );
    });

    it('renders the flow with the signal and theme labels', async () => {
      renderSankeySignals();

      expect(await screen.findByRole('region', { name: 'Signal theme flow' })).not.toBeNull();
    });

    it('limits the legend to stages returned by the flow', async () => {
      renderSankeySignals();

      const legend = await screen.findByRole('list', { name: 'Signal stage legend' });
      expect(
        within(legend)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Goal', 'Outcome']);
    });

    it('preserves the API-defined signal order', () => {
      const { columns } = themeFlowToSankeyData(themeFlowResponse);

      expect(columns).toEqual([
        { id: 'goal', label: 'Goal' },
        { id: 'outcome', label: 'Outcome' },
      ]);
    });

    it('preserves the API-defined theme labels', () => {
      const { columns, records } = themeFlowToSankeyData(themeFlowResponse);
      const graph = buildSankeyChartGraph(records, columns, undefined, getSignalRecordNodeId, getSignalRecordNodeLabel);

      expect(graph.nodes.map(node => node.label)).toEqual(['Resolve support request', 'Request resolved']);
    });

    it('preserves each API link as one chart record', () => {
      const { records } = themeFlowToSankeyData(themeFlowResponse);

      expect(records).toHaveLength(1);
    });

    it('preserves the API link weight in the playground-ui chart graph', () => {
      const { columns, records } = themeFlowToSankeyData(themeFlowResponse);
      const graph = buildSankeyChartGraph(
        records,
        columns,
        record => Number(record.traceCount),
        getSignalRecordNodeId,
        getSignalRecordNodeLabel,
      );

      expect(graph.links[0]?.value).toBe(3);
    });
  });
});

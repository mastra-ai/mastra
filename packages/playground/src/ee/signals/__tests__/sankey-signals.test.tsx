// @vitest-environment jsdom
import { buildSankeyChartGraph } from '@mastra/playground-ui/components/SankeyChart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SankeySignals } from '../sankey-signals';
import { themeFlowToSankeyData } from '../sankey-signals-data';
import {
  emptyThemeSnapshotsResponse,
  fourStageThemeFlowResponse,
  singleStageThemeFlowResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
} from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:3100';

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
  window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = BASE_URL;
  window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
});

afterEach(() => {
  cleanup();
  window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = undefined;
  window.MASTRA_PLATFORM_PROJECT_ID = undefined;
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

    it('renders the reference page identity and detached documentation action', async () => {
      renderSankeySignals();

      expect(await screen.findByText('SIGNALS')).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();
      expect(screen.getByText(/Signals group recurring patterns across traces/)).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Signals documentation' }).getAttribute('href')).toBe(
        'https://mastra.ai/en/docs/observability/tracing/overview',
      );
    });

    it('shows exactly three metrics derived from the loaded flow', async () => {
      renderSankeySignals();

      const metrics = await screen.findByRole('list', { name: 'Signal analysis metrics' });
      expect(within(metrics).getAllByRole('listitem')).toHaveLength(3);
      expect(within(metrics).getByText('50 traces analyzed')).not.toBeNull();
      expect(within(metrics).getByText('9 clusters')).not.toBeNull();
      expect(within(metrics).getByText('4 signal types')).not.toBeNull();
    });

    it('omits date, period, agent, and processing controls', async () => {
      renderSankeySignals();

      await screen.findByRole('region', { name: 'Signal theme flow' });
      expect(screen.queryByText('Jul 1–8, 2026')).toBeNull();
      expect(screen.queryByText(/Snapshot 4 of 4/)).toBeNull();
      expect(screen.queryByText(/All agents/)).toBeNull();
      expect(screen.queryByRole('status', { name: 'Signal processing status' })).toBeNull();
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
      for (const distribution of [goal, outcome, behavior, sentiment]) {
        expect(within(distribution).queryByText('50 traces')).toBeNull();
      }
      expect(within(goal).getByText('Resolve support request')).not.toBeNull();
      expect(within(goal).getByText('22 · 44%')).not.toBeNull();
      expect(within(goal).getAllByTestId('distribution-stack')).toHaveLength(1);
      expect(within(outcome).getByText('31 · 62%')).not.toBeNull();
      expect(within(behavior).getByText('34 · 68%')).not.toBeNull();
      expect(within(sentiment).getByText('29 · 58%')).not.toBeNull();
    });

    it('scopes horizontal overflow to the analytical region', async () => {
      renderSankeySignals();

      const analysis = await screen.findByTestId('signals-analysis-scroll');
      expect(analysis.getAttribute('data-scroll-container')).toBe('horizontal');
      expect(within(analysis).getByTestId('signals-analysis-canvas').getAttribute('data-min-width')).toBe('920');
      expect(screen.getByTestId('signals-page-header').closest('[data-scroll-container]')).toBeNull();
    });
  });

  describe('when a theme snapshot has weighted links', () => {
    it('renders the flow with the signal and theme labels', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );

      renderSankeySignals();

      expect(await screen.findByRole('region', { name: 'Signal theme flow' })).not.toBeNull();
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
      const graph = buildSankeyChartGraph(records, columns);

      expect(graph.nodes.map(node => node.name)).toEqual(['Resolve support request', 'Request resolved']);
    });

    it('preserves each API link as one chart record', () => {
      const { records } = themeFlowToSankeyData(themeFlowResponse);

      expect(records).toHaveLength(1);
    });

    it('preserves the API link weight in the playground-ui chart graph', () => {
      const { columns, records } = themeFlowToSankeyData(themeFlowResponse);
      const graph = buildSankeyChartGraph(records, columns, record => Number(record.traceCount));

      expect(graph.links[0]?.value).toBe(3);
    });
  });
});

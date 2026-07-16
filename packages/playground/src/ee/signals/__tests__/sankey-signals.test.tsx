// @vitest-environment jsdom
import { buildSankeyChartGraph } from '@mastra/playground-ui/components/SankeyChart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SankeySignals } from '../sankey-signals';
import { themeFlowToSankeyData } from '../sankey-signals-data';
import {
  emptyThemeSnapshotsResponse,
  singleStageThemeFlowResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
} from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:3100';

function renderSankeySignals() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SankeySignals entityId="support-agent" signalNames={['goal', 'outcome']} />
    </QueryClientProvider>,
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

    it('preserves the API link weight in the playground-ui chart graph', () => {
      const { columns, records } = themeFlowToSankeyData(themeFlowResponse);
      const graph = buildSankeyChartGraph(records, columns);

      expect(columns).toEqual([
        { id: 'goal', label: 'Goal' },
        { id: 'outcome', label: 'Outcome' },
      ]);
      expect(graph.nodes.map(node => node.name)).toEqual(['Resolve support request', 'Request resolved']);
      expect(graph.links[0]?.value).toBe(3);
    });
  });
});

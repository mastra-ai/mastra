// @vitest-environment jsdom
import type { DashboardQuery, DashboardWidget } from '@mastra/client-js';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedMetrics } from '../../metrics/components/__tests__/metrics-msw';
import { AggregateLimiterProvider } from '../../metrics/hooks/aggregate-limiter-provider';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import type { DatePreset } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import { useDashboardRequests } from '../hooks/use-dashboard-requests';
import { buildRequest } from '../lib/requests';
import type { DashboardPageContext } from '../lib/requests';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const METRICS_API = `${TEST_BASE_URL}/api/observability/metrics`;
const SCORES_API = `${TEST_BASE_URL}/api/observability/scores`;
const NO_TOKENS: never[] = [];
const noop = () => {};

const runsWidget: DashboardWidget = {
  id: 'runs',
  span: 12,
  kind: 'kpis',
  views: [
    {
      queries: [
        {
          id: 'runs',
          source: 'metrics',
          request: 'aggregate',
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count',
          compare: 'previousWindow',
        },
      ],
      options: {
        items: [
          { label: 'Agent runs', icon: 'bot', format: 'count', value: { query: 'runs' }, detail: 'in this range' },
        ],
      },
    },
  ],
};

type AggregateBody = { filters: { timestamp: { start: string; end: string }; environment?: string } };

/** Agent runs per window length and environment, e.g. `24h` or `24h:prod`; a held key answers once released. */
function serveRuns() {
  const values: Record<string, number> = { '24h': 693, '24h:prod': 120, '168h': 41, '720h': 0 };
  const gates = new Map<string, Promise<void>>();
  const sent: string[] = [];
  server.use(
    http.post<never, AggregateBody>(`${METRICS_API}/aggregate`, async ({ request }) => {
      const { timestamp, environment } = (await request.json()).filters;
      const hours = Math.round((new Date(timestamp.end).getTime() - new Date(timestamp.start).getTime()) / 3_600_000);
      const key = environment ? `${hours}h:${environment}` : `${hours}h`;
      sent.push(key);
      await gates.get(key);
      return HttpResponse.json({ value: values[key] ?? 0, previousValue: 10, changePercent: 1 });
    }),
  );
  return {
    sent,
    hold(key: string) {
      let release = noop;
      gates.set(key, new Promise<void>(resolve => (release = resolve)));
      return () => {
        gates.delete(key);
        release();
      };
    },
  };
}

type PageState = { preset: DatePreset; environment?: string };

function Page({ preset, environment }: PageState) {
  const tokens = environment ? [{ fieldId: 'environment', value: environment }] : NO_TOKENS;
  return (
    <MetricsProvider preset={preset} filterTokens={tokens} onPresetChange={noop} onFilterTokensChange={noop}>
      <DashboardRenderer definition={{ schemaVersion: 1, rows: [{ widgets: [runsWidget] }] }} scope="project" />
    </MetricsProvider>
  );
}

function renderPage(preset: DatePreset) {
  const rendered = renderWithProviders(<Page preset={preset} />);
  return {
    ...rendered,
    switchTo: (next: PageState) => rendered.rerender(<Page {...next} />),
    root: () => {
      const root = rendered.container.querySelector<HTMLElement>('[data-widget-id="runs"]');
      if (!root) throw new Error('the runs widget is not on the page');
      return root;
    },
  };
}

/** Whether the widget's card says its reading is loading or being replaced. */
const isBusy = (root: HTMLElement) => root.querySelector('[aria-busy="true"]') !== null;

describe('A dashboard widget while the page filters change', () => {
  beforeEach(() => {
    seedMetrics();
  });

  describe('when the page moves to a window it never loaded and the API is slow', () => {
    it("shows a skeleton, not the last window's figure", async () => {
      const api = serveRuns();
      const page = renderPage('24h');
      await screen.findByText('693');
      api.hold('168h');
      page.switchTo({ preset: '7d' });
      await waitFor(() => expect(api.sent).toContain('168h'));
      expect(screen.queryByText('693')).toBeNull();
      expect(isBusy(page.root())).toBe(true);
    });

    it("shows the new window's figure, settled, once it answers", async () => {
      const api = serveRuns();
      const page = renderPage('24h');
      await screen.findByText('693');
      const release = api.hold('168h');
      page.switchTo({ preset: '7d' });
      await waitFor(() => expect(api.sent).toContain('168h'));
      release();
      expect(await screen.findByText('41')).toBeTruthy();
      expect(isBusy(page.root())).toBe(false);
    });
  });

  describe('when a filter is removed, going back to an answer already in the cache', () => {
    it('shows that answer at once, marked as updating while it refetches', async () => {
      const api = serveRuns();
      const page = renderPage('24h');
      await screen.findByText('693');
      page.switchTo({ preset: '24h', environment: 'prod' });
      await screen.findByText('120');
      const release = api.hold('24h');
      page.switchTo({ preset: '24h' });
      expect(screen.getByText('693')).toBeTruthy();
      expect(isBusy(page.root())).toBe(true);
      release();
      await waitFor(() => expect(isBusy(page.root())).toBe(false));
      expect(screen.getByText('693')).toBeTruthy();
    });
  });

  describe('when the same answer refetches in the background', () => {
    it('keeps the figure, marked as updating until the answer comes back', async () => {
      const api = serveRuns();
      const page = renderPage('24h');
      await screen.findByText('693');
      const release = api.hold('24h');
      await act(async () => {
        void page.queryClient.invalidateQueries();
      });
      await waitFor(() => expect(isBusy(page.root())).toBe(true));
      expect(screen.getByText('693')).toBeTruthy();
      release();
      await waitFor(() => expect(isBusy(page.root())).toBe(false));
      expect(screen.getByText('693')).toBeTruthy();
    });
  });

  describe('when the new window answers with no data', () => {
    it('shows the empty figure, not a skeleton', async () => {
      serveRuns();
      const page = renderPage('24h');
      await screen.findByText('693');
      page.switchTo({ preset: '30d' });
      expect(await screen.findByText('0')).toBeTruthy();
      expect(isBusy(page.root())).toBe(false);
    });
  });
});

const day = { start: new Date('2026-10-27T12:00:00Z'), end: new Date('2026-10-28T12:00:00Z') };
const page: DashboardPageContext = { window: day, filters: { timestamp: day } };
const meanOf = (scorerId: string): DashboardQuery => ({
  id: 'mean',
  source: 'scores',
  request: 'aggregate',
  aggregation: 'avg',
  scorerId,
});

function Probe({ scorerId }: { scorerId: string }) {
  const [result] = useDashboardRequests([buildRequest(meanOf(scorerId), page, {})]);
  const answer = result?.data;
  const shown = answer?.method === 'getScoreAggregate' ? String(answer.data.value) : 'none';
  return <output aria-label={scorerId}>{shown}</output>;
}

describe('A request slot whose request moves to another scorer', () => {
  describe("when the new scorer's answer is still on its way", () => {
    it("never shows the previous scorer's answer as the new one's", async () => {
      let releaseBeta = noop;
      const beta = new Promise<void>(resolve => (releaseBeta = resolve));
      const sent: string[] = [];
      server.use(
        http.post<never, { scorerId: string }>(`${SCORES_API}/aggregate`, async ({ request }) => {
          const { scorerId } = await request.json();
          sent.push(scorerId);
          if (scorerId === 'beta') await beta;
          return HttpResponse.json({
            value: scorerId === 'alpha' ? 0.9 : 0.1,
            previousValue: null,
            changePercent: null,
          });
        }),
      );
      const ui = (scorerId: string) => (
        <AggregateLimiterProvider>
          <Probe scorerId={scorerId} />
        </AggregateLimiterProvider>
      );
      const rendered = renderWithProviders(ui('alpha'));
      await waitFor(() => expect(screen.getByLabelText('alpha').textContent).toBe('0.9'));
      rendered.rerender(ui('beta'));
      await waitFor(() => expect(sent).toContain('beta'));
      expect(screen.getByLabelText('beta').textContent).toBe('none');
      releaseBeta();
      await waitFor(() => expect(screen.getByLabelText('beta').textContent).toBe('0.1'));
    });
  });
});

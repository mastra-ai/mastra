// @vitest-environment jsdom
import type { DashboardWidget } from '@mastra/client-js';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentLatencyFixture } from '../../metrics/components/__tests__/fixtures/metrics';
import {
  distinctIdsSeriesFixture,
  distinctIdsTotalsFixture,
  traceAggregateCapabilities,
} from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import {
  renderInMetrics,
  seedMetrics,
  serveCapabilities,
  serveTraceAggregate,
} from '../../metrics/components/__tests__/metrics-msw';
import { AgentRunsCard } from '../../metrics/components/agent-runs-card';
import { BreakdownCard } from '../../metrics/components/breakdown-card';
import { DistinctIdsCard } from '../../metrics/components/distinct-ids-card';
import { FailureRateCard } from '../../metrics/components/failure-rate-card';
import { LatencyCard } from '../../metrics/components/latency-card';
import { MetricsKpis } from '../../metrics/components/metrics-kpis';
import { ScoresCard } from '../../metrics/components/scores-card';
import { TokenUsageCard } from '../../metrics/components/token-usage-card';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import type { OnDashboardDrilldown } from '../lib/definition';
import {
  API,
  BREAKDOWN_TABS,
  SCOPES,
  TEST_NOW,
  expectSame,
  expectSameTab,
  find,
  recordRequests,
  serveBreakdown,
  settle,
  metricsWidget,
  record,
} from './equality-harness';
import type { Rendered } from './equality-harness';
import { useFixedChartSize } from '@/test/chart-size';
import { server } from '@/test/msw-server';

/**
 * Each of today's Metrics cards next to its `METRICS_DASHBOARD` widget: both must send the same
 * requests (bodies and count) and render the same DOM, at project and org scope.
 */

async function renderCard(ui: ReactElement, scope: MetricsScope | undefined): Promise<Rendered> {
  const recorder = recordRequests();
  const { container } = renderInMetrics(<div data-testid="card">{ui}</div>, { scope });
  await settle(recorder);
  recorder.stop();
  return { root: find(container, '[data-testid="card"]'), sent: recorder.sent };
}

async function renderWidget(
  widget: DashboardWidget,
  scope: MetricsScope | undefined,
  onDrilldown: OnDashboardDrilldown = () => {},
): Promise<Rendered> {
  const recorder = recordRequests();
  const { container } = renderInMetrics(
    <DashboardRenderer definition={{ schemaVersion: 1, rows: [{ widgets: [widget] }] }} onDrilldown={onDrilldown} />,
    { scope },
  );
  await settle(recorder);
  recorder.stop();
  return { root: find(container, `[data-widget-id="${widget.id}"]`), sent: recorder.sent };
}

type RenderedPage = { sent: string[]; roots: Record<string, Rendered> };

async function renderCards(
  cards: Record<string, ReactElement>,
  scope: MetricsScope | undefined,
): Promise<RenderedPage> {
  const recorder = recordRequests();
  const { container } = renderInMetrics(
    <>
      {Object.entries(cards).map(([id, ui]) => (
        <div key={id} data-testid={id}>
          {ui}
        </div>
      ))}
    </>,
    { scope },
  );
  await settle(recorder);
  recorder.stop();
  const roots = Object.fromEntries(
    Object.keys(cards).map(id => [id, { root: find(container, `[data-testid="${id}"]`), sent: [] }]),
  );
  return { sent: recorder.sent, roots };
}

async function renderWidgets(widgets: DashboardWidget[], scope: MetricsScope | undefined): Promise<RenderedPage> {
  const recorder = recordRequests();
  const { container } = renderInMetrics(
    <DashboardRenderer definition={{ schemaVersion: 1, rows: [{ widgets }] }} onDrilldown={() => {}} />,
    { scope },
  );
  await settle(recorder);
  recorder.stop();
  const roots = Object.fromEntries(
    widgets.map(w => [w.id, { root: find(container, `[data-widget-id="${w.id}"]`), sent: [] }]),
  );
  return { sent: recorder.sent, roots };
}

const noop = () => {};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(TEST_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each(Object.entries(SCOPES))('cards and their widgets at %s scope', (_name, scope) => {
  beforeEach(() => {
    seedMetrics();
  });

  it('KPIs', async () => {
    const card = await renderCard(<MetricsKpis />, scope);
    const widget = await renderWidget(metricsWidget('kpis'), scope);
    expect(within(card.root).getByText('693')).toBeDefined();
    expectSame(card, widget);
  });

  // Token usage, Agent runs and Failure rate share one set of requests (`useMetricsActivity`), so a
  // card alone sends all four; compare them as the page shows them, together.
  it('Token usage (both tabs), Agent runs and Failure rate', async () => {
    const cards = await renderCards(
      {
        'token-usage': <TokenUsageCard onViewTraces={noop} onTimeRangeClick={noop} />,
        'agent-runs': <AgentRunsCard onTimeRangeClick={noop} />,
        'failure-rate': <FailureRateCard onViewErrors={noop} onTimeRangeClick={noop} />,
      },
      scope,
    );
    const widgets = await renderWidgets(
      [metricsWidget('token-usage'), metricsWidget('agent-runs'), metricsWidget('failure-rate')],
      scope,
    );
    expect(cards.sent).toHaveLength(4);
    expect(widgets.sent.toSorted()).toEqual(cards.sent.toSorted());
    for (const id of ['token-usage', 'agent-runs', 'failure-rate']) {
      expectSame({ ...cards.roots[id], sent: [] }, { ...widgets.roots[id], sent: [] });
    }
    expect(within(cards.roots['token-usage'].root).getByText('1.30K')).toBeDefined();
    await expectSameTab(cards.roots['token-usage'], widgets.roots['token-usage'], 'Cost');
    expect(within(widgets.roots['token-usage'].root).getByText('$0.75')).toBeDefined();
  });

  it('Latency, every tab', async () => {
    const card = await renderCard(<LatencyCard onViewTraces={noop} onTimeRangeClick={noop} />, scope);
    const widget = await renderWidget(metricsWidget('latency'), scope);
    expectSame(card, widget);
    expect(within(card.root).getByText('P95')).toBeDefined();
    await expectSameTab(card, widget, 'Workflows');
    expect(within(widget.root).getByText('No workflow runs in this range.')).toBeDefined();
    expect(widget.sent).toHaveLength(1);
    await expectSameTab(card, widget, 'Tools');
    expect(within(widget.root).getByText('No tool calls in this range.')).toBeDefined();
  });

  it('Resources and threads', async () => {
    serveCapabilities(traceAggregateCapabilities);
    serveTraceAggregate(request =>
      request.interval ? distinctIdsSeriesFixture(request.timeRange) : distinctIdsTotalsFixture,
    );
    const card = await renderCard(<DistinctIdsCard onTimeRangeClick={noop} />, scope);
    const widget = await renderWidget(metricsWidget('distinct-ids'), scope);
    expect(within(card.root).getByText('Resources')).toBeDefined();
    expectSame(card, widget);
  });

  it('Breakdown, every tab', async () => {
    serveBreakdown();
    const card = await renderCard(<BreakdownCard onRowClick={noop} />, scope);
    const widget = await renderWidget(metricsWidget('breakdown'), scope);
    // Org-wide it opens on Projects, with two to compare; a project opens on Agents.
    expect(within(card.root).getByRole('tab', { selected: true }).textContent).toBe(scope ? 'Projects' : 'Agents');
    expectSame(card, widget);
    for (const tab of BREAKDOWN_TABS[scope ? 'org' : 'project']) {
      await expectSameTab(card, widget, tab);
    }
  });

  it('Breakdown row clicks', async () => {
    serveBreakdown();
    const onRowClick = vi.fn();
    const onDrilldown = vi.fn();
    const card = await renderCard(<BreakdownCard onRowClick={onRowClick} />, scope);
    const widget = await renderWidget(metricsWidget('breakdown'), scope, onDrilldown);
    for (const tab of ['Agents', 'Tools', 'Models', 'Threads', 'Environments', ...(scope ? ['Projects'] : [])]) {
      await expectSameTab(card, widget, tab);
      for (const side of [card, widget]) {
        const [first] = within(side.root).getAllByRole('listitem');
        const label = first?.querySelector('[title]');
        if (!label) throw new Error(`No rows on ${tab}`);
        fireEvent.click(label);
      }
      expect(onDrilldown).toHaveBeenLastCalledWith('traces', onRowClick.mock.lastCall?.[0]);
    }
    expect(onRowClick).toHaveBeenCalledTimes(scope ? 6 : 5);
  });

  // Scores need a project; the org page leaves them out.
  it.runIf(!scope)('Scores', async () => {
    const card = await renderCard(<ScoresCard />, scope);
    const widget = await renderWidget(metricsWidget('scores'), scope);
    expect(within(card.root).getByText('Answer relevancy')).toBeDefined();
    expectSame(card, widget);
  });
});

/** A tab's requests held until released, to compare what each shows while the tab loads. */
function holdPercentiles(metric: string) {
  let release = () => {};
  const held = new Promise<void>(resolve => (release = resolve));
  server.use(
    http.post(`${API}/metrics/percentiles`, async ({ request }) => {
      const body = record(await request.clone().json());
      if (body.name !== metric) return undefined;
      await held;
      return HttpResponse.json(agentLatencyFixture());
    }),
  );
  return release;
}

/** Clicks a tab in both and returns their markup once each has sent its requests, before answers. */
async function switchWhileLoading(card: Rendered, widget: Rendered, tab: string) {
  for (const side of [card, widget]) {
    const recorder = recordRequests();
    fireEvent.click(within(side.root).getByRole('tab', { name: tab }));
    await waitFor(() => expect(recorder.sent.length).toBeGreaterThan(0));
    recorder.stop();
    side.sent = recorder.sent;
  }
}

describe('Latency drawn at real size', () => {
  useFixedChartSize(800, 300);

  beforeEach(() => {
    seedMetrics();
  });

  it('keeps the last tab dimmed while the next loads, and refetches a tab opened again', async () => {
    const release = holdPercentiles('mastra_workflow_duration_ms');
    const card = await renderCard(<LatencyCard onViewTraces={noop} onTimeRangeClick={noop} />, undefined);
    const widget = await renderWidget(metricsWidget('latency'), undefined);
    expect(card.root.querySelector('.recharts-area-curve')).not.toBeNull();
    expectSame(card, widget);

    await switchWhileLoading(card, widget, 'Workflows');
    // The card keeps the agents' chart, dimmed, rather than a skeleton.
    expect(card.root.querySelector('.recharts-area-curve')).not.toBeNull();
    expectSame(card, widget);

    release();
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));
    expectSame(card, widget);

    // Going back to Agents, the card refetches; so must the widget.
    await expectSameTab(card, widget, 'Agents');
    expect(card.sent).toHaveLength(1);
  });
});

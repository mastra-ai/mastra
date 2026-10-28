// @vitest-environment jsdom
import type { DashboardWidget } from '@mastra/client-js';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { DistinctIdsCard } from '../../metrics/components/distinct-ids-card';
import { FailureRateCard } from '../../metrics/components/failure-rate-card';
import { LatencyCard } from '../../metrics/components/latency-card';
import { MetricsKpis } from '../../metrics/components/metrics-kpis';
import { ScoresCard } from '../../metrics/components/scores-card';
import { TokenUsageCard } from '../../metrics/components/token-usage-card';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import {
  agentRunsWidget,
  distinctIdsWidget,
  failureRateWidget,
  kpisWidget,
  latencyWidget,
  scoresWidget,
  tokenUsageWidget,
} from './fixtures/metrics-widgets';
import { server } from '@/test/msw-server';

/**
 * Each of today's Metrics cards next to the widget describing it: both must send the same requests
 * (bodies and count) and render the same DOM, at project and org scope. These gate #28714.
 */

const SCOPES: Record<'project' | 'org', MetricsScope | undefined> = {
  project: undefined,
  org: { projectLabel: (id: string) => `Project ${id}` },
};

/** Sorts object keys so two bodies with the same fields compare equal. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

/** Records every request sent while it's on, as `METHOD path?query body`. */
function recordRequests() {
  const sent: string[] = [];
  let inFlight = 0;
  const onStart = ({ request }: { request: Request }) => {
    inFlight++;
    const url = new URL(request.url);
    const line = `${request.method} ${url.pathname}${url.search}`;
    if (request.method === 'GET') {
      sent.push(line);
      return;
    }
    void request
      .clone()
      .text()
      .then(text => sent.push(`${line} ${JSON.stringify(canonical(text ? JSON.parse(text) : null))}`));
  };
  const onEnd = () => {
    inFlight--;
  };
  server.events.on('request:start', onStart);
  server.events.on('response:mocked', onEnd);
  return {
    sent,
    idle: () => inFlight === 0,
    stop: () => {
      server.events.removeListener('request:start', onStart);
      server.events.removeListener('response:mocked', onEnd);
    },
  };
}

/** React's `useId` values differ between two trees; they say nothing about the markup. */
const normalise = (html: string) => html.replace(/_r_[0-9a-z]+_|:r[0-9a-z]+:/g, 'ID');

/** Waits until nothing is in flight and the request count has stopped growing. */
async function settle(recorder: ReturnType<typeof recordRequests>) {
  let last = -1;
  await waitFor(
    async () => {
      await act(() => new Promise(r => setTimeout(r, 20)));
      const count = recorder.sent.length;
      const stable = count === last && recorder.idle();
      last = count;
      expect(stable).toBe(true);
    },
    { timeout: 3000 },
  );
}

type Rendered = { root: HTMLElement; sent: string[] };

function find(container: HTMLElement, selector: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Nothing matches ${selector}`);
  return found;
}

function rootOf(page: RenderedPage, id: string): Rendered {
  const rendered = page.roots[id];
  if (!rendered) throw new Error(`No ${id} on the page`);
  return rendered;
}

async function renderCard(ui: ReactElement, scope: MetricsScope | undefined): Promise<Rendered> {
  const recorder = recordRequests();
  const { container } = renderInMetrics(<div data-testid="card">{ui}</div>, { scope });
  await settle(recorder);
  recorder.stop();
  return { root: find(container, '[data-testid="card"]'), sent: recorder.sent };
}

async function renderWidget(widget: DashboardWidget, scope: MetricsScope | undefined): Promise<Rendered> {
  const recorder = recordRequests();
  const { container } = renderInMetrics(
    <DashboardRenderer definition={{ schemaVersion: 1, rows: [{ widgets: [widget] }] }} onDrilldown={() => {}} />,
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

/** Same requests (as a multiset) and same markup. */
function expectSame(card: Rendered, widget: Rendered) {
  expect(widget.root).not.toBeNull();
  expect(widget.sent.toSorted()).toEqual(card.sent.toSorted());
  expect(normalise(widget.root.innerHTML)).toBe(normalise(card.root.innerHTML));
}

/** Opens a tab in both, then compares the requests that tab sent and the markup it shows. */
async function expectSameTab(card: Rendered, widget: Rendered, tab: string) {
  for (const side of [card, widget]) {
    const recorder = recordRequests();
    fireEvent.click(within(side.root).getByRole('tab', { name: tab }));
    await settle(recorder);
    recorder.stop();
    side.sent = recorder.sent;
  }
  expectSame(card, widget);
}

const noop = () => {};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
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
    const widget = await renderWidget(kpisWidget, scope);
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
    const widgets = await renderWidgets([tokenUsageWidget, agentRunsWidget, failureRateWidget], scope);
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
    const widget = await renderWidget(latencyWidget, scope);
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
    const widget = await renderWidget(distinctIdsWidget, scope);
    expect(within(card.root).getByText('Resources')).toBeDefined();
    expectSame(card, widget);
  });

  it('Scores', async () => {
    const card = await renderCard(<ScoresCard />, scope);
    const widget = await renderWidget(scoresWidget, scope);
    expect(within(card.root).getByText('Answer relevancy')).toBeDefined();
    expectSame(card, widget);
  });
});

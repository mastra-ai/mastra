// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import {
  dashboardDefinitionEnvelopeSchema,
  dashboardDefinitionSchema,
  DASHBOARD_MAX_WIDGETS,
} from '@mastra/core/storage/dashboards';
import { act, fireEvent, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  distinctIdsSeriesFixture,
  distinctIdsTotalsFixture,
} from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import { seedMetrics, TRACE_AGGREGATE_API } from '../../metrics/components/__tests__/metrics-msw';
import { AgentRunsCard } from '../../metrics/components/agent-runs-card';
import { BreakdownCard } from '../../metrics/components/breakdown-card';
import { DistinctIdsCard } from '../../metrics/components/distinct-ids-card';
import { FailureRateCard } from '../../metrics/components/failure-rate-card';
import { LatencyCard } from '../../metrics/components/latency-card';
import { MetricsGrid } from '../../metrics/components/metrics-grid/metrics-grid';
import { MetricsKpis } from '../../metrics/components/metrics-kpis';
import { ScoresCard } from '../../metrics/components/scores-card';
import { TokenUsageCard } from '../../metrics/components/token-usage-card';
import { buildLogsDrilldownUrl, buildTracesDrilldownUrl } from '../../metrics/drilldown';
import type { DrilldownScope } from '../../metrics/drilldown';
import { MetricsProvider, useMetrics } from '../../metrics/hooks/use-metrics';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import { METRICS_DASHBOARD } from '../metrics-dashboard';
import {
  BREAKDOWN_TABS,
  SCOPES,
  TEST_NOW,
  expectSame,
  expectSameTab,
  find,
  normalise,
  recordRequests,
  serveBreakdown,
  settle,
} from './equality-harness';
import type { Rendered } from './equality-harness';
import { useFixedChartSize } from '@/test/chart-size';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';

/**
 * The whole Metrics page as Platform composes it today (`unified-metrics-cards.tsx`) next to
 * `<DashboardRenderer definition={METRICS_DASHBOARD} />`: same requests, same markup, same drilldown
 * URLs, at project and org scope.
 */

const ORG = '/orgs/o1';
const PROJECT = `${ORG}/projects/p1`;

/** Platform's `useMetricsDrilldownNavigation`, recording the URL instead of navigating. */
function useOpen(project: boolean, urls: string[]) {
  const { datePreset, customRange, dimensionalFilter } = useMetrics();
  const base = { preset: datePreset, customRange, dashboardFilter: dimensionalFilter };
  const basePath = project ? PROJECT : ORG;
  // On the org pages a project is the `project` param; the URL builders ignore `scope.projectId`.
  const go = (href: string, scope: DrilldownScope) => {
    if (project || !scope.projectId) return void urls.push(href);
    const [path = href, query] = href.split('?');
    const params = new URLSearchParams(query);
    params.set('project', scope.projectId);
    urls.push(`${path}?${params}`);
  };
  return {
    openTraces: (scope: DrilldownScope = {}) =>
      go(buildTracesDrilldownUrl({ ...base, scope, tracesBasePath: `${basePath}/traces` }), scope),
    openLogs: (scope: DrilldownScope = {}) =>
      go(buildLogsDrilldownUrl({ ...base, scope, logsBasePath: `${basePath}/logs` }), scope),
  };
}

/** Wraps a card so the test can find it; the dashboard's grid cells carry `data-widget-id`. */
const Card = ({ id, children }: { id: string; children: ReactNode }) => <div data-testid={id}>{children}</div>;

/** `UnifiedMetricsCards`, card for card and callback for callback. */
function ComposedMetricsPage({ project, urls }: { project: boolean; urls: string[] }) {
  const { openTraces, openLogs } = useOpen(project, urls);
  const agent = EntityType.AGENT;
  return (
    <>
      <Card id="kpis">
        <MetricsKpis />
      </Card>
      <Card id="breakdown">
        <BreakdownCard onRowClick={openTraces} />
      </Card>
      <Card id="token-usage">
        <TokenUsageCard onViewTraces={() => openTraces()} onTimeRangeClick={range => openTraces({ window: range })} />
      </Card>
      <MetricsGrid columns={2}>
        <MetricsGrid.Item>
          <Card id="agent-runs">
            <AgentRunsCard onTimeRangeClick={range => openTraces({ rootEntityType: agent, window: range })} />
          </Card>
        </MetricsGrid.Item>
        <MetricsGrid.Item>
          <Card id="failure-rate">
            <FailureRateCard
              onViewErrors={() => openLogs({ rootEntityType: agent, status: 'error' })}
              onTimeRangeClick={range => openTraces({ rootEntityType: agent, status: 'error', window: range })}
            />
          </Card>
        </MetricsGrid.Item>
        <MetricsGrid.Item>
          <Card id="latency">
            <LatencyCard
              onViewTraces={rootEntityType => openTraces({ rootEntityType })}
              onTimeRangeClick={range => openTraces({ window: range })}
            />
          </Card>
        </MetricsGrid.Item>
        <MetricsGrid.Item>
          <Card id="distinct-ids">
            <DistinctIdsCard onTimeRangeClick={openTraces} />
          </Card>
        </MetricsGrid.Item>
      </MetricsGrid>
      {project ? (
        <Card id="scores">
          <ScoresCard />
        </Card>
      ) : null}
    </>
  );
}

/** The same page from `METRICS_DASHBOARD`, its drilldowns routed to the same two openers. */
function DefinedMetricsPage({ project, urls }: { project: boolean; urls: string[] }) {
  const { openTraces, openLogs } = useOpen(project, urls);
  return (
    <DashboardRenderer
      definition={METRICS_DASHBOARD}
      onDrilldown={(page, scope) => {
        if (page === 'traces') return openTraces(scope);
        if (page === 'logs') return openLogs(scope);
        throw new Error(`METRICS_DASHBOARD opened ${page}, which the Metrics page doesn't route`);
      }}
    />
  );
}

type Page = { container: HTMLElement; sent: string[]; urls: string[]; ids: string[]; cards: Record<string, Rendered> };

/** A 7-day range filtered to production, so drilldowns have a range and a filter to carry. */
async function renderPage(ui: (urls: string[]) => ReactNode, scope: MetricsScope | undefined, selector: string) {
  const urls: string[] = [];
  const recorder = recordRequests();
  const { container } = renderWithProviders(
    <MetricsProvider
      preset="7d"
      filterTokens={[{ fieldId: 'environment', value: 'production' }]}
      onPresetChange={() => {}}
      onFilterTokensChange={() => {}}
      scope={scope}
    >
      {ui(urls)}
    </MetricsProvider>,
  );
  await settle(recorder);
  recorder.stop();
  const attribute = selector.slice(1, -1);
  const roots = [...container.querySelectorAll<HTMLElement>(selector)];
  const ids = roots.map(root => root.getAttribute(attribute) ?? '');
  const cards = Object.fromEntries(roots.map((root, i) => [ids[i], { root, sent: [] }]));
  return { container, sent: recorder.sent, urls, ids, cards } satisfies Page;
}

async function renderBoth(scope: MetricsScope | undefined) {
  const project = !scope;
  const composed = await renderPage(
    urls => <ComposedMetricsPage project={project} urls={urls} />,
    scope,
    '[data-testid]',
  );
  const defined = await renderPage(
    urls => <DefinedMetricsPage project={project} urls={urls} />,
    scope,
    '[data-widget-id]',
  );
  return { composed, defined };
}

const pair = (pages: { composed: Page; defined: Page }, id: string): [Rendered, Rendered] => {
  const card = pages.composed.cards[id];
  const widget = pages.defined.cards[id];
  if (!card || !widget) throw new Error(`No ${id} on both pages`);
  return [card, widget];
};

/** Distinct ids ask `aggregateTraces()` without a `groupBy`; everything else falls through to Breakdown's answers. */
function serveDistinctIds() {
  server.use(
    http.post(TRACE_AGGREGATE_API, async ({ request }) => {
      const body = (await request.clone().json()) as {
        groupBy?: string[];
        interval?: string;
        timeRange: { to: string };
      };
      if (body.groupBy?.length) return undefined;
      return HttpResponse.json(body.interval ? distinctIdsSeriesFixture(body.timeRange) : distinctIdsTotalsFixture);
    }),
  );
}

/** Hovers the middle of a card's chart, then clicks: the bucket under the pointer opens. */
async function clickBucket(root: HTMLElement) {
  const chart = find(root, '.recharts-wrapper');
  fireEvent.mouseMove(chart, { clientX: 600, clientY: 100 });
  await act(() => new Promise(r => setTimeout(r, 50)));
  fireEvent.click(chart, { clientX: 600, clientY: 100 });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(TEST_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('METRICS_DASHBOARD', () => {
  it('passes the full schema and the envelope check', () => {
    expect(dashboardDefinitionSchema.safeParse(METRICS_DASHBOARD).success).toBe(true);
    expect(dashboardDefinitionEnvelopeSchema.safeParse(METRICS_DASHBOARD).success).toBe(true);
    const ids = METRICS_DASHBOARD.rows.flatMap(row => row.widgets.map(w => w.id));
    expect(ids.length).toBeLessThanOrEqual(DASHBOARD_MAX_WIDGETS);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Opens a card's tab on both pages. The first open of a tab must send the same requests and show the
 * same markup; opening it again (or the tab already showing) need only show the same markup.
 */
function tabOpener(pages: { composed: Page; defined: Page }) {
  const opened = new Map<string, Set<string>>();
  return async (id: string, name: string) => {
    const [card, widget] = pair(pages, id);
    let seen = opened.get(id);
    if (!seen) {
      const showing = within(card.root).getAllByRole('tab', { selected: true })[0]?.textContent ?? '';
      seen = new Set([showing]);
      opened.set(id, seen);
    }
    await expectSameTab(card, widget, name, { requests: !seen.has(name) });
    seen.add(name);
  };
}

describe.each(Object.entries(SCOPES))('the Metrics page from METRICS_DASHBOARD at %s scope', (_name, scope) => {
  // Charts draw, so their markup is compared too, and their buckets can be clicked.
  useFixedChartSize(1200, 400);

  beforeEach(() => {
    seedMetrics();
    serveBreakdown();
    serveDistinctIds();
  });

  it('sends the same requests and renders the same cards, in order', async () => {
    const pages = await renderBoth(scope);
    const expected = ['kpis', 'breakdown', 'token-usage', 'agent-runs', 'failure-rate', 'latency', 'distinct-ids'];
    expect(pages.composed.ids).toEqual(scope ? expected : [...expected, 'scores']);
    expect(pages.defined.ids).toEqual(pages.composed.ids);
    expect(pages.defined.sent.length).toBeGreaterThan(0);
    expect(pages.defined.sent.toSorted()).toEqual(pages.composed.sent.toSorted());
    for (const id of pages.composed.ids) {
      const [card, widget] = pair(pages, id);
      expect(normalise(widget.root.innerHTML), id).toBe(normalise(card.root.innerHTML));
    }
  });

  it('sends the same requests and shows the same markup on every tab', async () => {
    const pages = await renderBoth(scope);
    const tabs: [string, string[]][] = [
      ['breakdown', BREAKDOWN_TABS[scope ? 'org' : 'project']],
      ['token-usage', ['Cost', 'Tokens']],
      ['latency', ['Workflows', 'Tools', 'Agents']],
    ];
    const open = tabOpener(pages);
    for (const [id, labels] of tabs) {
      for (const label of labels) await open(id, label);
    }
    // Every other card is untouched by the tabs above.
    for (const id of pages.composed.ids) {
      const [card, widget] = pair(pages, id);
      expectSame({ ...card, sent: [] }, { ...widget, sent: [] });
    }
  });

  describe('drilldowns', () => {
    it('open the same URLs', async () => {
      const pages = await renderBoth(scope);
      /** Does the same thing on both pages; each must open exactly one URL. */
      const both = async (id: string, act: (root: HTMLElement) => void | Promise<void>) => {
        for (const page of [pages.composed, pages.defined]) {
          const before = page.urls.length;
          const card = page.cards[id];
          if (!card) throw new Error(`No ${id}`);
          await act(card.root);
          expect(page.urls.length, `${id} opened one URL`).toBe(before + 1);
        }
        expect(pages.defined.urls.at(-1)).toBe(pages.composed.urls.at(-1));
      };
      const button = (name: string) => (root: HTMLElement) =>
        fireEvent.click(within(root).getByRole('button', { name }));
      const tab = tabOpener(pages);

      for (const name of ['Tokens', 'Cost']) {
        await tab('token-usage', name);
        await both('token-usage', button('View in traces'));
        await both('token-usage', clickBucket);
      }
      await both('agent-runs', clickBucket);
      await both('failure-rate', button('View errors in logs'));
      await both('failure-rate', clickBucket);
      for (const name of ['Agents', 'Workflows', 'Tools']) {
        await tab('latency', name);
        await both('latency', button('View in traces'));
      }
      // Back to Agents, the only tab with latency data to click on.
      await tab('latency', 'Agents');
      await both('latency', clickBucket);
      await both('distinct-ids', clickBucket);

      const rowTabs = ['Agents', 'Tools', 'Models', 'Threads', 'Environments', ...(scope ? ['Projects'] : [])];
      for (const name of rowTabs) {
        await tab('breakdown', name);
        await both('breakdown', root => {
          const label = within(root).getAllByRole('listitem')[0]?.querySelector('[title]');
          if (!label) throw new Error(`No rows on ${name}`);
          fireEvent.click(label);
        });
      }

      // Every URL keeps the page's range and filter.
      for (const url of pages.defined.urls) expect(url).toMatch(/production/);
      expect(pages.defined.urls).toEqual(pages.composed.urls);
    });
  });
});

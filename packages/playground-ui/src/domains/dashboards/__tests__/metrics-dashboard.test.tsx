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
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  distinctIdsSeriesFixture,
  distinctIdsTotalsFixture,
} from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import { seedMetrics, TRACE_AGGREGATE_API } from '../../metrics/components/__tests__/metrics-msw';
import { AgentRunsCard } from '../../metrics/components/agent-runs-card';
import { BreakdownCard } from '../../metrics/components/breakdown-card';
import { DistinctIdsCard } from '../../metrics/components/distinct-ids-card';
import { LatencyCard } from '../../metrics/components/latency-card';
import { MetricsGrid } from '../../metrics/components/metrics-grid/metrics-grid';
import { TokenUsageCard } from '../../metrics/components/token-usage-card';
import { buildLogsDrilldownUrl, buildTracesDrilldownUrl } from '../../metrics/drilldown';
import type { DrilldownScope } from '../../metrics/drilldown';
import { MetricsProvider, useMetrics } from '../../metrics/hooks/use-metrics';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import { METRICS_DASHBOARD } from '../metrics-dashboard';
import {
  BREAKDOWN_VIEWS,
  SCOPES,
  TEST_NOW,
  expectSame,
  expectSameView,
  expectSameViewFromCache,
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
 * The whole Metrics page composed from the cards in code, as the Platform Metrics page does (OBS-750), next to
 * `<DashboardRenderer definition={METRICS_DASHBOARD} />`: same requests, same markup, same drilldown
 * URLs, at project and org scope.
 */

const ORG = '/orgs/o1';
const PROJECT = `${ORG}/projects/p1`;

/** Opens drilldowns as the Metrics page does, recording the URL instead of navigating. */
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

/**
 * Mirrors the Platform Metrics page (OBS-750), card for card and callback for callback. If that page
 * changes, this copy and `METRICS_DASHBOARD` must change with it.
 */
function ComposedMetricsPage({ project, urls }: { project: boolean; urls: string[] }) {
  const { openTraces, openLogs } = useOpen(project, urls);
  const agent = EntityType.AGENT;
  return (
    <>
      <MetricsGrid columns={2}>
        <MetricsGrid.Item>
          <Card id="token-usage">
            <TokenUsageCard
              onViewTraces={() => openTraces()}
              onTimeRangeClick={range => openTraces({ window: range })}
            />
          </Card>
        </MetricsGrid.Item>
        <MetricsGrid.Item>
          <Card id="agent-runs">
            <AgentRunsCard
              onTimeRangeClick={range => openTraces({ rootEntityType: agent, window: range })}
              onViewErrors={() => openLogs({ rootEntityType: agent, status: 'error' })}
              onFailureTimeRangeClick={range => openTraces({ rootEntityType: agent, status: 'error', window: range })}
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
      <Card id="breakdown">
        <BreakdownCard onRowClick={openTraces} />
      </Card>
    </>
  );
}

/** The same page from `METRICS_DASHBOARD`, its drilldowns routed to the same two openers. */
function DefinedMetricsPage({ project, urls }: { project: boolean; urls: string[] }) {
  const { openTraces, openLogs } = useOpen(project, urls);
  return (
    <DashboardRenderer
      definition={METRICS_DASHBOARD}
      scope={project ? 'project' : 'org'}
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
async function renderPage(
  ui: (urls: string[]) => ReactNode,
  scope: MetricsScope | undefined,
  attribute: 'data-testid' | 'data-widget-id',
) {
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
  const roots = [...container.querySelectorAll<HTMLElement>(`[${attribute}]`)];
  const ids = roots.map(root => root.getAttribute(attribute) ?? '');
  const cards = Object.fromEntries(roots.map((root, i) => [ids[i], { root, sent: [] }]));
  return { container, sent: recorder.sent, urls, ids, cards } satisfies Page;
}

async function renderBoth(scope: MetricsScope | undefined) {
  const project = !scope;
  const composed = await renderPage(
    urls => <ComposedMetricsPage project={project} urls={urls} />,
    scope,
    'data-testid',
  );
  const defined = await renderPage(
    urls => <DefinedMetricsPage project={project} urls={urls} />,
    scope,
    'data-widget-id',
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

  it('is frozen all the way down, so no consumer can change it for the others', () => {
    const [row] = METRICS_DASHBOARD.rows;
    const widget = row?.widgets[0];
    const view = widget?.views[0];
    for (const part of [METRICS_DASHBOARD, METRICS_DASHBOARD.rows, row, row?.widgets, widget, view, view?.queries[0]]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    expect(() => METRICS_DASHBOARD.rows.pop()).toThrow(TypeError);
    // A copy is the way to customise it.
    const copy = structuredClone(METRICS_DASHBOARD);
    copy.rows.pop();
    expect(copy.rows).toHaveLength(METRICS_DASHBOARD.rows.length - 1);
  });
});

/** Views with no data in the fixtures, and the message both pages show there (see `expectSameView`). */
const EMPTY: Record<string, string> = {
  'latency/Workflow latency': 'No workflow runs in this range.',
  'latency/Tool latency': 'No tool calls in this range.',
};

/** Opens a card's view on both pages and compares them. */
const view = (pages: { composed: Page; defined: Page }, id: string, name: string) =>
  expectSameView(...pair(pages, id), name, EMPTY[`${id}/${name}`]);

describe.each(Object.entries(SCOPES))('the Metrics page from METRICS_DASHBOARD at %s scope', (_name, scope) => {
  // Charts draw, so their markup is compared too, and their buckets can be clicked.
  useFixedChartSize(1200, 400);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });

  beforeEach(() => {
    seedMetrics();
    serveBreakdown();
    serveDistinctIds();
  });

  it('sends the same requests and renders the same cards, in order', async () => {
    const pages = await renderBoth(scope);
    expect(pages.composed.ids).toEqual(['token-usage', 'agent-runs', 'latency', 'distinct-ids', 'breakdown']);
    expect(pages.defined.ids).toEqual(pages.composed.ids);
    expect(pages.defined.sent.length).toBeGreaterThan(0);
    expect(pages.defined.sent.toSorted()).toEqual(pages.composed.sent.toSorted());
    for (const id of pages.composed.ids) {
      const [card, widget] = pair(pages, id);
      expect(normalise(widget.root.innerHTML), id).toBe(normalise(card.root.innerHTML));
    }
  });

  it('lays out four charts in two rows, then the breakdown', async () => {
    const { defined } = await renderBoth(scope);
    const grid = defined.cards['token-usage']?.root.parentElement?.parentElement;
    if (!grid) throw new Error('No dashboard grid');
    const rows = [...grid.children].map(row =>
      [...row.querySelectorAll('[data-widget-id]')].map(cell => cell.getAttribute('data-widget-id')),
    );
    expect(rows).toEqual([['token-usage', 'agent-runs'], ['latency', 'distinct-ids'], ['breakdown']]);
  });

  it('sends the same requests and shows the same markup on every view', async () => {
    const pages = await renderBoth(scope);
    const views: [string, string[]][] = [
      ['breakdown', BREAKDOWN_VIEWS[scope ? 'org' : 'project'].map(by => `Breakdown by ${by}`)],
      ['token-usage', ['Model cost', 'Token usage']],
      ['latency', ['Workflow latency', 'Tool latency', 'Agent latency']],
    ];
    for (const [id, labels] of views) {
      for (const label of labels) await view(pages, id, label);
    }
    // Failure rate reads Agent runs' answer: the card mounts its own chart, which refetches it.
    await expectSameViewFromCache(...pair(pages, 'agent-runs'), 'Failure rate');
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
      for (const name of ['Token usage', 'Model cost']) {
        if (name !== 'Token usage') await view(pages, 'token-usage', name);
        await both('token-usage', button('View in traces'));
        await both('token-usage', clickBucket);
      }
      await both('agent-runs', clickBucket);
      await expectSameViewFromCache(...pair(pages, 'agent-runs'), 'Failure rate');
      await both('agent-runs', button('View errors in logs'));
      await both('agent-runs', clickBucket);
      for (const name of ['Agent latency', 'Workflow latency', 'Tool latency']) {
        if (name !== 'Agent latency') await view(pages, 'latency', name);
        await both('latency', button('View in traces'));
      }
      // Back to Agent latency, the only view with latency data to click on.
      await view(pages, 'latency', 'Agent latency');
      await both('latency', clickBucket);
      await both('distinct-ids', clickBucket);

      const rowViews = ['agent', 'tool', 'model', 'thread', 'environment', ...(scope ? ['project'] : [])];
      for (const by of rowViews) {
        const name = `Breakdown by ${by}`;
        await view(pages, 'breakdown', name);
        await both('breakdown', root => {
          // The first row under the header.
          const first = within(root).getAllByRole('row')[1];
          if (!first) throw new Error(`No rows on ${name}`);
          fireEvent.click(first);
        });
      }

      // Every URL keeps the page's range and filter.
      for (const url of pages.defined.urls) expect(url).toMatch(/production/);
      expect(pages.defined.urls).toEqual(pages.composed.urls);
    });
  });
});

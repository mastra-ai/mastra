// @vitest-environment jsdom
import type { DashboardDefinition, DashboardQuery, DashboardWidget } from '@mastra/client-js';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { modelSpansByModel, usageByModel } from '../../metrics/components/__tests__/fixtures/breakdown';
import {
  distinctIdsSeriesFixture,
  distinctIdsTotalsFixture,
  traceAggregateCapabilities,
} from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import { seedMetrics, serveCapabilities, serveTraceAggregate } from '../../metrics/components/__tests__/metrics-msw';
import type { TraceAggregateRequest } from '../../metrics/components/__tests__/metrics-msw';
import { MetricsProvider, useMetrics } from '../../metrics/hooks/use-metrics';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import type { DashboardScope } from '../lib/definition';
import { defineWidgetKind } from '../widget-kind';
import type { AnyWidgetKind } from '../widget-kind';
import { agentRunsWidget, distinctIdsWidget, kpisWidget, modelsWidget } from './fixtures/metrics-widgets';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const LOAD_ERROR = "Couldn't load this data. Try again in a moment.";

/** A kind defined entirely outside the renderer: one line of text per view. */
const noteKind = defineWidgetKind({
  kind: 'note',
  optionsSchema: z.strictObject({ text: z.string() }),
  component: ({ widget, views }) => (
    <p data-testid={`note-${widget.id}`}>{views.map(v => v.options.text).join(' / ')}</p>
  ),
});

/** A kind whose component throws while rendering. */
const brokenKind = defineWidgetKind({
  kind: 'broken',
  optionsSchema: z.object({}),
  component: () => {
    throw new Error('Render failed.');
  },
});

/** A kind that throws while rendering on an unfiltered page. */
const unfilteredFailsKind = defineWidgetKind({
  kind: 'unfilteredFails',
  optionsSchema: z.object({}),
  component: function UnfilteredFails({ widget }) {
    if (useMetrics().filterTokens.length === 0) throw new Error('Needs a filter.');
    return <p data-testid={`filtered-${widget.id}`}>Filtered</p>;
  },
});

/** Note views carry a query, as every view must; the note kind never sends it. */
const unused: DashboardQuery = { source: 'metrics', request: 'aggregate', name: ['unused'], aggregation: 'count' };

const note = (id: string, text: string, extra: Partial<DashboardWidget> = {}): DashboardWidget => ({
  id,
  span: 6,
  kind: 'note',
  views: [{ queries: [unused], options: { text } }],
  ...extra,
});

function renderDashboard(
  definition: DashboardDefinition,
  {
    kinds = [noteKind, brokenKind],
    scope,
    environment,
    filterTokens = environment ? [{ fieldId: 'environment', value: environment }] : [],
  }: {
    kinds?: AnyWidgetKind[];
    scope?: { metrics: MetricsScope; dashboard: DashboardScope };
    environment?: string;
    filterTokens?: { fieldId: string; value: string }[];
  } = {},
) {
  const wrap = (ui: ReactNode) => (
    <MetricsProvider
      preset="24h"
      filterTokens={filterTokens}
      onPresetChange={() => {}}
      onFilterTokensChange={() => {}}
      scope={scope?.metrics}
    >
      {ui}
    </MetricsProvider>
  );
  return renderWithProviders(
    wrap(<DashboardRenderer definition={definition} kinds={kinds} scope={scope?.dashboard ?? 'project'} />),
  );
}

const cell = (container: HTMLElement, id: string) => {
  const found = container.querySelector<HTMLElement>(`[data-widget-id="${id}"]`);
  if (!found) throw new Error(`No widget ${id}`);
  return found;
};

const definition = (...widgets: DashboardWidget[]): DashboardDefinition => ({
  schemaVersion: 1,
  rows: [{ widgets }],
});

beforeEach(() => {
  seedMetrics();
});

describe('DashboardRenderer', () => {
  describe('when a host registers its own kind', () => {
    it('renders it with no change to the renderer', () => {
      renderDashboard(definition(note('a', 'Hello'), note('b', 'World')));
      expect(screen.getByTestId('note-a').textContent).toBe('Hello');
      expect(screen.getByTestId('note-b').textContent).toBe('World');
    });
  });

  describe('when one widget fails', () => {
    it("shows an unknown kind's own error, and the rest still render", () => {
      const { container } = renderDashboard(
        definition({ ...note('a', 'x'), kind: 'heatmap', title: 'Heatmap' }, note('b', 'Still here')),
      );
      expect(within(cell(container, 'a')).getByText('This widget needs a newer version.')).toBeDefined();
      expect(within(cell(container, 'a')).getByText('Heatmap')).toBeDefined();
      expect(screen.getByTestId('note-b').textContent).toBe('Still here');
    });

    it('shows options its kind rejects, with the path, and the rest still render', () => {
      const { container } = renderDashboard(
        definition(
          { ...note('a', 'x'), views: [{ queries: [unused], options: { text: 4 } }] },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText(/^views\.0\.options\.text:/)).toBeDefined();
      expect(screen.getByTestId('note-b')).toBeDefined();
    });

    it("shows a widget core's schema rejects, and the rest still render", () => {
      const { container } = renderDashboard(
        definition(
          {
            ...note('a', 'x'),
            // Ids start with a letter; storage takes the widget, core's widget schema doesn't.
            views: [{ queries: [{ id: '1st', source: 'spanAggregate', measures: ['count'] }], options: { text: 'x' } }],
          },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText(/views\.0\.queries\.0/)).toBeDefined();
      expect(screen.getByTestId('note-b')).toBeDefined();
    });

    it('keeps a render error to its own widget', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = renderDashboard(
        definition(
          { id: 'a', span: 6, kind: 'broken', title: 'Broken', views: [{ queries: [unused] }] },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText('Render failed.')).toBeDefined();
      expect(screen.getByTestId('note-b')).toBeDefined();
    });

    it('keeps a failing request to its own widget', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );
      const { container } = renderDashboard(definition(kpisWidget, agentRunsWidget));
      await waitFor(() => expect(within(cell(container, 'kpis')).getAllByText("Couldn't load")).toHaveLength(4));
      expect(await within(cell(container, 'agent-runs')).findByText('runs')).toBeDefined();
    });

    it('loads a trace chart after Retry once its requests succeed', async () => {
      serveCapabilities(traceAggregateCapabilities);
      let failing = true;
      serveTraceAggregate(request => {
        if (failing) return HttpResponse.json({ error: 'boom' }, { status: 500 });
        return request.interval ? distinctIdsSeriesFixture(request.timeRange) : distinctIdsTotalsFixture;
      });
      const { container } = renderDashboard(definition(distinctIdsWidget));
      const widget = cell(container, 'distinct-ids');
      // The client retries an aggregate itself before the widget sees the error.
      expect(await within(widget).findByText(LOAD_ERROR, undefined, { timeout: 5000 })).toBeDefined();
      failing = false;
      fireEvent.click(within(widget).getByRole('button', { name: 'Retry' }));
      expect(await within(widget).findByText('Resources', undefined, { timeout: 5000 })).toBeDefined();
    }, 15_000);

    it('loads a table after Retry once its requests succeed', async () => {
      let failing = true;
      server.use(
        http.post<never, { aggregation?: string }>(
          `${TEST_BASE_URL}/api/observability/metrics/breakdown`,
          async ({ request }) => {
            if (failing) return HttpResponse.json({ error: 'boom' }, { status: 500 });
            const body = await request.json();
            return HttpResponse.json(body.aggregation === 'count' ? modelSpansByModel : usageByModel);
          },
        ),
      );
      const { container } = renderDashboard(definition(modelsWidget));
      const widget = cell(container, 'models');
      expect(await within(widget).findByText(LOAD_ERROR, undefined, { timeout: 5000 })).toBeDefined();
      failing = false;
      fireEvent.click(within(widget).getByRole('button', { name: 'Retry' }));
      // The header row, then one per model.
      await waitFor(() => expect(within(widget).getAllByRole('row')).toHaveLength(3));
    });

    it('renders a widget that threw again once the page filters change', () => {
      const page = (environment?: string) => (
        <MetricsProvider
          preset="24h"
          filterTokens={environment ? [{ fieldId: 'environment', value: environment }] : []}
          onPresetChange={() => {}}
          onFilterTokensChange={() => {}}
        >
          <DashboardRenderer
            definition={definition({
              ...note('a', ''),
              kind: 'unfilteredFails',
              views: [{ queries: [unused], options: {} }],
            })}
            kinds={[unfilteredFailsKind]}
            scope="project"
          />
        </MetricsProvider>
      );
      const { container, rerender } = renderWithProviders(page());
      expect(within(cell(container, 'a')).getByText('Needs a filter.')).toBeDefined();
      rerender(page('production'));
      expect(screen.getByTestId('filtered-a')).toBeDefined();
    });

    it('shows a widget whose views share a label as its own error', () => {
      const { container } = renderDashboard(
        definition(
          {
            ...note('a', ''),
            views: [
              { label: 'Same', queries: [unused], options: { text: 'one' } },
              { label: 'Same', queries: [unused], options: { text: 'two' } },
            ],
          },
          note('b', 'Still here'),
        ),
      );
      expect(within(cell(container, 'a')).getByText("views.1: another view is already labelled 'Same'")).toBeDefined();
      expect(screen.getByTestId('note-b').textContent).toBe('Still here');
    });

    it("says a trace widget can't apply a page filter it has no equivalent for, and sends nothing", async () => {
      serveCapabilities(traceAggregateCapabilities);
      const traces: TraceAggregateRequest[] = [];
      serveTraceAggregate(request => {
        traces.push(request);
        return { rows: [], truncated: false };
      });
      const { container } = renderDashboard(definition(distinctIdsWidget), {
        filterTokens: [{ fieldId: 'serviceName', value: 'checkout' }],
      });
      expect(
        await within(cell(container, 'distinct-ids')).findByText('Not available with a service filter.'),
      ).toBeDefined();
      expect(traces).toHaveLength(0);
    });

    it('says why a dashboard that storage would reject cannot be shown', () => {
      // Two widgets with one id: storage rejects the whole definition.
      renderDashboard(definition(note('a', 'Hello'), note('a', 'World')));
      expect(screen.getByText(/^This dashboard can't be shown\./)).toBeDefined();
    });
  });

  describe('scope', () => {
    const scoped = definition(
      note('org', 'Org only', { scope: 'org' }),
      note('project', 'Project only', { scope: 'project' }),
      {
        ...note('tabs', ''),
        views: [
          { label: 'Projects', scope: 'org', queries: [unused], options: { text: 'projects' } },
          { label: 'Agents', queries: [unused], options: { text: 'agents' } },
        ],
      },
    );

    it('hides org widgets and views on a project page', () => {
      const { container } = renderDashboard(scoped);
      expect(container.querySelector('[data-widget-id="org"]')).toBeNull();
      expect(screen.getByTestId('note-project')).toBeDefined();
      expect(screen.getByTestId('note-tabs').textContent).toBe('agents');
    });

    it('hides project widgets on an org page', () => {
      const { container } = renderDashboard(scoped, {
        scope: { metrics: { projectLabel: id => id }, dashboard: 'org' },
      });
      expect(container.querySelector('[data-widget-id="project"]')).toBeNull();
      expect(screen.getByTestId('note-org')).toBeDefined();
      expect(screen.getByTestId('note-tabs').textContent).toBe('projects / agents');
    });

    it('draws no row for a row whose widgets are all hidden, so the grid keeps no gap for it', () => {
      const rows: DashboardDefinition = {
        schemaVersion: 1,
        rows: [
          { widgets: [note('everywhere', 'x')] },
          { widgets: [note('project-only', 'x', { scope: 'project' })] },
          { widgets: [note('org-only', 'x', { scope: 'org' }), note('also-org', 'x', { scope: 'org' })] },
        ],
      };
      const rowsOf = (container: HTMLElement) =>
        [...(container.firstElementChild?.children ?? [])].map(row =>
          [...row.querySelectorAll('[data-widget-id]')].map(c => c.getAttribute('data-widget-id')),
        );
      expect(rowsOf(renderDashboard(rows).container)).toEqual([['everywhere'], ['project-only']]);
      cleanup();
      const org = renderDashboard(rows, { scope: { metrics: { projectLabel: id => id }, dashboard: 'org' } });
      expect(rowsOf(org.container)).toEqual([['everywhere'], ['org-only', 'also-org']]);
    });
  });

  it('lays each row out on 12 columns by span', () => {
    const { container } = renderDashboard({
      schemaVersion: 1,
      rows: [
        { widgets: [note('full', 'x', { span: 12 })] },
        { widgets: [note('half', 'x', { span: 6 }), note('third', 'x', { span: 4 })] },
      ],
    });
    // jsdom resolves no container queries, so the span's classes are what this can observe.
    expect(cell(container, 'full').className).toContain('col-span-full');
    expect(cell(container, 'half').className).toContain('@3xl:col-span-6');
    expect(cell(container, 'third').className).toContain('@7xl:col-span-4');
    // Each row is its own grid, so a short row doesn't pull widgets up from the next.
    expect(cell(container, 'full').parentElement).not.toBe(cell(container, 'half').parentElement);
  });

  it("adds the page's filters to every widget's queries", async () => {
    serveCapabilities(traceAggregateCapabilities);
    const traces: TraceAggregateRequest[] = [];
    serveTraceAggregate(request => {
      traces.push(request);
      return { rows: [], truncated: false };
    });
    const metrics: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/metrics/timeseries'))
        void request
          .clone()
          .json()
          .then(b => metrics.push(b));
    });
    renderDashboard(definition(agentRunsWidget, distinctIdsWidget), { environment: 'production' });
    await waitFor(() => expect(traces.length).toBeGreaterThan(0));
    await waitFor(() => expect(metrics.length).toBeGreaterThan(0));
    server.events.removeAllListeners();
    for (const body of metrics) expect(body).toMatchObject({ filters: { environment: 'production' } });
    for (const request of traces) expect(JSON.stringify(request.where)).toContain('production');
  });

  it("sends nothing and shows no data when a widget's filters contradict the page's", async () => {
    const sent: string[] = [];
    server.events.on('request:start', ({ request }) => sent.push(new URL(request.url).pathname));
    const [view] = agentRunsWidget.views;
    const runs = view?.queries[0];
    if (!view || runs?.source !== 'metrics') throw new Error('agent runs reads metrics');
    const staging: DashboardWidget = {
      ...agentRunsWidget,
      views: [{ ...view, queries: [{ ...runs, filters: { environment: 'staging' } }] }],
    };
    const { container } = renderDashboard(definition(staging), { environment: 'production' });
    expect(await within(cell(container, 'agent-runs')).findByText('No agent runs in this range.')).toBeDefined();
    server.events.removeAllListeners();
    expect(sent.filter(path => path.includes('/metrics/'))).toEqual([]);
  });
});

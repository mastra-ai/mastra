// @vitest-environment jsdom
import type { DashboardDefinition, DashboardQuery, DashboardWidget } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { traceAggregateCapabilities } from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import { seedMetrics, serveCapabilities, serveTraceAggregate } from '../../metrics/components/__tests__/metrics-msw';
import type { TraceAggregateRequest } from '../../metrics/components/__tests__/metrics-msw';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardRenderer } from '../components/dashboard-renderer';
import { defineWidgetKind } from '../widget-kind';
import type { AnyWidgetKind } from '../widget-kind';
import { agentRunsWidget, distinctIdsWidget, kpisWidget } from './fixtures/metrics-widgets';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

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
  }: { kinds?: AnyWidgetKind[]; scope?: MetricsScope; environment?: string } = {},
) {
  const wrap = (ui: ReactNode) => (
    <MetricsProvider
      preset="24h"
      filterTokens={environment ? [{ fieldId: 'environment', value: environment }] : []}
      onPresetChange={() => {}}
      onFilterTokensChange={() => {}}
      scope={scope}
    >
      {ui}
    </MetricsProvider>
  );
  return renderWithProviders(wrap(<DashboardRenderer definition={definition} kinds={kinds} />));
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
            views: [{ queries: [{ source: 'nowhere' }], options: { text: 'x' } }],
          } as DashboardWidget,
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

    it('says why a dashboard that storage would reject cannot be shown', () => {
      renderDashboard({ schemaVersion: 2 } as unknown as DashboardDefinition);
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
      const { container } = renderDashboard(scoped, { scope: { projectLabel: id => id } });
      expect(container.querySelector('[data-widget-id="project"]')).toBeNull();
      expect(screen.getByTestId('note-org')).toBeDefined();
      expect(screen.getByTestId('note-tabs').textContent).toBe('projects / agents');
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
      return { rows: [] };
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
});

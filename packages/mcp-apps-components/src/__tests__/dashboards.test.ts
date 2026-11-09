import { dashboardDefinitionSchema, dashboardWidgetSchema } from '@mastra/core/storage/dashboards';
import type { DashboardDefinition, DashboardWidget, DashboardWidgetView } from '@mastra/core/storage/dashboards';
import type { KpisOptions } from '@mastra/playground-ui/domains/dashboards/kinds/kpis/options';
import type { ScoresOptions } from '@mastra/playground-ui/domains/dashboards/kinds/scores/options';
import type { TableColumnOptions, TableOptions } from '@mastra/playground-ui/domains/dashboards/lib/table';
import type { TimeseriesOptions } from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import type { ValueExpr } from '@mastra/playground-ui/domains/dashboards/lib/values';
import { METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards/metrics-dashboard';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod/v4';
import { strictDashboardDefinitionSchema, strictDashboardWidgetSchema } from '../dashboards';
import type {
  DashboardKpisOptions,
  DashboardScoresOptions,
  DashboardTableColumnOptions,
  DashboardTableOptions,
  DashboardTimeseriesOptions,
  DashboardValueExpr,
  StrictDashboardDefinition,
  StrictDashboardWidget,
} from '../dashboards';

const metricsWidgets = METRICS_DASHBOARD.rows.flatMap(row => row.widgets);

const metricsWidget = (id: string): DashboardWidget => {
  const found = metricsWidgets.find(widget => widget.id === id);
  if (!found) throw new Error(`METRICS_DASHBOARD has no ${id} widget`);
  return structuredClone(found);
};

const kpis: DashboardWidget = {
  id: 'kpis',
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

const models: DashboardWidget = {
  id: 'models',
  span: 12,
  kind: 'table',
  title: 'Models',
  views: [
    {
      queries: [
        {
          id: 'calls',
          source: 'metrics',
          request: 'breakdown',
          name: ['mastra_model_total_input_tokens'],
          groupBy: ['model'],
          aggregation: 'count',
        },
      ],
      columns: [
        { id: 'name', label: 'Model', options: { type: 'name' } },
        { id: 'calls', label: 'Calls', options: { type: 'value', value: { query: 'calls' }, format: 'count' } },
        { id: 'tokens', label: 'Tokens', options: { type: 'value', value: { query: 'calls' }, format: 'count' } },
      ],
      options: { groupBy: ['model'], defaultSort: { column: 'calls', direction: 'desc' }, emptyMessage: 'No models.' },
    },
  ],
};

const scores: DashboardWidget = {
  id: 'scores',
  span: 12,
  kind: 'scores',
  title: 'Scores',
  views: [
    {
      queries: [
        { id: 'average', source: 'scores', request: 'aggregate', aggregation: 'avg', scorerId: 'relevance' },
        { id: 'series', source: 'scores', request: 'timeSeries', aggregation: 'avg', scorerId: 'relevance' },
      ],
      options: { average: 'average', series: 'series' },
    },
  ],
};

const definition = (...widgets: DashboardWidget[]): DashboardDefinition => ({ schemaVersion: 1, rows: [{ widgets }] });

/** The first view of `widget`, changed by `change`. */
const withView = (widget: DashboardWidget, change: (view: DashboardWidgetView) => DashboardWidgetView) => {
  const [first, ...rest] = structuredClone(widget).views;
  return { ...widget, views: [change(first!), ...rest] };
};

const issuesOf = (result: { error?: z.ZodError }) =>
  result.error?.issues.map(issue => ({ path: issue.path, message: issue.message }));

describe('strictDashboardDefinitionSchema', () => {
  it("passes Studio's Metrics dashboard, returning it unchanged", () => {
    const result = strictDashboardDefinitionSchema.safeParse(METRICS_DASHBOARD);

    expect(issuesOf(result)).toBeUndefined();
    expect(result.data).toEqual(METRICS_DASHBOARD);
  });

  it("passes Studio's Metrics dashboard once core has parsed it, filling in defaults", () => {
    const parsed = dashboardDefinitionSchema.parse(structuredClone(METRICS_DASHBOARD));

    expect(parsed).not.toEqual(METRICS_DASHBOARD);
    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(parsed))).toBeUndefined();
  });

  it.each([
    [
      'an unknown kind',
      definition({ ...kpis, kind: 'heatmap' }),
      [
        {
          path: ['rows', 0, 'widgets', 0, 'kind'],
          message: "Unknown widget kind 'heatmap'; expected one of kpis, table, timeseries, scores",
        },
      ],
    ],
    [
      "options the view's kind rejects",
      definition(
        kpis,
        withView(metricsWidget('agent-runs'), view => {
          const options = view.options as TimeseriesOptions;
          return { ...view, options: { ...options, series: [{ ...options.series[0]!, value: 'runs' }] } };
        }),
      ),
      [{ path: ['rows', 0, 'widgets', 1, 'views', 0, 'options', 'series', 0, 'value'], message: 'Invalid input' }],
    ],
    [
      "a table column's options",
      definition(
        withView(models, view => ({
          ...view,
          columns: view.columns!.map((column, i) => (i === 1 ? { ...column, options: { type: 'bogus' } } : column)),
        })),
      ),
      [
        {
          path: ['rows', 0, 'widgets', 0, 'views', 0, 'columns', 1, 'options', 'type'],
          message: "Invalid discriminator value. Expected 'name' | 'dimension' | 'value' | 'change'",
        },
      ],
    ],
    [
      'columns on a view that is not a table',
      definition(withView(kpis, view => ({ ...view, columns: models.views[0]!.columns }))),
      [{ path: ['rows', 0, 'widgets', 0, 'views', 0, 'columns'], message: 'Only table widgets have columns' }],
    ],
    [
      'a KPI reading a query the view lacks, once though it fails at every scope',
      definition(
        withView(kpis, view => ({
          ...view,
          options: { items: [{ ...(view.options as KpisOptions).items[0]!, value: { query: 'nope' } }] },
        })),
      ),
      [
        {
          path: ['rows', 0, 'widgets', 0, 'views', 0],
          message: "options: reads query 'nope', which the view doesn't have",
        },
      ],
    ],
    [
      'scores reads naming different scorers',
      definition(
        withView(scores, view => ({
          ...view,
          queries: [
            view.queries[0]!,
            { ...view.queries[1]!, scorerId: 'toxicity' } as DashboardWidgetView['queries'][number],
          ],
        })),
      ),
      [
        {
          path: ['rows', 0, 'widgets', 0, 'views', 0],
          message: "options.average names scorer 'relevance' but options.series names 'toxicity'; they must match",
        },
      ],
    ],
    [
      'a chart query with its own interval',
      definition(
        withView(metricsWidget('agent-runs'), view => ({
          ...view,
          queries: [{ ...view.queries[0]!, interval: '1h' } as DashboardWidgetView['queries'][number]],
        })),
      ),
      [
        {
          path: ['rows', 0, 'widgets', 0, 'views', 0],
          message: "query 'runs' sets its own interval; the chart's buckets follow the page's range",
        },
      ],
    ],
    [
      'two views with one label',
      definition({
        ...metricsWidget('agent-runs'),
        views: metricsWidget('agent-runs').views.map(view => ({ ...view, label: 'Same' })),
      }),
      [{ path: ['rows', 0, 'widgets', 0, 'views', 1], message: "another view is already labelled 'Same'" }],
    ],
    [
      'a sort column only one scope has',
      definition(
        withView(models, view => ({
          ...view,
          columns: view.columns!.map(column => (column.id === 'calls' ? { ...column, scope: 'org' as const } : column)),
        })),
      ),
      [{ path: ['rows', 0, 'widgets', 0, 'views', 0], message: "options.defaultSort: no column 'calls'" }],
    ],
  ])('rejects %s, at its path', (_, value, issues) => {
    expect(dashboardDefinitionSchema.safeParse(value).success).toBe(true);
    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(value))).toEqual(issues);
  });

  it("reports what core's schema rejects at core's path, without checking kinds", () => {
    const value = definition(kpis, { ...kpis, kind: 'heatmap' });

    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(value))).toEqual(
      issuesOf(dashboardDefinitionSchema.safeParse(value)),
    );
    expect(issuesOf(strictDashboardDefinitionSchema.safeParse(value))).toEqual([
      { path: ['rows', 0, 'widgets', 1, 'id'], message: expect.any(String) },
    ]);
    expect(strictDashboardDefinitionSchema.safeParse({ ...definition(kpis), schemaVersion: 2 }).success).toBe(false);
  });
});

describe('strictDashboardWidgetSchema', () => {
  it.each(metricsWidgets.map(widget => [widget.id, widget] as const))(
    "passes Studio's %s widget, as written and as core parses it",
    (_, widget) => {
      expect(issuesOf(strictDashboardWidgetSchema.safeParse(widget))).toBeUndefined();
      expect(strictDashboardWidgetSchema.safeParse(widget).data).toBe(widget);
      expect(issuesOf(strictDashboardWidgetSchema.safeParse(dashboardWidgetSchema.parse(widget)))).toBeUndefined();
    },
  );

  it('reports paths from the widget', () => {
    const widget = withView(metricsWidget('agent-runs'), view => ({ ...view, options: { chart: 'pie' } }));

    expect(issuesOf(strictDashboardWidgetSchema.safeParse(widget))).toContainEqual({
      path: ['views', 0, 'options', 'chart'],
      message: expect.any(String),
    });
  });
});

it("types each kind's options as the kind's own schema reads them", () => {
  expectTypeOf<DashboardValueExpr>().toEqualTypeOf<ValueExpr>();
  expectTypeOf<DashboardKpisOptions>().toEqualTypeOf<KpisOptions>();
  expectTypeOf<DashboardTableOptions>().toEqualTypeOf<TableOptions>();
  expectTypeOf<DashboardTableColumnOptions>().toEqualTypeOf<TableColumnOptions>();
  expectTypeOf<DashboardTimeseriesOptions>().toEqualTypeOf<TimeseriesOptions>();
  expectTypeOf<DashboardScoresOptions>().toEqualTypeOf<ScoresOptions>();
  expectTypeOf<StrictDashboardDefinition>().toExtend<DashboardDefinition>();
  expectTypeOf<StrictDashboardWidget>().toExtend<DashboardWidget>();
  expectTypeOf<z.output<typeof strictDashboardDefinitionSchema>>().toEqualTypeOf<StrictDashboardDefinition>();
  expectTypeOf<z.output<typeof strictDashboardWidgetSchema>>().toEqualTypeOf<StrictDashboardWidget>();
});

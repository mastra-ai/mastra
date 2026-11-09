import type { DashboardDefinition, DashboardWidget, DashboardWidgetView } from '@mastra/core/storage/dashboards';
import type { KpisOptions } from '@mastra/playground-ui/domains/dashboards/kinds/kpis/options';
import type { TimeseriesOptions } from '@mastra/playground-ui/domains/dashboards/lib/timeseries';
import { METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards/metrics-dashboard';

export const metricsWidgets = METRICS_DASHBOARD.rows.flatMap(row => row.widgets);

export const metricsWidget = (id: string): DashboardWidget => {
  const found = metricsWidgets.find(widget => widget.id === id);
  if (!found) throw new Error(`METRICS_DASHBOARD has no ${id} widget`);
  return structuredClone(found);
};

export const kpis: DashboardWidget = {
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

export const models: DashboardWidget = {
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

export const scores: DashboardWidget = {
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

export const definition = (...widgets: DashboardWidget[]): DashboardDefinition => ({
  schemaVersion: 1,
  rows: [{ widgets }],
});

/** The first view of `widget`, changed by `change`. */
export const withView = (widget: DashboardWidget, change: (view: DashboardWidgetView) => DashboardWidgetView) => {
  const [first, ...rest] = structuredClone(widget).views;
  return { ...widget, views: [change(first!), ...rest] };
};

type Issue = { path: PropertyKey[]; message: string };

/** Definitions core accepts but the renderer can't draw, with the issues the strict schema reports. */
export const BROKEN_DASHBOARDS: [name: string, definition: DashboardDefinition, issues: Issue[]][] = [
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
];

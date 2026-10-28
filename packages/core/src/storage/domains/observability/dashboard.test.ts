import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_MAX_BYTES,
  DASHBOARD_MAX_QUERIES_PER_VIEW,
  DASHBOARD_MAX_WIDGETS,
  DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_SCHEMA_VERSIONS,
  DASHBOARD_WIDGET_KINDS,
  dashboardDefinitionEnvelopeSchema,
  dashboardDefinitionSchema,
  migrateDashboardDefinition,
} from './dashboard';
import type { DashboardDefinition, DashboardQuery, DashboardWidget } from './dashboard';
import { TRACE_QUERY_MAX_DEPTH, TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE } from './trace-query';

const schemas = [
  ['full schema', dashboardDefinitionSchema],
  ['envelope', dashboardDefinitionEnvelopeSchema],
] as const;

const countQuery: DashboardQuery = { source: 'traceAggregate', measures: ['count'] };

const widget = (id: string, overrides: Partial<DashboardWidget> = {}): DashboardWidget => ({
  id,
  span: 3,
  kind: 'kpis',
  views: [{ queries: [countQuery] }],
  ...overrides,
});

const definition = (widgets: DashboardWidget[][]): DashboardDefinition => ({
  schemaVersion: 1,
  rows: widgets.map(row => ({ widgets: row })),
});

const widgets = (count: number) => Array.from({ length: count }, (_, index) => widget(`w${index}`));

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** A one-widget definition padded through `description` to exactly `bytes` serialized bytes. */
const definitionOfSize = (bytes: number) => {
  const base = definition([[widget('w0', { description: '' })]]);
  const padding = bytes - byteLength(base);
  return definition([[widget('w0', { description: 'x'.repeat(padding) })]]);
};

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map(issue => issue.message) ?? [];

/** Close to the Metrics page: every source, tabs, table columns with scope, drilldowns, defaults. */
const metricsDashboard: DashboardDefinition = {
  schemaVersion: 1,
  defaults: {
    datePreset: '24h',
    filters: [
      { fieldId: 'environment', value: 'production' },
      {
        id: 'g1',
        logic: 'or',
        nodes: [
          { id: 't1', fieldId: 'rootEntityName', value: ['support-agent', 'triage-agent'] },
          { id: 'g2', logic: 'and', nodes: [{ id: 't2', fieldId: 'status', value: 'error', operatorId: 'is' }] },
        ],
      },
    ],
  },
  rows: [
    {
      widgets: [
        {
          id: 'kpis',
          span: 12,
          kind: 'kpis',
          views: [
            {
              queries: [
                { source: 'traceAggregate', measures: ['count', 'errorRate', 'cost.sum'], compare: 'previousWindow' },
                {
                  source: 'metrics',
                  request: 'aggregate',
                  name: ['mastra_model_total_input_tokens'],
                  aggregation: 'sum',
                  compare: 'previousWindow',
                },
                { source: 'spanAggregate', measures: ['count'], compare: 'previousWindow' },
                {
                  source: 'scores',
                  request: 'aggregate',
                  scorerId: 'relevance',
                  aggregation: 'avg',
                  compare: 'previousWindow',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      widgets: [
        {
          id: 'agents',
          span: 6,
          kind: 'table',
          title: 'Agents',
          views: [
            {
              label: 'Agents',
              queries: [
                {
                  source: 'traceAggregate',
                  measures: ['count', 'duration.p95', 'errorCount'],
                  groupBy: ['rootEntityName'],
                  where: { op: 'eq', left: { path: 'rootEntityType' }, right: { literal: 'agent' } },
                  having: { op: 'gt', left: { path: 'duration.p95' }, right: { literal: 5000 } },
                  orderBy: { field: 'errorCount', direction: 'desc' },
                  limit: 10,
                },
              ],
              columns: [
                { id: 'rootEntityName', label: 'Agent' },
                { id: 'count' },
                { id: 'projectId', label: 'Project', scope: 'org' },
              ],
            },
            {
              label: 'Tools',
              description: 'Tool calls with errors',
              scope: 'project',
              drilldown: { click: { page: 'spans', filters: [{ fieldId: 'spanType', value: 'tool_call' }] } },
              queries: [
                {
                  source: 'spanAggregate',
                  measures: ['count', 'errorCount'],
                  groupBy: ['entityName'],
                  having: { op: 'gt', left: { path: 'errorCount' }, right: { literal: 0 } },
                },
              ],
            },
          ],
          drilldown: {
            action: { page: 'traces' },
            click: { page: 'traces', filters: [{ fieldId: 'status', value: 'error' }] },
          },
        },
        {
          id: 'latency',
          span: 6,
          kind: 'timeseries',
          scope: 'project',
          views: [
            {
              queries: [
                {
                  source: 'metrics',
                  request: 'percentiles',
                  name: 'mastra_agent_duration_ms',
                  percentiles: [0.5, 0.95],
                },
                {
                  source: 'metrics',
                  request: 'timeSeries',
                  name: ['mastra_model_total_input_tokens'],
                  aggregation: 'count_distinct',
                  distinctColumn: 'model',
                  interval: '1h',
                },
              ],
              options: { stacked: true },
            },
          ],
        },
      ],
    },
    {
      widgets: [
        {
          id: 'scores',
          span: 12,
          kind: 'scores',
          views: [
            {
              // No scorerId: the widget discovers scorers at run time.
              queries: [
                { source: 'scores', request: 'aggregate', aggregation: 'avg' },
                { source: 'scores', request: 'timeSeries', scorerId: 'relevance', aggregation: 'avg' },
                {
                  source: 'scores',
                  request: 'breakdown',
                  scorerId: 'relevance',
                  aggregation: 'avg',
                  groupBy: ['entityName'],
                },
                { source: 'scores', request: 'percentiles', scorerId: 'relevance', percentiles: [0.9] },
                {
                  source: 'metrics',
                  request: 'breakdown',
                  name: ['mastra_agent_duration_ms'],
                  groupBy: ['entityName'],
                  aggregation: 'avg',
                  filters: { entityType: 'agent' },
                  limit: 5,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('dashboardDefinitionSchema', () => {
  it('accepts a Metrics-page definition using every query source', () => {
    const result = dashboardDefinitionSchema.safeParse(metricsDashboard);
    expect(messages(result)).toEqual([]);
    // Aggregate defaults are applied, as for a direct aggregate request.
    const agentsQuery = result.data?.rows[1]!.widgets[0]!.views[1]!.queries[0];
    expect(agentsQuery).toMatchObject({ orderBy: { field: 'count', direction: 'desc' }, limit: 100 });
  });

  it('rejects a query that stores its own time range', () => {
    const timeRange = { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' };
    const result = dashboardDefinitionSchema.safeParse(
      definition([[widget('w', { views: [{ queries: [{ ...countQuery, timeRange } as DashboardQuery] }] })]]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['timeRange'] });
  });

  it('rejects filters.timestamp on metrics and scores queries', () => {
    const timestamp = { start: '2026-01-01T00:00:00Z' };
    const queries = [
      { source: 'metrics', request: 'aggregate', name: ['m'], aggregation: 'sum', filters: { timestamp } },
      { source: 'scores', request: 'aggregate', scorerId: 's', aggregation: 'avg', filters: { timestamp } },
    ];
    for (const query of queries) {
      const result = dashboardDefinitionSchema.safeParse(
        definition([[widget('w', { views: [{ queries: [query as DashboardQuery] }] })]]),
      );
      expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['timestamp'] });
    }
  });

  it('states comparison only as compare: previousWindow', () => {
    const queries = [
      { source: 'metrics', request: 'aggregate', name: ['m'], aggregation: 'sum', comparePeriod: 'previous_period' },
      { source: 'scores', request: 'aggregate', aggregation: 'avg', comparePeriod: 'previous_day' },
    ];
    for (const query of queries) {
      const result = dashboardDefinitionSchema.safeParse(
        definition([[widget('w', { views: [{ queries: [query as DashboardQuery] }] })]]),
      );
      expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['comparePeriod'] });
    }
    const otherWindow = { ...countQuery, compare: 'previousWeek' } as unknown as DashboardQuery;
    const result = dashboardDefinitionSchema.safeParse(
      definition([[widget('w', { views: [{ queries: [otherWindow] }] })]]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects malformed drilldowns on widgets and views', () => {
    const cases = [
      widget('w', { drilldown: { page: 'traces' } as unknown as DashboardWidget['drilldown'] }),
      widget('w', { drilldown: { click: { page: 'metrics' } } as unknown as DashboardWidget['drilldown'] }),
      widget('w', {
        views: [{ queries: [countQuery], drilldown: { action: { page: 'logs', extra: 1 } } as never }],
      }),
    ];
    for (const item of cases) {
      expect(dashboardDefinitionSchema.safeParse(definition([[item]])).success).toBe(false);
    }
  });

  it('keeps the metrics distinctColumn rule', () => {
    const query = { source: 'metrics', request: 'timeSeries', name: ['m'], aggregation: 'count_distinct' } as const;
    const result = dashboardDefinitionSchema.safeParse(definition([[widget('w', { views: [{ queries: [query] }] })]]));
    expect(messages(result)).toEqual(["distinctColumn is required when aggregation is 'count_distinct'"]);
  });

  it('rejects unknown query sources and metrics requests', () => {
    for (const query of [
      { source: 'logs', measures: ['count'] },
      { source: 'metrics', request: 'list', name: ['m'] },
    ]) {
      const result = dashboardDefinitionSchema.safeParse(
        definition([[widget('w', { views: [{ queries: [query as unknown as DashboardQuery] }] })]]),
      );
      expect(result.error?.issues[0]?.code).toBe('invalid_union');
    }
  });

  it('applies the aggregate predicate complexity guard to stored queries', () => {
    let where: Record<string, unknown> = { op: 'eq', left: { path: 'name' }, right: { literal: 'x' } };
    for (let depth = 0; depth <= TRACE_QUERY_MAX_DEPTH; depth += 1) where = { op: 'not', arg: where };
    const result = dashboardDefinitionSchema.safeParse(
      definition([[widget('w', { views: [{ queries: [{ ...countQuery, where } as DashboardQuery] }] })]]),
    );
    expect(messages(result)).toEqual([TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE]);
  });

  it('accepts any widget kind and leaves options to the kind', () => {
    // A kind core has never heard of, with options only that kind understands.
    const options = { cells: { x: 'hour', y: 'weekday' }, palette: ['#000'], threshold: 0.5 };
    const input = definition([[widget('w', { kind: 'heatmap', views: [{ queries: [countQuery], options }] })]]);
    const result = dashboardDefinitionSchema.safeParse(input);
    expect(messages(result)).toEqual([]);
    expect(result.data?.rows[0]!.widgets[0]).toMatchObject({ kind: 'heatmap', views: [{ options }] });
    expect(DASHBOARD_WIDGET_KINDS).toEqual(['kpis', 'table', 'timeseries', 'scores']);
  });

  it('still validates the common widget shape and queries for any kind', () => {
    const cases = [
      widget('w', { kind: '' }),
      widget('w', { kind: 'heatmap', span: 5 as DashboardWidget['span'] }),
      widget('w', {
        kind: 'heatmap',
        views: [{ queries: [{ source: 'traceAggregate', measures: ['nope'] } as DashboardQuery] }],
      }),
      widget('w', { views: [{ queries: [countQuery], options: 'compact' as never }] }),
    ];
    for (const input of cases) {
      expect(dashboardDefinitionSchema.safeParse(definition([[input]])).success).toBe(false);
    }
  });

  it('rejects unknown fields on writes', () => {
    const cases = [
      { ...widget('w'), extra: true } as DashboardWidget,
      widget('w', { views: [{ queries: [countQuery], extra: true } as never] }),
      widget('w', { views: [{ queries: [{ ...countQuery, extra: true } as DashboardQuery] }] }),
    ];
    for (const input of cases) {
      expect(dashboardDefinitionSchema.safeParse(definition([[input]])).success).toBe(false);
    }
  });

  it('rejects malformed filter nodes', () => {
    const cases = [
      [{ fieldId: 'status' }],
      [{ id: 'g', logic: 'xor', nodes: [] }],
      [{ id: 'g', logic: 'and', nodes: [{ fieldId: 'status', value: 1 }] }],
    ];
    for (const filters of cases) {
      const input = { ...definition([[widget('w')]]), defaults: { filters } };
      expect(dashboardDefinitionSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('dashboardDefinitionEnvelopeSchema', () => {
  it('accepts widget kinds and query internals it does not know, and keeps them', () => {
    const input = {
      ...definition([[widget('w', { kind: 'heatmap' as DashboardWidget['kind'] })]]),
      rows: [
        {
          widgets: [
            { id: 'w', kind: 'heatmap', span: 5, futureField: true, views: [{ queries: [{ source: 'future' }, 42] }] },
          ],
        },
      ],
    };
    const result = dashboardDefinitionEnvelopeSchema.safeParse(input);
    expect(messages(result)).toEqual([]);
    expect(result.data).toEqual(input);
    expect(dashboardDefinitionSchema.safeParse(input).success).toBe(false);
  });

  it('accepts the Metrics-page definition unchanged', () => {
    expect(dashboardDefinitionEnvelopeSchema.parse(metricsDashboard)).toEqual(metricsDashboard);
  });
});

describe('migrateDashboardDefinition', () => {
  it('returns a current-version definition unchanged', () => {
    const stored = dashboardDefinitionEnvelopeSchema.parse(metricsDashboard);
    expect(DASHBOARD_SCHEMA_VERSION).toBe(1);
    expect(migrateDashboardDefinition(stored)).toBe(stored);
  });

  it('upgrades every version the envelope accepts to one the full schema parses', () => {
    for (const schemaVersion of DASHBOARD_SCHEMA_VERSIONS) {
      const stored = dashboardDefinitionEnvelopeSchema.parse({ ...metricsDashboard, schemaVersion });
      const migrated = migrateDashboardDefinition(stored);
      expect(migrated.schemaVersion).toBe(DASHBOARD_SCHEMA_VERSION);
      expect(messages(dashboardDefinitionSchema.safeParse(migrated))).toEqual([]);
    }
  });
});

describe.each(schemas)('limits (%s)', (_name, schema) => {
  it(`accepts ${DASHBOARD_MAX_WIDGETS} widgets across rows and rejects ${DASHBOARD_MAX_WIDGETS + 1}`, () => {
    const all = widgets(DASHBOARD_MAX_WIDGETS + 1);
    expect(schema.safeParse(definition([all.slice(0, 10), all.slice(10, DASHBOARD_MAX_WIDGETS)])).success).toBe(true);
    const result = schema.safeParse(definition([all.slice(0, 10), all.slice(10)]));
    expect(messages(result)).toEqual([`A dashboard can have at most ${DASHBOARD_MAX_WIDGETS} widgets; found 21`]);
  });

  it(`accepts ${DASHBOARD_MAX_QUERIES_PER_VIEW} queries per view and rejects more or none`, () => {
    const withQueries = (count: number) =>
      definition([[widget('w', { views: [{ queries: Array.from({ length: count }, () => countQuery) }] })]]);
    expect(schema.safeParse(withQueries(DASHBOARD_MAX_QUERIES_PER_VIEW)).success).toBe(true);
    for (const count of [DASHBOARD_MAX_QUERIES_PER_VIEW + 1, 0]) {
      const result = schema.safeParse(withQueries(count));
      expect(result.error?.issues[0]).toMatchObject({ path: ['rows', 0, 'widgets', 0, 'views', 0, 'queries'] });
    }
  });

  it(`accepts exactly ${DASHBOARD_MAX_BYTES} serialized bytes and rejects one more`, () => {
    const atLimit = definitionOfSize(DASHBOARD_MAX_BYTES);
    expect(byteLength(atLimit)).toBe(DASHBOARD_MAX_BYTES);
    expect(schema.safeParse(atLimit).success).toBe(true);
    const result = schema.safeParse(definitionOfSize(DASHBOARD_MAX_BYTES + 1));
    expect(messages(result)).toEqual([
      `Dashboard definition is ${DASHBOARD_MAX_BYTES + 1} bytes; the limit is ${DASHBOARD_MAX_BYTES}`,
    ]);
  });

  it('counts bytes, not characters', () => {
    const base = definitionOfSize(DASHBOARD_MAX_BYTES);
    // 'é' is two UTF-8 bytes: swapping one 'x' for it adds a byte without adding a character.
    const description = `é${base.rows[0]!.widgets[0]!.description!.slice(1)}`;
    expect(schema.safeParse(definition([[widget('w0', { description })]])).success).toBe(false);
  });

  it('rejects duplicate widget ids across rows', () => {
    const result = schema.safeParse(definition([[widget('a'), widget('b')], [widget('a')]]));
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['rows', 1, 'widgets', 0, 'id'], message: "Duplicate widget id 'a'" }),
    ]);
  });

  it('rejects unknown or missing schema versions', () => {
    for (const schemaVersion of [2, 0, '1', undefined]) {
      expect(schema.safeParse({ ...definition([[widget('w')]]), schemaVersion }).success).toBe(false);
    }
  });

  it('rejects widgets missing id, kind, or views, and empty views', () => {
    for (const key of ['id', 'kind', 'views'] as const) {
      const { [key]: _omitted, ...rest } = widget('w');
      expect(schema.safeParse(definition([[rest as DashboardWidget]])).success).toBe(false);
    }
    expect(schema.safeParse(definition([[widget('w', { views: [] })]])).success).toBe(false);
    expect(schema.safeParse(definition([[widget('')]])).success).toBe(false);
  });

  it('rejects non-object input', () => {
    for (const input of [null, undefined, 'dashboard', []]) {
      expect(schema.safeParse(input).success).toBe(false);
    }
  });
});

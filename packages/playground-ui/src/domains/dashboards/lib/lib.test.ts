import { MastraClient } from '@mastra/client-js';
import type { DashboardQuery } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { kpisIssues } from '../kinds/kpis/options';
import type { KpisOptions } from '../kinds/kpis/options';
import type { ResolvedView } from '../widget-kind';
import { dashboardDefaults, inScope, targetScope, viewDrilldown } from './definition';
import { intersectFilters } from './filters';
import { buildPreviousRequest, buildRequest, sendRequest } from './requests';
import type { DashboardAnswer, DashboardPageContext, DashboardRequestOptions } from './requests';
import {
  buildTableRows,
  countRows,
  formatChange,
  listedRows,
  openingView,
  parseColumns,
  previousTableValues,
  rowDrilldown,
  tableContent,
  tableIssues,
  valueChange,
} from './table';
import type { TableColumn, TableOptions, ValueColumn } from './table';
import { shapeTimeseries, timeseriesIssues } from './timeseries';
import type { TimeseriesOptions } from './timeseries';
import { answersById, evaluate, matchesGroups, unknownQueryIssues, valueExprSchema } from './values';
import type { ValueExpr, ValueRef } from './values';
import { server } from '@/test/msw-server';

const window = { start: new Date('2026-10-27T12:00:00Z'), end: new Date('2026-10-28T12:00:00Z') };
const page: DashboardPageContext = {
  window,
  filters: { timestamp: window, environment: 'production' },
  traceWhere: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
};
type AnswerOf<M extends DashboardAnswer['method']> = Extract<DashboardAnswer, { method: M }>;
/** A span aggregate's answer with these rows. */
const spans = (rows: AnswerOf<'aggregateSpans'>['data']['rows'], truncated = false): DashboardAnswer => ({
  method: 'aggregateSpans',
  data: { rows, truncated },
});
/** A metrics breakdown's answer with these groups. */
const groups = (list: AnswerOf<'getMetricBreakdown'>['data']['groups']): DashboardAnswer => ({
  method: 'getMetricBreakdown',
  data: { groups: list },
});

/** `buildRequest` for a query it always builds a request for. */
const built = (query: DashboardQuery, options: DashboardRequestOptions) => {
  const request = buildRequest(query, page, options);
  if (!request) throw new Error('no request');
  return request;
};

describe('value expressions', () => {
  const values: Record<string, number | undefined> = { runs: 100, failed: 30, missing: undefined };
  const read = (ref: ValueRef) => values[ref.query];

  it('sums, subtracts and divides', () => {
    expect(evaluate({ sum: [{ query: 'runs' }, { query: 'failed' }] }, read)).toBe(130);
    expect(evaluate({ minus: [{ query: 'failed' }, { query: 'runs' }] }, read)).toBe(-70);
    expect(evaluate({ ratio: { of: { query: 'failed' }, over: { query: 'runs' } } }, read)).toBe(0.3);
  });

  it('is missing only when everything it reads is missing', () => {
    expect(evaluate({ query: 'missing' }, read)).toBeUndefined();
    expect(evaluate({ sum: [{ query: 'missing' }, { query: 'missing' }] }, read)).toBeUndefined();
    expect(evaluate({ sum: [{ query: 'missing' }, { query: 'failed' }] }, read)).toBe(30);
    expect(evaluate({ minus: [{ query: 'missing' }, { query: 'missing' }] }, read)).toBeUndefined();
  });

  it('gives a ratio no value when dividing by zero or nothing', () => {
    expect(evaluate({ ratio: { of: { query: 'failed' }, over: { query: 'missing' } } }, read)).toBeUndefined();
    expect(evaluate({ ratio: { of: { query: 'failed' }, over: { const: 0 } } }, read)).toBeUndefined();
  });

  it("states the cards' clamp and 0% rules explicitly", () => {
    const input: ValueExpr = { max: [{ minus: [{ query: 'failed' }, { query: 'runs' }] }, { const: 0 }] };
    expect(evaluate(input, read)).toBe(0);
    const rate: ValueExpr = {
      coalesce: [{ ratio: { of: { query: 'failed' }, over: { query: 'missing' } } }, { const: 0 }],
    };
    expect(evaluate(rate, read)).toBe(0);
    expect(evaluate({ coalesce: [{ query: 'missing' }, { query: 'failed' }] }, read)).toBe(30);
    expect(evaluate({ max: [{ query: 'missing' }] }, read)).toBeUndefined();
  });

  it('matches group keys exactly', () => {
    const failed = { query: 'runs', groups: ['error'] };
    const completed = { query: 'runs', notGroups: ['error'] };
    expect(matchesGroups(failed, 'error')).toBe(true);
    expect(matchesGroups(failed, 'Error')).toBe(false);
    expect(matchesGroups(failed, 'error-handler')).toBe(false);
    expect(matchesGroups(completed, 'ok')).toBe(true);
    expect(matchesGroups(completed, 'error')).toBe(false);
  });

  it('parses nested expressions and rejects unknown keys', () => {
    expect(valueExprSchema.safeParse({ sum: [{ minus: [{ query: 'runs' }, { query: 'failed' }] }] }).success).toBe(
      true,
    );
    expect(valueExprSchema.safeParse({ product: [{ query: 'runs' }] }).success).toBe(false);
    expect(valueExprSchema.safeParse({ query: 0 }).success).toBe(false);
    expect(unknownQueryIssues(['runs', 'other'], [{ id: 'runs' }, {}])).toEqual([
      "options: reads query 'other', which the view doesn't have",
    ]);
  });
});

describe('buildRequest', () => {
  it('ANDs the widget predicate before the page one, and sets the time range', () => {
    const query: DashboardQuery = {
      source: 'traceAggregate',
      where: { op: 'exists', path: 'threadId' },
      groupBy: ['threadId'],
      measures: ['count'],
    };
    const request = built(query, {});
    expect(request.method).toBe('aggregateTraces');
    expect(request.args).toMatchObject({
      where: { op: 'and', args: [{ op: 'exists', path: 'threadId' }, page.traceWhere] },
      timeRange: { from: window.start.toISOString(), to: window.end.toISOString() },
    });
  });

  it("ANDs metrics filters with the page's and compares an aggregate in the same request", () => {
    const query: DashboardQuery = {
      source: 'metrics',
      request: 'aggregate',
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
      filters: { entityType: EntityType.AGENT, environment: 'production' },
      compare: 'previousWindow',
    };
    const request = built(query, {});
    expect(request.unsatisfiable).toBeUndefined();
    expect(request.args).toEqual({
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
      filters: { environment: 'production', entityType: 'agent', timestamp: window },
      comparePeriod: 'previous_period',
    });
    expect(buildPreviousRequest(query, page, {})).toBeUndefined();
  });

  it('marks a request whose filters contradict the page as unsatisfiable, and answers it empty unsent', async () => {
    const query: DashboardQuery = {
      source: 'metrics',
      request: 'timeSeries',
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
      filters: { environment: 'staging' },
    };
    const request = built(query, {});
    expect(request.unsatisfiable).toBe(true);
    const sent: string[] = [];
    server.events.on('request:start', ({ request: r }) => sent.push(r.url));
    const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
    await expect(sendRequest(client, request)).resolves.toEqual({
      method: 'getMetricTimeSeries',
      data: { series: [] },
    });
    server.events.removeAllListeners();
    expect(sent).toEqual([]);
  });
  it('sends anything else over the previous window as a request of its own, last', () => {
    const query: DashboardQuery = {
      source: 'metrics',
      request: 'timeSeries',
      name: ['mastra_model_total_input_tokens'],
      aggregation: 'sum',
      compare: 'previousWindow',
    };
    const previous = buildPreviousRequest(query, page, { interval: '1h' });
    expect(previous?.args).toMatchObject({
      interval: '1h',
      filters: { timestamp: { start: new Date('2026-10-26T12:00:00Z'), end: window.start } },
    });
    expect(previous).not.toHaveProperty('priority');
  });

  it('sends a previous-window aggregate after everything else', () => {
    const query: DashboardQuery = { source: 'spanAggregate', measures: ['count'], compare: 'previousWindow' };
    const previous = buildPreviousRequest(query, page, {});
    expect(previous).toMatchObject({ priority: 2 });
    expect(previous?.args).toMatchObject({ timeRange: { to: window.start.toISOString() } });
  });
});

/** Any filters object: these cases are about how fields combine, not which fields exist. */
type Filters = Record<string, unknown>;

describe('intersectFilters', () => {
  it('keeps fields set on one side and equal values set on both', () => {
    expect(intersectFilters<Filters>({ environment: 'prod' }, { entityType: 'agent', environment: 'prod' })).toEqual({
      environment: 'prod',
      entityType: 'agent',
    });
  });

  it('intersects lists of alternatives, and contradicts when nothing is shared', () => {
    expect(intersectFilters<Filters>({ name: ['a', 'b'] }, { name: ['b', 'c'] })).toEqual({ name: ['b'] });
    expect(intersectFilters<Filters>({ scorerId: 'a' }, { scorerId: ['a', 'b'] })).toEqual({ scorerId: ['a'] });
    expect(intersectFilters<Filters>({ name: ['a'] }, { name: ['c'] })).toBeUndefined();
  });

  it('requires every tag from both, since tags must all match', () => {
    expect(intersectFilters<Filters>({ tags: ['x'] }, { tags: ['y', 'x'] })).toEqual({ tags: ['x', 'y'] });
  });

  it('merges per-key maps, contradicting on a key set differently', () => {
    expect(intersectFilters<Filters>({ labels: { a: '1' } }, { labels: { b: '2' } })).toEqual({
      labels: { a: '1', b: '2' },
    });
    expect(intersectFilters<Filters>({ labels: { a: '1' } }, { labels: { a: '2' } })).toBeUndefined();
  });

  it('contradicts on different single values', () => {
    expect(intersectFilters<Filters>({ environment: 'prod' }, { environment: 'dev' })).toBeUndefined();
  });
});

describe('definition helpers', () => {
  it('hides what belongs to the other scope', () => {
    expect(inScope({}, 'org')).toBe(true);
    expect(inScope({ scope: 'org' }, 'project')).toBe(false);
  });

  it("lets a view's drilldown targets override the widget's", () => {
    const drilldown = viewDrilldown(
      {
        id: 'w',
        span: 6,
        kind: 'timeseries',
        views: [],
        drilldown: { action: { page: 'traces' }, click: { page: 'traces' } },
      },
      { queries: [], drilldown: { action: { page: 'logs' } } },
    );
    expect(drilldown).toEqual({ action: { page: 'logs' }, click: { page: 'traces' } });
  });

  it('turns single-value chips on scope fields into a drilldown scope', () => {
    expect(
      targetScope({
        page: 'logs',
        filters: [
          { fieldId: 'status', value: 'error' },
          { fieldId: 'tags', value: ['a'] },
          { id: 'g', logic: 'or', nodes: [] },
        ],
      }),
    ).toEqual({ status: 'error' });
  });

  it('reads defaults as a preset and top-level chips', () => {
    expect(
      dashboardDefaults({
        defaults: {
          datePreset: '7d',
          filters: [
            { fieldId: 'environment', value: 'production', operatorId: 'is' },
            { id: 'g', logic: 'and', nodes: [] },
          ],
        },
      }),
    ).toEqual({ preset: '7d', filterTokens: [{ fieldId: 'environment', value: 'production' }] });
    expect(dashboardDefaults({ defaults: { datePreset: 'yesterday' } })).toEqual({ filterTokens: [] });
  });
});

describe('table rows', () => {
  const options: TableOptions = {
    groupBy: ['projectId', 'entityName'],
    defaultSort: { column: 'count', direction: 'desc' },
    emptyMessage: 'None.',
  };
  const columns: TableColumn[] = [
    { id: 'name', label: 'Agent', options: { type: 'name' } },
    { id: 'project', label: 'Project', options: { type: 'dimension', dimension: 'projectId' } },
    {
      id: 'errorRate',
      label: 'Errors',
      options: { type: 'value', value: { query: 'figures', measure: 'errorRate' }, format: 'percent' },
    },
    {
      id: 'tokens',
      label: 'Tokens',
      options: {
        type: 'value',
        value: { query: 'usage', field: 'value' },
        format: 'count',
        missing: 0,
        additive: true,
      },
    },
    {
      id: 'cost',
      label: 'Cost',
      options: { type: 'value', value: { query: 'usage', field: 'estimatedCost' }, format: 'usd', additive: true },
    },
    {
      id: 'count',
      label: 'Traces',
      options: {
        type: 'value',
        value: { query: 'figures', measure: 'countDistinct.traceId' },
        format: 'count',
        missing: 0,
        additive: true,
      },
    },
  ];
  const queries: DashboardQuery[] = [
    { id: 'figures', source: 'spanAggregate', measures: ['count'] },
    {
      id: 'usage',
      source: 'metrics',
      request: 'breakdown',
      name: ['tokens'],
      aggregation: 'sum',
      groupBy: ['entityName'],
    },
  ];
  const valueColumn = (id: string): ValueColumn => {
    const column = columns.find(c => c.id === id);
    if (column?.options.type !== 'value') throw new Error(`no value column ${id}`);
    return { ...column, options: column.options };
  };
  const firstRow = (figures: DashboardAnswer) => {
    const [row] = buildTableRows(options, columns, queries, answers(figures, groups([])));
    if (!row) throw new Error('no row');
    return row;
  };
  const answers = (figures: DashboardAnswer, usage: DashboardAnswer) =>
    answersById([{ id: 'figures' }, { id: 'usage' }], [figures, usage]);
  const aggregate = spans([
    {
      dimensions: { projectId: 'p1', entityName: 'Code Agent' },
      measures: { 'countDistinct.traceId': 4, errorRate: 0.25 },
    },
  ]);
  const usage = groups([
    { dimensions: { projectId: 'p1', entityName: 'Code Agent' }, value: 1200, estimatedCost: 0.5, costUnit: 'usd' },
    { dimensions: { projectId: 'p2', entityName: 'Idle Agent' }, value: 50, estimatedCost: null, costUnit: null },
  ]);

  it('joins the queries value columns read on groupBy, in query order, keeping a group with only usage', () => {
    expect(buildTableRows(options, columns, queries, answers(aggregate, usage))).toEqual([
      {
        key: '["p1","Code Agent"]',
        dimensions: { projectId: 'p1', entityName: 'Code Agent' },
        name: 'Code Agent',
        values: { errorRate: 0.25, tokens: 1200, cost: 0.5, count: 4 },
        units: { cost: 'usd' },
        lookups: {},
      },
      {
        key: '["p2","Idle Agent"]',
        dimensions: { projectId: 'p2', entityName: 'Idle Agent' },
        name: 'Idle Agent',
        values: { errorRate: undefined, tokens: 50, cost: undefined, count: 0 },
        units: {},
        lookups: {},
      },
    ]);
  });

  it("keeps a dimension value containing '|' whole", () => {
    const piped = spans([
      { dimensions: { projectId: 'p1', entityName: 'a|b' }, measures: { 'countDistinct.traceId': 1 } },
    ]);
    const [row] = buildTableRows(options, columns, queries, answers(piped, groups([])));
    expect(row).toMatchObject({ dimensions: { projectId: 'p1' }, name: 'a|b' });
    const previous = previousTableValues(
      options,
      columns,
      queries,
      answers(
        spans([{ dimensions: { projectId: 'p|2', entityName: 'x' }, measures: { 'countDistinct.traceId': 2 } }]),
        groups([]),
      ),
    );
    expect(listedRows(options, columns, [], previous, false)).toMatchObject([
      { dimensions: { projectId: 'p|2' }, name: 'x', values: { count: 0 } },
    ]);
  });

  it('names resources through a lookup query that never makes rows', () => {
    const threads: TableOptions = { ...options, groupBy: ['threadId'] };
    const rows = buildTableRows(
      threads,
      [
        {
          id: 'count',
          label: 'Traces',
          options: { type: 'value', value: { query: 'figures', measure: 'count' }, format: 'count' },
        },
        {
          id: 'resource',
          label: 'Resource',
          options: { type: 'dimension', dimension: 'resourceId', query: 'usage', joinOn: 'threadId' },
        },
      ],
      queries,
      answers(
        spans([{ dimensions: { threadId: 't1' }, measures: { count: 3 } }]),
        spans([
          { dimensions: { resourceId: 'user-1', threadId: 't1' }, measures: { count: 3 } },
          { dimensions: { resourceId: 'user-2', threadId: 't2' }, measures: { count: 1 } },
        ]),
      ),
    );
    expect(rows.map(r => [r.name, r.lookups.resource])).toEqual([['t1', 'user-1']]);
  });

  it('adds a dropped group at zero when a total had a value before, unless turned off or cut short', () => {
    const previous = previousTableValues(
      options,
      columns,
      queries,
      answers(
        spans([{ dimensions: { projectId: 'p1', entityName: 'Retired' }, measures: { 'countDistinct.traceId': 0 } }]),
        groups([{ dimensions: { projectId: 'p1', entityName: 'Retired' }, value: 0, estimatedCost: 2 }]),
      ),
    );
    const built = buildTableRows(options, columns, queries, answers(aggregate, groups([])));
    const listed = listedRows(options, columns, built, previous, false);
    // Cost alone was above 0; it drops to 0, and a total without a value before shows its `missing`.
    expect(listed.map(r => [r.name, r.values])).toEqual([
      ['Code Agent', { errorRate: 0.25, tokens: 0, cost: undefined, count: 4 }],
      ['Retired', { errorRate: undefined, tokens: 0, cost: 0, count: 0 }],
    ]);
    expect(listedRows(options, columns, built, previous, true)).toHaveLength(1);
    expect(listedRows({ ...options, dropped: false }, columns, built, previous, false)).toHaveLength(1);
    expect(
      listedRows({ ...options, hideUnnamed: true }, columns, [{ ...firstRow(aggregate), name: '' }], undefined, false),
    ).toEqual([]);
  });

  it('lists rows with the cap the first truncated aggregate hit, and compares only once the previous window is in', () => {
    const capped: DashboardQuery[] = [{ ...queries[0], limit: 50 }, queries[1]];
    const truncated = spans(
      [{ dimensions: { projectId: 'p1', entityName: 'Code Agent' }, measures: { 'countDistinct.traceId': 4 } }],
      true,
    );
    const content = tableContent(options, columns, capped, [truncated, usage], undefined);
    expect(content.rows.map(r => r.name)).toEqual(['Code Agent', 'Idle Agent']);
    expect(content).toMatchObject({ truncated: true, limit: 50, before: undefined });

    const compared = tableContent(options, columns, queries, [aggregate, usage], [aggregate, groups([])]);
    expect(compared).toMatchObject({ truncated: false, limit: undefined });
    expect(compared.before?.get('["p1","Code Agent"]')).toMatchObject({ count: 4 });
  });

  it('counts the groups above zero in a column once its request answers', () => {
    const [figures] = queries;
    const count = valueColumn('count');
    const zero = spans([
      { dimensions: { projectId: 'p2', entityName: 'Idle' }, measures: { 'countDistinct.traceId': 0 } },
    ]);
    expect(countRows(options, count, figures, undefined)).toBe('loading');
    expect(countRows(options, count, figures, aggregate)).toBe(1);
    expect(countRows(options, count, figures, zero)).toBe(0);
  });

  it('compares totals as New and percents in points', () => {
    const count = valueColumn('count');
    const errors = valueColumn('errorRate');
    expect(formatChange(valueChange(count, 5, undefined), count)).toBe('New');
    expect(formatChange(valueChange(count, 0, 4), count)).toBe('−100.0%');
    expect(formatChange(valueChange(errors, 0.3, undefined), errors)).toBe('—');
    expect(formatChange(valueChange(errors, 0.3, 0.1), errors)).toBe('+20.0 pt');
    expect(formatChange(valueChange(errors, 0.1, 0.1), errors)).toBe('0 pt');
  });

  it('drills into a row by its dimensions, an entity as a span filter', () => {
    const row = firstRow(aggregate);
    const fields = { projectId: 'projectId', entityName: 'entityName' } as const;
    expect(rowDrilldown({ ...options, rowDrilldown: { fields, spanTypes: ['agent_run'] } }, row)).toEqual({
      projectId: 'p1',
      span: { spanTypes: ['agent_run'], entityName: 'Code Agent' },
    });
    const unnamed = { ...row, name: '', dimensions: { projectId: 'p1', entityName: '' } };
    expect(rowDrilldown({ ...options, rowDrilldown: { fields } }, unnamed)).toEqual({ projectId: 'p1' });
    expect(rowDrilldown({ ...options, rowDrilldown: { fields, keepEmpty: true } }, unnamed)).toEqual({
      projectId: 'p1',
      entityName: '',
    });
  });

  it('checks column options, widths and what columns name', () => {
    expect(
      parseColumns([
        { id: 'name', options: { type: 'name', width: 'minmax(12rem, 3fr)' } },
        { id: 'a', options: { type: 'name', width: 'calc(100% - 1px)' } },
      ]).issues,
    ).toEqual(['columns.1.options.width: Expected auto, max-content, Nrem, Nfr or minmax(a, b) of those']);
    expect(
      tableIssues(
        [
          { id: 'name', options: { type: 'name' } },
          { id: 'resource', options: { type: 'dimension', dimension: 'resourceId', query: 'lookup' } },
          { id: 'cost', options: { type: 'value', value: { query: 'missing' }, format: 'usd', unpricedWhen: 'name' } },
        ],
        options,
        queries,
      ),
    ).toEqual([
      "options.defaultSort: no column 'count'",
      "columns: 'resource' needs both 'query' and 'joinOn', or neither",
      "columns: 'resource' reads 'resourceId', which rows aren't keyed on",
      "columns: 'cost' is unpriced by 'name', which isn't a value column",
      "columns: reads query 'lookup', which the view doesn't have",
      "columns: reads query 'missing', which the view doesn't have",
    ]);
  });
});

describe('openingView', () => {
  const view = (openWhen?: TableOptions['openWhen']): { options: TableOptions } => ({
    options: {
      groupBy: ['entityName'],
      defaultSort: { column: 'count', direction: 'desc' },
      emptyMessage: 'Nothing here.',
      openWhen,
    },
  });
  const views = [view({ minRows: 2 }), view(), view()];

  it('opens on the first view when none has openWhen', () => {
    expect(openingView([view(), view()], 5)).toBe(0);
  });

  it('opens on the openWhen view while its rows load', () => {
    expect(openingView(views, 'loading')).toBe(0);
  });

  it('opens on the openWhen view once it has minRows rows', () => {
    expect(openingView(views, 2)).toBe(0);
  });

  it('passes over the openWhen view with fewer than minRows rows', () => {
    expect(openingView(views, 1)).toBe(1);
  });

  it("passes over the openWhen view when it can't count its rows", () => {
    expect(openingView(views, 'uncountable')).toBe(1);
  });

  it('opens on the first view when a passed-over openWhen view is last', () => {
    expect(openingView([view(), view({ minRows: 2 })], 0)).toBe(0);
  });
});

describe('shapeTimeseries', () => {
  const runs: DashboardQuery = {
    id: 'runs',
    source: 'metrics',
    request: 'timeSeries',
    name: ['mastra_agent_duration_ms'],
    aggregation: 'count',
    groupBy: ['entityName'],
  };
  const options = (value: ValueExpr): TimeseriesOptions => ({
    chart: 'line',
    format: 'count',
    buckets: 'api',
    series: [{ dataKey: 'runs', label: 'Runs', color: 'green', value }],
  });
  const at = '2026-10-28T09:00:00Z';

  describe('when a ref with no group matches several series on API buckets', () => {
    it('adds them up in each bucket, as chart buckets do', () => {
      const answer: DashboardAnswer = {
        method: 'getMetricTimeSeries',
        data: {
          series: [
            { name: 'alpha', points: [{ timestamp: at, value: 3 }] },
            { name: 'beta', points: [{ timestamp: at, value: 4 }] },
          ],
        },
      };
      const shaped = shapeTimeseries({
        options: options({ query: 'runs' }),
        responses: new Map([['runs', answer]]),
        window,
        hasTraceQueries: false,
      });
      expect(shaped.data.find(b => b.ts === new Date(at).getTime())?.runs).toBe(7);
      // A bucket no series answers stays unset rather than zero.
      expect(shaped.data.filter(b => b.runs !== undefined)).toHaveLength(1);
    });
  });
});

describe('timeseriesIssues', () => {
  const options = (value: ValueExpr): TimeseriesOptions => ({
    chart: 'line',
    format: 'duration',
    buckets: 'api',
    series: [{ dataKey: 'latency', label: 'Latency', color: 'green', value }],
  });
  const latency: DashboardQuery = {
    id: 'latency',
    source: 'metrics',
    request: 'percentiles',
    name: 'mastra_agent_duration_ms',
    percentiles: [0.5, 0.95],
  };

  it('reports a ref that reads several percentiles without picking one', () => {
    expect(timeseriesIssues(options({ query: 'latency' }), [latency])).toEqual([
      "a value reading query 'latency' must pick one of its percentiles",
    ]);
  });

  it('takes a ref that picks one of the percentiles', () => {
    expect(timeseriesIssues(options({ query: 'latency', percentile: 0.95 }), [latency])).toEqual([]);
  });

  it("reports a bucketed query that sets its own interval, since the chart's grid follows the page's range", () => {
    expect(timeseriesIssues(options({ query: 'latency', percentile: 0.5 }), [{ ...latency, interval: '1d' }])).toEqual([
      "query 'latency' sets its own interval; the chart's buckets follow the page's range",
    ]);
  });

  it('takes an interval on a query sent over the whole range', () => {
    const totals: TimeseriesOptions = { ...options({ query: 'latency', percentile: 0.5 }), totals: ['latency'] };
    expect(timeseriesIssues(totals, [{ ...latency, interval: '1d' }])).toEqual([]);
  });
});

describe('kpisIssues', () => {
  const kpi = (queries: DashboardQuery[]): ResolvedView<KpisOptions> => ({
    queries,
    options: { items: [{ label: 'Runs', icon: 'bot', format: 'count', value: { query: 'runs' }, detail: 'runs' }] },
  });

  it('reports a KPI reading a query that is not an aggregate', () => {
    const series: DashboardQuery = {
      id: 'runs',
      source: 'metrics',
      request: 'timeSeries',
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
    };
    expect(kpisIssues(kpi([series]))).toEqual([
      "KPI 'Runs' reads query 'runs', which is not a metrics or scores aggregate",
    ]);
  });

  it('takes a KPI reading a metrics aggregate', () => {
    const aggregate: DashboardQuery = {
      id: 'runs',
      source: 'metrics',
      request: 'aggregate',
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count',
    };
    expect(kpisIssues(kpi([aggregate]))).toEqual([]);
  });
});

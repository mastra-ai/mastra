import type { DashboardQuery, MastraClient } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import { buildTableRows, listedRows, previousTableFigures, rowDrilldown, breakdownIssues } from './breakdown';
import type { BreakdownColumn, BreakdownOptions } from './breakdown';
import { dashboardDefaults, inScope, targetScope, viewDrilldown } from './definition';
import { intersectFilters } from './filters';
import { buildPreviousRequest, buildRequest, sendRequest } from './requests';
import type { DashboardPageContext } from './requests';
import { evaluate, matchesGroups, outOfRangeQueries, valueExprSchema } from './values';
import type { ValueExpr, ValueRef } from './values';

const window = { start: new Date('2026-10-27T12:00:00Z'), end: new Date('2026-10-28T12:00:00Z') };
const page: DashboardPageContext = {
  window,
  filters: { timestamp: window, environment: 'production' },
  traceWhere: { op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } },
};

describe('value expressions', () => {
  const values: Record<number, number | undefined> = { 0: 100, 1: 30, 2: undefined };
  const read = (ref: ValueRef) => values[ref.query];

  it('sums, subtracts and divides', () => {
    expect(evaluate({ sum: [{ query: 0 }, { query: 1 }] }, read)).toBe(130);
    expect(evaluate({ minus: [{ query: 1 }, { query: 0 }] }, read)).toBe(-70);
    expect(evaluate({ ratio: { of: { query: 1 }, over: { query: 0 } } }, read)).toBe(0.3);
  });

  it('is missing only when everything it reads is missing', () => {
    expect(evaluate({ query: 2 }, read)).toBeUndefined();
    expect(evaluate({ sum: [{ query: 2 }, { query: 2 }] }, read)).toBeUndefined();
    expect(evaluate({ sum: [{ query: 2 }, { query: 1 }] }, read)).toBe(30);
    expect(evaluate({ minus: [{ query: 2 }, { query: 2 }] }, read)).toBeUndefined();
  });

  it('gives a ratio no value when dividing by zero or nothing', () => {
    expect(evaluate({ ratio: { of: { query: 1 }, over: { query: 2 } } }, read)).toBeUndefined();
    expect(evaluate({ ratio: { of: { query: 1 }, over: { const: 0 } } }, read)).toBeUndefined();
  });

  it("states the cards' clamp and 0% rules explicitly", () => {
    const input: ValueExpr = { max: [{ minus: [{ query: 1 }, { query: 0 }] }, { const: 0 }] };
    expect(evaluate(input, read)).toBe(0);
    const rate: ValueExpr = { coalesce: [{ ratio: { of: { query: 1 }, over: { query: 2 } } }, { const: 0 }] };
    expect(evaluate(rate, read)).toBe(0);
    expect(evaluate({ coalesce: [{ query: 2 }, { query: 1 }] }, read)).toBe(30);
    expect(evaluate({ max: [{ query: 2 }] }, read)).toBeUndefined();
  });

  it('matches group keys exactly', () => {
    const failed = { query: 0, groups: ['error'] };
    const completed = { query: 0, notGroups: ['error'] };
    expect(matchesGroups(failed, 'error')).toBe(true);
    expect(matchesGroups(failed, 'Error')).toBe(false);
    expect(matchesGroups(failed, 'error-handler')).toBe(false);
    expect(matchesGroups(completed, 'ok')).toBe(true);
    expect(matchesGroups(completed, 'error')).toBe(false);
  });

  it('parses nested expressions and rejects unknown keys', () => {
    expect(valueExprSchema.safeParse({ sum: [{ minus: [{ query: 0 }, { query: 1 }] }] }).success).toBe(true);
    expect(valueExprSchema.safeParse({ product: [{ query: 0 }] }).success).toBe(false);
    expect(outOfRangeQueries([{ sum: [{ query: 0 }, { query: 3 }] }], 2)).toEqual([{ query: 3 }]);
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
    const request = buildRequest(query, page, {});
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
      filters: { entityType: 'agent', environment: 'production' },
      compare: 'previousWindow',
    };
    const request = buildRequest(query, page, {});
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
    const request = buildRequest(query, page, {});
    expect(request.unsatisfiable).toBe(true);
    const client = new Proxy({} as MastraClient, {
      get: () => {
        throw new Error('sent');
      },
    });
    await expect(sendRequest(client, request)).resolves.toEqual({ series: [] });
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
    expect(previous?.priority).toBeUndefined();
  });

  it('sends a previous-window aggregate after everything else', () => {
    const query: DashboardQuery = { source: 'spanAggregate', measures: ['count'], compare: 'previousWindow' };
    const previous = buildPreviousRequest(query, page, {});
    expect(previous?.priority).toBe(2);
    expect(previous?.args).toMatchObject({ timeRange: { to: window.start.toISOString() } });
  });
});

describe('intersectFilters', () => {
  it('keeps fields set on one side and equal values set on both', () => {
    expect(intersectFilters({ environment: 'prod' }, { entityType: 'agent', environment: 'prod' })).toEqual({
      environment: 'prod',
      entityType: 'agent',
    });
  });

  it('intersects lists of alternatives, and contradicts when nothing is shared', () => {
    expect(intersectFilters({ name: ['a', 'b'] }, { name: ['b', 'c'] })).toEqual({ name: ['b'] });
    expect(intersectFilters({ scorerId: 'a' }, { scorerId: ['a', 'b'] })).toEqual({ scorerId: ['a'] });
    expect(intersectFilters({ name: ['a'] }, { name: ['c'] })).toBeUndefined();
  });

  it('requires every tag from both, since tags must all match', () => {
    expect(intersectFilters({ tags: ['x'] }, { tags: ['y', 'x'] })).toEqual({ tags: ['x', 'y'] });
  });

  it('merges per-key maps, contradicting on a key set differently', () => {
    expect(intersectFilters({ labels: { a: '1' } }, { labels: { b: '2' } })).toEqual({ labels: { a: '1', b: '2' } });
    expect(intersectFilters({ labels: { a: '1' } }, { labels: { a: '2' } })).toBeUndefined();
  });

  it('contradicts on different single values', () => {
    expect(intersectFilters({ environment: 'prod' }, { environment: 'dev' })).toBeUndefined();
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

describe('breakdown rows', () => {
  const options: BreakdownOptions = { groupBy: ['projectId', 'entityName'], emptyMessage: 'None.' };
  const columns: BreakdownColumn[] = [
    { id: 'project', options: {} },
    { id: 'errorRate', options: { query: 0, measure: 'errorRate' } },
    { id: 'p95', options: { query: 0, measure: 'duration.p95' } },
    { id: 'tokens', options: { query: 1, field: 'value' } },
    { id: 'cost', options: { query: 1, field: 'estimatedCost' } },
    { id: 'count', options: { query: 0, measure: 'countDistinct.traceId' } },
  ];
  const aggregate = {
    rows: [
      {
        dimensions: { projectId: 'p1', entityName: 'Code Agent' },
        measures: { 'countDistinct.traceId': 4, errorRate: 0.25, 'duration.p95': 900 },
      },
    ],
  };
  const usage = {
    groups: [
      { dimensions: { projectId: 'p1', entityName: 'Code Agent' }, value: 1200, estimatedCost: 0.5, costUnit: 'usd' },
      { dimensions: { projectId: 'p2', entityName: 'Idle Agent' }, value: 50, estimatedCost: null, costUnit: null },
    ],
  };

  it('joins every query on groupBy, keeping a group that only has usage', () => {
    expect(buildTableRows(options, columns, [aggregate, usage])).toEqual([
      {
        key: '["p1","Code Agent"]',
        projectId: 'p1',
        name: 'Code Agent',
        count: 4,
        tokens: 1200,
        errorRate: 0.25,
        p95: 900,
        cost: 0.5,
        costUnit: 'usd',
      },
      {
        key: '["p2","Idle Agent"]',
        projectId: 'p2',
        name: 'Idle Agent',
        count: 0,
        tokens: 50,
        cost: undefined,
        costUnit: undefined,
      },
    ]);
  });

  it("keeps a dimension value containing '|' whole", () => {
    const piped = {
      rows: [{ dimensions: { projectId: 'p1', entityName: 'a|b' }, measures: { 'countDistinct.traceId': 1 } }],
    };
    const [row] = buildTableRows(options, columns, [piped, { groups: [] }]);
    expect(row).toMatchObject({ projectId: 'p1', name: 'a|b' });
    const previous = previousTableFigures(options, columns, [
      { rows: [{ dimensions: { projectId: 'p|2', entityName: 'x' }, measures: { 'countDistinct.traceId': 2 } }] },
      { groups: [] },
    ]);
    const dropped = listedRows(options, [], previous, false, true);
    expect(dropped).toMatchObject([{ projectId: 'p|2', name: 'x', count: 0 }]);
  });

  it('names resources through a lookup query', () => {
    const threads: BreakdownOptions = { groupBy: ['threadId'], emptyMessage: 'None.' };
    const rows = buildTableRows(
      threads,
      [
        { id: 'count', options: { query: 0, measure: 'count' } },
        { id: 'resource', options: { query: 1, dimension: 'resourceId', joinOn: 'threadId' } },
      ],
      [
        { rows: [{ dimensions: { threadId: 't1' }, measures: { count: 3 } }] },
        { rows: [{ dimensions: { resourceId: 'user-1', threadId: 't1' }, measures: { count: 3 } }] },
      ],
    );
    expect(rows[0]?.resource).toBe('user-1');
  });

  it('adds dropped groups unless the view turns them off or the list is cut short', () => {
    const previous = previousTableFigures(options, columns, [
      { rows: [{ dimensions: { projectId: 'p1', entityName: 'Retired' }, measures: { 'countDistinct.traceId': 2 } }] },
      { groups: [] },
    ]);
    const built = buildTableRows(options, columns, [aggregate, { groups: [] }]);
    expect(listedRows(options, built, previous, false, true).map(r => r.name)).toEqual(['Code Agent', 'Retired']);
    expect(listedRows(options, built, previous, true, true)).toHaveLength(1);
    expect(listedRows({ ...options, dropped: false }, built, previous, false, true)).toHaveLength(1);
  });

  it('drills into a row by its project and its spans or name', () => {
    const row = { key: '["p1","Code Agent"]', projectId: 'p1', name: 'Code Agent', count: 1 };
    expect(rowDrilldown({ ...options, rowScope: { spanTypes: ['agent_run'] } }, row)).toEqual({
      projectId: 'p1',
      span: { spanTypes: ['agent_run'], entityName: 'Code Agent' },
    });
    expect(rowDrilldown({ ...options, rowScope: { field: 'model' } }, { ...row, name: '' })).toEqual({
      projectId: 'p1',
    });
  });

  it('reports columns the view cannot fill', () => {
    expect(
      breakdownIssues(
        [
          { id: 'errorRate', options: { query: 0, measure: 'errorRate' } },
          { id: 'sparkline', options: {} },
          { id: 'tokens', options: { query: 4, field: 'value' } },
        ],
        [{ source: 'traceAggregate', measures: ['count'] }],
      ),
    ).toEqual([
      "columns.1: unknown column 'sparkline'",
      "columns: a breakdown needs a 'count' column",
      "columns: 'errorRate' and 'p95' come together",
      "columns: 'tokens' and 'cost' come together",
      "columns: 'tokens' reads query 4, which the view doesn't have",
    ]);
  });
});

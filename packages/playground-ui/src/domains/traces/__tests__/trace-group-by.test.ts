import type { TraceAggregateDiscovery } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import type { TraceGroupRow } from '../trace-group-by';
import {
  applyTraceGroupDrillDown,
  buildTraceGroupByRequest,
  DEFAULT_TRACE_GROUP_SORT,
  formatTraceGroupMeasure,
  formatTraceGroupValue,
  getOfferedTraceGroupByDimensions,
  getTraceGroupDrillDown,
  parseTraceGroupBy,
  parseTraceGroupSort,
  serializeTraceGroupSort,
} from '../trace-group-by';
import { buildTraceQueryRequest } from '../trace-query-filters';

const discovery = (paths: string[]): TraceAggregateDiscovery => ({
  dimensions: paths.map(path => ({ path, valueKind: 'string' })),
  measures: [],
});

const row = (measures: TraceGroupRow['measures'], cost?: TraceGroupRow['cost']): TraceGroupRow => ({
  dimensions: { entityName: 'support-agent' },
  measures,
  ...(cost ? { cost } : {}),
});

describe('getOfferedTraceGroupByDimensions', () => {
  it('offers the allowlist when the server does not report dimensions', () => {
    expect(getOfferedTraceGroupByDimensions({})).toEqual(['entityName', 'status', 'environment', 'entityType']);
  });

  it('never offers an extra dimension the server has not reported', () => {
    expect(getOfferedTraceGroupByDimensions({ extraDimensions: ['projectId'] })).not.toContain('projectId');
  });

  it('narrows the allowlist and extras to the reported dimensions', () => {
    expect(
      getOfferedTraceGroupByDimensions({
        discovery: discovery(['status', 'entityName', 'serviceName', 'projectId']),
        extraDimensions: ['projectId'],
      }),
    ).toEqual(['entityName', 'status', 'projectId']);
  });

  it('does not offer a reported extra dimension the page did not ask for', () => {
    expect(getOfferedTraceGroupByDimensions({ discovery: discovery(['entityName', 'projectId']) })).toEqual([
      'entityName',
    ]);
  });
});

describe('URL state', () => {
  it('reads only offered dimensions', () => {
    expect(parseTraceGroupBy(new URLSearchParams('groupBy=status'), ['entityName', 'status'])).toBe('status');
    expect(parseTraceGroupBy(new URLSearchParams('groupBy=projectId'), ['entityName', 'status'])).toBeUndefined();
    expect(parseTraceGroupBy(new URLSearchParams(), ['entityName'])).toBeUndefined();
  });

  it('round-trips a sort and falls back to Traces descending for anything malformed', () => {
    const sort = { measure: 'duration.p95', direction: 'asc' } as const;
    expect(parseTraceGroupSort(new URLSearchParams({ groupSort: serializeTraceGroupSort(sort) }))).toEqual(sort);
    for (const raw of ['', 'duration.p95', 'bogus:desc', 'count:sideways']) {
      expect(parseTraceGroupSort(new URLSearchParams({ groupSort: raw }))).toEqual(DEFAULT_TRACE_GROUP_SORT);
    }
  });
});

describe('buildTraceGroupByRequest', () => {
  it('groups the same selection as the trace list', () => {
    const query = buildTraceQueryRequest({
      status: 'error',
      tokens: [{ fieldId: 'environment', value: 'production' }],
      now: new Date('2026-10-15T12:00:00.000Z'),
    });

    expect(buildTraceGroupByRequest(query, 'entityName', { measure: 'cost.sum', direction: 'desc' })).toEqual({
      timeRange: query.timeRange,
      where: query.where,
      groupBy: ['entityName'],
      measures: [
        'count',
        'errorRate',
        'duration.p50',
        'duration.p95',
        'tokens.input.sum',
        'tokens.output.sum',
        'cost.sum',
      ],
      orderBy: { field: 'cost.sum', direction: 'desc' },
      limit: 50,
    });
  });

  it('omits where when the list has no filters', () => {
    const query = buildTraceQueryRequest({ tokens: [], now: new Date('2026-10-15T12:00:00.000Z') });
    expect(buildTraceGroupByRequest(query, 'status', DEFAULT_TRACE_GROUP_SORT)).not.toHaveProperty('where');
  });
});

describe('formatTraceGroupValue', () => {
  it('labels status, entity types and missing values', () => {
    expect(formatTraceGroupValue('status', 'error')).toBe('Error');
    expect(formatTraceGroupValue('status', 'success')).toBe('Success');
    expect(formatTraceGroupValue('entityType', 'workflow_run')).toBe('Workflow');
    expect(formatTraceGroupValue('entityType', 'tool')).toBe('tool');
    expect(formatTraceGroupValue('environment', null)).toBe('(not set)');
    expect(formatTraceGroupValue('entityName', '')).toBe('(not set)');
    expect(formatTraceGroupValue('entityName', 'support-agent')).toBe('support-agent');
  });
});

describe('drill-down', () => {
  it('maps each dimension to the trace list filter that selects the group', () => {
    expect(getTraceGroupDrillDown('entityName', 'support-agent')).toEqual({
      kind: 'filter',
      param: 'filterEntityName',
      value: 'support-agent',
      operatorId: 'is',
    });
    expect(getTraceGroupDrillDown('status', 'error')).toEqual({
      kind: 'filter',
      param: 'status',
      value: 'error',
      operatorId: 'is',
    });
    expect(getTraceGroupDrillDown('entityType', 'agent')).toEqual({
      kind: 'filter',
      param: 'rootEntityType',
      value: 'agent',
      operatorId: 'is',
    });
    expect(getTraceGroupDrillDown('environment', 'production')).toEqual({
      kind: 'filter',
      param: 'filterEnvironment',
      value: 'production',
      operatorId: 'is',
    });
    expect(getTraceGroupDrillDown('projectId', 'project-a')).toEqual({ kind: 'project', projectId: 'project-a' });
  });

  it('selects traces without an environment with notExists', () => {
    expect(getTraceGroupDrillDown('environment', null)).toEqual({
      kind: 'filter',
      param: 'filterEnvironment',
      value: '',
      operatorId: 'notExists',
    });
  });

  it('has no drill-down for groups the filters cannot express', () => {
    expect(getTraceGroupDrillDown('entityName', null)).toBeUndefined();
    expect(getTraceGroupDrillDown('entityType', 'tool')).toBeUndefined();
    expect(getTraceGroupDrillDown('entityType', null)).toBeUndefined();
    expect(getTraceGroupDrillDown('status', null)).toBeUndefined();
    expect(getTraceGroupDrillDown('projectId', null)).toBeUndefined();
  });

  it('replaces the existing filter on that field, keeps the rest and leaves the grouped view', () => {
    const params = new URLSearchParams(
      'groupBy=environment&groupSort=cost.sum:desc&datePreset=last-24h&filterEnvironment=staging&filterEnvironment.op=isNot&filterEntityName=support-agent',
    );
    const drillDown = getTraceGroupDrillDown('environment', 'production');
    if (drillDown?.kind !== 'filter') throw new Error('expected a filter drill-down');

    const next = applyTraceGroupDrillDown(params, drillDown);

    expect(next.has('groupBy')).toBe(false);
    expect(next.get('groupSort')).toBe('cost.sum:desc');
    expect(next.get('datePreset')).toBe('last-24h');
    expect(next.getAll('filterEnvironment')).toEqual(['production']);
    expect(next.has('filterEnvironment.op')).toBe(false);
    expect(next.get('filterEntityName')).toBe('support-agent');
  });

  it('writes the notExists operator for a not-set environment', () => {
    const drillDown = getTraceGroupDrillDown('environment', null);
    if (drillDown?.kind !== 'filter') throw new Error('expected a filter drill-down');

    const next = applyTraceGroupDrillDown(new URLSearchParams('groupBy=environment'), drillDown);

    expect(next.get('filterEnvironment')).toBe('');
    expect(next.get('filterEnvironment.op')).toBe('notExists');
  });
});

describe('formatTraceGroupMeasure', () => {
  it('formats counts, rates, durations and tokens', () => {
    const measures = {
      count: 1234,
      errorRate: 0.25,
      'duration.p50': 850,
      'duration.p95': 2400,
      'tokens.input.sum': 15200,
      'tokens.output.sum': 0,
    };
    expect(formatTraceGroupMeasure(row(measures), 'count').text).toBe('1,234');
    expect(formatTraceGroupMeasure(row(measures), 'errorRate').text).toBe('25%');
    expect(formatTraceGroupMeasure(row(measures), 'duration.p50').text).toBe('850ms');
    expect(formatTraceGroupMeasure(row(measures), 'duration.p95').text).toBe('2.4s');
    expect(formatTraceGroupMeasure(row(measures), 'tokens.input.sum').text).toBe('15.2K');
    expect(formatTraceGroupMeasure(row(measures), 'tokens.output.sum').text).toBe('0');
  });

  it('explains missing tokens', () => {
    expect(formatTraceGroupMeasure(row({ 'tokens.input.sum': null }), 'tokens.input.sum')).toEqual({
      text: '—',
      tooltip: 'No token usage recorded for these traces',
    });
  });

  it('shows a fully priced cost as is', () => {
    expect(formatTraceGroupMeasure(row({ 'cost.sum': 1.234 }, { coverage: 1, unit: 'USD' }), 'cost.sum')).toEqual({
      text: '$1.23',
    });
  });

  it('marks partially priced cost as approximate', () => {
    expect(formatTraceGroupMeasure(row({ 'cost.sum': 1.234 }, { coverage: 0.62, unit: 'USD' }), 'cost.sum')).toEqual({
      text: '~$1.23',
      tooltip: 'Priced for 62% of traces with usage',
    });
  });

  it('explains missing and mixed-currency cost', () => {
    expect(formatTraceGroupMeasure(row({ 'cost.sum': null }, { coverage: null, unit: null }), 'cost.sum')).toEqual({
      text: '—',
      tooltip: 'No priced usage for these traces',
    });
    expect(formatTraceGroupMeasure(row({ 'cost.sum': null }, { coverage: 1, unit: 'mixed' }), 'cost.sum')).toEqual({
      text: '—',
      tooltip: 'Costs use more than one currency',
    });
  });
});

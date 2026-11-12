import { describe, expect, it } from 'vitest';
import { logArgsToParams, whereToTraceFilters } from '../apps/trace-list/opened-filters';

const eq = (path: string, literal: string | number) => ({ op: 'eq', left: { path }, right: { literal } });

describe('whereToTraceFilters', () => {
  it('draws the conditions a model typically asks for as filter chips', () => {
    const result = whereToTraceFilters({
      op: 'and',
      args: [
        eq('status', 'error'),
        eq('entityType', 'workflow_run'),
        eq('entityName', 'refund-workflow'),
        { op: 'gt', left: { path: 'durationMs' }, right: { literal: 1000 } },
        { op: 'includes', path: 'tags', value: 'prod' },
        { spans: { some: eq('model', 'gemini-2.5-flash') } },
      ],
    });

    expect(result.rest).toBeUndefined();
    expect(result.groups).toEqual([]);
    expect(result.tokens).toEqual([
      { fieldId: 'status', operatorId: 'is', value: 'error' },
      { fieldId: 'rootEntityType', operatorId: 'is', value: 'workflow_run' },
      { fieldId: 'entityName', operatorId: 'is', value: 'refund-workflow' },
      { fieldId: 'durationMs', operatorId: 'gt', value: '1000' },
      { fieldId: 'tags', operatorId: 'in', value: ['prod'] },
      { fieldId: 'spans.model', operatorId: 'is', value: 'gemini-2.5-flash' },
    ]);
  });

  it('draws set membership, exclusions, and "or" combinations', () => {
    const result = whereToTraceFilters({
      op: 'and',
      args: [
        { op: 'in', value: { path: 'entityName' }, set: ['triage-agent', 'support-agent'] },
        { spans: { none: { op: 'exists', path: 'error' } } },
        {
          op: 'or',
          args: [eq('status', 'error'), { op: 'gt', left: { path: 'durationMs' }, right: { literal: 5000 } }],
        },
      ],
    });

    expect(result.rest).toBeUndefined();
    expect(result.tokens).toEqual([
      { fieldId: 'entityName', operatorId: 'in', value: ['triage-agent', 'support-agent'] },
      { fieldId: 'spans.error', operatorId: 'notExists', value: '' },
    ]);
    expect(result.groups).toEqual([
      {
        id: expect.any(String),
        logic: 'or',
        nodes: [
          { id: expect.any(String), fieldId: 'status', operatorId: 'is', value: 'error' },
          { id: expect.any(String), fieldId: 'durationMs', operatorId: 'gt', value: '5000' },
        ],
      },
    ]);
  });

  it('keeps what the filter bar would query differently applied as it was', () => {
    // Studio's "is not" on an optional field also keeps traces without it, so a bare `ne` isn't the same filter.
    const environment = { op: 'ne', left: { path: 'environment' }, right: { literal: 'production' } };
    const running = eq('status', 'running');
    const result = whereToTraceFilters({
      op: 'and',
      args: [eq('entityName', 'refund-workflow'), environment, running],
    });

    expect(result.tokens).toEqual([{ fieldId: 'entityName', operatorId: 'is', value: 'refund-workflow' }]);
    expect(result.rest).toEqual({ op: 'and', args: [environment, running] });
  });

  it('keeps a second condition on the same span apart, which the filter bar would merge into one span', () => {
    const model = { spans: { some: eq('model', 'gemini-2.5-flash') } };
    const failed = { spans: { some: { op: 'exists', path: 'error' } } };
    const result = whereToTraceFilters({ op: 'and', args: [model, failed] });

    expect(result.tokens).toEqual([{ fieldId: 'spans.model', operatorId: 'is', value: 'gemini-2.5-flash' }]);
    expect(result.rest).toEqual(failed);
  });

  it('opens with no chips without a predicate', () => {
    expect(whereToTraceFilters(undefined)).toEqual({ tokens: [], groups: [] });
  });
});

describe('logArgsToParams', () => {
  it('draws list_logs filters as the logs filter bar params, keeping the date range', () => {
    const dates = new URLSearchParams({ datePreset: 'custom', dateFrom: '2026-11-10T00:00:00.000Z' });
    const { params, rest } = logArgsToParams(
      { level: 'error', rootEntityType: 'agent', rootEntityName: 'Acme Support', tags: ['prod'] },
      dates,
    );

    expect(rest).toBeUndefined();
    expect(Object.fromEntries(params)).toEqual({
      datePreset: 'custom',
      dateFrom: '2026-11-10T00:00:00.000Z',
      rootEntityType: 'agent',
      filterLevel: 'error',
      filterEntityName: 'Acme Support',
      filterTags: 'prod',
    });
  });

  it('keeps filters the bar has no chip for applied as they were', () => {
    const { params, rest } = logArgsToParams(
      { level: ['error', 'warn'], traceId: 'trace-1', message: 'refund' },
      new URLSearchParams(),
    );

    expect(Object.fromEntries(params)).toEqual({ filterTraceId: 'trace-1' });
    expect(rest).toEqual({ level: ['error', 'warn'], message: 'refund' });
  });
});

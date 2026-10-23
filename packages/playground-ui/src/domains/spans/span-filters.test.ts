import { SPAN_QUERY_FIELD_REGISTRY } from '@mastra/core/storage';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import type { TraceFilterGroup, TraceFilterToken } from '../traces/trace-query-filters';
import {
  buildSpanQueryWhere,
  createSpanFilterBarFields,
  SPAN_CONTEXT_FILTER_FIELD_IDS,
  SPAN_CORE_FILTER_FIELD_IDS,
} from './span-filters';

const withContext = { withContextFields: true };
const coreOnly = { withContextFields: false };

const eq = (path: string, literal: string | number): TraceQueryScalarPredicate => ({
  op: 'eq',
  left: { path },
  right: { literal },
});

const fieldIds = (withContextFields: boolean) =>
  createSpanFilterBarFields({ withContextFields, entityNames: [], environments: [] }).map(field => field.id);

const collectPaths = (predicate: TraceQueryScalarPredicate | undefined): string[] => {
  if (!predicate) return [];
  const paths: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if ('path' in node && typeof node.path === 'string') paths.push(node.path);
    Object.values(node).forEach(child => (Array.isArray(child) ? child.forEach(visit) : visit(child)));
  };
  visit(predicate);
  return paths;
};

describe('span filter fields', () => {
  describe('when listing every filterable field', () => {
    it('only offers paths the span query grammar accepts', () => {
      const registryPaths = Object.keys(SPAN_QUERY_FIELD_REGISTRY);
      for (const id of [...SPAN_CORE_FILTER_FIELD_IDS, ...SPAN_CONTEXT_FILTER_FIELD_IDS]) {
        expect(registryPaths).toContain(id);
      }
    });

    it('leaves the start and end timestamps to the time-range chip', () => {
      expect(fieldIds(true)).not.toContain('startedAt');
      expect(fieldIds(true)).not.toContain('endedAt');
    });
  });

  describe('when the store does not accept context fields', () => {
    it('offers only the core fields', () => {
      expect([...fieldIds(false)].sort()).toEqual([...SPAN_CORE_FILTER_FIELD_IDS].sort());
    });
  });

  describe('when the store accepts context fields', () => {
    it('offers the core and context fields', () => {
      expect([...fieldIds(true)].sort()).toEqual(
        [...SPAN_CORE_FILTER_FIELD_IDS, ...SPAN_CONTEXT_FILTER_FIELD_IDS].sort(),
      );
    });
  });

  describe('when building each field', () => {
    const fields = createSpanFilterBarFields({
      withContextFields: true,
      entityNames: ['weather-agent'],
      environments: ['production'],
      valueSuggestions: () => async () => [],
    });
    const byId = (id: string) => {
      const field = fields.find(candidate => candidate.id === id);
      if (!field) throw new Error(`No ${id} field`);
      return field;
    };

    it('restricts status to success and error', () => {
      expect(byId('status')).toMatchObject({ strict: true, operators: ['is', 'in'] });
      expect(byId('status').suggestions).toEqual([
        { value: 'success', label: 'Success' },
        { value: 'error', label: 'Error' },
      ]);
    });

    it('restricts span type to known span types', () => {
      const values = (byId('spanType').suggestions as { value: string }[]).map(option => option.value);
      expect(byId('spanType').strict).toBe(true);
      expect(values).toContain('agent_run');
      expect(values).toContain('tool_call');
    });

    it('restricts primitive types to known entity types', () => {
      for (const id of ['entityType', 'parentEntityType', 'rootEntityType']) {
        const options = byId(id).suggestions as { value: string; label?: string }[];
        expect(byId(id).strict).toBe(true);
        expect(options).toContainEqual({ value: 'agent', label: 'Agent' });
      }
    });

    it('picks primitive names and environments from the discovered lists', () => {
      expect(byId('entityName').suggestions).toEqual([{ value: 'weather-agent' }]);
      expect(byId('rootEntityName').suggestions).toEqual([{ value: 'weather-agent' }]);
      expect(byId('environment').suggestions).toEqual([{ value: 'production' }]);
    });

    it('lets the span name match text and suggests values', () => {
      expect(byId('name').operators).toContain('matches');
      expect(typeof byId('name').suggestions).toBe('function');
    });

    it('only tests error for presence', () => {
      expect(byId('error').operators).toEqual(['exists', 'notExists']);
    });

    it('treats durations as numbers', () => {
      expect(byId('durationMs')).toMatchObject({ type: 'number' });
      expect(byId('timeToFirstChunkMs')).toMatchObject({ type: 'number' });
      expect(byId('durationMs').operators).toContain('gte');
    });

    it('leaves ids as free text', () => {
      expect(byId('runId').suggestions).toBeUndefined();
      expect(byId('traceId').operators).not.toContain('notExists');
    });
  });
});

describe('buildSpanQueryWhere', () => {
  describe('when there are no filters', () => {
    it('returns no predicate', () => {
      expect(buildSpanQueryWhere([], [], withContext)).toBeUndefined();
    });
  });

  describe('when a token filters a core field', () => {
    it('wraps a single value in a top-level and', () => {
      expect(buildSpanQueryWhere([{ fieldId: 'status', value: 'error' }], [], coreOnly)).toEqual({
        op: 'and',
        args: [eq('status', 'error')],
      });
    });

    it('uses set membership for several values', () => {
      expect(buildSpanQueryWhere([{ fieldId: 'spanType', value: ['agent_run', 'tool_call'] }], [], coreOnly)).toEqual({
        op: 'and',
        args: [{ op: 'in', value: { path: 'spanType' }, set: ['agent_run', 'tool_call'] }],
      });
    });
  });

  describe('when a token filters a context field', () => {
    const tokens: TraceFilterToken[] = [{ fieldId: 'traceId', value: 'trace-1' }];

    it('keeps it when the store accepts context fields', () => {
      expect(buildSpanQueryWhere(tokens, [], withContext)).toEqual({ op: 'and', args: [eq('traceId', 'trace-1')] });
    });

    it('drops it when the store does not', () => {
      expect(buildSpanQueryWhere(tokens, [], coreOnly)).toBeUndefined();
    });
  });

  describe('when a token uses a field the span query does not know', () => {
    it('drops it', () => {
      const tokens: TraceFilterToken[] = [
        { fieldId: 'metadata.region', value: 'eu' },
        { fieldId: 'tags', value: 'beta' },
        { fieldId: 'spans.model', value: 'gpt' },
      ];
      expect(buildSpanQueryWhere(tokens, [], withContext)).toBeUndefined();
    });
  });

  describe('when a token has no usable value', () => {
    it('drops empty values', () => {
      expect(buildSpanQueryWhere([{ fieldId: 'runId', value: '  ' }], [], withContext)).toBeUndefined();
    });

    it('drops non-numeric durations and keeps numeric ones as numbers', () => {
      expect(
        buildSpanQueryWhere([{ fieldId: 'durationMs', operatorId: 'gt', value: 'slow' }], [], withContext),
      ).toBeUndefined();
      expect(buildSpanQueryWhere([{ fieldId: 'durationMs', operatorId: 'gt', value: '250' }], [], withContext)).toEqual(
        { op: 'and', args: [{ op: 'gt', left: { path: 'durationMs' }, right: { literal: 250 } }] },
      );
    });

    it('drops text matches without letters or digits', () => {
      expect(
        buildSpanQueryWhere([{ fieldId: 'name', operatorId: 'matches', value: '***' }], [], withContext),
      ).toBeUndefined();
    });
  });

  describe('when error is filtered', () => {
    it('keeps presence checks', () => {
      expect(buildSpanQueryWhere([{ fieldId: 'error', operatorId: 'exists', value: '' }], [], coreOnly)).toEqual({
        op: 'and',
        args: [{ op: 'exists', path: 'error' }],
      });
    });

    it('drops value comparisons', () => {
      expect(
        buildSpanQueryWhere([{ fieldId: 'error', operatorId: 'is', value: 'boom' }], [], coreOnly),
      ).toBeUndefined();
    });
  });

  describe('when a negation targets an optional field', () => {
    it('keeps spans without the field', () => {
      expect(
        buildSpanQueryWhere([{ fieldId: 'environment', operatorId: 'isNot', value: 'production' }], [], withContext),
      ).toEqual({
        op: 'and',
        args: [
          {
            op: 'or',
            args: [
              { op: 'ne', left: { path: 'environment' }, right: { literal: 'production' } },
              { op: 'notExists', path: 'environment' },
            ],
          },
        ],
      });
    });
  });

  describe('when a negation targets a field every span has', () => {
    it('stays a plain negation', () => {
      expect(buildSpanQueryWhere([{ fieldId: 'status', operatorId: 'notIn', value: ['error'] }], [], coreOnly)).toEqual(
        { op: 'and', args: [{ op: 'notIn', value: { path: 'status' }, set: ['error'] }] },
      );
    });
  });

  describe('when filters are grouped', () => {
    it('keeps each group logic, including nested groups', () => {
      const groups: TraceFilterGroup[] = [
        {
          logic: 'or',
          nodes: [
            { fieldId: 'status', value: 'error' },
            {
              logic: 'and',
              nodes: [
                { fieldId: 'spanType', value: 'tool_call' },
                { fieldId: 'durationMs', operatorId: 'gte', value: '1000' },
              ],
            },
          ],
        },
      ];
      expect(buildSpanQueryWhere([{ fieldId: 'name', value: 'agent run' }], groups, coreOnly)).toEqual({
        op: 'and',
        args: [
          eq('name', 'agent run'),
          {
            op: 'or',
            args: [
              eq('status', 'error'),
              {
                op: 'and',
                args: [
                  eq('spanType', 'tool_call'),
                  { op: 'gte', left: { path: 'durationMs' }, right: { literal: 1000 } },
                ],
              },
            ],
          },
        ],
      });
    });

    it('drops groups left empty', () => {
      const groups: TraceFilterGroup[] = [{ logic: 'or', nodes: [{ fieldId: 'traceId', value: 'trace-1' }] }];
      expect(buildSpanQueryWhere([], groups, coreOnly)).toBeUndefined();
    });
  });

  describe('when every field is filtered', () => {
    it('only produces registry paths', () => {
      const tokens: TraceFilterToken[] = [...SPAN_CORE_FILTER_FIELD_IDS, ...SPAN_CONTEXT_FILTER_FIELD_IDS].map(
        fieldId => ({ fieldId, operatorId: 'isNot', value: '1' }),
      );
      const paths = collectPaths(buildSpanQueryWhere(tokens, [], withContext));
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) expect(Object.keys(SPAN_QUERY_FIELD_REGISTRY)).toContain(path);
    });
  });
});

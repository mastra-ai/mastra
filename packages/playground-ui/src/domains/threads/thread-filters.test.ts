import { THREAD_QUERY_FIELD_REGISTRY } from '@mastra/core/storage';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import { MessagesSquareIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { TraceFilterGroup, TraceFilterToken } from '../traces/trace-query-filters';
import { buildThreadQueryWhere, createThreadFilterBarFields, THREAD_FILTER_FIELD_IDS } from './thread-filters';

const eq = (path: string, literal: string | number): TraceQueryScalarPredicate => ({
  op: 'eq',
  left: { path },
  right: { literal },
});

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

describe('thread filter fields', () => {
  const fields = createThreadFilterBarFields({ entityNames: ['weather-agent'], environments: ['production'] });
  const byId = (id: string) => {
    const field = fields.find(candidate => candidate.id === id);
    if (!field) throw new Error(`No ${id} field`);
    return field;
  };

  describe('when listing every filterable field', () => {
    it('only offers paths the thread query grammar accepts', () => {
      const registryPaths = Object.keys(THREAD_QUERY_FIELD_REGISTRY);
      for (const id of THREAD_FILTER_FIELD_IDS) expect(registryPaths).toContain(id);
    });

    it('offers every thread filter field', () => {
      expect(fields.map(field => field.id).sort()).toEqual([...THREAD_FILTER_FIELD_IDS].sort());
    });

    it('leaves the start and end timestamps to the time-range chip', () => {
      expect(fields.map(field => field.id)).not.toContain('startedAt');
      expect(fields.map(field => field.id)).not.toContain('endedAt');
    });
  });

  describe('when building each field', () => {
    it('restricts status to success and error with the operators the thread query accepts', () => {
      expect(byId('status')).toMatchObject({ strict: true, operators: ['is', 'isNot', 'in', 'notIn'] });
      expect(byId('status').suggestions).toEqual([
        { value: 'success', label: 'Success' },
        { value: 'error', label: 'Error' },
      ]);
    });

    it('restricts primitive types to known entity types', () => {
      expect(byId('entityType').strict).toBe(true);
      expect(byId('entityType').suggestions).toContainEqual({ value: 'agent', label: 'Agent' });
    });

    it('picks primitive names and environments from the discovered lists', () => {
      expect(byId('entityName').suggestions).toEqual([{ value: 'weather-agent' }]);
      expect(byId('environment').suggestions).toEqual([{ value: 'production' }]);
    });

    it('treats trace count as a number without presence checks', () => {
      expect(byId('traceCount')).toMatchObject({ type: 'number' });
      expect(byId('traceCount').operators).toContain('gte');
      expect(byId('traceCount').operators).not.toContain('exists');
    });

    it('labels the trace count as Messages with the Threads message icon', () => {
      expect(byId('traceCount')).toMatchObject({ label: 'Messages', icon: MessagesSquareIcon });
    });

    it('treats time to first chunk as a number', () => {
      expect(byId('timeToFirstChunkMs')).toMatchObject({ type: 'number' });
    });

    it('leaves ids as free text', () => {
      expect(byId('runId').suggestions).toBeUndefined();
      expect(byId('threadId').operators).not.toContain('notExists');
    });
  });
});

describe('buildThreadQueryWhere', () => {
  describe('when there are no filters', () => {
    it('returns no predicate', () => {
      expect(buildThreadQueryWhere([], [])).toBeUndefined();
    });
  });

  describe('when a token filters a thread field', () => {
    it('wraps a single value in a top-level and', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'status', value: 'error' }], [])).toEqual({
        op: 'and',
        args: [eq('status', 'error')],
      });
    });

    it('uses set membership for several values', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'entityName', value: ['a', 'b'] }], [])).toEqual({
        op: 'and',
        args: [{ op: 'in', value: { path: 'entityName' }, set: ['a', 'b'] }],
      });
    });
  });

  describe('when a token uses a field the thread query does not know', () => {
    it('drops it', () => {
      const tokens: TraceFilterToken[] = [
        { fieldId: 'metadata.region', value: 'eu' },
        { fieldId: 'tags', value: 'beta' },
        { fieldId: 'spans.model', value: 'gpt' },
        { fieldId: 'traceId', value: 'trace-1' },
      ];
      expect(buildThreadQueryWhere(tokens, [])).toBeUndefined();
    });
  });

  describe('when a token has no usable value', () => {
    it('drops empty values', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'runId', value: '  ' }], [])).toBeUndefined();
    });

    it('drops non-numeric trace counts', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'traceCount', operatorId: 'gt', value: 'many' }], [])).toBeUndefined();
    });

    it('drops trace counts matched against several values', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'traceCount', value: ['2', '3'] }], [])).toBeUndefined();
    });

    it('keeps numeric trace counts as numbers', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'traceCount', operatorId: 'gt', value: '3' }], [])).toEqual({
        op: 'and',
        args: [{ op: 'gt', left: { path: 'traceCount' }, right: { literal: 3 } }],
      });
    });
  });

  describe('when a negation targets an optional field', () => {
    it('keeps threads without the field', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'environment', operatorId: 'isNot', value: 'production' }], [])).toEqual(
        {
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
        },
      );
    });
  });

  describe('when a negation targets a field every thread has', () => {
    it('stays a plain negation', () => {
      expect(buildThreadQueryWhere([{ fieldId: 'status', operatorId: 'notIn', value: ['error'] }], [])).toEqual({
        op: 'and',
        args: [{ op: 'notIn', value: { path: 'status' }, set: ['error'] }],
      });
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
                { fieldId: 'entityType', value: 'agent' },
                { fieldId: 'traceCount', operatorId: 'gte', value: '2' },
              ],
            },
          ],
        },
      ];
      expect(buildThreadQueryWhere([{ fieldId: 'entityName', value: 'weather-agent' }], groups)).toEqual({
        op: 'and',
        args: [
          eq('entityName', 'weather-agent'),
          {
            op: 'or',
            args: [
              eq('status', 'error'),
              {
                op: 'and',
                args: [eq('entityType', 'agent'), { op: 'gte', left: { path: 'traceCount' }, right: { literal: 2 } }],
              },
            ],
          },
        ],
      });
    });

    it('drops groups left empty', () => {
      const groups: TraceFilterGroup[] = [{ logic: 'or', nodes: [{ fieldId: 'traceId', value: 'trace-1' }] }];
      expect(buildThreadQueryWhere([], groups)).toBeUndefined();
    });
  });

  describe('when every field is filtered', () => {
    it('only produces registry paths', () => {
      const tokens: TraceFilterToken[] = THREAD_FILTER_FIELD_IDS.map(fieldId => ({
        fieldId,
        operatorId: 'isNot',
        value: '1',
      }));
      const paths = collectPaths(buildThreadQueryWhere(tokens, []));
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) expect(Object.keys(THREAD_QUERY_FIELD_REGISTRY)).toContain(path);
    });
  });
});

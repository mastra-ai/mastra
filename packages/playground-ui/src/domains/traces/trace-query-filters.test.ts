import { describe, expect, it } from 'vitest';
import {
  buildTraceQueryRequest,
  clampTraceDiscoveryTimeRange,
  TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS,
} from './trace-query-filters';

const now = new Date('2026-09-15T12:00:00Z');

describe('buildTraceQueryRequest', () => {
  it('defaults to the last seven days without an empty predicate', () => {
    expect(buildTraceQueryRequest({ tokens: [], now })).toEqual({
      timeRange: { from: '2026-09-08T12:00:00.000Z', to: now.toISOString() },
    });
  });

  it.each(['entityType', 'rootEntityType', 'entityName', 'environment', 'traceId', 'threadId', 'resourceId', 'status'])(
    'serializes single and multiple %s values',
    fieldId => {
      const path = fieldId === 'rootEntityType' ? 'entityType' : fieldId;
      expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: 'success' }], now })?.where).toEqual({
        op: 'and',
        args: [{ op: 'eq', left: { path }, right: { literal: 'success' } }],
      });
      expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: ['success', 'error'] }], now })?.where).toEqual({
        op: 'and',
        args: [{ op: 'in', value: { path }, set: ['success', 'error'] }],
      });
    },
  );

  it('queries entity IDs through related spans', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'entityId', value: 'agent-1' }], now })?.where).toEqual({
      op: 'and',
      args: [{ spans: { some: { op: 'eq', left: { path: 'entityId' }, right: { literal: 'agent-1' } } } }],
    });
  });

  it.each([...TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS])('ignores obsolete %s filters', fieldId => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: 'value' }], now }).where).toBeUndefined();
  });

  it('ignores unsupported running status filters', () => {
    expect(buildTraceQueryRequest({ tokens: [], status: 'running', now }).where).toBeUndefined();
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'status', value: ['running'] }], now }).where).toBeUndefined();
  });

  it('retains error when mixed with running', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'status', value: ['running', 'error'] }], now }).where).toEqual(
      {
        op: 'and',
        args: [{ op: 'eq', left: { path: 'status' }, right: { literal: 'error' } }],
      },
    );
  });

  it('retains all supported statuses when mixed with running', () => {
    expect(
      buildTraceQueryRequest({ tokens: [{ fieldId: 'status', value: ['running', 'success', 'error'] }], now }).where,
    ).toEqual({
      op: 'and',
      args: [{ op: 'in', value: { path: 'status' }, set: ['success', 'error'] }],
    });
  });

  it('preserves explicit dates and root filters', () => {
    const dateFrom = new Date('2026-09-01T00:00:00Z');
    expect(
      buildTraceQueryRequest({ tokens: [], rootEntityType: 'agent', status: 'error', dateFrom, dateTo: now, now }),
    ).toEqual({
      timeRange: { from: dateFrom.toISOString(), to: now.toISOString() },
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'entityType' }, right: { literal: 'agent' } },
          { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
        ],
      },
    });
  });

  it('turns discovered metadata tokens into predicates on the metadata path', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'metadata.region', value: 'eu-west' }], now })?.where).toEqual({
      op: 'and',
      args: [{ op: 'eq', left: { path: 'metadata.region' }, right: { literal: 'eu-west' } }],
    });
    expect(
      buildTraceQueryRequest({ tokens: [{ fieldId: 'metadata.region', value: ['eu-west', 'us-east'] }], now })?.where,
    ).toEqual({
      op: 'and',
      args: [{ op: 'in', value: { path: 'metadata.region' }, set: ['eu-west', 'us-east'] }],
    });
  });

  it('drops a bare metadata prefix with no key', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'metadata.', value: 'x' }], now }).where).toBeUndefined();
  });

  describe('when a token carries the isNot operator', () => {
    it('emits a ne predicate', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'traceId', value: 'abc', operatorId: 'isNot' }], now }).where,
      ).toEqual({
        op: 'and',
        args: [{ op: 'ne', left: { path: 'traceId' }, right: { literal: 'abc' } }],
      });
    });
  });

  describe('when a token carries notIn with several values', () => {
    it('emits a notIn predicate with the set, also matching traces where the field is unset', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [{ fieldId: 'metadata.region', value: ['eu', 'us'], operatorId: 'notIn' }],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [
          {
            op: 'or',
            args: [
              { op: 'notIn', value: { path: 'metadata.region' }, set: ['eu', 'us'] },
              { op: 'notExists', path: 'metadata.region' },
            ],
          },
        ],
      });
    });
  });

  describe('when an optional trace field carries isNot', () => {
    it('also matches traces where the field is unset', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'threadId', value: 't1', operatorId: 'isNot' }], now }).where,
      ).toEqual({
        op: 'and',
        args: [
          {
            op: 'or',
            args: [
              { op: 'ne', left: { path: 'threadId' }, right: { literal: 't1' } },
              { op: 'notExists', path: 'threadId' },
            ],
          },
        ],
      });
    });
  });

  describe('when an optional trace field carries notIn', () => {
    it('also matches traces where the field is unset', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [{ fieldId: 'environment', value: ['a', 'b'], operatorId: 'notIn' }],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [
          {
            op: 'or',
            args: [
              { op: 'notIn', value: { path: 'environment' }, set: ['a', 'b'] },
              { op: 'notExists', path: 'environment' },
            ],
          },
        ],
      });
    });
  });

  describe('when an always-present trace field carries isNot', () => {
    it('emits a plain ne predicate', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'entityName', value: 'agent', operatorId: 'isNot' }], now }).where,
      ).toEqual({ op: 'and', args: [{ op: 'ne', left: { path: 'entityName' }, right: { literal: 'agent' } }] });
    });
  });

  describe('when a related-scope token carries isNot', () => {
    it('emits none with the positive predicate', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'spans.model', value: 'gpt-5-mini', operatorId: 'isNot' }], now })
          .where,
      ).toEqual({
        op: 'and',
        args: [{ spans: { none: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-5-mini' } } } }],
      });
    });
  });

  describe('when a related-scope token carries notIn', () => {
    it('emits none with an in predicate', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [{ fieldId: 'scores.scorerId', value: ['a', 'b'], operatorId: 'notIn' }],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [{ scores: { none: { op: 'in', value: { path: 'scorerId' }, set: ['a', 'b'] } } }],
      });
    });
  });

  describe('when two negative tokens target the same scope', () => {
    it('emits one none per token', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [
            { fieldId: 'spans.model', value: 'x', operatorId: 'isNot' },
            { fieldId: 'spans.error', value: '', operatorId: 'notExists' },
          ],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [
          { spans: { none: { op: 'eq', left: { path: 'model' }, right: { literal: 'x' } } } },
          { spans: { none: { op: 'exists', path: 'error' } } },
        ],
      });
    });
  });

  describe.each([
    ['spans', 'spans.name'],
    ['scores', 'scores.scorerId'],
    ['feedback', 'feedback.feedbackType'],
  ] as const)('when a %s token carries a negative operator', (scope, fieldId) => {
    it.each(['isNot', 'notIn', 'notExists'] as const)('%s never emits a negative op inside some', operatorId => {
      const { where } = buildTraceQueryRequest({ tokens: [{ fieldId, value: ['v'], operatorId }], now });
      const [arg] = (where as { args: Record<string, unknown>[] }).args;
      expect(arg).toHaveProperty([scope, 'none']);
      expect(JSON.stringify(arg)).not.toMatch(/"op":"(ne|notIn|notExists)"/);
    });
  });

  describe('when a token carries a presence operator', () => {
    it('emits exists without a literal even when the value is empty', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'threadId', value: '', operatorId: 'exists' }], now }).where,
      ).toEqual({ op: 'and', args: [{ op: 'exists', path: 'threadId' }] });
    });

    it('emits spans.none(exists) for a span presence field carrying notExists', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'spans.error', value: '', operatorId: 'notExists' }], now }).where,
      ).toEqual({ op: 'and', args: [{ spans: { none: { op: 'exists', path: 'error' } } }] });
    });
  });

  describe('when a numeric span field carries gt', () => {
    it('emits gt inside spans.some with a number literal', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'spans.durationMs', value: '1000', operatorId: 'gt' }], now })
          .where,
      ).toEqual({
        op: 'and',
        args: [{ spans: { some: { op: 'gt', left: { path: 'durationMs' }, right: { literal: 1000 } } } }],
      });
    });

    it('skips a non-numeric value', () => {
      expect(
        buildTraceQueryRequest({ tokens: [{ fieldId: 'spans.durationMs', value: 'fast', operatorId: 'gt' }], now })
          .where,
      ).toBeUndefined();
    });
  });

  describe('when several tokens target the same related scope', () => {
    it('merges positive spans tokens into one spans.some and-predicate', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [
            { fieldId: 'spans.model', value: 'gpt-4o' },
            { fieldId: 'entityId', value: 'agent-1' },
          ],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [
          {
            spans: {
              some: {
                op: 'and',
                args: [
                  { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-4o' } },
                  { op: 'eq', left: { path: 'entityId' }, right: { literal: 'agent-1' } },
                ],
              },
            },
          },
        ],
      });
    });

    it('keeps a negative token out of the merged some and emits it as none', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [
            { fieldId: 'spans.model', value: 'gpt-4o', operatorId: 'isNot' },
            { fieldId: 'entityId', value: 'agent-1' },
          ],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [
          { spans: { none: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-4o' } } } },
          { spans: { some: { op: 'eq', left: { path: 'entityId' }, right: { literal: 'agent-1' } } } },
        ],
      });
    });

    it('merges scores tokens into one scores.some and-predicate', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [
            { fieldId: 'scores.scorerId', value: 'factuality' },
            { fieldId: 'scores.score', value: '0.6', operatorId: 'lt' },
          ],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [
          {
            scores: {
              some: {
                op: 'and',
                args: [
                  { op: 'eq', left: { path: 'scorerId' }, right: { literal: 'factuality' } },
                  { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
                ],
              },
            },
          },
        ],
      });
    });

    it('merges feedback tokens into one feedback.some and-predicate', () => {
      expect(
        buildTraceQueryRequest({
          tokens: [
            { fieldId: 'feedback.feedbackType', value: 'thumbs' },
            { fieldId: 'feedback.comment', value: '', operatorId: 'exists' },
          ],
          now,
        }).where,
      ).toEqual({
        op: 'and',
        args: [
          {
            feedback: {
              some: {
                op: 'and',
                args: [
                  { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'thumbs' } },
                  { op: 'exists', path: 'comment' },
                ],
              },
            },
          },
        ],
      });
    });
  });
});

describe('clampTraceDiscoveryTimeRange', () => {
  const to = '2026-09-15T12:00:00.000Z';

  it('keeps ranges of 31 days or less untouched', () => {
    const range = { from: '2026-09-01T00:00:00.000Z', to };
    expect(clampTraceDiscoveryTimeRange(range)).toBe(range);
  });

  it('clamps wider ranges to the 31 days ending at to', () => {
    expect(clampTraceDiscoveryTimeRange({ from: '2026-01-01T00:00:00.000Z', to })).toEqual({
      from: '2026-08-15T12:00:00.000Z',
      to,
    });
  });

  it('falls back to the 31-day window when from is not before to', () => {
    expect(clampTraceDiscoveryTimeRange({ from: to, to })).toEqual({ from: '2026-08-15T12:00:00.000Z', to });
  });
});

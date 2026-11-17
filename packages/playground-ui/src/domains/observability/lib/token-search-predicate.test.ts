import { TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH, spanQueryRequestSchema } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { hasTokenSearchFilter, tokenSearchValue, withTokenSearchFields } from './token-search-predicate';

describe('trace content filters', () => {
  it.each(['all', 'input', 'output', 'error', 'inputPreview', 'outputPreview', 'errorPreview'])(
    'counts only span-scoped %s tokens as applied',
    field => {
      const token = { fieldId: field, operatorId: 'hasAllTokens', value: 'needle' };
      expect(hasTokenSearchFilter(token)).toBe(false);
      expect(hasTokenSearchFilter({ ...token, fieldId: `spans.${field}` })).toBe(true);
      expect(hasTokenSearchFilter({ id: 'group', logic: 'or', nodes: [token] })).toBe(false);
      expect(hasTokenSearchFilter({ ...token, fieldId: `spans.${field}`, value: '!!!' })).toBe(false);
    },
  );

  it('labels trace fields as span-scoped and preserves Error presence operators', () => {
    const fields = withTokenSearchFields(
      [{ id: 'spans.error', label: 'Span error', operators: ['exists', 'notExists'] }],
      true,
      'spans.',
    );
    expect(fields.map(field => field.label)).toEqual([
      'Any span content',
      'Span input',
      'Span output',
      'Span error',
      'Span input preview',
      'Span output preview',
      'Span error preview',
    ]);
    expect(fields.find(field => field.id === 'spans.error')?.operators).toEqual([
      'exists',
      'notExists',
      'hasAllTokens',
    ]);
    expect(withTokenSearchFields([], true)[0]?.label).toBe('Any Content');
  });
});

describe('token search length contract', () => {
  it.each(['a', '😀'])('matches Core at the Unicode length boundary for %s', character => {
    for (const length of [
      TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH - 1,
      TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH,
      TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH + 1,
    ]) {
      const literal = character.repeat(length);
      const accepted = spanQueryRequestSchema.safeParse({
        timeRange: { from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' },
        where: { op: 'hasAllTokens', left: { path: 'input' }, right: { literal } },
      }).success;
      expect(tokenSearchValue(literal) !== undefined).toBe(accepted);
      expect(accepted).toBe(length <= TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { hasTokenSearchFilter, withTokenSearchFields } from './token-search-predicate';

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

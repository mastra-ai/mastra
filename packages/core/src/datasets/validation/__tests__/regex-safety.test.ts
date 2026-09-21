import { describe, expect, it } from 'vitest';
import { DATASET_SCHEMA_PATTERN_MAX_LENGTH, findUnsafeSchemaPattern } from '../regex-safety';

describe('findUnsafeSchemaPattern', () => {
  it.each([
    '',
    '^[a-z0-9_-]{3,16}$',
    '^\\d{4}-\\d{2}-\\d{2}$',
    '^(\\d{1,3}\\.){3}\\d{1,3}$',
    '^\\w+(,\\w+)*$',
    '^(\\d+\\.)*\\d+$',
    '^[^,]+(,[^,]+)*$',
    '^(foo|bar)+$',
    '^(?:https?://)?[^\\s/]+(?:/[^\\s]*)?$',
    '^[^\\]]+$',
    '^(a+)?b$',
    '^(ab){1}$',
    '^(ab)+$',
    '^((ab)+c)*$',
    '^((ab)+b)*$',
    '^(a?)*b$',
    '^(?=.*\\d)(?=.*[a-z]).{8,}$',
    '^[A-Za-z]+(?:[ \\-][A-Za-z]+)*$',
    '^(?<year>\\d{4})-(?<month>\\d{2})$',
    'a{2,}',
  ])('accepts %j', pattern => {
    expect(findUnsafeSchemaPattern({ type: 'string', pattern })).toBeNull();
  });

  it.each([
    ['(a+)+$', 'nests repetition'],
    ['^(\\d*)*$', 'nests repetition'],
    ['^(\\w+\\s?)+$', 'nests repetition'],
    ['^((a|b)+b)*$', 'nests repetition'],
    ['^(a+){2,}$', 'nests repetition'],
    ['^(a+){1,5}$', 'nests repetition'],
    ['^(x+)+?$', 'nests repetition'],
    ['^(a+a)*$', 'nests repetition'],
    ['^(.+,)*$', 'nests repetition'],
    ['^(a|ab)*$', 'alternation'],
    ['^(a|a?)+$', 'alternation'],
    ['^(a?b|b)+$', 'alternation'],
    ['^(\\d|[0-9a-f])+$', 'alternation'],
    ['^(a)\\1+$', 'backreference'],
    ['^(?<w>a)\\k<w>$', 'backreference'],
    ['^(?=(a+)+)$', 'nests repetition'],
    ['(unclosed', 'does not compile'],
    ['a'.repeat(DATASET_SCHEMA_PATTERN_MAX_LENGTH + 1), 'exceeds'],
  ])('rejects %j', (pattern, reason) => {
    const found = findUnsafeSchemaPattern({ type: 'string', pattern });
    expect(found).toMatchObject({ path: '/pattern', pattern });
    expect(found?.reason).toContain(reason);
  });

  it('inspects nested subschemas and patternProperties keys', () => {
    expect(
      findUnsafeSchemaPattern({
        type: 'object',
        properties: {
          list: {
            type: 'array',
            items: {
              anyOf: [
                { type: 'string', pattern: '^ok$' },
                { type: 'string', pattern: '(a+)+' },
              ],
            },
          },
        },
      }),
    ).toMatchObject({ path: '/properties/list/items/anyOf/1/pattern' });
    expect(
      findUnsafeSchemaPattern({ type: 'object', patternProperties: { '^ok_': {}, '^(\\w+\\s?)+$': {} } }),
    ).toMatchObject({ path: '/patternProperties/^(\\w+\\s?)+$', pattern: '^(\\w+\\s?)+$' });
  });

  it('ignores data-valued keywords and non-string pattern values', () => {
    expect(
      findUnsafeSchemaPattern({
        type: 'object',
        properties: { pattern: { type: 'string' } },
        enum: [{ pattern: '(a+)+' }],
        default: { patternProperties: { '(a+)+': 1 } },
        examples: [{ pattern: '(a+)+' }],
      }),
    ).toBeNull();
  });

  it('escapes JSON Pointer segments', () => {
    expect(findUnsafeSchemaPattern({ properties: { 'a/b~c': { pattern: '(a+)+' } } })).toMatchObject({
      path: '/properties/a~1b~0c/pattern',
    });
  });
});

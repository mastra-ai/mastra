import { describe, expect, it, vi } from 'vitest';
import { buildInsert } from './sql';

vi.mock('@mastra/core/utils', () => ({
  parseSqlIdentifier: (identifier: string) => identifier,
}));

describe('buildInsert', () => {
  it('sanitizes PostgreSQL-incompatible Unicode in jsonb columns', () => {
    const insert = buildInsert('public', 'mastra_span_events', [
      {
        input: {
          nul: 'before\u0000after',
          unpairedHighSurrogate: 'before\uD83Dafter',
          unpairedLowSurrogate: 'before\uDE00after',
          validEmoji: '😀',
        },
      },
    ]);

    expect(insert).not.toBeNull();
    expect(JSON.parse(insert!.values[0] as string)).toEqual({
      nul: 'beforeafter',
      unpairedHighSurrogate: 'beforeafter',
      unpairedLowSurrogate: 'beforeafter',
      validEmoji: '😀',
    });
  });
});

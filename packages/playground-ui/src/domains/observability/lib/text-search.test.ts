import { observabilityTextSearchSchema } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { effectiveTextSearch } from './text-search';

describe('effectiveTextSearch', () => {
  describe('when the draft is normalized', () => {
    it.each(['', '  ', 'ab', ' ABC ', 'İİ', '😀😀😀', '😀'.repeat(256), '😀'.repeat(257), 'a%b_c'])(
      'matches API validation for %s',
      value => {
        const parsed = observabilityTextSearchSchema.safeParse(value);
        expect(effectiveTextSearch(value)).toBe(parsed.success ? parsed.data : undefined);
      },
    );
  });
});

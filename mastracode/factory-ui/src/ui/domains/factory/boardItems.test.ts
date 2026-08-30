import { describe, expect, it } from 'vitest';
import { reviewVerdictForItem } from './boardItems';

describe('reviewVerdictForItem', () => {
  it('reads the stamped verdict and rejects values the factory never wrote', () => {
    expect(reviewVerdictForItem({ metadata: { reviewVerdict: 'request_changes' } })).toBe('request_changes');
    expect(reviewVerdictForItem({ metadata: { reviewVerdict: 'approve' } })).toBe('approve');
    expect(reviewVerdictForItem({ metadata: { reviewVerdict: 'lgtm' } })).toBeUndefined();
    expect(reviewVerdictForItem({ metadata: {} })).toBeUndefined();
  });
});

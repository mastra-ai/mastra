import { describe, expect, it } from 'vitest';

import { reviewVerdict } from './WorkItemCardRows';

describe('reviewVerdict', () => {
  it('labels a recorded verdict with the short reviewed head', () => {
    expect(reviewVerdict({ reviewVerdict: 'request changes', reviewedHeadSha: 'abc1234def' })).toEqual({
      approved: false,
      label: 'Changes requested · abc1234',
    });
    expect(reviewVerdict({ reviewVerdict: 'approve' })).toEqual({ approved: true, label: 'Approved' });
  });

  it('shows nothing before a verdict is recorded or for unknown values', () => {
    expect(reviewVerdict({})).toBeUndefined();
    expect(reviewVerdict({ reviewVerdict: 'merge' })).toBeUndefined();
  });
});

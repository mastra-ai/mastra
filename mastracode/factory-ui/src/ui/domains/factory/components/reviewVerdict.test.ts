import { describe, expect, it } from 'vitest';

import { reviewVerdict } from './WorkItemCardRows';

describe('reviewVerdict', () => {
  it('labels a recorded verdict with the short reviewed head', () => {
    expect(reviewVerdict({ reviewVerdict: 'request changes', reviewedHeadSha: 'abc1234def' })).toEqual({
      approved: false,
      outdated: false,
      label: 'Changes requested · abc1234',
    });
    expect(reviewVerdict({ reviewVerdict: 'approve' })).toEqual({ approved: true, outdated: false, label: 'Approved' });
  });

  it('shows nothing before a verdict is recorded or for unknown values', () => {
    expect(reviewVerdict({})).toBeUndefined();
    expect(reviewVerdict({ reviewVerdict: 'merge' })).toBeUndefined();
  });

  it('marks the verdict outdated once the pull request head moves past the reviewed one', () => {
    expect(
      reviewVerdict({ reviewVerdict: 'approve', reviewedHeadSha: 'be10bfa111', pullRequestHeadSha: '8fa258d222' }),
    ).toEqual({ approved: false, outdated: true, label: 'Approved · be10bfa (outdated)' });
    expect(
      reviewVerdict({
        reviewVerdict: 'request changes',
        reviewedHeadSha: 'be10bfa111',
        pullRequestHeadSha: '8fa258d222',
      }),
    ).toEqual({ approved: false, outdated: true, label: 'Changes requested · be10bfa (outdated)' });
  });

  it('keeps the verdict current while the head is the reviewed one or unknown', () => {
    expect(
      reviewVerdict({ reviewVerdict: 'approve', reviewedHeadSha: 'be10bfa111', pullRequestHeadSha: 'BE10BFA111' }),
    ).toEqual({ approved: true, outdated: false, label: 'Approved · be10bfa' });
    expect(reviewVerdict({ reviewVerdict: 'approve', reviewedHeadSha: 'be10bfa111' })).toEqual({
      approved: true,
      outdated: false,
      label: 'Approved · be10bfa',
    });
  });
});

import { describe, expect, it } from 'vitest';

import { needsApproval } from './types.js';

describe('needsApproval', () => {
  const labeled = { metadata: { labels: ['bug', 'Status: Needs Approval'] } };

  it('holds a labeled card while it rests in Intake or Triage', () => {
    expect(needsApproval({ ...labeled, stages: ['intake'] })).toBe(true);
    expect(needsApproval({ ...labeled, stages: ['triage'] })).toBe(true);
    expect(needsApproval(labeled)).toBe(true);
  });

  it('lets the card go once a person moved it on, even before the source drops the label', () => {
    expect(needsApproval({ ...labeled, stages: ['planning'] })).toBe(false);
    expect(needsApproval({ ...labeled, stages: ['execute'] })).toBe(false);
  });

  it('holds nothing without the label', () => {
    expect(needsApproval({ metadata: { labels: ['bug'] }, stages: ['intake'] })).toBe(false);
    expect(needsApproval({ metadata: null, stages: ['intake'] })).toBe(false);
  });

  it('ignores a legacy acceptance stamp: the label and the lane decide', () => {
    const legacy = { ...labeled, stages: ['intake'], acceptedAt: new Date() };
    expect(needsApproval(legacy)).toBe(true);
  });
});

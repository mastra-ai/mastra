import { describe, expect, it } from 'vitest';
import { generatePlanDiff, shouldShowDiff } from '../plan-diff.js';

describe('generatePlanDiff', () => {
  it('marks only the changed line, not everything after an insertion', () => {
    const oldText = 'a\nb\nc';
    const newText = 'a\nx\nb\nc';
    const entries = generatePlanDiff(oldText, newText);

    // LCS keeps a, b, c as context and only adds x — a naive index diff would
    // mark b and c as changed too.
    expect(entries.filter(e => e.type === 'added').map(e => e.text)).toEqual(['x']);
    expect(entries.filter(e => e.type === 'removed')).toHaveLength(0);
    expect(entries.filter(e => e.type === 'context').map(e => e.text)).toEqual(['a', 'b', 'c']);
  });

  it('captures removals', () => {
    const entries = generatePlanDiff('a\nb\nc', 'a\nc');
    expect(entries.filter(e => e.type === 'removed').map(e => e.text)).toEqual(['b']);
  });
});

describe('shouldShowDiff (real-diff size gate)', () => {
  it('shows a diff for a small targeted edit', () => {
    const previous = ['Build the feature', 'Run tests', 'Update docs'].join('\n');
    const next = ['Build the feature', 'Add tests', 'Update docs'].join('\n');
    expect(shouldShowDiff(previous, next)).toBe(true);
  });

  it('shows a diff for an inserted line (LCS keeps the rest as context)', () => {
    const previous = ['Step 1', 'Step 2', 'Step 3'].join('\n');
    const next = ['Step 1', 'Step 1.5', 'Step 2', 'Step 3'].join('\n');
    expect(shouldShowDiff(previous, next)).toBe(true);
  });

  it('falls back to the full plan when most of the new plan changed', () => {
    const previous = ['Old line 1', 'Old line 2', 'Old line 3', 'Keep'].join('\n');
    const next = ['New line 1', 'New line 2', 'New line 3', 'Keep'].join('\n');
    expect(shouldShowDiff(previous, next)).toBe(false);
  });

  it('returns false when there is no previous plan or no change', () => {
    expect(shouldShowDiff('', 'New plan')).toBe(false);
    expect(shouldShowDiff('Same plan', 'Same plan')).toBe(false);
  });
});

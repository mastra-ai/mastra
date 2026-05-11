import { describe, expect, it } from 'vitest';

import { skillSnapshotFieldValuesEqual } from './skill-snapshot-field-equal';

describe('skillSnapshotFieldValuesEqual', () => {
  it('treats null and undefined as equal', () => {
    expect(skillSnapshotFieldValuesEqual(null, undefined)).toBe(true);
    expect(skillSnapshotFieldValuesEqual(undefined, null)).toBe(true);
  });

  it('ignores plain object key order', () => {
    expect(skillSnapshotFieldValuesEqual({ b: 1, a: 2 }, { a: 2, b: 1 })).toBe(true);
  });

  it('compares nested structures with stable key order', () => {
    const treeA = {
      entries: {
        'b.md': { blobHash: 'h2', size: 2 },
        'a.md': { blobHash: 'h1', size: 1 },
      },
    };
    const treeB = {
      entries: {
        'a.md': { size: 1, blobHash: 'h1' },
        'b.md': { blobHash: 'h2', size: 2 },
      },
    };
    expect(skillSnapshotFieldValuesEqual(treeA, treeB)).toBe(true);
  });

  it('detects real value changes', () => {
    expect(skillSnapshotFieldValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(skillSnapshotFieldValuesEqual({ a: 1 }, { b: 1 })).toBe(false);
  });
});

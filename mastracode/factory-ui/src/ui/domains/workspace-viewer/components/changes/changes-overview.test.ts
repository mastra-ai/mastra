import { describe, expect, it } from 'vitest';

import type { WorkspaceChange } from '../../../../../api/types';
import {
  additionShare,
  changeTone,
  conflictCount,
  mosaicCapacity,
  overviewOrder,
  splitPath,
  tileOpacity,
} from './changes-overview';

const change = (path: string, rest: Partial<WorkspaceChange> = {}): WorkspaceChange => ({
  path,
  status: 'modified',
  ...rest,
});

describe('the workspace overview of a branch’s changes', () => {
  it('lists conflicted files first, keeping the rest in their order', () => {
    const changes = [change('a.ts'), change('b.ts', { status: 'conflicted' }), change('c.ts')];

    expect(overviewOrder(changes).map(item => item.path)).toEqual(['b.ts', 'a.ts', 'c.ts']);
    expect(conflictCount(changes)).toBe(1);
  });

  it('tints a file by what most of its lines did, and leaves a binary file unsized', () => {
    expect(changeTone(change('a.ts', { additions: 3, deletions: 1 }))).toBe('addition');
    expect(changeTone(change('a.ts', { additions: 0, deletions: 64 }))).toBe('deletion');
    expect(changeTone(change('a.png', { binary: true }))).toBe('unsized');
    expect(changeTone(change('a.ts', { status: 'conflicted', additions: 9 }))).toBe('conflict');
  });

  it('fits two rows of tiles in the width it has', () => {
    expect(mosaicCapacity(320)).toBe(48);
    expect(mosaicCapacity(528)).toBe(80);
    expect(mosaicCapacity(0)).toBe(2);
  });

  it('shades the largest file darkest without washing small files out', () => {
    expect(tileOpacity(1000, 1000)).toBeCloseTo(0.94);
    expect(tileOpacity(0, 1000)).toBeCloseTo(0.36);
    expect(tileOpacity(10, 1000)).toBeGreaterThan(0.5);
  });

  it('splits a path into the file name and the folder it sits in', () => {
    expect(splitPath('packages/core/src/retry.ts')).toEqual({ name: 'retry.ts', directory: 'packages/core/src' });
    expect(splitPath('CHANGELOG.md')).toEqual({ name: 'CHANGELOG.md', directory: '' });
  });

  it('has no ratio for a file without line counts', () => {
    expect(additionShare(change('a.ts', { additions: 3, deletions: 1 }))).toBe(0.75);
    expect(additionShare(change('a.png', { binary: true }))).toBeUndefined();
  });
});

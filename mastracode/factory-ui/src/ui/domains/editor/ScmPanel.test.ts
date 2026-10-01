import { describe, expect, it } from 'vitest';

import { splitDiffHunks } from './ScmPanel';

const FILE_HEADER = [
  'diff --git a/src/foo.ts b/src/foo.ts',
  'index 1111111..2222222 100644',
  '--- a/src/foo.ts',
  '+++ b/src/foo.ts',
].join('\n');

describe('splitDiffHunks', () => {
  it('returns no hunks for empty or headerless diffs', () => {
    expect(splitDiffHunks('')).toEqual([]);
    expect(splitDiffHunks('Binary files a/x and b/x differ\n')).toEqual([]);
  });

  it('splits a single-hunk diff into one applicable patch', () => {
    const diff = `${FILE_HEADER}\n@@ -1,3 +1,3 @@\n context\n-old\n+new\n`;
    const hunks = splitDiffHunks(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.header).toBe('@@ -1,3 +1,3 @@');
    expect(hunks[0]!.patch).toBe(`${FILE_HEADER}\n@@ -1,3 +1,3 @@\n context\n-old\n+new\n`);
  });

  it('gives every hunk its own copy of the file header', () => {
    const diff = [
      FILE_HEADER,
      '@@ -1,2 +1,2 @@',
      '-a',
      '+b',
      '@@ -10,2 +10,2 @@',
      ' keep',
      '-c',
      '+d',
      '',
    ].join('\n');
    const hunks = splitDiffHunks(diff);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]!.patch).toBe(`${FILE_HEADER}\n@@ -1,2 +1,2 @@\n-a\n+b\n`);
    expect(hunks[1]!.header).toBe('@@ -10,2 +10,2 @@');
    expect(hunks[1]!.patch).toBe(`${FILE_HEADER}\n@@ -10,2 +10,2 @@\n keep\n-c\n+d\n`);
    // Each patch must end with a newline so `git apply` accepts it via stdin.
    for (const hunk of hunks) expect(hunk.patch.endsWith('\n')).toBe(true);
  });
});

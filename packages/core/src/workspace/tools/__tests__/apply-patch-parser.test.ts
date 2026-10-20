import { describe, it, expect } from 'vitest';

import { ApplyPatchError, applyChunks, parsePatch, patchPaths } from '../apply-patch-parser';

const wrap = (body: string) => `*** Begin Patch\n${body}\n*** End Patch`;

describe('parsePatch', () => {
  it('parses add, delete, update and move operations', () => {
    const ops = parsePatch(
      wrap(`*** Add File: a.ts
+one
+two
*** Delete File: b.ts
*** Update File: c.ts
*** Move to: d.ts
@@ function c() {
 keep
-old
+new
*** End of File`),
    );

    expect(ops).toEqual([
      { type: 'add', path: 'a.ts', content: 'one\ntwo\n' },
      { type: 'delete', path: 'b.ts' },
      {
        type: 'update',
        path: 'c.ts',
        moveTo: 'd.ts',
        chunks: [
          {
            context: 'function c() {',
            oldLines: ['keep', 'old'],
            newLines: ['keep', 'new'],
            contextSource: [0, undefined],
            isEndOfFile: true,
          },
        ],
      },
    ]);
    expect(patchPaths(ops)).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
  });

  it('accepts CRLF input and surrounding blank lines', () => {
    const ops = parsePatch(`\r\n*** Begin Patch\r\n*** Delete File: x\r\n*** End Patch\r\n\r\n`);
    expect(ops).toEqual([{ type: 'delete', path: 'x' }]);
  });

  it.each([
    ['missing begin marker', '*** Delete File: x\n*** End Patch', /first line/],
    ['missing end marker', '*** Begin Patch\n*** Delete File: x', /last line/],
    ['no operations', '*** Begin Patch\n*** End Patch', /no file operations/],
    ['add line without +', wrap('*** Add File: a\nplain'), /must start with "\+"/],
    ['update without hunks', wrap('*** Update File: a'), /a/],
    ['unknown header', wrap('*** Frobnicate File: a'), /./],
    ['empty path', wrap('*** Delete File: '), /missing file path/],
    ['same path twice', wrap('*** Delete File: a\n*** Add File: a\n+x'), /more than once|once/],
    ['move onto another touched path', wrap('*** Delete File: b\n*** Update File: a\n*** Move to: b'), /once/],
  ])('rejects %s', (_name, patch, message) => {
    expect(() => parsePatch(patch)).toThrow(ApplyPatchError);
    expect(() => parsePatch(patch)).toThrow(message);
  });
});

describe('applyChunks', () => {
  const update = (patch: string) => {
    const [op] = parsePatch(wrap(patch));
    if (op?.type !== 'update') throw new Error('expected update');
    return op.chunks;
  };

  it('applies multiple hunks in order', () => {
    const chunks = update(`*** Update File: f
@@
 a
-b
+B
@@
 y
-z
+Z`);
    expect(applyChunks('a\nb\nc\ny\nz\n', chunks, 'f')).toBe('a\nB\nc\ny\nZ\n');
  });

  it('uses the @@ context line to pick the right occurrence', () => {
    const chunks = update(`*** Update File: f
@@ second
-x
+X`);
    expect(applyChunks('first\nx\nsecond\nx\n', chunks, 'f')).toBe('first\nx\nsecond\nX\n');
  });

  it('anchors an End of File hunk to the end', () => {
    const chunks = update(`*** Update File: f
@@
-x
+last
*** End of File`);
    expect(applyChunks('x\nmid\nx\n', chunks, 'f')).toBe('x\nmid\nlast\n');
  });

  it('tolerates trailing-whitespace differences in context', () => {
    const chunks = update(`*** Update File: f
@@
 keep
-old
+new`);
    expect(applyChunks('keep   \nold\n', chunks, 'f')).toBe('keep   \nnew\n');
  });

  it('inserts lines after a context-only hunk', () => {
    const chunks = update(`*** Update File: f
@@ header
+inserted`);
    expect(applyChunks('header\nbody\n', chunks, 'f')).toBe('header\ninserted\nbody\n');
  });

  it('throws when the lines to replace are not found', () => {
    const chunks = update(`*** Update File: f
@@
-missing
+x`);
    expect(() => applyChunks('a\n', chunks, 'f')).toThrow(ApplyPatchError);
  });
});

import { describe, it, expect } from 'vitest';

import {
  applyChunks,
  ApplyPatchHunkError,
  ApplyPatchParseError,
  getApplyPatchWritePaths,
  getPatchPaths,
  parseApplyPatch,
} from './apply-patch-parser';

function patch(body: string): string {
  return `*** Begin Patch\n${body}*** End Patch\n`;
}

describe('parseApplyPatch', () => {
  it('parses add, update, move, and delete in one patch', () => {
    const hunks = parseApplyPatch(
      patch(
        [
          '*** Add File: src/new.ts',
          '+export const x = 1',
          '*** Update File: src/existing.ts',
          '*** Move to: src/renamed.ts',
          '@@',
          ' context line',
          '-old',
          '+new',
          '*** Delete File: src/obsolete.ts',
          '',
        ].join('\n'),
      ),
    );

    expect(hunks).toEqual([
      { type: 'add', path: 'src/new.ts', contents: 'export const x = 1\n' },
      {
        type: 'update',
        path: 'src/existing.ts',
        movePath: 'src/renamed.ts',
        chunks: [
          {
            changeContext: undefined,
            lines: [
              { type: 'context', text: 'context line' },
              { type: 'remove', text: 'old' },
              { type: 'add', text: 'new' },
            ],
          },
        ],
      },
      { type: 'delete', path: 'src/obsolete.ts' },
    ]);
  });

  it('normalizes CRLF and ignores surrounding blank lines', () => {
    const hunks = parseApplyPatch('\r\n*** Begin Patch\r\n*** Delete File: gone.txt\r\n*** End Patch\r\n');
    expect(hunks).toEqual([{ type: 'delete', path: 'gone.txt' }]);
  });

  it('parses @@ change context headers', () => {
    const hunks = parseApplyPatch(
      patch(['*** Update File: src/app.ts', '@@ class BaseClass', ' foo', '-bar', '+baz', ''].join('\n')),
    );
    expect(hunks[0]).toMatchObject({
      type: 'update',
      path: 'src/app.ts',
      chunks: [{ changeContext: 'class BaseClass' }],
    });
  });

  it('rejects missing begin marker', () => {
    expect(() => parseApplyPatch('*** Add File: a.ts\n+x\n*** End Patch\n')).toThrow(ApplyPatchParseError);
  });

  it('rejects missing end marker', () => {
    expect(() => parseApplyPatch('*** Begin Patch\n*** Delete File: a.ts\n')).toThrow(ApplyPatchParseError);
  });

  it('rejects empty patch', () => {
    expect(() => parseApplyPatch('*** Begin Patch\n*** End Patch\n')).toThrow(/empty patch/);
  });

  it('rejects empty patchText', () => {
    expect(() => parseApplyPatch('   ')).toThrow(/patchText is required/);
  });

  it('rejects add-file lines without a + prefix', () => {
    expect(() => parseApplyPatch(patch('*** Add File: a.ts\nnot plus\n'))).toThrow(/Invalid Add File line/);
  });

  it('rejects delete-file with a diff', () => {
    expect(() => parseApplyPatch(patch('*** Delete File: a.ts\n-old\n'))).toThrow(/must not include a diff/);
  });

  it('rejects update-file without a hunk', () => {
    expect(() => parseApplyPatch(patch('*** Update File: a.ts\n'))).toThrow(/must include a hunk/);
  });

  it('collects write paths including move destinations', () => {
    const hunks = parseApplyPatch(
      patch(['*** Update File: old.ts', '*** Move to: new.ts', '@@', ' a', '-b', '+c', ''].join('\n')),
    );
    expect(getPatchPaths(hunks)).toEqual(['old.ts', 'new.ts']);
  });

  it('returns no write paths for invalid patch text', () => {
    expect(getApplyPatchWritePaths({ patchText: 'not a patch' })).toEqual([]);
  });
});

describe('applyChunks', () => {
  it('replaces a unique snippet', () => {
    const result = applyChunks('one\ntwo\nthree\n', [
      {
        lines: [
          { type: 'context', text: 'two' },
          { type: 'remove', text: 'three' },
          { type: 'add', text: 'THREE' },
        ],
      },
    ]);
    expect(result).toBe('one\ntwo\nTHREE\n');
  });

  it('fails when the hunk is not unique', () => {
    expect(() =>
      applyChunks('hello\nhello\n', [
        {
          lines: [
            { type: 'remove', text: 'hello' },
            { type: 'add', text: 'hi' },
          ],
        },
      ]),
    ).toThrow(ApplyPatchHunkError);
  });

  it('uses @@ context to pick the right occurrence', () => {
    const content = ['class A {', '  foo()', '}', 'class B {', '  foo()', '}', ''].join('\n');
    const result = applyChunks(content, [
      {
        changeContext: 'class B',
        lines: [
          { type: 'context', text: '  foo()' },
          { type: 'add', text: '  bar()' },
        ],
      },
    ]);
    expect(result).toContain('class B {\n  foo()\n  bar()\n}');
    expect(result).toContain('class A {\n  foo()\n}');
  });

  it('fails when context is missing', () => {
    expect(() =>
      applyChunks('hello\n', [
        {
          lines: [
            { type: 'remove', text: 'world' },
            { type: 'add', text: 'earth' },
          ],
        },
      ]),
    ).toThrow(/does not match/);
  });
});

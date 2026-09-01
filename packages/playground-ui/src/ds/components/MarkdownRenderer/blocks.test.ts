import { describe, expect, it } from 'vitest';

import { splitBlocks } from './blocks';

describe('splitBlocks', () => {
  it('cuts a reply at its blank lines', () => {
    expect(splitBlocks('First para.\n\nSecond para.')).toEqual(['First para.\n\n', 'Second para.']);
    expect(splitBlocks('Para.\n\n- one\n- two\n\n## Heading\n\n```js\ncode\n```\n\nEnd.')).toHaveLength(5);
  });

  it('only breaks on a blank line, not between consecutive lines', () => {
    expect(splitBlocks('Line one\nLine two\n\nNext.')).toEqual(['Line one\nLine two\n\n', 'Next.']);
  });

  it('treats a whitespace-only line as blank', () => {
    expect(splitBlocks('One.\n   \nTwo.')).toEqual(['One.\n   \n', 'Two.']);
  });

  it.each([
    ['a fence holding a blank line', '```ts\nconst a = 1;\n\nconst b = 2;\n```', 1],
    ['a fence the stream has not closed', 'Here:\n\n```ts\nconst a = 1;\n\nconst b', 2],
    ['a tilde fence holding a blank line', '~~~ts\nconst a = 1;\n\nconst b = 2;\n~~~\n\nAfter.', 2],
    ['a list whose items are spaced out', '- one\n\n- two\n\n- three', 1],
    ['a list item with its own paragraph', '1. one\n\n   still one\n\n2. two', 1],
    ['a list continued by a multi-digit item', '1. one\n\n10. ten', 1],
    ['a list continued by a bare marker', '- one\n\n-\n\n- two', 1],
    ['an indented code block holding a blank line', 'Run:\n\n    npm i\n\n    npm test', 1],
    ['a reply whose link reference resolves across a break', 'See [docs][d].\n\n[d]: https://mastra.ai', 1],
    ['a reply whose footnote resolves across a break', 'Text[^1]\n\n[^1]: The note.\n\nAfter.', 1],
  ])('keeps %s whole', (_, markdown, blocks) => {
    expect(splitBlocks(markdown)).toHaveLength(blocks);
  });

  it.each([
    ['backticks that only appear mid-line', 'Text with ``` inside.\n\nNext para.', 2],
    ['a single leading tilde', '~ tilde start.\n\nNext para.', 2],
    ['a single leading backtick', '`code` at start.\n\nNext para.', 2],
    ['a bracketed label that is not at the line start', 'Text [x]: not a def.\n\nNext.', 2],
    ['a dash inside a paragraph that follows a list', '- one\n\nsome - text\n\n- two', 3],
    ['two spaces inside a sentence', 'One.\n\nTwo.  Three.\n\nFour.', 3],
    ['a single leading space', 'Para.\n\n one space\n\nnext', 3],
  ])('still breaks on %s', (_, markdown, blocks) => {
    expect(splitBlocks(markdown)).toHaveLength(blocks);
  });

  it('re-evaluates list membership when a new block starts', () => {
    // The paragraph ends the list, so the trailing item starts its own block
    // rather than being merged back into the one before it.
    expect(splitBlocks('- one\n\npara\n\n- two')).toEqual(['- one\n\n', 'para\n\n', '- two']);
  });

  it('keeps a fence open until a line that is only its marker', () => {
    // `x ```' and '```js' are fence content: the closing line carries nothing
    // but the marker and trailing whitespace.
    expect(splitBlocks('```ts\nx ```\n\nmore\n```\n\nAfter.')).toEqual(['```ts\nx ```\n\nmore\n```\n\n', 'After.']);
    expect(splitBlocks('```ts\ncode\n```js\n\nstill fence\n```\n\nAfter.')).toEqual([
      '```ts\ncode\n```js\n\nstill fence\n```\n\n',
      'After.',
    ]);
  });

  it('reads a definition inside a fence as the code it is', () => {
    expect(splitBlocks('```py\n[x]: int\n```\n\nAfter.')).toHaveLength(2);
  });

  it.each([
    'Plain text with no break at all',
    'Para.\n\n- one\n- two\n\n## Heading\n\n```js\ncode\n```\n\nEnd.',
    'Trailing blanks follow this.\n\n\n',
    'Run:\n\n    npm i\n\n    npm test',
    'One.\n   \nTwo.',
    '- one\n\npara\n\n- two',
    '',
  ])('rejoins to the reply it was given', markdown => {
    expect(splitBlocks(markdown).join('')).toBe(markdown);
  });
});

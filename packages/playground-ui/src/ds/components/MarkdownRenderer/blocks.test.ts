import { describe, expect, it } from 'vitest';

import { splitBlocks } from './blocks';

describe('splitBlocks', () => {
  it('cuts a reply at its blank lines', () => {
    expect(splitBlocks('First para.\n\nSecond para.')).toEqual(['First para.\n\n', 'Second para.']);
    expect(splitBlocks('Para.\n\n- one\n- two\n\n## Heading\n\n```js\ncode\n```\n\nEnd.')).toHaveLength(5);
  });

  it.each([
    ['a fence holding a blank line', '```ts\nconst a = 1;\n\nconst b = 2;\n```', 1],
    ['a fence the stream has not closed', 'Here:\n\n```ts\nconst a = 1;\n\nconst b', 2],
    ['a list whose items are spaced out', '- one\n\n- two\n\n- three', 1],
    ['a list item with its own paragraph', '1. one\n\n   still one\n\n2. two', 1],
    ['an indented code block holding a blank line', 'Run:\n\n    npm i\n\n    npm test', 1],
    ['a reply whose link reference resolves across a break', 'See [docs][d].\n\n[d]: https://mastra.ai', 1],
    ['a reply whose footnote resolves across a break', 'Text[^1]\n\n[^1]: The note.\n\nAfter.', 1],
  ])('keeps %s whole', (_, markdown, blocks) => {
    expect(splitBlocks(markdown)).toHaveLength(blocks);
  });

  it.each([
    'Plain text with no break at all',
    'Para.\n\n- one\n- two\n\n## Heading\n\n```js\ncode\n```\n\nEnd.',
    'Trailing blanks follow this.\n\n\n',
    'Run:\n\n    npm i\n\n    npm test',
    '',
  ])('rejoins to the reply it was given', markdown => {
    expect(splitBlocks(markdown).join('')).toBe(markdown);
  });
});

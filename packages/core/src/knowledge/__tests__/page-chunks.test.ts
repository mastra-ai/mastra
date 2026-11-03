import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { knowledgeBodyChunks, knowledgeBodySections } from '../page-body';

const paragraph = (i: number) => `Paragraph ${i}. ${'Words that fill the paragraph out. '.repeat(20)}`.trim();

describe('knowledgeBodyChunks', () => {
  it('keeps a body that fits as one chunk', () => {
    expect(knowledgeBodyChunks('Short body.\n\nTwo paragraphs.', 100)).toEqual(['Short body.\n\nTwo paragraphs.']);
  });

  it('cuts between paragraphs, each chunk within the limit, each starting with the end of the last', () => {
    const body = Array.from({ length: 30 }, (_, i) => paragraph(i)).join('\n\n');
    const chunks = knowledgeBodyChunks(body, 600, 50);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(estimateTokenCount(chunk)).toBeLessThanOrEqual(600);
    // No paragraph is split, and every one lands in some chunk.
    for (let i = 0; i < 30; i++) expect(chunks.some(chunk => chunk.includes(paragraph(i)))).toBe(true);
    for (let i = 1; i < chunks.length; i++) {
      const previous = chunks[i - 1]!;
      expect(previous.endsWith(chunks[i]!.split('\n\n')[0]!)).toBe(true);
    }
  });

  it('starts a new chunk at a heading once the current one is half full', () => {
    const body = [paragraph(1), paragraph(2), paragraph(3), '## Next part', paragraph(4)].join('\n\n');
    const chunks = knowledgeBodyChunks(body, 600, 0);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]!.startsWith('## Next part')).toBe(true);
  });

  it('keeps a fenced code block whole, blank lines and all, when it fits', () => {
    const code = ['```ts', 'const a = 1;', '', '# not a heading', 'const b = 2;', '```'].join('\n');
    const body = [paragraph(1), paragraph(2), code, paragraph(3)].join('\n\n');
    const chunks = knowledgeBodyChunks(body, 400, 0);
    expect(chunks.some(chunk => chunk.includes(code))).toBe(true);
  });

  it('cuts a single paragraph too big for one chunk by tokens, losing nothing', () => {
    const body = 'word '.repeat(5_000).trim();
    const chunks = knowledgeBodyChunks(body, 500, 0);
    for (const chunk of chunks) expect(estimateTokenCount(chunk)).toBeLessThanOrEqual(500);
    expect(chunks.join('')).toBe(body);
  });

  it('keeps a four-backtick fence whole when it shows a three-backtick one inside', () => {
    const code = ['````md', '```js', 'const a = 1;', '', '## not a heading', '```', '', 'still code', '````'].join(
      '\n',
    );
    const body = [paragraph(1), paragraph(2), code, paragraph(3)].join('\n\n');
    const chunks = knowledgeBodyChunks(body, 400, 0);
    expect(chunks.some(chunk => chunk.includes(code))).toBe(true);
  });

  it('refuses an overlap as big as the chunk', () => {
    expect(() => knowledgeBodyChunks('word '.repeat(500), 100, 100)).toThrow(RangeError);
  });
});

describe('knowledgeBodySections', () => {
  it('ignores headings in a fence until a matching fence closes it', () => {
    const body = ['````md', '```js', '## inside', '```', '## still inside', '````', '## Outside'].join('\n');
    expect(knowledgeBodySections(body).map(section => section.title)).toEqual(['Outside']);
  });

  it('a ```js line does not close an open ``` fence', () => {
    const body = ['```', '```js', '## inside', '```', '## Outside'].join('\n');
    expect(knowledgeBodySections(body).map(section => section.title)).toEqual(['Outside']);
  });

  it('a fence indented four spaces is indented code, not a fence', () => {
    const body = ['Example:', '', '    ```', '# Overview', '', '   ```', '## inside', '   ```', '## After'].join('\n');
    expect(knowledgeBodySections(body).map(section => section.title)).toEqual(['Overview', 'After']);
  });

  it('keeps a trailing # that is part of the title, and drops a closing run after a space', () => {
    expect(knowledgeBodySections('## Use C#\n\n### Notes ##').map(section => section.title)).toEqual([
      'Use C#',
      'Notes',
    ]);
  });
});

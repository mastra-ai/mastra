import { describe, expect, it } from 'vitest';

import { adfToText, textToAdf } from './adf.js';

describe('adfToText', () => {
  it('flattens paragraphs, hard breaks, and marks-carrying text', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First line' },
            { type: 'hardBreak' },
            { type: 'text', text: 'second line', marks: [{ type: 'strong' }] },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph' }] },
      ],
    };
    expect(adfToText(doc)).toBe('First line\nsecond line\n\nSecond paragraph');
  });

  it('renders nested lists with prefixes', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'alpha' }] }] },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'beta' }] },
                {
                  type: 'orderedList',
                  content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(adfToText(doc)).toBe('- alpha\n- beta\n  1. one\n  2. two');
  });

  it('fences code blocks and keeps headings as plain lines', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Repro' }] },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const a = 1;' }] },
      ],
    };
    expect(adfToText(doc)).toBe('Repro\n\n```\nconst a = 1;\n```');
  });

  it('renders mentions as @name and inline cards as their URL', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'u1', text: '@Ada' } },
            { type: 'text', text: ' please look at ' },
            { type: 'inlineCard', attrs: { url: 'https://example.com/spec' } },
          ],
        },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'u2', text: 'Grace' } }] },
      ],
    };
    expect(adfToText(doc)).toBe('@Ada please look at https://example.com/spec\n\n@Grace');
  });

  it('degrades unknown nodes to their text content', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'mysteryBlock',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'still visible' }] }],
        },
        { type: 'emptyMystery' },
      ],
    };
    expect(adfToText(doc)).toBe('still visible');
  });

  it('returns an empty string for null, undefined, and non-object input', () => {
    expect(adfToText(null)).toBe('');
    expect(adfToText(undefined)).toBe('');
    expect(adfToText('plain string')).toBe('');
  });
});

describe('textToAdf', () => {
  it('wraps each line in a paragraph inside a version-1 doc', () => {
    expect(textToAdf('line one\n\nline two')).toEqual({
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'line one' }] },
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [{ type: 'text', text: 'line two' }] },
      ],
    });
  });

  it('round-trips through adfToText', () => {
    expect(adfToText(textToAdf('hello\nworld'))).toBe('hello\n\nworld');
  });
});

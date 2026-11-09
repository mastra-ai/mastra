import { describe, expect, it } from 'vitest';

import { MDocument } from '../document';

// Characters outside the Basic Multilingual Plane (emoji, CJK Extension B) are
// two UTF-16 code units. A chunk that ends between them holds a lone surrogate,
// which is not valid UTF-16 and turns into U+FFFD once stored or embedded. (#29268)
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const hasLoneSurrogate = (text: string) => LONE_SURROGATE.test(text);
const survivesUtf8RoundTrip = (text: string) => Buffer.from(text, 'utf8').toString('utf8') === text;

describe('chunking text with characters outside the BMP (#29268)', () => {
  it('recursive chunking keeps each emoji whole when it falls back to splitting by character', async () => {
    const doc = MDocument.fromText('😀'.repeat(6));

    const chunks = await doc.chunk({ strategy: 'recursive', maxSize: 5, overlap: 0 });
    const texts = chunks.map(chunk => chunk.text);

    expect(texts).toEqual(['😀😀', '😀😀', '😀😀']);
    expect(texts.every(survivesUtf8RoundTrip)).toBe(true);
  });

  it('recursive chunking of a long run of emoji with overlap produces only valid UTF-16 chunks', async () => {
    const doc = MDocument.fromText('😀'.repeat(2500));

    const chunks = await doc.chunk({ strategy: 'recursive', maxSize: 1001, overlap: 101 });
    const texts = chunks.map(chunk => chunk.text);

    expect(texts.length).toBeGreaterThan(1);
    expect(texts.filter(hasLoneSurrogate)).toEqual([]);
    expect(texts.every(text => text.length <= 1001)).toBe(true);
  });

  it('recursive chunking with a small overlap never starts a chunk on the second half of a pair', async () => {
    const doc = MDocument.fromText('😀'.repeat(6));

    const chunks = await doc.chunk({ strategy: 'recursive', maxSize: 5, overlap: 2 });
    const texts = chunks.map(chunk => chunk.text);

    // An overlap of 2 code units holds exactly one emoji, so each chunk repeats
    // the last emoji of the one before it.
    expect(texts).toEqual(['😀😀', '😀😀', '😀😀', '😀😀', '😀😀']);
  });

  it('recursive chunking of supplementary-plane CJK mixed with BMP text rejoins to the input', async () => {
    // U+20000..U+20004 are CJK Extension B (surrogate pairs); 中文 is BMP.
    const input = '中𠀀文𠀁𠀂中𠀃文𠀄'.repeat(20);
    const doc = MDocument.fromText(input);

    const chunks = await doc.chunk({ strategy: 'recursive', maxSize: 7, overlap: 0 });
    const texts = chunks.map(chunk => chunk.text);

    expect(texts.filter(hasLoneSurrogate)).toEqual([]);
    expect(texts.join('')).toBe(input);
  });

  it('markdown chunking keeps emoji whole when a line has no separators left', async () => {
    const doc = MDocument.fromMarkdown('🚀'.repeat(9));

    const chunks = await doc.chunk({ strategy: 'markdown', maxSize: 5, overlap: 0 });
    const texts = chunks.map(chunk => chunk.text);

    expect(texts.filter(hasLoneSurrogate)).toEqual([]);
    expect(texts.join('')).toBe('🚀'.repeat(9));
  });

  it('character chunking with an empty separator keeps each emoji whole', async () => {
    const input = 'a😀b🌍'.repeat(3);
    const doc = MDocument.fromText(input);

    const chunks = await doc.chunk({ strategy: 'character', separator: '', maxSize: 5, overlap: 0 });
    const texts = chunks.map(chunk => chunk.text);

    expect(texts.filter(hasLoneSurrogate)).toEqual([]);
    expect(texts.join('')).toBe(input);
  });

  it('character chunking with an empty separator and overlap produces only valid UTF-16 chunks', async () => {
    const doc = MDocument.fromText('😀'.repeat(2500));

    const chunks = await doc.chunk({ strategy: 'character', separator: '', maxSize: 1001, overlap: 101 });
    const texts = chunks.map(chunk => chunk.text);

    // Character chunking does not merge splits, so each emoji is its own chunk.
    expect(texts).toHaveLength(2500);
    expect(texts.filter(hasLoneSurrogate)).toEqual([]);
    expect(texts.join('')).toBe('😀'.repeat(2500));
  });
});

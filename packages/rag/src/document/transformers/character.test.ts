import { describe, expect, it } from 'vitest';

import { CharacterTransformer, RecursiveCharacterTransformer } from './character';

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

describe('CharacterTransformer', () => {
  it('preserves character-based overlap with the default length function', () => {
    const transformer = new CharacterTransformer({
      maxSize: 3,
      overlap: 1,
      stripWhitespace: false,
    });

    expect(transformer.splitText({ text: 'abcdef' })).toEqual(['abc', 'cde', 'ef']);
  });

  it('preserves content when the length function uses non-character units', () => {
    const transformer = new CharacterTransformer({
      maxSize: 4,
      overlap: 0,
      lengthFunction: utf8Length,
      stripWhitespace: false,
    });

    expect(transformer.splitText({ text: 'éøåß' })).toEqual(['éø', 'åß']);
  });

  it('measures overlap with the configured length function', () => {
    const transformer = new CharacterTransformer({
      maxSize: 4,
      overlap: 2,
      lengthFunction: utf8Length,
      stripWhitespace: false,
    });

    expect(transformer.splitText({ text: 'éøåß' })).toEqual(['éø', 'øå', 'åß']);
  });

  it('preserves an oversized Unicode code point as a complete chunk', () => {
    const transformer = new CharacterTransformer({
      maxSize: 2,
      overlap: 0,
      lengthFunction: utf8Length,
      stripWhitespace: false,
    });

    expect(transformer.splitText({ text: '😀a' })).toEqual(['😀', 'a']);
  });

  it('keeps overlap on Unicode code-point boundaries', () => {
    const transformer = new CharacterTransformer({
      maxSize: 4,
      overlap: 3,
      lengthFunction: utf8Length,
      stripWhitespace: false,
    });

    expect(transformer.splitText({ text: '😀😀' })).toEqual(['😀', '😀']);
  });
});

describe('maxSize with a large overlap', () => {
  it('keeps every chunk within maxSize when the overlap is large relative to it', () => {
    // The overlap window is carried into the next chunk, and the split that
    // triggered the flush was appended without checking that the two still fit.
    // `aaaa bbbb cccc` is 14 characters against a maxSize of 12, and the loop
    // only noticed one iteration later, after the chunk had been emitted.
    const transformer = new RecursiveCharacterTransformer({
      separators: [' '],
      maxSize: 12,
      overlap: 8,
    });

    const chunks = transformer.splitText({ text: 'aaaa bbbb cccc dddd eeee' });

    expect(chunks).toEqual(['aaaa bbbb', 'bbbb cccc', 'cccc dddd', 'dddd eeee']);
  });

  it('still emits a single split that cannot fit, rather than dropping it', () => {
    // The control: dropping from the front must stop at an empty window, so the
    // oversized split is emitted whole and the existing warning still covers it.
    const transformer = new RecursiveCharacterTransformer({
      separators: [' '],
      maxSize: 4,
      overlap: 3,
    });

    const chunks = transformer.splitText({ text: 'aa bbbbbbbb cc' });

    expect(chunks.join(' ')).toContain('bbbbbbbb');
  });

  it('leaves a transformer whose splits already fit unchanged', () => {
    // The control: CharacterTransformer on a space separator produces splits of
    // 4, which never trip the limit, so its output must not move.
    const transformer = new CharacterTransformer({
      separator: ' ',
      maxSize: 12,
      overlap: 8,
      isSeparatorRegex: false,
    });

    expect(transformer.splitText({ text: 'aaaa bbbb cccc dddd eeee' })).toEqual([
      'aaaa',
      'bbbb',
      'cccc',
      'dddd',
      'eeee',
    ]);
  });
});

describe('separatorPosition: start', () => {
  const baseOptions = { maxSize: 100, overlap: 0, stripWhitespace: false } as const;

  it('preserves consecutive and trailing separators', () => {
    const transformer = new CharacterTransformer({
      ...baseOptions,
      separator: ',',
      separatorPosition: 'start',
    });

    expect(transformer.splitText({ text: 'hello,,world,' })).toEqual(['hello', ',', ',world', ',']);
  });

  it('keeps separator-only input', () => {
    const transformer = new CharacterTransformer({
      ...baseOptions,
      separator: ',',
      separatorPosition: 'start',
    });

    expect(transformer.splitText({ text: ',,' })).toEqual([',', ',']);
  });

  it('returns no chunks for empty input', () => {
    const transformer = new CharacterTransformer({
      ...baseOptions,
      separator: ',',
      separatorPosition: 'start',
    });

    expect(transformer.splitText({ text: '' })).toEqual([]);
  });

  it('round-trips text with the character strategy', () => {
    const text = 'a\n\n\n\nb\n\n';
    const transformer = new CharacterTransformer({
      ...baseOptions,
      separator: '\n\n',
      separatorPosition: 'start',
    });

    expect(transformer.splitText({ text }).join('')).toBe(text);
  });

  it('round-trips text with the recursive strategy', () => {
    const text = 'a\n\n\n\nb\n\n';
    const transformer = new RecursiveCharacterTransformer({
      ...baseOptions,
      separators: ['\n\n'],
      separatorPosition: 'start',
    });

    expect(transformer.splitText({ text }).join('')).toBe(text);
  });

  it('keeps end-position output unchanged', () => {
    const transformer = new CharacterTransformer({
      ...baseOptions,
      separator: ',',
      separatorPosition: 'end',
    });

    expect(transformer.splitText({ text: 'hello,,world,' })).toEqual(['hello,', ',', 'world,']);
  });
});

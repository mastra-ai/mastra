import { describe, expect, it } from 'vitest';

import { Language } from '../types';

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

  it('keeps chunks within maxSize when overlap is large relative to it', () => {
    const transformer = new RecursiveCharacterTransformer({
      maxSize: 12,
      overlap: 8,
      separators: [' '],
      stripWhitespace: false,
    });

    const chunks = transformer.splitText({ text: 'aaaa bbbb cccc dddd eeee' });

    expect(chunks).toEqual(['aaaa bbbb', 'bbbb cccc', 'cccc dddd', 'dddd eeee']);
    expect(chunks.every(chunk => chunk.length <= 12)).toBe(true);
  });

  it('keeps chunks within maxSize for a near-maximal overlap', () => {
    const transformer = new RecursiveCharacterTransformer({
      maxSize: 10,
      overlap: 9,
      separators: [' '],
      stripWhitespace: false,
    });

    const chunks = transformer.splitText({ text: 'aaaa bbbb cccc dddd eeee' });

    expect(chunks.every(chunk => chunk.length <= 10)).toBe(true);
  });

  it('still emits an indivisible split that exceeds maxSize as a whole chunk', () => {
    const transformer = new RecursiveCharacterTransformer({
      maxSize: 5,
      overlap: 3,
      separators: [' '],
      stripWhitespace: false,
    });

    const chunks = transformer.splitText({ text: 'aa superlongtoken bb' });

    expect(chunks).toContain('superlongtoken');
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

describe('regex separators are rejoined with the matched text', () => {
  it('keeps markdown headers intact when merging', async () => {
    const { MarkdownTransformer } = await import('./markdown');
    const text = '# Title\n\nIntro.\n\n## Install\n\nRun it.\n\n### Notes\n\nSome notes.';
    const chunks = new MarkdownTransformer({ maxSize: 1000, overlap: 0 }).splitText({ text });
    expect(chunks).toEqual([text]);
  });

  it('keeps LaTeX section commands intact', async () => {
    const { LatexTransformer } = await import('./latex');
    const text = 'Intro text.\n\\section{One}\nBody one.\n\\section*{Two}\nBody two.';
    const chunks = new LatexTransformer({ maxSize: 1000, overlap: 0 }).splitText({ text });
    expect(chunks).toEqual([text]);
  });

  it('writes real newlines for PHP separators', () => {
    const text = '<?php\nfunction a() {}';
    const chunks = RecursiveCharacterTransformer.fromLanguage(Language.PHP, { maxSize: 1000, overlap: 0 }).splitText({
      text,
    });
    expect(chunks).toEqual([text]);
  });

  it('keeps RST underlines intact', () => {
    const text = 'Title\n=====\nBody text';
    const chunks = RecursiveCharacterTransformer.fromLanguage(Language.RST, { maxSize: 1000, overlap: 0 }).splitText({
      text,
    });
    expect(chunks).toEqual([text]);
  });

  it('uses matched text across chunk boundaries and overlap', () => {
    const transformer = new RecursiveCharacterTransformer({
      separators: ['\\n#{1,6} '],
      isSeparatorRegex: true,
      maxSize: 20,
      overlap: 10,
    });
    const chunks = transformer.splitText({ text: 'aaaa\n## bbbb\n### cccc\n# dddd\n## eeee' });
    for (const chunk of chunks) {
      expect(chunk).not.toContain('{1,6}');
    }
    expect(chunks.join('\n')).toContain('bbbb\n### cccc');
  });

  it('leaves literal separators unchanged', () => {
    const transformer = new RecursiveCharacterTransformer({ separators: ['|'], maxSize: 1000, overlap: 0 });
    expect(transformer.splitText({ text: 'a|b|c' })).toEqual(['a|b|c']);
  });
});

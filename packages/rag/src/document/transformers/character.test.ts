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

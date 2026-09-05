import { describe, expect, it } from 'vitest';

import { CharacterTransformer, RecursiveCharacterTransformer } from './character';

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

describe('RecursiveCharacterTransformer', () => {
  it('preserves consecutive and trailing start separators when merging chunks', () => {
    const transformer = new RecursiveCharacterTransformer({
      separators: [','],
      separatorPosition: 'start',
      maxSize: 6,
      overlap: 0,
      stripWhitespace: false,
    });

    const chunks = transformer.splitText({ text: 'hello,,world,' });
    expect(chunks.join('')).toBe('hello,,world,');
    expect(chunks.every(chunk => chunk.length <= 6)).toBe(true);
  });
});

describe('CharacterTransformer', () => {
  it.each<[string, string[]]>([
    ['hello,', ['hello', ',']],
    ['hello,,world', ['hello', ',', ',world']],
    [',,', [',', ',']],
    ['', []],
  ])('preserves start separators in %j', (text, expected) => {
    const transformer = new CharacterTransformer({
      separator: ',',
      separatorPosition: 'start',
      maxSize: 100,
      overlap: 0,
      stripWhitespace: false,
    });

    expect(transformer.splitText({ text })).toEqual(expected);
  });

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

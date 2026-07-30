import { describe, expect, it } from 'vitest';

import { CharacterTransformer } from './character';

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

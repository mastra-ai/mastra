import { describe, it, expect } from 'vitest';
import { CODEC_TAG, MAX_REGEXP_SOURCE_LENGTH, isEnvelope } from './tags';

describe('CODEC_TAG', () => {
  it('is the reserved envelope discriminator key', () => {
    expect(CODEC_TAG).toBe('__m_codec__');
  });
});

describe('MAX_REGEXP_SOURCE_LENGTH', () => {
  it('is a positive finite bound on RegExp source length', () => {
    expect(MAX_REGEXP_SOURCE_LENGTH).toBeGreaterThan(0);
    expect(Number.isFinite(MAX_REGEXP_SOURCE_LENGTH)).toBe(true);
  });
});

describe('isEnvelope', () => {
  it('returns false for plain objects without the codec tag', () => {
    expect(isEnvelope({ foo: 'bar' })).toBe(false);
    expect(isEnvelope({})).toBe(false);
  });

  it('returns false when the tag value is a non-string', () => {
    expect(isEnvelope({ [CODEC_TAG]: 123 })).toBe(false);
    expect(isEnvelope({ [CODEC_TAG]: null })).toBe(false);
  });

  it('returns false for an unknown tag value', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Unknown', v: 'x' })).toBe(false);
  });

  it('recognizes the Undefined envelope (no payload)', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Undefined' })).toBe(true);
  });

  it('recognizes Date, BigInt and URL envelopes (string v)', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Date', v: '2024-01-01' })).toBe(true);
    expect(isEnvelope({ [CODEC_TAG]: 'BigInt', v: '123' })).toBe(true);
    expect(isEnvelope({ [CODEC_TAG]: 'URL', v: 'https://example.com' })).toBe(true);
  });

  it('rejects Date/BigInt/URL envelopes with non-string v', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Date', v: 123 })).toBe(false);
    expect(isEnvelope({ [CODEC_TAG]: 'URL', v: {} })).toBe(false);
  });

  it('recognizes Map and Set envelopes (array v)', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Map', v: [['a', 1]] })).toBe(true);
    expect(isEnvelope({ [CODEC_TAG]: 'Set', v: [1, 2, 3] })).toBe(true);
  });

  it('rejects Map/Set envelopes with non-array v', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Map', v: 'not-array' })).toBe(false);
    expect(isEnvelope({ [CODEC_TAG]: 'Set', v: {} })).toBe(false);
  });

  it('recognizes Error envelopes (object v)', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Error', v: { name: 'Error', message: 'boom' } })).toBe(true);
  });

  it('rejects Error envelopes with null/primitive v', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Error', v: null })).toBe(false);
    expect(isEnvelope({ [CODEC_TAG]: 'Error', v: 'boom' })).toBe(false);
  });

  it('recognizes Class envelopes (string n)', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Class', n: 'Foo', v: {} })).toBe(true);
  });

  it('rejects Class envelopes with non-string n', () => {
    expect(isEnvelope({ [CODEC_TAG]: 'Class', n: 42, v: {} })).toBe(false);
  });

  describe('RegExp envelopes', () => {
    it('recognizes a valid RegExp envelope', () => {
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: 'abc', flags: 'g' } })).toBe(true);
    });

    it('rejects RegExp envelopes missing source or flags', () => {
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: 'abc' } })).toBe(false);
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { flags: 'g' } })).toBe(false);
    });

    it('rejects RegExp envelopes with non-string source/flags', () => {
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: 1, flags: 'g' } })).toBe(false);
    });

    it('rejects RegExp envelopes with invalid flag characters', () => {
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: 'abc', flags: 'z' } })).toBe(false);
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: 'abc', flags: 'gx' } })).toBe(false);
    });

    it('rejects RegExp envelopes with duplicate flags', () => {
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: 'abc', flags: 'gg' } })).toBe(false);
    });

    it('accepts all spec-defined RegExp flags', () => {
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: 'abc', flags: 'dgimsuvy' } })).toBe(true);
    });

    it('rejects RegExp sources exceeding the length bound', () => {
      const tooLong = 'a'.repeat(MAX_REGEXP_SOURCE_LENGTH + 1);
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: tooLong, flags: 'g' } })).toBe(false);
    });

    it('accepts RegExp sources at exactly the length bound', () => {
      const atBound = 'a'.repeat(MAX_REGEXP_SOURCE_LENGTH);
      expect(isEnvelope({ [CODEC_TAG]: 'RegExp', v: { source: atBound, flags: 'g' } })).toBe(true);
    });
  });
});

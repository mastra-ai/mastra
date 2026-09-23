import { describe, expect, it } from 'vitest';
import { sanitizeJsonForPg, toPgJson } from '../../db/sanitize-json';

describe('PostgreSQL JSON serialization', () => {
  it('removes NUL characters from values and keys', () => {
    expect(JSON.parse(toPgJson({ 'a\0b': 'before\0after' }))).toEqual({ ab: 'beforeafter' });
  });

  it('replaces unpaired surrogates without changing valid emoji', () => {
    expect(JSON.parse(toPgJson({ text: 'a\uD800b\uDFFF', emoji: '😀' }))).toEqual({ text: 'a�b�', emoji: '😀' });
  });

  it('preserves literal Unicode escape text and real backslashes preceding invalid characters', () => {
    const value = {
      literalNull: String.raw`literal\u0000`,
      literalSurrogate: String.raw`literal\uD800`,
      path: 'C:\\path\\\uD800-end',
      nullPath: 'C:\\path\\\0-end',
      regex: String.raw`[^\ud800-\udfff]`,
    };
    expect(JSON.parse(toPgJson(value))).toEqual({
      ...value,
      path: 'C:\\path\\�-end',
      nullPath: 'C:\\path\\-end',
    });
  });

  it('normalizes nested arrays and keys without changing JSON.stringify handling of Dates', () => {
    const value = { nested: [{ 'x\uD800': 'y\0z' }], date: new Date('2020-01-01T00:00:00.000Z') };
    expect(JSON.parse(toPgJson(value))).toEqual({ nested: [{ 'x�': 'yz' }], date: value.date.toISOString() });
  });

  it('preserves JSON.stringify behavior for shared references and circular objects', () => {
    const shared = { 'a\0b': 'value' };
    expect(toPgJson({ first: shared, second: shared })).toBe('{"first":{"ab":"value"},"second":{"ab":"value"}}');

    const circular: Record<string, unknown> = { 'a\0b': 'value' };
    circular.self = circular;
    expect(() => toPgJson(circular)).toThrow(TypeError);
  });

  it('preserves native JSON serialization for boxed values, getters, and custom toJSON', () => {
    const value = {
      number: new Number(4),
      boolean: new Boolean(true),
      string: new String('hello'),
      nested: { toJSON: () => ({ text: 'normal' }) },
      get computed() {
        return this.string.toString();
      },
    };
    expect(toPgJson(value)).toBe(JSON.stringify(value));
    expect(toPgJson(JSON.rawJSON('3'))).toBe(JSON.stringify(JSON.rawJSON('3')));
  });

  it('rejects keys that collide after repair rather than silently overwriting values', () => {
    expect(() => toPgJson({ ab: 1, 'a\0b': 2 })).toThrow('JSON keys collide');
  });

  it('preserves native behavior for top-level values without JSON output', () => {
    expect(toPgJson(undefined)).toBe(JSON.stringify(undefined));
  });

  it('still accepts already serialized JSON', () => {
    expect(sanitizeJsonForPg('"before\\u0000after"')).toBe('"beforeafter"');
    expect(JSON.parse(sanitizeJsonForPg('"before\\uD800after"'))).toBe('before�after');
    expect(JSON.parse(sanitizeJsonForPg('"literal\\\\uD800"'))).toBe(String.raw`literal\uD800`);
    expect(JSON.parse(sanitizeJsonForPg('"invalid\\v escape"'))).toBe(String.raw`invalid\v escape`);
  });
});

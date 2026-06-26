/**
 * Pure-function tests for the v-next observability polling helpers.
 *
 * Lives next to the source so it runs as part of the @mastra/pg test suite
 * without needing the integration-test Postgres container. Anything that
 * touches the DB belongs in the storage / index test files instead.
 */

import { describe, expect, it } from 'vitest';
import { decodeDeltaCursor, encodeDeltaCursor } from './polling';

describe('encodeDeltaCursor', () => {
  it('encodes the transaction id and cursor id as one opaque string', () => {
    expect(encodeDeltaCursor(42, 7)).toBe('42:7');
  });

  it('accepts string values that fit in Postgres integer casts', () => {
    expect(encodeDeltaCursor('1234567890123456789', '9223372036854775807')).toBe(
      '1234567890123456789:9223372036854775807',
    );
  });

  it('uses cursor id zero when encoding a safe transaction horizon', () => {
    expect(encodeDeltaCursor('55')).toBe('55:0');
  });

  it('returns "0:0" when both parts are nullish', () => {
    expect(encodeDeltaCursor(null, undefined)).toBe('0:0');
  });
});

describe('decodeDeltaCursor', () => {
  it('decodes a valid pair cursor', () => {
    expect(decodeDeltaCursor('42:7')).toEqual({ xactId: '42', cursorId: '7' });
  });

  it('accepts zero for the bootstrap cursor pair', () => {
    expect(decodeDeltaCursor('0:0')).toEqual({ xactId: '0', cursorId: '0' });
  });

  it('accepts the Postgres bigint upper bound in both parts', () => {
    expect(decodeDeltaCursor('9223372036854775807:9223372036854775807')).toEqual({
      xactId: '9223372036854775807',
      cursorId: '9223372036854775807',
    });
  });

  it('rejects negative numbers (leading sign breaks the digit regex)', () => {
    expect(() => decodeDeltaCursor('-1:2')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects non-digit input', () => {
    expect(() => decodeDeltaCursor('abc:2')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects mixed digit/non-digit input', () => {
    expect(() => decodeDeltaCursor('123abc:2')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects the empty string', () => {
    expect(() => decodeDeltaCursor('')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects the old single-number cursor shape', () => {
    expect(() => decodeDeltaCursor('123')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects a cursor with too many parts', () => {
    expect(() => decodeDeltaCursor('1:2:3')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects values one above the Postgres bigint upper bound', () => {
    expect(() => decodeDeltaCursor('9223372036854775808:1')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects values far above the Postgres bigint upper bound', () => {
    expect(() => decodeDeltaCursor('1:99999999999999999999999999')).toThrow(/Invalid observability delta cursor/);
  });
});

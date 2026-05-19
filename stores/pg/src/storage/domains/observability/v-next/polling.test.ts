/**
 * Pure-function tests for the v-next observability polling helpers.
 *
 * Lives next to the source so it runs as part of the @mastra/pg test suite
 * without needing the integration-test Postgres container. Anything that
 * touches the DB belongs in the storage / index test files instead.
 */

import { describe, expect, it } from 'vitest';
import { encodeDeltaCursor, validateCursorId } from './polling';

describe('encodeDeltaCursor', () => {
  it('coerces a numeric value to its string form', () => {
    expect(encodeDeltaCursor(42)).toBe('42');
  });

  it('passes through a string cursor unchanged', () => {
    expect(encodeDeltaCursor('1234567890123456789')).toBe('1234567890123456789');
  });

  it('returns "0" for null', () => {
    expect(encodeDeltaCursor(null)).toBe('0');
  });

  it('returns "0" for undefined', () => {
    expect(encodeDeltaCursor(undefined)).toBe('0');
  });
});

describe('validateCursorId', () => {
  it('accepts a small positive integer', () => {
    expect(validateCursorId('1')).toBe('1');
  });

  it('accepts zero (the bootstrap cursor)', () => {
    expect(validateCursorId('0')).toBe('0');
  });

  it('accepts the Postgres bigint upper bound', () => {
    expect(validateCursorId('9223372036854775807')).toBe('9223372036854775807');
  });

  it('rejects negative numbers (leading sign breaks the digit regex)', () => {
    expect(() => validateCursorId('-1')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects non-digit input', () => {
    expect(() => validateCursorId('abc')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects mixed digit/non-digit input', () => {
    expect(() => validateCursorId('123abc')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects the empty string', () => {
    expect(() => validateCursorId('')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects values one above the Postgres bigint upper bound', () => {
    expect(() => validateCursorId('9223372036854775808')).toThrow(/Invalid observability delta cursor/);
  });

  it('rejects values far above the Postgres bigint upper bound', () => {
    expect(() => validateCursorId('99999999999999999999999999')).toThrow(/Invalid observability delta cursor/);
  });
});

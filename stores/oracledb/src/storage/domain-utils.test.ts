import { ErrorCategory, MastraError } from '@mastra/core/error';
import { describe, expect, it } from 'vitest';

import {
  createOracleStorageError,
  parseJsonValue,
  parseOptionalJson,
  parseOptionalJsonObject,
  parseOptionalStringArray,
  toDate,
} from './domain-utils';

describe('Oracle storage domain utils', () => {
  it('normalizes JSON values from Oracle fetch formats', () => {
    expect(parseJsonValue(null)).toBeNull();
    expect(parseJsonValue(undefined)).toBeNull();
    expect(parseJsonValue({ ok: true })).toEqual({ ok: true });
    expect(parseJsonValue(Buffer.from('{"ok":true}'))).toEqual({ ok: true });
    expect(parseJsonValue('not-json')).toBe('not-json');
    expect(parseOptionalJson<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true });
  });

  it('parses optional objects, string arrays, and dates', () => {
    expect(parseOptionalJsonObject('{"team":"ai"}')).toEqual({ team: 'ai' });
    expect(parseOptionalJsonObject('{}', { emptyObjectAsUndefined: true })).toBeUndefined();
    expect(parseOptionalJsonObject('[]')).toBeUndefined();
    expect(parseOptionalStringArray('["a",1,true]')).toEqual(['a', '1', 'true']);
    expect(parseOptionalStringArray('{"not":"array"}')).toBeUndefined();
    expect(toDate(new Date('2026-01-01T00:00:00.000Z')).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(toDate('2026-01-02T00:00:00.000Z').toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('creates Mastra storage errors while dropping undefined detail fields', () => {
    const error = createOracleStorageError({
      operation: 'TEST_OPERATION',
      reason: 'FAILED',
      details: { kept: 'yes', count: 1, skipped: undefined },
      cause: new Error('database failed'),
      category: ErrorCategory.USER,
    });

    expect(error).toBeInstanceOf(MastraError);
    expect(error.id).toContain('TEST_OPERATION');
    expect(error.details).toEqual({ kept: 'yes', count: 1 });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { optionalBoolean } from './reconciliation-config.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('optionalBoolean', () => {
  it('parses boolean values case-insensitively', () => {
    expect(optionalBoolean('ENABLED', ' true ', 'Test reconciliation')).toBe(true);
    expect(optionalBoolean('ENABLED', 'FALSE', 'Test reconciliation')).toBe(false);
    expect(optionalBoolean('ENABLED', undefined, 'Test reconciliation')).toBeUndefined();
  });

  it('warns with the integration label for invalid values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(optionalBoolean('ENABLED', 'sometimes', 'Test reconciliation')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[Test reconciliation] ENABLED must be true or false; received "sometimes".',
    );
  });
});

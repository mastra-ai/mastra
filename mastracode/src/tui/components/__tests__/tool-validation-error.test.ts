import { describe, it, expect } from 'vitest';
import { parseValidationErrors } from '../tool-validation-error.js';

describe('parseValidationErrors', () => {
  it('parses a single Zod-style error', () => {
    const input = 'Validation failed: at "user.name": Required field';
    const errors = parseValidationErrors(input);
    expect(errors).toEqual([{ field: 'user.name', message: 'Required field' }]);
  });

  it('parses multiple Zod-style errors on separate lines', () => {
    const input = ['at "a": first error', 'at "b": second error'].join('\n');
    const errors = parseValidationErrors(input);
    expect(errors).toEqual([
      { field: 'a', message: 'first error' },
      { field: 'b', message: 'second error' },
    ]);
  });

  it('parses "missing required" errors with any quote style', () => {
    expect(parseValidationErrors('missing required parameter "foo"')).toEqual([
      { field: 'foo', message: 'Required parameter is missing' },
    ]);
    expect(parseValidationErrors("missing required parameter 'bar'")).toEqual([
      { field: 'bar', message: 'Required parameter is missing' },
    ]);
    expect(parseValidationErrors('missing required parameter `baz`')).toEqual([
      { field: 'baz', message: 'Required parameter is missing' },
    ]);
  });

  it('returns a generic error when no pattern matches', () => {
    const errors = parseValidationErrors('some other string');
    expect(errors).toEqual([{ field: 'unknown', message: 'some other string' }]);
  });

  it('runs in linear time on pathological input (no ReDoS)', () => {
    // Shape CodeQL flagged: many `at "x"` with attribute-looking gaps and no ': '.
    const input = 'at "x"'.repeat(20_000);
    parseValidationErrors('at "x"'.repeat(100)); // warm up JIT
    const start = performance.now();
    parseValidationErrors(input);
    const elapsed = performance.now() - start;
    // Generous budget — linear implementation finishes in a few ms;
    // exponential backtracking would take seconds or hang.
    expect(elapsed).toBeLessThan(2000);
  });
});

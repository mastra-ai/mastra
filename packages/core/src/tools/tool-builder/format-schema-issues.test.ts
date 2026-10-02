import { describe, expect, it } from 'vitest';

import { formatStandardSchemaIssues, formatStandardSchemaPath } from './format-schema-issues';

describe('formatStandardSchemaPath', () => {
  it('returns an empty string when the path is missing or empty', () => {
    expect(formatStandardSchemaPath(undefined)).toBe('');
    expect(formatStandardSchemaPath([])).toBe('');
  });

  it('renders a top-level property name without a leading dot', () => {
    expect(formatStandardSchemaPath(['items'])).toBe('items');
  });

  it('renders nested properties with dot separators', () => {
    expect(formatStandardSchemaPath(['options', 'destination'])).toBe('options.destination');
  });

  it('renders array indexes with brackets and no leading dot', () => {
    expect(formatStandardSchemaPath(['items', 0, 'tags'])).toBe('items[0].tags');
  });

  it('accepts standard-schema PathSegment objects alongside raw keys', () => {
    expect(formatStandardSchemaPath([{ key: 'items' }, { key: 0 }, 'tags'])).toBe('items[0].tags');
  });

  it('quotes non-identifier keys with bracket notation', () => {
    expect(formatStandardSchemaPath(['user data', 'id'])).toBe('["user data"].id');
    expect(formatStandardSchemaPath(['-weird', 'ok'])).toBe('["-weird"].ok');
  });
});

describe('formatStandardSchemaIssues', () => {
  it('includes the path of every issue in a readable multi-line message', () => {
    const message = formatStandardSchemaIssues([
      { message: 'expected array, received string', path: ['items', 0, 'tags'] },
      { message: 'expected string, received undefined', path: ['options', 'destination'] },
    ]);

    expect(message).toBe(
      [
        'Tool validation failed:',
        '- items[0].tags: expected array, received string',
        '- options.destination: expected string, received undefined',
      ].join('\n'),
    );
  });

  it('falls back to the bare message when an issue has no path', () => {
    const message = formatStandardSchemaIssues([{ message: 'required', path: [] }, { message: 'oops' }]);

    expect(message).toBe(['Tool validation failed:', '- required', '- oops'].join('\n'));
  });

  it('fills in a default message when the issue text is empty', () => {
    const message = formatStandardSchemaIssues([{ message: '', path: ['tags'] }]);

    expect(message).toBe('Tool validation failed:\n- tags: invalid input');
  });
});

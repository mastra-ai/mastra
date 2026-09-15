/**
 * Tests for channels/formatting.ts
 *
 * All functions under test are pure (or near-pure) string-transformation utilities
 * with no I/O or async behaviour, so no mocking is required.
 *
 * The `formatToolRunning`, `formatToolResult`, `formatToolApproval`,
 * `formatToolApproved`, and `formatToolDenied` functions branch on a `useCards`
 * flag.  When `useCards` is false they return plain strings; when true they call
 * into the lazily-loaded Chat SDK via `chatModule()`.  The plain-text paths are
 * fully covered here.  The card paths require the Chat SDK to be initialised and
 * are integration-level concerns left to the channel integration tests.
 */
import { describe, expect, it } from 'vitest';

import {
  formatArgsSummary,
  formatResult,
  formatToolApproval,
  formatToolApproved,
  formatToolDenied,
  formatToolHeader,
  formatToolResult,
  formatToolRunning,
  stripToolPrefix,
} from './formatting';

// ---------------------------------------------------------------------------
// stripToolPrefix
// ---------------------------------------------------------------------------

describe('stripToolPrefix', () => {
  it('strips the mastra_workspace_ prefix', () => {
    expect(stripToolPrefix('mastra_workspace_search')).toBe('search');
  });

  it('strips only the first matching prefix', () => {
    expect(stripToolPrefix('mastra_workspace_mastra_workspace_nested')).toBe('mastra_workspace_nested');
  });

  it('returns the name unchanged when no prefix matches', () => {
    expect(stripToolPrefix('my_custom_tool')).toBe('my_custom_tool');
  });

  it('returns an empty string unchanged', () => {
    expect(stripToolPrefix('')).toBe('');
  });

  it('does not strip partial prefix matches', () => {
    expect(stripToolPrefix('mastra_work')).toBe('mastra_work');
  });

  it('handles a name that is exactly the prefix', () => {
    expect(stripToolPrefix('mastra_workspace_')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatArgsSummary
// ---------------------------------------------------------------------------

describe('formatArgsSummary', () => {
  it('returns the first string value for a simple object', () => {
    expect(formatArgsSummary({ query: 'hello world' })).toBe('hello world');
  });

  it('truncates values longer than 35 characters', () => {
    const longValue = 'a'.repeat(40);
    const result = formatArgsSummary({ key: longValue });
    expect(result).toHaveLength(36); // 35 + ellipsis character
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate values of exactly 35 characters', () => {
    const value = 'a'.repeat(35);
    const result = formatArgsSummary({ key: value });
    expect(result).toBe(value);
  });

  it('serialises a non-string first value as JSON', () => {
    const result = formatArgsSummary({ count: 42 });
    expect(result).toBe('42');
  });

  it('skips the __mastraMetadata key', () => {
    const result = formatArgsSummary({ __mastraMetadata: 'internal', query: 'visible' });
    expect(result).toBe('visible');
  });

  it('skips null values', () => {
    const result = formatArgsSummary({ a: null, b: 'shown' });
    expect(result).toBe('shown');
  });

  it('skips false values', () => {
    const result = formatArgsSummary({ a: false, b: 'shown' });
    expect(result).toBe('shown');
  });

  it('skips empty string values', () => {
    const result = formatArgsSummary({ a: '', b: 'shown' });
    expect(result).toBe('shown');
  });

  it('returns an empty string for an empty object', () => {
    expect(formatArgsSummary({})).toBe('');
  });

  it('returns an empty string when all values are filtered out', () => {
    expect(formatArgsSummary({ a: null, b: false, c: '' })).toBe('');
  });

  it('accepts a JSON string and parses it', () => {
    const result = formatArgsSummary(JSON.stringify({ query: 'parsed' }));
    expect(result).toBe('parsed');
  });

  it('returns an empty string for a non-object primitive', () => {
    expect(formatArgsSummary(42)).toBe('');
    expect(formatArgsSummary(true)).toBe('');
  });

  it('returns an empty string for null', () => {
    expect(formatArgsSummary(null)).toBe('');
  });

  it('returns an empty string when the input is invalid JSON string', () => {
    expect(formatArgsSummary('not json {')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatResult
// ---------------------------------------------------------------------------

describe('formatResult', () => {
  it('returns the string value directly', () => {
    expect(formatResult('hello')).toBe('hello');
  });

  it('serialises non-string values as formatted JSON', () => {
    expect(formatResult({ key: 'value' })).toBe('{\n  "key": "value"\n}');
  });

  it('truncates output longer than 300 characters', () => {
    const long = 'x'.repeat(350);
    const result = formatResult(long);
    expect(result).toHaveLength(301); // 300 + ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate output of exactly 300 characters', () => {
    const exact = 'x'.repeat(300);
    expect(formatResult(exact)).toBe(exact);
  });

  it('returns "(no output)" for null', () => {
    expect(formatResult(null)).toBe('(no output)');
  });

  it('returns "(no output)" for undefined', () => {
    expect(formatResult(undefined)).toBe('(no output)');
  });

  it('prepends "Error: " when isError is true', () => {
    expect(formatResult('timeout', true)).toBe('Error: timeout');
  });

  it('prepends "Error: " to "(no output)" when isError is true and value is null', () => {
    expect(formatResult(null, true)).toBe('Error: (no output)');
  });

  it('trims leading and trailing whitespace from the output', () => {
    expect(formatResult('  trimmed  ')).toBe('trimmed');
  });

  it('returns a number serialised as a string', () => {
    expect(formatResult(42)).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// formatToolHeader
// ---------------------------------------------------------------------------

describe('formatToolHeader', () => {
  it('formats the header with argsSummary as italic name + code arg', () => {
    expect(formatToolHeader('search', 'cats')).toBe('*search* `cats`');
  });

  it('formats the header without args when argsSummary is empty', () => {
    expect(formatToolHeader('search', '')).toBe('*search*');
  });
});

// ---------------------------------------------------------------------------
// formatToolRunning (plain text path only)
// ---------------------------------------------------------------------------

describe('formatToolRunning (plain text)', () => {
  it('renders the spinner indicator with args', () => {
    const result = formatToolRunning('search', 'cats', false);
    expect(result).toBe('*search* `cats` ⋯');
  });

  it('renders the spinner indicator without args', () => {
    const result = formatToolRunning('search', '', false);
    expect(result).toBe('*search* ⋯');
  });
});

// ---------------------------------------------------------------------------
// formatToolResult (plain text path only)
// ---------------------------------------------------------------------------

describe('formatToolResult (plain text)', () => {
  it('renders a success result with duration', () => {
    const result = formatToolResult('search', 'cats', '5 results', false, 123, false);
    expect(result).toContain('*search* `cats`');
    expect(result).toContain('✓');
    expect(result).toContain('123ms');
    expect(result).toContain('5 results');
  });

  it('renders a success result without duration', () => {
    const result = formatToolResult('search', 'cats', 'ok', false, undefined, false);
    expect(result).toContain('✓');
    expect(result).not.toContain('ms');
  });

  it('renders an error result', () => {
    const result = formatToolResult('search', '', 'timeout', true, 50, false);
    expect(result).toContain('✗');
    expect(result).toContain('Error: timeout');
  });

  it('does not double-prepend "Error:" if result already starts with it', () => {
    const result = formatToolResult('search', '', 'Error: timeout', true, undefined, false);
    expect(result).not.toContain('Error: Error:');
  });

  it('formats duration >= 1000ms as seconds', () => {
    const result = formatToolResult('search', '', 'ok', false, 2500, false);
    expect(result).toContain('2.5s');
  });
});

// ---------------------------------------------------------------------------
// formatToolApproval (plain text path only)
// ---------------------------------------------------------------------------

describe('formatToolApproval (plain text)', () => {
  it('includes the tool header and approval instructions', () => {
    const result = formatToolApproval('run_code', 'print()', 'call-123', false);
    expect(result).toContain('*run_code*');
    expect(result).toContain('`print()`');
    expect(result).toContain('Requires approval');
    expect(result).toContain('approve');
    expect(result).toContain('deny');
  });

  it('works without an args summary', () => {
    const result = formatToolApproval('run_code', '', 'call-123', false);
    expect(result).toContain('*run_code*');
    expect(result).toContain('Requires approval');
  });
});

// ---------------------------------------------------------------------------
// formatToolApproved (plain text path only)
// ---------------------------------------------------------------------------

describe('formatToolApproved (plain text)', () => {
  it('includes the tool header and approved status', () => {
    const result = formatToolApproved('run_code', 'print()', false);
    expect(result).toContain('*run_code*');
    expect(result).toContain('✓ Approved');
  });

  it('works without an args summary', () => {
    const result = formatToolApproved('run_code', '', false);
    expect(result).toContain('*run_code*');
    expect(result).toContain('✓ Approved');
  });
});

// ---------------------------------------------------------------------------
// formatToolDenied (plain text path only)
// ---------------------------------------------------------------------------

describe('formatToolDenied (plain text)', () => {
  it('includes the tool header and denied status', () => {
    const result = formatToolDenied('run_code', 'print()', undefined, false);
    expect(typeof result).toBe('string');
    expect(result).toContain('*run_code*');
    expect(result).toContain('✗ Denied');
  });

  it('includes the user who denied when provided', () => {
    const result = formatToolDenied('run_code', 'print()', 'alice', false);
    expect(result).toContain('by alice');
  });

  it('omits the "by …" suffix when byUser is undefined', () => {
    const result = formatToolDenied('run_code', '', undefined, false);
    expect(result).not.toContain('by');
  });
});

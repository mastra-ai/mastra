import { describe, it, expect } from 'vitest';

import { hasHeadlessFlag, parseHeadlessArgs, truncate } from './headless.js';

describe('hasHeadlessFlag', () => {
  it('returns true when --prompt is present', () => {
    expect(hasHeadlessFlag(['node', 'main.js', '--prompt', 'hello'])).toBe(true);
  });

  it('returns true when -p is present', () => {
    expect(hasHeadlessFlag(['node', 'main.js', '-p', 'hello'])).toBe(true);
  });

  it('returns false when no prompt flag', () => {
    expect(hasHeadlessFlag(['node', 'main.js'])).toBe(false);
  });

  it('returns false for unrelated flags', () => {
    expect(hasHeadlessFlag(['node', 'main.js', '--continue', '--timeout', '60'])).toBe(false);
  });
});

describe('parseHeadlessArgs', () => {
  it('parses --prompt with value', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '--prompt', 'Fix the bug']);
    expect(args.prompt).toBe('Fix the bug');
    expect(args.format).toBe('default');
    expect(args.continue_).toBe(false);
    expect(args.timeout).toBeUndefined();
  });

  it('parses -p shorthand', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'Fix the bug']);
    expect(args.prompt).toBe('Fix the bug');
  });

  it('parses --continue flag', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'continue', '-c']);
    expect(args.continue_).toBe(true);
  });

  it('parses -c shorthand for continue', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'hello', '-c']);
    expect(args.continue_).toBe(true);
  });

  it('parses --timeout', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--timeout', '300']);
    expect(args.timeout).toBe(300);
  });

  it('throws on non-numeric --timeout', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--timeout', 'abc'])).toThrow(
      '--timeout must be a positive integer',
    );
  });

  it('throws on partial numeric --timeout like "10s"', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--timeout', '10s'])).toThrow(
      '--timeout must be a positive integer',
    );
  });

  it('throws on zero --timeout', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--timeout', '0'])).toThrow(
      '--timeout must be a positive integer',
    );
  });

  it('throws on negative --timeout', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--timeout', '-5'])).toThrow(
      '--timeout must be a positive integer',
    );
  });

  it('parses --format json', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--format', 'json']);
    expect(args.format).toBe('json');
  });

  it('parses --format default', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--format', 'default']);
    expect(args.format).toBe('default');
  });

  it('throws on invalid --format', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--format', 'xml'])).toThrow(
      '--format must be "default" or "json"',
    );
  });

  it('accepts positional prompt without flag', () => {
    const args = parseHeadlessArgs(['node', 'main.js', 'Fix the bug']);
    expect(args.prompt).toBe('Fix the bug');
  });

  it('parses all flags together', () => {
    const args = parseHeadlessArgs([
      'node',
      'main.js',
      '--prompt',
      'Run tests',
      '--thread',
      'my-thread',
      '--title',
      'My Title',
      '--clone-thread',
      '--resource-id',
      'my-project',
      '--timeout',
      '600',
      '--format',
      'json',
    ]);
    expect(args.prompt).toBe('Run tests');
    expect(args.thread).toBe('my-thread');
    expect(args.title).toBe('My Title');
    expect(args.cloneThread).toBe(true);
    expect(args.resourceId).toBe('my-project');
    expect(args.timeout).toBe(600);
    expect(args.format).toBe('json');
  });

  it('returns defaults when only prompt provided', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'hello']);
    expect(args.format).toBe('default');
    expect(args.continue_).toBe(false);
    expect(args.timeout).toBeUndefined();
  });

  it('returns undefined prompt when no prompt given', () => {
    const args = parseHeadlessArgs(['node', 'main.js']);
    expect(args.prompt).toBeUndefined();
  });

  it('returns undefined prompt when --prompt flag has no value', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '--prompt']);
    expect(args.prompt).toBeUndefined();
  });

  it('parses --clone-thread hyphenated boolean flag', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--clone-thread']);
    expect(args.cloneThread).toBe(true);
  });

  it('throws on --continue with --thread', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--continue', '--thread', 'abc123'])).toThrow(
      '--continue and --thread cannot be used together',
    );
  });
});

describe('truncate', () => {
  it('returns string unchanged when under max', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string unchanged when exactly at max', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis when over max', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('handles max of 0', () => {
    expect(truncate('hello', 0)).toBe('...');
  });
});

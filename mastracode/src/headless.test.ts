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
      '--continue',
      '--timeout',
      '600',
      '--format',
      'json',
      '--model',
      'anthropic/claude-sonnet-4-20250514',
      '--mode',
      'plan',
      '--thinking-level',
      'low',
      '--config',
      './config.json',
    ]);
    expect(args.prompt).toBe('Run tests');
    expect(args.continue_).toBe(true);
    expect(args.timeout).toBe(600);
    expect(args.format).toBe('json');
    expect(args.model).toBe('anthropic/claude-sonnet-4-20250514');
    expect(args.mode).toBe('plan');
    expect(args.thinkingLevel).toBe('low');
    expect(args.config).toBe('./config.json');
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

  it('parses --model with value', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--model', 'anthropic/claude-sonnet-4-20250514']);
    expect(args.model).toBe('anthropic/claude-sonnet-4-20250514');
  });

  it('parses -m shorthand', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '-m', 'anthropic/claude-sonnet-4-20250514']);
    expect(args.model).toBe('anthropic/claude-sonnet-4-20250514');
  });

  it('returns undefined model when not provided', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task']);
    expect(args.model).toBeUndefined();
  });

  it('parses --mode with value', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--mode', 'fast']);
    expect(args.mode).toBe('fast');
  });

  it('throws on invalid --mode value', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--mode', 'turbo'])).toThrow(
      '--mode must be "build", "plan", "fast"',
    );
  });

  it('returns undefined mode when not provided', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task']);
    expect(args.mode).toBeUndefined();
  });

  it('parses --thinking-level with value', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--thinking-level', 'high']);
    expect(args.thinkingLevel).toBe('high');
  });

  it('throws on invalid --thinking-level value', () => {
    expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--thinking-level', 'extreme'])).toThrow(
      '--thinking-level must be',
    );
  });

  it('returns undefined thinkingLevel when not provided', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task']);
    expect(args.thinkingLevel).toBeUndefined();
  });

  it('parses --config with path', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--config', './my-config.json']);
    expect(args.config).toBe('./my-config.json');
  });

  it('returns undefined config when not provided', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task']);
    expect(args.config).toBeUndefined();
  });

  it('parses --profile with value', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--profile', 'ci']);
    expect(args.profile).toBe('ci');
  });

  it('returns undefined profile when not provided', () => {
    const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task']);
    expect(args.profile).toBeUndefined();
  });

  it('parses all flags together including new ones', () => {
    const args = parseHeadlessArgs([
      'node',
      'main.js',
      '--prompt',
      'Run tests',
      '--continue',
      '--timeout',
      '600',
      '--format',
      'json',
      '--model',
      'anthropic/claude-sonnet-4-20250514',
      '--mode',
      'build',
      '--thinking-level',
      'medium',
      '--config',
      './ci.json',
      '--profile',
      'ci',
    ]);
    expect(args.prompt).toBe('Run tests');
    expect(args.continue_).toBe(true);
    expect(args.timeout).toBe(600);
    expect(args.format).toBe('json');
    expect(args.model).toBe('anthropic/claude-sonnet-4-20250514');
    expect(args.mode).toBe('build');
    expect(args.thinkingLevel).toBe('medium');
    expect(args.config).toBe('./ci.json');
    expect(args.profile).toBe('ci');
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

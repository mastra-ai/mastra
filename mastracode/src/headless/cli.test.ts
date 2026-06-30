import { describe, it, expect } from 'vitest';

import { hasHeadlessFlag, parseHeadlessArgs } from './cli.js';
import { buildParseArgsOptions, FLAGS, renderFlagUsage } from './flags.js';

function argv(...rest: string[]): string[] {
  return ['node', 'main.js', ...rest];
}

describe('hasHeadlessFlag', () => {
  it('detects --prompt', () => {
    expect(hasHeadlessFlag(argv('--prompt', 'do it'))).toBe(true);
  });

  it('detects -p', () => {
    expect(hasHeadlessFlag(argv('-p', 'do it'))).toBe(true);
  });

  it('returns false without a prompt flag', () => {
    expect(hasHeadlessFlag(argv('--continue'))).toBe(false);
  });
});

describe('parseHeadlessArgs', () => {
  it('parses --prompt and applies defaults', () => {
    const args = parseHeadlessArgs(argv('--prompt', 'Fix the bug'));
    expect(args.prompt).toBe('Fix the bug');
    expect(args.output).toBe('human');
    expect(args.continue_).toBe(false);
    expect(args.cloneThread).toBe(false);
  });

  it('parses the -p short flag', () => {
    expect(parseHeadlessArgs(argv('-p', 'Fix the bug')).prompt).toBe('Fix the bug');
  });

  it('reads a positional prompt when no flag is given', () => {
    expect(parseHeadlessArgs(argv('Fix the bug')).prompt).toBe('Fix the bug');
  });

  it('parses the consolidated --output modes', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--output', 'json')).output).toBe('json');
    expect(parseHeadlessArgs(argv('-p', 'x', '-o', 'jsonl')).output).toBe('jsonl');
    expect(parseHeadlessArgs(argv('-p', 'x', '--output', 'human')).output).toBe('human');
  });

  it('rejects an invalid --output value', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--output', 'xml'))).toThrow(/--output must be one of/);
  });

  it('parses --timeout as a positive integer', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--timeout', '300')).timeout).toBe(300);
  });

  it('rejects a non-positive or non-integer --timeout', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--timeout', '0'))).toThrow(/--timeout/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--timeout', '1.5'))).toThrow(/--timeout/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--timeout', 'soon'))).toThrow(/--timeout/);
  });

  it('validates --mode', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--mode', 'plan')).mode).toBe('plan');
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--mode', 'turbo'))).toThrow(/--mode/);
  });

  it('validates --thinking-level', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--thinking-level', 'high')).thinkingLevel).toBe('high');
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--thinking-level', 'extreme'))).toThrow(/--thinking-level/);
  });

  it('parses thread flags', () => {
    const args = parseHeadlessArgs(argv('-p', 'x', '--thread', 't-1', '--title', 'My run', '--clone-thread'));
    expect(args.thread).toBe('t-1');
    expect(args.title).toBe('My run');
    expect(args.cloneThread).toBe(true);
  });

  it('parses --continue', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--continue')).continue_).toBe(true);
    expect(parseHeadlessArgs(argv('-p', 'x', '-c')).continue_).toBe(true);
  });

  it('rejects --continue together with --thread', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--continue', '--thread', 't-1'))).toThrow(
      /--continue and --thread/,
    );
  });

  it('parses --model, --resource-id, and --settings', () => {
    const args = parseHeadlessArgs(
      argv('-p', 'x', '--model', 'openai/gpt-4o', '--resource-id', 'r-1', '--settings', './s.json'),
    );
    expect(args.model).toBe('openai/gpt-4o');
    expect(args.resourceId).toBe('r-1');
    expect(args.settings).toBe('./s.json');
  });

  it('parses --max-turns as a positive integer', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--max-turns', '5')).maxTurns).toBe(5);
  });

  it('leaves maxTurns undefined when --max-turns is absent', () => {
    expect(parseHeadlessArgs(argv('-p', 'x')).maxTurns).toBeUndefined();
  });

  it('rejects a non-positive or non-integer --max-turns', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', '0'))).toThrow(/--max-turns/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', '-3'))).toThrow(/--max-turns/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', '2.5'))).toThrow(/--max-turns/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', 'lots'))).toThrow(/--max-turns/);
  });

  it('validates --permission-mode', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'auto')).permissionMode).toBe('auto');
    expect(parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'deny')).permissionMode).toBe('deny');
  });

  it('leaves permissionMode undefined when absent', () => {
    expect(parseHeadlessArgs(argv('-p', 'x')).permissionMode).toBeUndefined();
  });

  it('rejects an invalid --permission-mode value', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'yolo'))).toThrow(/--permission-mode must be/);
  });

  it('parses every flag together', () => {
    const args = parseHeadlessArgs(
      argv(
        '--prompt',
        'Do everything',
        '--output',
        'json',
        '--model',
        'openai/gpt-4o',
        '--mode',
        'plan',
        '--thinking-level',
        'high',
        '--timeout',
        '120',
        '--max-turns',
        '8',
        '--permission-mode',
        'deny',
        '--thread',
        't-9',
        '--title',
        'Full run',
        '--clone-thread',
        '--resource-id',
        'r-9',
        '--settings',
        './ci.json',
      ),
    );
    expect(args).toEqual({
      prompt: 'Do everything',
      output: 'json',
      model: 'openai/gpt-4o',
      mode: 'plan',
      thinkingLevel: 'high',
      timeout: 120,
      maxTurns: 8,
      permissionMode: 'deny',
      continue_: false,
      thread: 't-9',
      title: 'Full run',
      cloneThread: true,
      resourceId: 'r-9',
      settings: './ci.json',
    });
  });
});

describe('flag spec', () => {
  it('derives parseArgs options from the flag table', () => {
    const options = buildParseArgsOptions();
    // Every declared flag is present with the right kind + short alias.
    for (const flag of FLAGS) {
      expect(options[flag.key]).toMatchObject({ type: flag.type });
      if (flag.short) expect(options[flag.key]!.short).toBe(flag.short);
    }
    // Booleans default to false so they're always defined.
    expect(options.continue).toMatchObject({ type: 'boolean', default: false });
  });

  it('renders one usage entry per flag, aligned', () => {
    const usage = renderFlagUsage();
    for (const flag of FLAGS) {
      expect(usage).toContain(`--${flag.key}`);
    }
    // First help line of a multi-line flag stays on the same row as the flag.
    expect(usage).toMatch(/--permission-mode <mode>\s+How tool approvals/);
  });

  it('reports unknown enum values uniformly', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--mode', 'turbo'))).toThrow(
      '--mode must be one of: build, plan, fast',
    );
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'nope'))).toThrow(
      '--permission-mode must be one of: auto, deny',
    );
  });
});

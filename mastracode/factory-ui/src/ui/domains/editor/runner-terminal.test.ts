import { describe, expect, it } from 'vitest';

import {
  applyCompletion,
  classifyToken,
  completionCandidates,
  parseAnsi,
  tokenizeCommand,
} from './runner-terminal';

describe('tokenizeCommand', () => {
  it('splits on whitespace and preserves single-quoted spans', () => {
    expect(tokenizeCommand("echo 'hello world' hi")).toEqual(['echo', 'hello world', 'hi']);
  });
  it('preserves double-quoted spans', () => {
    expect(tokenizeCommand('grep "needle in haystack" file.txt')).toEqual([
      'grep',
      'needle in haystack',
      'file.txt',
    ]);
  });
  it('returns [] for empty input', () => {
    expect(tokenizeCommand('   ')).toEqual([]);
  });
  it('captures trailing partial tokens', () => {
    expect(tokenizeCommand('npm run bui')).toEqual(['npm', 'run', 'bui']);
  });
});

describe('classifyToken', () => {
  it('marks the first token as a command', () => {
    expect(classifyToken('npm', 0)).toBe('command');
  });
  it('marks -flag arguments as flags', () => {
    expect(classifyToken('--force', 1)).toBe('flag');
  });
  it('marks paths by leading . / ~', () => {
    expect(classifyToken('./src/main.ts', 1)).toBe('path');
    expect(classifyToken('src/main.ts', 1)).toBe('path');
    expect(classifyToken('~/notes', 1)).toBe('path');
  });
  it('marks quoted strings', () => {
    expect(classifyToken('"hello"', 1)).toBe('string');
    expect(classifyToken("'x'", 1)).toBe('string');
  });
  it('falls back to value for other tokens', () => {
    expect(classifyToken('foo', 1)).toBe('value');
  });
});

describe('parseAnsi', () => {
  it('yields a single span when the line has no escapes', () => {
    const spans = parseAnsi('hello world');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.content).toBe('hello world');
    expect(spans[0]?.fg).toBeUndefined();
  });
  it('splits on foreground colour changes and translates the palette', () => {
    // \u001b[31m = red, \u001b[0m = reset
    const spans = parseAnsi('normal \u001b[31mred bit\u001b[0m done');
    expect(spans.map(s => s.content)).toEqual(['normal ', 'red bit', ' done']);
    expect(spans[1]?.fg).toBe('var(--notice-destructive)');
    expect(spans[2]?.fg).toBeUndefined();
  });
  it('captures bold decoration', () => {
    const spans = parseAnsi('\u001b[1mbold\u001b[0m');
    expect(spans[0]?.bold).toBe(true);
  });
});

describe('completionCandidates', () => {
  it('returns empty when the input ends with whitespace (no active token)', () => {
    expect(completionCandidates('npm ', ['build'], [])).toEqual([]);
  });
  it('completes npm scripts after `npm run `', () => {
    const candidates = completionCandidates('npm run bui', ['build', 'bump', 'test'], []);
    expect(candidates).toEqual(['build']);
  });
  it('offers npm-run shortcuts for the first token', () => {
    const candidates = completionCandidates('npm r', ['build'], []);
    expect(candidates).toContain('npm run build');
  });
  it('includes common commands and history in first-token completion', () => {
    const candidates = completionCandidates('gi', [], ['git log --oneline']);
    expect(candidates).toContain('git status');
    expect(candidates).toContain('git');
  });
});

describe('applyCompletion', () => {
  it('replaces the trailing token when the candidate is a bare word', () => {
    expect(applyCompletion('npm run bui', 'build')).toBe('npm run build');
  });
  it('replaces the whole input when the candidate contains a space', () => {
    expect(applyCompletion('gi', 'git status')).toBe('git status');
  });
  it('returns the candidate untouched on empty input', () => {
    expect(applyCompletion('', 'ls')).toBe('ls');
  });
});

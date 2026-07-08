import { describe, it, expect } from 'vitest';
import { parsePatternEntry, parsePermissionPatterns } from './permissions.js';

describe('parsePatternEntry', () => {
  it('parses Bash(git status*) into execute_command pattern', () => {
    const rule = parsePatternEntry('Bash(git status*)', 'allow');
    expect(rule.toolName).toBe('execute_command');
    expect(rule.pattern).toBe('git status*');
    expect(rule.policy).toBe('allow');
  });

  it('parses Read(*.ts) into view pattern', () => {
    const rule = parsePatternEntry('Read(*.ts)', 'allow');
    expect(rule.toolName).toBe('view');
    expect(rule.pattern).toBe('*.ts');
    expect(rule.policy).toBe('allow');
  });

  it('parses bare tool name as wildcard pattern', () => {
    const rule = parsePatternEntry('Bash', 'deny');
    expect(rule.toolName).toBe('execute_command');
    expect(rule.pattern).toBe('*');
    expect(rule.policy).toBe('deny');
  });

  it('passes unknown tool names through as-is', () => {
    const rule = parsePatternEntry('my_custom_tool(some_arg*)', 'allow');
    expect(rule.toolName).toBe('my_custom_tool');
    expect(rule.pattern).toBe('some_arg*');
    expect(rule.policy).toBe('allow');
  });
});

describe('parsePermissionPatterns', () => {
  it('returns empty array for undefined config', () => {
    expect(parsePermissionPatterns(undefined)).toEqual([]);
  });

  it('returns empty array for empty config', () => {
    expect(parsePermissionPatterns({})).toEqual([]);
  });

  it('parses allow entries', () => {
    const rules = parsePermissionPatterns({ allow: ['Bash(git status*)'] });
    expect(rules).toHaveLength(1);
    expect(rules[0].policy).toBe('allow');
    expect(rules[0].pattern).toBe('git status*');
  });

  it('parses deny entries', () => {
    const rules = parsePermissionPatterns({ deny: ['Bash(rm -rf*)'] });
    expect(rules).toHaveLength(1);
    expect(rules[0].policy).toBe('deny');
    expect(rules[0].pattern).toBe('rm -rf*');
  });

  it('parses mixed allow and deny', () => {
    const rules = parsePermissionPatterns({
      allow: ['Bash(git status*)', 'Bash(pnpm check-types*)'],
      deny: ['Bash(rm -rf*)'],
    });
    expect(rules).toHaveLength(3);
    // deny rules come first in the array
    expect(rules[0].policy).toBe('deny');
    expect(rules[1].policy).toBe('allow');
    expect(rules[2].policy).toBe('allow');
  });
});

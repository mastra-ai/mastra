import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SLACK_PERMISSION_LEVEL,
  isSlackPermissionLevel,
  scopesForLevel,
  SLACK_MANIFEST_USER_SCOPES,
  SLACK_PERMISSION_LEVELS,
} from '../scopes.js';
import type { SlackPermissionLevel } from '../scopes.js';

describe('slack scopes', () => {
  it('exposes the three permission levels in order of privilege', () => {
    expect(SLACK_PERMISSION_LEVELS).toEqual(['read-only', 'read-write', 'full']);
  });

  it('defaults to read-only', () => {
    expect(DEFAULT_SLACK_PERMISSION_LEVEL).toBe('read-only');
  });

  it('returns a fresh array each call (no shared mutable preset)', () => {
    const a = scopesForLevel('read-only');
    const b = scopesForLevel('read-only');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    a.push('mutated');
    expect(scopesForLevel('read-only')).not.toContain('mutated');
  });

  it('nests presets: read-only ⊆ read-write ⊆ full', () => {
    const readOnly = scopesForLevel('read-only');
    const readWrite = scopesForLevel('read-write');
    const full = scopesForLevel('full');

    for (const scope of readOnly) expect(readWrite).toContain(scope);
    for (const scope of readWrite) expect(full).toContain(scope);
    expect(readWrite.length).toBeGreaterThan(readOnly.length);
    expect(full.length).toBeGreaterThan(readWrite.length);
  });

  it('adds write scopes only at read-write and above', () => {
    expect(scopesForLevel('read-only')).not.toContain('chat:write');
    expect(scopesForLevel('read-write')).toContain('chat:write');
    expect(scopesForLevel('full')).toContain('chat:write');
  });

  it('keeps every preset scope a subset of the manifest superset', () => {
    for (const level of SLACK_PERMISSION_LEVELS) {
      for (const scope of scopesForLevel(level)) {
        expect(SLACK_MANIFEST_USER_SCOPES).toContain(scope);
      }
    }
  });

  it('validates permission level strings', () => {
    for (const level of SLACK_PERMISSION_LEVELS) {
      expect(isSlackPermissionLevel(level)).toBe(true);
    }
    expect(isSlackPermissionLevel('write')).toBe(false);
    expect(isSlackPermissionLevel('')).toBe(false);
    expect(isSlackPermissionLevel(undefined)).toBe(false);
    expect(isSlackPermissionLevel(3)).toBe(false);
  });

  it('narrows the type via the guard', () => {
    const value: unknown = 'full';
    if (isSlackPermissionLevel(value)) {
      const level: SlackPermissionLevel = value;
      expect(scopesForLevel(level).length).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import { defaultGithubRules, resolveGithubRules } from './default-rules.js';

describe('GitHub rule resolution', () => {
  it.each(Object.keys(defaultGithubRules))('preserves the default for %s', event => {
    expect(resolveGithubRules()).toHaveProperty(event, Reflect.get(defaultGithubRules, event));
  });

  it('replaces only the specified event', () => {
    const handler = vi.fn();
    const rules = resolveGithubRules({ issueOpened: handler });
    expect(rules.issueOpened).toBe(handler);
    expect(rules.issueClosed).toBe(defaultGithubRules.issueClosed);
  });

  it('disables events with null and falls back for undefined', () => {
    const rules = resolveGithubRules({ issueOpened: null, issueClosed: undefined });
    expect(rules.issueOpened).toBeNull();
    expect(rules.issueClosed).toBe(defaultGithubRules.issueClosed);
  });

  it('copies and freezes rules independently of caller mutation', () => {
    const overrides = { issueOpened: vi.fn() };
    const first = resolveGithubRules(overrides);
    overrides.issueOpened = vi.fn();
    const second = resolveGithubRules(overrides);
    expect(first.issueOpened).not.toBe(second.issueOpened);
    expect(Object.isFrozen(first)).toBe(true);
    expect(resolveGithubRules().issueOpened).toBe(defaultGithubRules.issueOpened);
  });

  it.each([
    null,
    [],
    'rules',
    { unknown: null },
    { toString: null },
    { issueOpened: false },
    { [Symbol('event')]: null },
  ])('rejects invalid configuration %j', overrides => {
    // @ts-expect-error Exercise JavaScript callers at the constructor boundary.
    expect(() => resolveGithubRules(overrides)).toThrow();
  });
});

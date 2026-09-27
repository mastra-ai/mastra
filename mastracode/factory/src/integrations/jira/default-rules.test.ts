import { describe, expect, it, vi } from 'vitest';
import { defaultJiraRules, resolveJiraRules } from './default-rules.js';

describe('Jira rule resolution', () => {
  it.each(['issueObserved', 'issueClosed'] as const)('preserves the default for %s', event => {
    expect(resolveJiraRules()[event]).toBe(defaultJiraRules[event]);
    expect(resolveJiraRules({ [event]: undefined })[event]).toBe(defaultJiraRules[event]);
  });

  it.each(['issueObserved', 'issueClosed'] as const)('replaces or disables only %s', event => {
    const handler = vi.fn();
    const sibling = event === 'issueObserved' ? 'issueClosed' : 'issueObserved';
    const replaced = resolveJiraRules({ [event]: handler });
    expect(replaced[event]).toBe(handler);
    expect(replaced[sibling]).toBe(defaultJiraRules[sibling]);
    const disabled = resolveJiraRules({ [event]: null });
    expect(disabled[event]).toBeNull();
    expect(disabled[sibling]).toBe(defaultJiraRules[sibling]);
  });

  it('copies and freezes maps independently of caller mutation', () => {
    const original = vi.fn();
    const overrides = { issueObserved: original };
    const first = resolveJiraRules(overrides);
    overrides.issueObserved = vi.fn();
    const second = resolveJiraRules(overrides);
    expect(first.issueObserved).toBe(original);
    expect(second.issueObserved).toBe(overrides.issueObserved);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Reflect.set(first, 'issueClosed', null)).toBe(false);
    expect(resolveJiraRules().issueObserved).toBe(defaultJiraRules.issueObserved);
  });

  it('accepts null-prototype rule maps', () => {
    const overrides = Object.assign(Object.create(null), { issueObserved: null });
    const resolved = resolveJiraRules(overrides);
    expect(resolved.issueObserved).toBeNull();
    expect(resolved.issueClosed).toBe(defaultJiraRules.issueClosed);
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it.each([
    new Map([['issueObserved', null]]),
    new Date(0),
    new Set(['issueObserved']),
    new (class {
      issueObserved = null;
    })(),
  ])('rejects non-plain rule maps %j', overrides => {
    // @ts-expect-error Exercise invalid runtime configuration.
    expect(() => resolveJiraRules(overrides)).toThrow(/plain object/);
  });

  it.each([
    null,
    [],
    'rules',
    { unknown: null },
    { toString: null },
    { issueObserved: false },
    { issueClosed: {} },
    { [Symbol('event')]: null },
  ])('rejects invalid configuration %j', overrides => {
    // @ts-expect-error Exercise invalid configuration from JavaScript callers.
    expect(() => resolveJiraRules(overrides)).toThrow();
  });
});

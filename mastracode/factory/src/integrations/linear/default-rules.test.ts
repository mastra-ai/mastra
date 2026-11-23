import { describe, expect, it, vi } from 'vitest';
import { defaultLinearRules, resolveLinearRules } from './default-rules.js';

describe('Linear rule resolution', () => {
  it.each(['issueObserved', 'issueClosed'] as const)('preserves the default for %s', event => {
    expect(resolveLinearRules()[event]).toBe(defaultLinearRules[event]);
    expect(resolveLinearRules({ [event]: undefined })[event]).toBe(defaultLinearRules[event]);
  });

  it.each(['issueObserved', 'issueClosed'] as const)('replaces or disables only %s', event => {
    const handler = vi.fn();
    const sibling = event === 'issueObserved' ? 'issueClosed' : 'issueObserved';
    const replaced = resolveLinearRules({ [event]: handler });
    expect(replaced[event]).toBe(handler);
    expect(replaced[sibling]).toBe(defaultLinearRules[sibling]);
    const disabled = resolveLinearRules({ [event]: null });
    expect(disabled[event]).toBeNull();
    expect(disabled[sibling]).toBe(defaultLinearRules[sibling]);
  });

  it('copies and freezes maps independently of caller mutation', () => {
    const original = vi.fn();
    const overrides = { issueObserved: original };
    const first = resolveLinearRules(overrides);
    overrides.issueObserved = vi.fn();
    const second = resolveLinearRules(overrides);
    expect(first.issueObserved).toBe(original);
    expect(second.issueObserved).toBe(overrides.issueObserved);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Reflect.set(first, 'issueClosed', null)).toBe(false);
    expect(resolveLinearRules().issueObserved).toBe(defaultLinearRules.issueObserved);
  });

  it('accepts null-prototype rule maps', () => {
    const overrides = Object.assign(Object.create(null), { issueObserved: null });
    const resolved = resolveLinearRules(overrides);
    expect(resolved.issueObserved).toBeNull();
    expect(resolved.issueClosed).toBe(defaultLinearRules.issueClosed);
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
    expect(() => resolveLinearRules(overrides)).toThrow(/plain object/);
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
    expect(() => resolveLinearRules(overrides)).toThrow();
  });
});

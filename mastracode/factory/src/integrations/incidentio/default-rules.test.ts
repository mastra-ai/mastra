import { describe, expect, it, vi } from 'vitest';
import { defaultIncidentioRules, resolveIncidentioRules } from './default-rules.js';

describe('incident.io rule resolution', () => {
  it.each(['followUpObserved', 'followUpClosed'] as const)('preserves the default for %s', event => {
    expect(resolveIncidentioRules()[event]).toBe(defaultIncidentioRules[event]);
    expect(resolveIncidentioRules({ [event]: undefined })[event]).toBe(defaultIncidentioRules[event]);
  });

  it.each(['followUpObserved', 'followUpClosed'] as const)('replaces or disables only %s', event => {
    const handler = vi.fn();
    const sibling = event === 'followUpObserved' ? 'followUpClosed' : 'followUpObserved';
    const replaced = resolveIncidentioRules({ [event]: handler });
    expect(replaced[event]).toBe(handler);
    expect(replaced[sibling]).toBe(defaultIncidentioRules[sibling]);
    const disabled = resolveIncidentioRules({ [event]: null });
    expect(disabled[event]).toBeNull();
    expect(disabled[sibling]).toBe(defaultIncidentioRules[sibling]);
  });

  it('copies and freezes maps independently of caller mutation', () => {
    const original = vi.fn();
    const overrides = { followUpObserved: original };
    const first = resolveIncidentioRules(overrides);
    overrides.followUpObserved = vi.fn();
    const second = resolveIncidentioRules(overrides);
    expect(first.followUpObserved).toBe(original);
    expect(second.followUpObserved).toBe(overrides.followUpObserved);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Reflect.set(first, 'followUpClosed', null)).toBe(false);
    expect(resolveIncidentioRules().followUpObserved).toBe(defaultIncidentioRules.followUpObserved);
  });

  it('accepts null-prototype rule maps', () => {
    const overrides = Object.assign(Object.create(null), { followUpObserved: null });
    const resolved = resolveIncidentioRules(overrides);
    expect(resolved.followUpObserved).toBeNull();
    expect(resolved.followUpClosed).toBe(defaultIncidentioRules.followUpClosed);
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it.each([
    new Map([['followUpObserved', null]]),
    new Date(0),
    new Set(['followUpObserved']),
    new (class {
      followUpObserved = null;
    })(),
  ])('rejects non-plain rule maps %j', overrides => {
    // @ts-expect-error Exercise invalid runtime configuration.
    expect(() => resolveIncidentioRules(overrides)).toThrow(/plain object/);
  });

  // Each case is wrapped in a one-element tuple: with a bare mixed list Vitest
  // only passes array cases through intact because other rows are non-arrays,
  // which would silently change if the list ever became all-arrays.
  it.each([
    [null],
    [[]],
    ['rules'],
    [{ unknown: null }],
    [{ toString: null }],
    [{ followUpObserved: false }],
    [{ followUpClosed: {} }],
    [{ [Symbol('event')]: null }],
  ])('rejects invalid configuration %j', overrides => {
    // @ts-expect-error Exercise invalid configuration from JavaScript callers.
    expect(() => resolveIncidentioRules(overrides)).toThrow();
  });
});

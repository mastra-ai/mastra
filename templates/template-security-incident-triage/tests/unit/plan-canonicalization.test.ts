import { describe, expect, it } from 'vitest';

import {
  calculatePlanHash,
  canonicalizePlanValue,
  isPlanExpired,
  verifyPlanHash,
} from '../../src/containment/plan-canonicalization.js';
import { buildValidatedContainmentPlan } from '../../src/containment/plan-builder.js';
import { createContainmentCandidate, resolveContainmentActions } from '../../src/containment/action-registry.js';
import { buildSeverityDecision } from '../../src/triage/decision-validation.js';
import { triageContext } from '../fixtures/triage.js';

describe('triage plan canonicalization and hash v1', () => {
  it('produces stable IDs, bytes, TTL, and hash for deterministic redelivery', () => {
    const context = triageContext('unauthorized_privilege_change');
    const decision = buildSeverityDecision(context);
    const actions = resolveContainmentActions(context, decision, createContainmentCandidate(context, decision));
    const first = buildValidatedContainmentPlan(context, actions);
    const second = buildValidatedContainmentPlan(context, [...actions].reverse());
    expect(second).toEqual(first);
    expect(first.createdAt).toBe('2026-08-28T12:00:30.000Z');
    expect(first.expiresAt).toBe('2026-08-28T12:15:30.000Z');
    expect(first.planHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(verifyPlanHash(first)).toBe(true);
    expect(first.actions).toHaveLength(2);
  });

  it('normalizes key order, NFC/NFD, -0, and equivalent timestamps', () => {
    const left = {
      expiresAt: '2026-08-28T09:15:30-03:00',
      text: 'caf\u00e9',
      number: -0,
      nested: { z: true, a: 1 },
    };
    const right = {
      nested: { a: 1, z: true },
      number: 0,
      text: 'cafe\u0301',
      expiresAt: '2026-08-28T12:15:30.000Z',
    };
    expect(canonicalizePlanValue(left)).toBe(canonicalizePlanValue(right));
    expect(calculatePlanHash(left)).toBe(calculatePlanHash(right));
  });

  it('rejects post-NFC key collisions and non-finite numbers', () => {
    expect(() => canonicalizePlanValue({ 'caf\u00e9': 1, 'cafe\u0301': 2 })).toThrow();
    expect(() => canonicalizePlanValue({ value: Number.NaN })).toThrow();
    expect(() => canonicalizePlanValue({ value: Number.POSITIVE_INFINITY })).toThrow();
  });

  it('changes the hash for every semantic mutation and excludes only top-level planHash', () => {
    const context = triageContext('unknown_device_login');
    const decision = buildSeverityDecision(context);
    const plan = buildValidatedContainmentPlan(
      context,
      resolveContainmentActions(context, decision, createContainmentCandidate(context, decision)),
    );
    const mutations = [
      { ...plan, planId: 'plan_changed' },
      { ...plan, planVersion: 2 },
      { ...plan, createdAt: '2026-08-28T12:00:31.000Z' },
      { ...plan, expiresAt: '2026-08-28T12:16:30.000Z' },
      { ...plan, tenantId: 'tenant-2' },
      {
        ...plan,
        actions: [{ ...plan.actions[0]!, targetId: 'device-2' }, plan.actions[1]!],
      },
      {
        ...plan,
        actions: [{ ...plan.actions[0]!, impact: 'Changed impact.' }, plan.actions[1]!],
      },
      {
        ...plan,
        actions: [{ ...plan.actions[0]!, input: { changed: true } }, plan.actions[1]!],
      },
      {
        ...plan,
        actions: [{ ...plan.actions[0]!, preconditions: ['Changed precondition.'] }, plan.actions[1]!],
      },
      {
        ...plan,
        actions: [{ ...plan.actions[0]!, rollback: 'Changed rollback.' }, plan.actions[1]!],
      },
      {
        ...plan,
        actions: [{ ...plan.actions[0]!, verification: 'Changed verification.' }, plan.actions[1]!],
      },
      {
        ...plan,
        actions: [{ ...plan.actions[0]!, actionId: 'action_changed' }, plan.actions[1]!],
      },
    ];
    for (const mutation of mutations) expect(calculatePlanHash(mutation)).not.toBe(plan.planHash);
    expect(calculatePlanHash({ ...plan, planHash: 'f'.repeat(64) })).toBe(plan.planHash);
  });

  it('treats the exact expiry instant as expired', () => {
    const plan = { expiresAt: '2026-08-28T12:15:30.000Z' };
    expect(isPlanExpired(plan, '2026-08-28T12:15:29.999Z')).toBe(false);
    expect(isPlanExpired(plan, '2026-08-28T12:15:30.000Z')).toBe(true);
    expect(isPlanExpired(plan, '2026-08-28T12:15:30.001Z')).toBe(true);
  });
});

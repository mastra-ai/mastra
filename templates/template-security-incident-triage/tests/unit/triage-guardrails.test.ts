import { describe, expect, it } from 'vitest';

import { createContainmentCandidate, resolveContainmentActions } from '../../src/containment/action-registry.js';
import { buildValidatedContainmentPlan } from '../../src/containment/plan-builder.js';
import type { Evidence } from '../../src/schemas/evidence.js';
import { buildSeverityDecision } from '../../src/triage/decision-validation.js';
import { triageContext } from '../fixtures/triage.js';

const targetMutations: readonly Readonly<[string, (item: Evidence) => Evidence]>[] = [
  ['low confidence', item => ({ ...item, confidence: 0.01 })],
  ['wrong source', item => ({ ...item, source: 'cloud' })],
  ['wrong provider', item => ({ ...item, provider: 'hostile-identity' })],
  [
    'wrong provenance',
    item => ({
      ...item,
      fact: { ...item.fact, confidenceProvenance: 'rule-v1' },
    }),
  ],
];

describe('triage containment guardrails', () => {
  it.each(['unauthorized_privilege_change', 'disallowed_country_login', 'unknown_device_login'] as const)(
    'resolves only code/runbook actions and one proven target for %s',
    kind => {
      const context = triageContext(kind);
      const decision = buildSeverityDecision(context);
      const actions = resolveContainmentActions(context, decision, createContainmentCandidate(context, decision));
      const plan = buildValidatedContainmentPlan(context, actions);
      expect(plan.actions.length).toBeLessThanOrEqual(2);
      for (const action of plan.actions) {
        expect(action.targetId).not.toMatch(/[*,]/u);
        expect(Array.isArray(action.targetId)).toBe(false);
      }
    },
  );

  it.each([
    {
      schemaVersion: 1,
      actions: [
        {
          actionType: 'revoke_session',
          targetToken: 'target-1',
          inputToken: 'input-2',
        },
      ],
    },
    {
      schemaVersion: 1,
      actions: [
        {
          actionType: 'mark_device_for_review',
          targetToken: 'target-3',
          inputToken: 'input-3',
        },
      ],
    },
    {
      schemaVersion: 1,
      actions: [
        {
          actionType: 'restore_previous_role',
          targetToken: 'target-1',
          inputToken: 'input-1',
        },
        {
          actionType: 'restore_previous_role',
          targetToken: 'target-1',
          inputToken: 'input-1',
        },
      ],
    },
  ])('blocks altered target tokens, out-of-runbook actions, and duplicates', candidate => {
    expect(() =>
      resolveContainmentActions(triageContext(), buildSeverityDecision(triageContext()), candidate),
    ).toThrow();
  });

  it('never exposes actual targets or parameters in the model candidate', () => {
    const serialized = JSON.stringify(
      createContainmentCandidate(triageContext(), buildSeverityDecision(triageContext())),
    );
    expect(serialized).not.toMatch(/subject-1|session-1|member|device-1/u);
    expect(serialized).toMatch(/target-[1-3]|input-[1-4]/u);
  });

  it('intersects a country plan with the staging identity provider capabilities', () => {
    const context = triageContext('disallowed_country_login');
    const decision = buildSeverityDecision(context);
    const supported = ['restore_previous_role', 'revoke_session'] as const;
    const candidate = createContainmentCandidate(context, decision, supported);

    expect(candidate.actions).toEqual([expect.objectContaining({ actionType: 'revoke_session' })]);
    expect(resolveContainmentActions(context, decision, candidate, supported)).toEqual([
      expect.objectContaining({
        type: 'revoke_session',
        targetId: 'session-1',
      }),
    ]);
    expect(() =>
      resolveContainmentActions(context, decision, createContainmentCandidate(context, decision), supported),
    ).toThrow();
  });

  it.each(['unauthorized_privilege_change', 'disallowed_country_login', 'unknown_device_login'] as const)(
    'never creates a containment candidate for a benign %s decision',
    kind => {
      const context = triageContext(kind, { benign: true });
      const decision = buildSeverityDecision(context);
      expect(decision.severity).toBe('low');
      expect(() => createContainmentCandidate(context, decision)).toThrow();
    },
  );

  it.each(targetMutations)('does not authorize revoke_session from a session target with %s', (_label, mutate) => {
    const original = triageContext('unauthorized_privilege_change');
    const evidence = original.evidence.map(item => (item.fact.factType === 'session.subject' ? mutate(item) : item));
    const context = { ...original, evidence };
    const decision = buildSeverityDecision(context);
    expect(createContainmentCandidate(context, decision).actions).toEqual([
      expect.objectContaining({ actionType: 'restore_previous_role' }),
    ]);
  });

  it('fails closed on duplicate session target evidence', () => {
    const original = triageContext('unauthorized_privilege_change');
    const session = original.evidence.find(item => item.fact.factType === 'session.subject')!;
    const context = {
      ...original,
      evidence: [...original.evidence, { ...session, evidenceId: 'evidence-duplicate-session' }],
    };
    const decision = buildSeverityDecision(context);
    expect(createContainmentCandidate(context, decision).actions).toEqual([
      expect.objectContaining({ actionType: 'restore_previous_role' }),
    ]);
  });

  it('accepts equivalent candidate order and resolves identical actions', () => {
    const context = triageContext('disallowed_country_login');
    const decision = buildSeverityDecision(context);
    const candidate = createContainmentCandidate(context, decision);
    const ordered = resolveContainmentActions(context, decision, candidate);
    const reversed = resolveContainmentActions(context, decision, {
      ...candidate,
      actions: [...candidate.actions].reverse(),
    });
    expect(reversed).toEqual(ordered);
    expect(buildValidatedContainmentPlan(context, reversed)).toEqual(buildValidatedContainmentPlan(context, ordered));
  });
});

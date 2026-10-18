import { describe, expect, it } from 'vitest';

import { LocalEndpointEvidenceProvider } from '../../src/providers/endpoint-evidence-provider.js';
import type { Evidence } from '../../src/schemas/evidence.js';
import { buildIncidentSummary, createSummaryCandidate, validateSummaryReferences } from '../../src/triage/claims.js';
import { SeverityDecisionSchema } from '../../src/triage/decision-contracts.js';
import { triageContext } from '../fixtures/triage.js';

const claimMutations: readonly Readonly<[string, (item: Evidence) => Evidence]>[] = [
  ['incomplete', item => ({ ...item, incomplete: true })],
  ['low confidence', item => ({ ...item, confidence: 0.79 })],
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

describe('triage evidence-attributed claims', () => {
  it('renders only redacted facts with real evidence and exact runbook references', () => {
    const context = triageContext('disallowed_country_login');
    const decision = decisionFor(context);
    const summary = buildIncidentSummary(context, decision, createSummaryCandidate(context));
    validateSummaryReferences(summary, context, decision);
    expect(summary.hypotheses).toEqual([]);
    expect(JSON.stringify(summary)).not.toMatch(/synthetic-actor|subject-1|198\.51\.100\.8|protected:/u);
    expect(summary.facts.flatMap(claim => claim.references)).toContain(decision.runbookReference);
  });

  it.each([
    { schemaVersion: 1, factTokens: ['fact-48'], hypothesisCodes: [] },
    {
      schemaVersion: 1,
      factTokens: ['fact-1'],
      hypothesisCodes: [],
      extra: true,
    },
  ])('blocks a forged, out-of-context, or schema-expanded claim candidate', candidate => {
    const context = triageContext();
    expect(() => buildIncidentSummary(context, decisionFor(context), candidate)).toThrow();
  });

  it('rejects cross-context evidence and runbook references', () => {
    const context = triageContext();
    const decision = decisionFor(context);
    const summary = buildIncidentSummary(context, decision, createSummaryCandidate(context));
    const first = summary.facts[0]!;
    first.references[0] = '[evidence:cross-tenant]';
    expect(() => validateSummaryReferences(summary, context, decision)).toThrow();
  });

  it('rejects claim text altered after deterministic rendering', () => {
    const context = triageContext();
    const decision = decisionFor(context);
    const summary = buildIncidentSummary(context, decision, createSummaryCandidate(context));
    summary.facts[0]!.text = 'A forged but cited factual claim.';
    expect(() => validateSummaryReferences(summary, context, decision)).toThrow();
  });

  it('does not promote incomplete or kind-irrelevant device evidence into a login-country fact', () => {
    const base = triageContext('disallowed_country_login');
    const device = triageContext('unknown_device_login').evidence.find(
      item => item.fact.factType === 'device.authorized',
    )!;
    const context = {
      ...base,
      evidence: [
        ...base.evidence,
        {
          ...device,
          evidenceId: 'evidence-irrelevant-device',
          incomplete: true,
        },
      ],
    };
    const candidate = createSummaryCandidate(context);
    const rejectedToken = `fact-${context.evidence.length}`;
    expect(candidate.factTokens).not.toContain(rejectedToken);
    expect(() =>
      buildIncidentSummary(context, decisionFor(context), {
        ...candidate,
        factTokens: [...candidate.factTokens, rejectedToken],
      }),
    ).toThrow();
    const decision = decisionFor(context);
    const summary = buildIncidentSummary(context, decision, candidate);
    validateSummaryReferences(summary, context, decision);
    expect(JSON.stringify(summary)).not.toMatch(/device|authorized-device/iu);
  });

  it.each(claimMutations)('filters a relevant claim with %s', (_label, mutate) => {
    const base = triageContext('unauthorized_privilege_change');
    const evidence = base.evidence.map(item => (item.fact.factType === 'role.current' ? mutate(item) : item));
    const context = { ...base, evidence };
    const changedIndex = evidence.findIndex(item => item.fact.factType === 'role.current');
    expect(createSummaryCandidate(context).factTokens).not.toContain(`fact-${changedIndex + 1}`);
  });

  it('does not emit device signature or authorization without an applicable device context', async () => {
    const provider = new LocalEndpointEvidenceProvider();
    const common = {
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      subjectId: 'subject-1',
      workflowRunId: 'workflow-run-1',
      occurredAt: '2026-08-28T12:00:00.000Z',
      sessionId: 'session-1',
    } as const;
    const disallowed = await provider.inspect(
      { ...common, incidentKind: 'disallowed_country_login' },
      { signal: new AbortController().signal, attempt: 1 },
    );
    const unknown = await provider.inspect(
      { ...common, incidentKind: 'unknown_device_login' },
      { signal: new AbortController().signal, attempt: 1 },
    );
    for (const result of [disallowed, unknown]) {
      expect(result.status).toBe('success');
      if (result.status !== 'success') continue;
      const factTypes = result.facts.map(fact => fact.factType);
      expect(factTypes).not.toContain('device.signatureValid');
      expect(factTypes).not.toContain('device.authorized');
    }
  });
});

function decisionFor(context: ReturnType<typeof triageContext>) {
  const runbookReference = `[runbook:${context.runbook.metadata.id}@1.0.0]`;
  return SeverityDecisionSchema.parse({
    schemaVersion: 1,
    decisionId: 'decision-1',
    incidentId: 'incident-1',
    tenantId: 'tenant-1',
    workflowRunId: 'workflow-run-1',
    severity: 'medium',
    effectiveConfidence: 1,
    rationale: 'Integrity-verified fixture rationale.',
    references: [`[evidence:${context.evidence[0]!.evidenceId}]`, runbookReference],
    runbookReference,
    policyVersion: 1,
    reasonCodes: [],
  });
}

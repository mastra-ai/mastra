import { describe, expect, it } from 'vitest';

import { LocalCloudEvidenceProvider } from '../../src/providers/cloud-evidence-provider.js';
import { evaluateSeverityPolicy } from '../../src/triage/policy.js';
import { triageContext } from '../fixtures/triage.js';

describe('triage deterministic severity policy', () => {
  it.each([
    ['US', 'low'],
    ['CA', 'medium'],
  ] as const)('classifies verified GeoIP %s without fabricated session history', (country, severity) => {
    const context = triageContext('disallowed_country_login', {
      omitFactType: 'session.abnormalHistory',
    });
    const evidence = context.evidence.map(item => {
      if (item.fact.factType === 'login.country')
        return {
          ...item,
          source: 'identity' as const,
          provider: 'identity-geoip',
          confidence: 0.7,
          fact: {
            ...item.fact,
            value: country,
            confidenceProvenance: 'policy-v1',
          },
        };
      if (item.fact.factType === 'login.ipPresent')
        return {
          ...item,
          source: 'identity' as const,
          provider: 'identity-geoip',
        };
      if (item.fact.factType === 'session.subject') return { ...item, provider: 'workos-identity' };
      return item;
    });
    expect(evaluateSeverityPolicy(context.correlation.context, evidence, 0)).toMatchObject({
      outcome: 'classified',
      severity,
    });
    for (const required of ['session.subject', 'login.country', 'policy.allowedCountry', 'login.ipPresent']) {
      expect(
        evaluateSeverityPolicy(
          context.correlation.context,
          evidence.filter(item => item.fact.factType !== required),
          0,
        ),
      ).toMatchObject({
        outcome: 'manual-review',
        reasonCodes: ['REQUIRED_EVIDENCE_MISSING'],
      });
    }
  });

  it.each([
    ['unauthorized_privilege_change', 'medium'],
    ['disallowed_country_login', 'medium'],
    ['unknown_device_login', 'medium'],
  ] as const)('classifies the %s central event as %s', (kind, severity) => {
    const context = triageContext(kind, { confidence: 0.8 });
    expect(evaluateSeverityPolicy(context.correlation.context, context.evidence, 0)).toMatchObject({
      outcome: 'classified',
      severity,
      effectiveConfidence: 0.8,
    });
  });

  it.each([
    ['disallowed_country_login', 'login.ipPresent', false],
    ['unknown_device_login', 'device.identifierPresent', false],
  ] as const)('requires a true presence marker for %s', (kind, factType, value) => {
    const context = triageContext(kind);
    const evidence = context.evidence.map(item =>
      item.fact.factType === factType ? { ...item, fact: { ...item.fact, value } } : item,
    );
    expect(evaluateSeverityPolicy(context.correlation.context, evidence, 0)).toMatchObject({
      outcome: 'manual-review',
      reasonCodes: expect.arrayContaining(['REQUIRED_EVIDENCE_INCOMPLETE']),
    });
  });

  it('routes an invalid device signature to manual review', () => {
    const context = triageContext('unknown_device_login', { benign: true });
    const evidence = context.evidence.map(item =>
      item.fact.factType === 'device.signatureValid' ? { ...item, fact: { ...item.fact, value: false } } : item,
    );
    expect(evaluateSeverityPolicy(context.correlation.context, evidence, 0)).toMatchObject({
      outcome: 'manual-review',
      effectiveConfidence: 0,
      reasonCodes: expect.arrayContaining(['REQUIRED_EVIDENCE_INCOMPLETE']),
    });
  });

  it('rejects required evidence with the wrong source, provider, provenance, domain, or context binding', () => {
    const context = triageContext('disallowed_country_login');
    const country = context.evidence.find(item => item.fact.factType === 'login.country')!;
    const variants = [
      { ...country, source: 'identity' as const },
      { ...country, provider: 'hostile-cloud' },
      {
        ...country,
        fact: { ...country.fact, confidenceProvenance: 'rule-v1' },
      },
      { ...country, fact: { ...country.fact, value: 'outside-domain' } },
    ];
    for (const replacement of variants) {
      const evidence = context.evidence.map(item => (item.evidenceId === country.evidenceId ? replacement : item));
      expect(evaluateSeverityPolicy(context.correlation.context, evidence, 0)).toMatchObject({
        outcome: 'manual-review',
      });
    }
    expect(
      evaluateSeverityPolicy({ ...context.correlation.context, ip: undefined }, context.evidence, 0),
    ).toMatchObject({ outcome: 'manual-review' });
  });

  it('accepts only atomic local-cloud or identity-geoip origin pairs', () => {
    const context = triageContext('disallowed_country_login');
    const replace = (factType: string, patch: Record<string, unknown>) =>
      context.evidence.map(item => (item.fact.factType === factType ? { ...item, ...patch } : item));
    const validIpPresent = replace('login.ipPresent', {
      source: 'identity',
      provider: 'identity-geoip',
    });
    expect(evaluateSeverityPolicy(context.correlation.context, validIpPresent, 0)).toMatchObject({
      outcome: 'classified',
    });
    for (const [factType, patch] of [
      ['login.ipPresent', { source: 'identity', provider: 'local-cloud' }],
      ['login.ipPresent', { source: 'cloud', provider: 'identity-geoip' }],
      ['login.country', { source: 'identity', provider: 'local-cloud' }],
      ['login.country', { source: 'cloud', provider: 'identity-geoip' }],
    ] as const) {
      expect(evaluateSeverityPolicy(context.correlation.context, replace(factType, patch), 0)).toMatchObject({
        outcome: 'manual-review',
      });
    }
  });

  it('accepts the approved GeoIP 0.70 capability but rejects forged provenance or confidence', () => {
    const context = triageContext('disallowed_country_login');
    const country = context.evidence.find(item => item.fact.factType === 'login.country')!;
    const geo = (value: string, confidence: number, provenance = 'policy-v1') =>
      context.evidence.map(item =>
        item.evidenceId === country.evidenceId
          ? {
              ...item,
              source: 'identity' as const,
              provider: 'identity-geoip',
              confidence,
              fact: {
                ...item.fact,
                value,
                confidenceProvenance: provenance as 'policy-v1',
              },
            }
          : item,
      );
    expect(evaluateSeverityPolicy(context.correlation.context, geo('CA', 0.7), 0)).toMatchObject({
      outcome: 'classified',
    });
    expect(evaluateSeverityPolicy(context.correlation.context, geo('BR', 0.8), 0)).toMatchObject({
      outcome: 'manual-review',
    });
    expect(evaluateSeverityPolicy(context.correlation.context, geo('CA', 0.8), 0)).toMatchObject({
      outcome: 'manual-review',
    });
    const forged = geo('CA', 0.7).map(item =>
      item.evidenceId === country.evidenceId
        ? {
            ...item,
            fact: { ...item.fact, confidenceProvenance: 'provider' as const },
          }
        : item,
    );
    expect(evaluateSeverityPolicy(context.correlation.context, forged, 0)).toMatchObject({ outcome: 'manual-review' });
  });

  it('fails closed on duplicate required fact labels', () => {
    const context = triageContext('unknown_device_login');
    const duplicate = {
      ...context.evidence.find(item => item.fact.factType === 'device.identifierPresent')!,
      evidenceId: 'evidence-duplicate',
    };
    expect(evaluateSeverityPolicy(context.correlation.context, [...context.evidence, duplicate], 0)).toMatchObject({
      outcome: 'manual-review',
    });
  });

  it.each([
    ['login.country', 'ZZ'],
    ['policy.allowedCountry', 'CA'],
  ] as const)('does not let provider evidence redefine the US-only policy via %s=%s', (factType, value) => {
    const context = triageContext('disallowed_country_login', {
      benign: factType === 'policy.allowedCountry',
    });
    const evidence = context.evidence.map(item =>
      item.fact.factType === factType ? { ...item, fact: { ...item.fact, value } } : item,
    );
    expect(evaluateSeverityPolicy(context.correlation.context, evidence, 0)).toMatchObject({
      outcome: 'manual-review',
      effectiveConfidence: 0,
      reasonCodes: expect.arrayContaining(['REQUIRED_EVIDENCE_INCOMPLETE']),
    });
  });

  it('does not fabricate a country result when the cloud request has no IP', async () => {
    const provider = new LocalCloudEvidenceProvider();
    const result = await provider.inspect(
      {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        subjectId: 'subject-1',
        workflowRunId: 'workflow-run-1',
        incidentKind: 'disallowed_country_login',
        occurredAt: '2026-08-28T12:00:00.000Z',
        sessionId: 'session-1',
      },
      { signal: new AbortController().signal, attempt: 1 },
    );
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.facts).not.toEqual(expect.arrayContaining([expect.objectContaining({ factType: 'login.country' })]));
    expect(result.facts).toEqual(
      expect.arrayContaining([expect.objectContaining({ factType: 'login.ipPresent', value: false })]),
    );
  });

  it('emits high only with a proven central event and aggravating fact, and never critical', () => {
    const context = triageContext('unauthorized_privilege_change', {
      includeAggravating: true,
    });
    const result = evaluateSeverityPolicy(context.correlation.context, context.evidence, 0);
    expect(result).toMatchObject({ outcome: 'classified', severity: 'high' });
    expect(result.severity).not.toBe('critical');
  });

  it('does not elevate severity from a low-confidence aggravating fact', () => {
    const context = triageContext('unauthorized_privilege_change', {
      includeAggravating: true,
      aggravatingConfidence: 0.799,
    });
    expect(evaluateSeverityPolicy(context.correlation.context, context.evidence, 0)).toMatchObject({
      outcome: 'classified',
      severity: 'medium',
    });
  });

  it('emits low only when integrity-verified evidence proves the benign condition', () => {
    const context = triageContext('disallowed_country_login', { benign: true });
    expect(evaluateSeverityPolicy(context.correlation.context, context.evidence, 0)).toMatchObject({
      outcome: 'classified',
      severity: 'low',
    });
  });

  it.each([
    [{ confidence: 0.799 }, 'CONFIDENCE_BELOW_THRESHOLD'],
    [{ omitFactType: 'actor.id' }, 'REQUIRED_EVIDENCE_MISSING'],
    [{ incompleteFactType: 'actor.id' }, 'REQUIRED_EVIDENCE_INCOMPLETE'],
    [{ contradictions: 1 }, 'MATERIAL_CONTRADICTION'],
  ] as const)('falls back to manual review for %o', (options, reason) => {
    const context = triageContext('unauthorized_privilege_change', options);
    expect(
      evaluateSeverityPolicy(context.correlation.context, context.evidence, context.correlation.contradictions.length),
    ).toMatchObject({
      outcome: 'manual-review',
      reasonCodes: expect.arrayContaining([reason]),
    });
  });
});

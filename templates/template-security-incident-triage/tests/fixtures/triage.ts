import type { Evidence } from '../../src/schemas/evidence.js';
import type { IncidentKind } from '../../src/schemas/incident.js';
import type { DecisionContext } from '../../src/triage/decision-context.js';

const actions = {
  unauthorized_privilege_change: ['restore_previous_role', 'revoke_session'],
  disallowed_country_login: ['revoke_session', 'require_reauthentication'],
  unknown_device_login: ['revoke_session', 'mark_device_for_review'],
} as const;

export function triageContext(
  kind: IncidentKind = 'unauthorized_privilege_change',
  options: Readonly<{
    confidence?: number;
    incompleteFactType?: string;
    omitFactType?: string;
    contradictions?: number;
    includeAggravating?: boolean;
    aggravatingConfidence?: number;
    benign?: boolean;
  }> = {},
): DecisionContext {
  const facts = factsFor(kind, options);
  const evidence = facts
    .filter(fact => fact.factType !== options.omitFactType)
    .map((fact, index) =>
      evidenceItem(index + 1, fact.factType, fact.value, {
        confidence:
          fact.factType === 'session.active' && options.aggravatingConfidence !== undefined
            ? options.aggravatingConfidence
            : (options.confidence ?? 1),
        incomplete: fact.factType === options.incompleteFactType,
      }),
    );
  const idsBySource = (source: Evidence['source']) =>
    evidence.filter(item => item.source === source).map(item => item.evidenceId);
  return {
    correlation: {
      context: {
        schemaVersion: 1,
        eventId: 'event-1',
        alertId: 'alert-1',
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        subjectId: 'subject-1',
        workflowRunId: 'workflow-run-1',
        correlationId: 'correlation-1',
        incidentKind: kind,
        occurredAt: '2026-08-28T12:00:00.000Z',
        sessionId: 'session-1',
        ...(kind === 'unknown_device_login' ? { deviceId: 'device-1' } : {}),
        ...(kind === 'disallowed_country_login' ? { ip: '198.51.100.8' } : {}),
      },
      branches: [
        branch('identity', idsBySource('identity')),
        branch('endpoint', idsBySource('endpoint')),
        branch('cloud', idsBySource('cloud')),
      ],
      orderedEvents: evidence.map(item => ({
        evidenceId: item.evidenceId,
        observedAt: item.observedAt,
      })),
      relations: [],
      contradictions: Array.from({ length: options.contradictions ?? 0 }, () => ({
        leftEvidenceId: evidence[0]!.evidenceId,
        rightEvidenceId: evidence[1]!.evidenceId,
        reason: 'Conflicting values',
      })),
      missingData: [],
    },
    evidence,
    runbook: {
      metadata: {
        id: {
          unauthorized_privilege_change: 'RB-IDENTITY-001',
          disallowed_country_login: 'RB-IDENTITY-002',
          unknown_device_login: 'RB-IDENTITY-003',
        }[kind],
        version: '1.0.0',
        incidentKinds: [kind],
        owner: 'security',
        status: 'active',
        mandatoryRules: ['Fixture mandatory rule.'],
      },
      sourcePath: `runbooks/${kind}.md`,
      sourceHash: 'a'.repeat(64),
      parsedHash: 'b'.repeat(64),
      sections: Array.from({ length: 9 }, (_value, index) => ({
        heading: `Section ${index + 1}`,
        key: `section-${index + 1}`,
        body: 'Integrity-verified fixture policy.',
      })),
      allowedActions: actions[kind],
      prohibitedActions: ['generic_tool'],
    },
    allowedActions: actions[kind],
    startedAt: '2026-08-28T12:00:30.000Z',
  };
}

function factsFor(kind: IncidentKind, options: Readonly<{ includeAggravating?: boolean; benign?: boolean }>) {
  if (kind === 'unauthorized_privilege_change')
    return [
      { factType: 'role.previous', value: options.benign ? 'admin' : 'member' },
      { factType: 'role.current', value: 'admin' },
      { factType: 'actor.id', value: 'synthetic-actor' },
      { factType: 'change.approved', value: false },
      { factType: 'session.subject', value: 'subject-1' },
      ...(options.includeAggravating ? [{ factType: 'session.active', value: true }] : []),
    ];
  if (kind === 'disallowed_country_login')
    return [
      { factType: 'login.ipPresent', value: true },
      { factType: 'login.country', value: options.benign ? 'US' : 'CA' },
      { factType: 'policy.allowedCountry', value: 'US' },
      { factType: 'session.subject', value: 'subject-1' },
      {
        factType: 'session.abnormalHistory',
        value: options.includeAggravating === true,
      },
    ];
  return [
    { factType: 'device.identifierPresent', value: true },
    { factType: 'device.signatureValid', value: true },
    { factType: 'device.authorized', value: options.benign === true },
    { factType: 'session.subject', value: 'subject-1' },
    {
      factType: 'session.abnormalHistory',
      value: options.includeAggravating === true,
    },
  ];
}

function evidenceItem(
  ordinal: number,
  factType: string,
  value: string | boolean,
  options: Readonly<{ confidence: number; incomplete: boolean }>,
): Evidence {
  const source = sourceForFact(factType);
  const confidenceProvenance = provenanceForFact(factType);
  return {
    schemaVersion: 1,
    hashVersion: 1,
    evidenceId: `evidence-${ordinal}`,
    incidentId: 'incident-1',
    tenantId: 'tenant-1',
    source,
    provider: `local-${source}`,
    observedAt: '2026-08-28T12:00:00.000Z',
    collectedAt: '2026-08-28T12:00:30.000Z',
    fact: {
      semanticKey: `key-${ordinal}`,
      factType,
      value,
      confidenceProvenance,
    },
    confidence: options.confidence,
    rawPayloadRef: `protected:fixture:${ordinal}`,
    integrityHash: ordinal.toString(16).padStart(64, '0'),
    sensitivity: 'confidential',
    incomplete: options.incomplete,
  };
}

function sourceForFact(factType: string): Evidence['source'] {
  if (factType.startsWith('device.')) return 'endpoint';
  if (factType.startsWith('login.') || factType.startsWith('policy.') || factType === 'session.abnormalHistory')
    return 'cloud';
  return 'identity';
}

function provenanceForFact(factType: string): 'provider' | 'rule-v1' {
  return ['role.previous', 'role.current', 'actor.id', 'login.country', 'session.subject'].includes(factType)
    ? 'provider'
    : 'rule-v1';
}

function branch(source: 'identity' | 'endpoint' | 'cloud', evidenceIds: string[]) {
  return {
    source,
    status: 'success' as const,
    evidenceIds,
    startedAt: '2026-08-28T12:00:30.000Z',
    finishedAt: '2026-08-28T12:00:31.000Z',
    latencyMs: 1_000,
    stepId: `gather-${source}-evidence` as const,
    toolCallIds: [],
  };
}

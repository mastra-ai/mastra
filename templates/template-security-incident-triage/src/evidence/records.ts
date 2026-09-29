import { DomainError, parseDomainSchema } from '../domain/errors.js';
import { EvidenceSchema, type Evidence } from '../schemas/evidence.js';
import type { EvidenceSourceV1, InvestigationContext } from './contracts.js';
import { evidenceIntegrityHash, type EvidenceEnvelope } from './hashes.js';

export function evidenceFromEnvelope(envelope: EvidenceEnvelope): Evidence {
  return parseDomainSchema(EvidenceSchema, {
    schemaVersion: envelope.schemaVersion,
    hashVersion: envelope.hashVersion,
    evidenceId: envelope.evidenceId,
    incidentId: envelope.incidentId,
    tenantId: envelope.tenantId,
    source: envelope.source,
    provider: envelope.provider,
    observedAt: envelope.observedAt,
    collectedAt: envelope.collectedAt,
    fact: {
      ...envelope.fact,
      confidenceProvenance: envelope.confidenceProvenance,
    },
    confidence: envelope.confidence,
    rawPayloadRef: envelope.rawPayloadRef,
    integrityHash: evidenceIntegrityHash(envelope),
    sensitivity: envelope.sensitivity,
    incomplete: envelope.incomplete,
    ...(envelope.error ? { error: envelope.error } : {}),
  });
}

export function parseAndVerifyEvidenceRow(row: Record<string, unknown>, context: InvestigationContext): Evidence {
  let fact: unknown;
  try {
    fact = JSON.parse(String(row.fact_json));
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
  const evidence = parseDomainSchema(EvidenceSchema, {
    schemaVersion: 1,
    hashVersion: Number(row.hash_version),
    evidenceId: row.id,
    incidentId: row.incident_id,
    tenantId: row.tenant_id,
    source: row.source,
    provider: row.provider,
    observedAt: row.observed_at,
    collectedAt: row.collected_at,
    fact,
    confidence: Number(row.confidence),
    rawPayloadRef: row.raw_payload_ref,
    integrityHash: row.integrity_hash,
    sensitivity: row.sensitivity,
    incomplete: Number(row.incomplete) === 1,
    ...(row.error_code === null ? {} : { error: row.error_code }),
  });
  if (evidence.integrityHash !== evidenceIntegrityHash(evidenceToEnvelope(evidence, context))) {
    throw new DomainError('VALIDATION_FAILED');
  }
  return evidence;
}

export function evidenceToEnvelope(evidence: Evidence, context: InvestigationContext): EvidenceEnvelope {
  const { confidenceProvenance, ...fact } = evidence.fact;
  if (
    confidenceProvenance !== 'provider' &&
    confidenceProvenance !== 'rule-v1' &&
    confidenceProvenance !== 'policy-v1'
  ) {
    throw new DomainError('VALIDATION_FAILED');
  }
  return {
    schemaVersion: 1,
    hashVersion: evidence.hashVersion,
    evidenceId: evidence.evidenceId,
    incidentId: evidence.incidentId,
    tenantId: evidence.tenantId,
    workflowRunId: context.workflowRunId,
    subjectId: context.subjectId,
    source: evidence.source as EvidenceSourceV1,
    provider: evidence.provider,
    observedAt: evidence.observedAt,
    collectedAt: evidence.collectedAt,
    fact,
    confidence: evidence.confidence,
    confidenceProvenance,
    rawPayloadRef: evidence.rawPayloadRef,
    sensitivity: evidence.sensitivity,
    incomplete: evidence.incomplete,
    error: evidence.error ?? null,
  };
}

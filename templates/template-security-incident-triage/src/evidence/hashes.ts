import { createHash } from 'node:crypto';

import { canonicalJson } from './canonicalize.js';
import type { EvidenceFact, EvidenceSourceV1 } from './contracts.js';

export type EvidenceEnvelope = Readonly<{
  schemaVersion: 1;
  hashVersion: 1;
  evidenceId: string;
  incidentId: string;
  tenantId: string;
  workflowRunId: string;
  subjectId: string;
  source: EvidenceSourceV1;
  provider: string;
  observedAt: string;
  collectedAt: string;
  fact: Readonly<Record<string, string | number | boolean | null>>;
  confidence: number;
  confidenceProvenance: 'provider' | 'rule-v1' | 'policy-v1';
  rawPayloadRef: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  incomplete: boolean;
  error: string | null;
}>;

export function stableEvidenceId(input: {
  tenantId: string;
  incidentId: string;
  workflowRunId: string;
  source: EvidenceSourceV1;
  provider: string;
  subjectId: string;
  semanticKey: string;
}): string {
  const digest = sha256(canonicalJson({ namespace: 'evidence-v1', hashVersion: 1, ...input }));
  return `ev_${digest}`;
}

export function createEvidenceEnvelope(input: {
  tenantId: string;
  incidentId: string;
  workflowRunId: string;
  subjectId: string;
  source: EvidenceSourceV1;
  provider: string;
  collectedAt: string;
  fact: EvidenceFact;
}): EvidenceEnvelope {
  const evidenceId = stableEvidenceId({
    tenantId: input.tenantId,
    incidentId: input.incidentId,
    workflowRunId: input.workflowRunId,
    source: input.source,
    provider: input.provider,
    subjectId: input.subjectId,
    semanticKey: input.fact.semanticKey,
  });
  return Object.freeze({
    schemaVersion: 1,
    hashVersion: 1,
    evidenceId,
    incidentId: input.incidentId,
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    subjectId: input.subjectId,
    source: input.source,
    provider: input.provider,
    observedAt: input.fact.observedAt,
    collectedAt: input.collectedAt,
    fact: Object.freeze({
      semanticKey: input.fact.semanticKey,
      factType: input.fact.factType,
      value: input.fact.value,
    }),
    confidence: input.fact.confidence,
    confidenceProvenance: input.fact.confidenceProvenance,
    rawPayloadRef: input.fact.rawPayloadRef,
    sensitivity: input.fact.sensitivity,
    incomplete: input.fact.incomplete,
    error: null,
  });
}

export function evidenceIntegrityHash(envelope: EvidenceEnvelope): string {
  return sha256(canonicalJson(envelope));
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

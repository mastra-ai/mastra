import { z } from 'zod';

import type { EvidenceRepository } from '../contracts/repositories/evidence-repository.js';
import { DomainInvariantError } from '../domain/errors.js';
import { evidenceItemSchema } from '../domain/evidence.js';
import { caseIdSchema, checksumSchema, evidenceIdSchema, tenantIdSchema } from '../domain/identifiers.js';
import { reasonCodeSchema } from '../domain/reasons.js';
import { fingerprintValue } from './stable-identifiers.js';

export const canonicalEvidenceBundleSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    evidence: z.array(evidenceItemSchema),
    evidenceIds: z.array(evidenceIdSchema),
    reasonCodes: z.array(reasonCodeSchema),
    fingerprint: checksumSchema,
  })
  .strict();

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
};

const canonicalEvidence = (evidence: z.infer<typeof evidenceItemSchema>): string =>
  JSON.stringify(canonicalize(evidence));

export const aggregateCanonicalEvidence = (
  tenantId: string,
  caseId: string,
  rawEvidence: readonly z.infer<typeof evidenceItemSchema>[],
) => {
  const sorted = rawEvidence
    .map(item => {
      const parsed = evidenceItemSchema.parse(item);
      if (parsed.tenantId !== tenantId || parsed.caseId !== caseId) {
        throw new DomainInvariantError('Evidence does not match the requested tenant and case');
      }
      return parsed;
    })
    .sort((left, right) =>
      [left.occurredAt, left.kind, left.sourceId, left.id]
        .join('\0')
        .localeCompare([right.occurredAt, right.kind, right.sourceId, right.id].join('\0')),
    );
  const immutableEvidence = new Map<string, string>();
  const evidence = sorted.filter(item => {
    const canonical = canonicalEvidence(item);
    const existing = immutableEvidence.get(item.id);
    if (existing === undefined) {
      immutableEvidence.set(item.id, canonical);
      return true;
    }
    if (existing !== canonical) {
      throw new DomainInvariantError('Immutable evidence ID has divergent content');
    }
    return false;
  });
  const evidenceIds = evidence.map(item => item.id);
  const reasonCodes = [
    ...new Set(
      evidence
        .flatMap(item => [item.reasonCode, ...(item.reasonCodes ?? [])])
        .flatMap(reason => {
          const parsed = reasonCodeSchema.safeParse(reason);
          return parsed.success ? [parsed.data] : [];
        }),
    ),
  ];
  return canonicalEvidenceBundleSchema.parse({
    tenantId,
    caseId,
    evidence,
    evidenceIds,
    reasonCodes,
    fingerprint: fingerprintValue({ tenantId, caseId, evidenceIds, reasonCodes }),
  });
};

export class EvidenceAggregationService {
  constructor(private readonly evidence: EvidenceRepository) {}

  async aggregate(input: Readonly<{ tenantId: string; caseId: string }>) {
    const evidence = await this.evidence.list(input);
    return aggregateCanonicalEvidence(input.tenantId, input.caseId, evidence);
  }
}

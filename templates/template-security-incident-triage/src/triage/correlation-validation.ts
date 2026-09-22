import { DomainError } from '../domain/errors.js';
import { canonicalJson } from '../evidence/canonicalize.js';
import type { Correlation } from '../evidence/contracts.js';
import type { Evidence } from '../schemas/evidence.js';

export function assertCorrelationDerivedData(correlation: Correlation, evidence: readonly Evidence[]) {
  const evidenceById = new Map(evidence.map(item => [item.evidenceId, item] as const));
  for (const branch of correlation.branches) {
    if (branch.evidenceIds.some(evidenceId => evidenceById.get(evidenceId)?.source !== branch.source))
      throw new DomainError('CONFLICT');
    const hasIncomplete = evidence.some(item => item.source === branch.source && item.incomplete);
    if (
      (branch.status === 'failed' && branch.evidenceIds.length !== 0) ||
      (branch.status === 'partial') !== hasIncomplete ||
      (branch.status === 'success' && hasIncomplete)
    )
      throw new DomainError('CONFLICT');
  }
  const relations = [];
  for (let index = 1; index < evidence.length; index += 1) {
    const previous = evidence[index - 1]!;
    const current = evidence[index]!;
    const delta = Date.parse(current.observedAt) - Date.parse(previous.observedAt);
    if (delta >= 0 && delta <= 15 * 60 * 1_000)
      relations.push({
        fromEvidenceId: previous.evidenceId,
        toEvidenceId: current.evidenceId,
        type: 'same-subject-within-15m-v1',
      });
  }
  const contradictions = [];
  for (let left = 0; left < evidence.length; left += 1) {
    for (let right = left + 1; right < evidence.length; right += 1) {
      const a = evidence[left]!;
      const b = evidence[right]!;
      if (a.fact.factType === b.fact.factType && a.fact.value !== b.fact.value)
        contradictions.push({
          leftEvidenceId: a.evidenceId,
          rightEvidenceId: b.evidenceId,
          reason: `Conflicting values for ${String(a.fact.factType)}`,
        });
    }
  }
  const missingData = [
    ...correlation.branches
      .filter(branch => branch.status === 'failed')
      .map(branch => ({
        source: branch.source,
        reason: branch.error?.code ?? 'SOURCE_UNAVAILABLE',
      })),
    ...evidence
      .filter(item => item.incomplete)
      .map(item => ({
        source: item.source as 'identity' | 'endpoint' | 'cloud',
        evidenceId: item.evidenceId,
        reason: item.error ?? 'INCOMPLETE_EVIDENCE',
      })),
  ];
  if (
    canonicalJson(relations) !== canonicalJson(correlation.relations) ||
    canonicalJson(contradictions) !== canonicalJson(correlation.contradictions) ||
    canonicalJson(missingData) !== canonicalJson(correlation.missingData)
  )
    throw new DomainError('CONFLICT');
}

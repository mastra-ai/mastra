import { createHash } from 'node:crypto';
import { candidatePassages, verifierDecisionsSchema, verifierLedgerSchema } from '../research/contracts';
import type { Candidate, Evidence, ResearchBranch } from '../research/contracts';
import { normalizedCandidateId } from '../research/evidence-validation';

/** Model self-report only. The supported-ID contract and local evidence validation remain authoritative. */
export function verifierDiagnostics(
  raw: unknown,
  candidates: Candidate[],
  supportedCandidateIds: string[],
  evidence: { material: Evidence[]; aliases: Map<string, string> },
  scope: { providerId: string; branch: ResearchBranch; roundIndex: number },
) {
  const parsed = verifierDecisionsSchema.safeParse(raw);
  const coverage =
    parsed.success &&
    parsed.data.length === candidates.length &&
    parsed.data.every(item => candidates.some(candidate => candidate.id === item.candidateId));
  const supported = new Set(supportedCandidateIds);
  const byId = new Map(evidence.material.map(source => [source.id, source]));
  return candidates.map(candidate => {
    const decision = parsed.success ? parsed.data.find(item => item.candidateId === candidate.id) : undefined;
    const base = {
      version: 1 as const,
      candidateId: normalizedCandidateId(candidate.id, scope),
      providerId: scope.providerId,
      branch: scope.branch,
      roundIndex: scope.roundIndex,
      attribute: candidate.attribute,
      verifierSupported: supported.has(candidate.id),
      candidateInferred: Boolean(candidate.inference),
      modelReport: coverage && decision ? { decision: decision.decision, reasonCode: decision.reasonCode } : null,
      decision: null,
      reasonCode: null,
      passages: [],
      privatePassagesOmitted: 0,
    };
    const absent = raw === undefined ? 'missing' : raw === null ? 'not_reported' : null;
    if (absent) return verifierLedgerSchema.parse({ ...base, status: absent, invalidCode: null });
    const passages = candidatePassages(candidate);
    const invalidCode = !parsed.success
      ? 'schema_invalid'
      : !coverage
        ? 'coverage_mismatch'
        : decision!.decision !== (base.verifierSupported ? 'supported' : 'rejected')
          ? 'support_membership_mismatch'
          : base.verifierSupported && (decision!.reasonCode === 'supported_inference') !== Boolean(candidate.inference)
            ? 'inference_kind_mismatch'
            : decision!.passageIndexes.some(index => !passages[index] || !byId.has(passages[index]!.evidenceId))
              ? 'passage_invalid'
              : null;
    if (invalidCode) return verifierLedgerSchema.parse({ ...base, status: 'invalid', invalidCode });
    const selected = decision!.passageIndexes.map(index => ({ index, source: byId.get(passages[index]!.evidenceId)! }));
    return verifierLedgerSchema.parse({
      ...base,
      status: 'reported',
      invalidCode: null,
      decision: decision!.decision,
      reasonCode: decision!.reasonCode,
      privatePassagesOmitted: selected.filter(item => item.source.kind !== 'website').length,
      passages: selected
        .filter(item => item.source.kind === 'website')
        .map(({ index, source }) => ({
          index,
          evidenceId: evidence.aliases.get(source.id) ?? source.id,
          evidenceDigest: source.digest,
          quoteDigest: createHash('sha256').update(passages[index]!.quote).digest('hex'),
          sourceDigest: createHash('sha256').update(source.source).digest('hex'),
        })),
    });
  });
}

import { createHash } from 'node:crypto';
import type { QualificationConfig } from '../config/qualification';
import { candidatePassages, candidateSchema, evidenceSchema, ResearchError } from './contracts';
import type { BranchResult, Candidate, Evidence, ResearchBranch } from './contracts';
import { approvedUrl } from './page-retrieval';
import { rejectedEvidenceDiagnostic } from './evidence-diagnostics';

function scopedEvidence(source: Evidence): Evidence {
  const identity = JSON.stringify([source.providerId, source.id, source.kind, source.source, source.digest]);
  return { ...source, id: `evidence-${createHash('sha256').update(identity).digest('hex').slice(0, 40)}` };
}

export function validateSource(
  material: Evidence,
  providerId: string,
  domains: string[],
  policy: QualificationConfig['sources'],
) {
  const source = evidenceSchema.parse(material);
  const validDigest = createHash('sha256').update(source.excerpt).digest('hex') === source.digest;
  const trusted =
    source.kind === 'website'
      ? Boolean(approvedUrl(source.source, domains))
      : policy.trustedReferences.includes(source.source);
  return validDigest && trusted && source.providerId === providerId ? source : null;
}

export function createEvidenceBatch(previous: Evidence[]) {
  const previousIds = new Set(previous.map(source => source.id));
  const current = new Map<string, Evidence>();
  return {
    add(source: Evidence) {
      const existing = current.get(source.id);
      if (previousIds.has(source.id) || (existing && scopedEvidence(existing).id !== scopedEvidence(source).id))
        throw new ResearchError('evidence_id_conflict');
      if (!existing) current.set(source.id, source);
    },
    prepare() {
      const sources = [...current.values()];
      const stored = sources.map(scopedEvidence);
      // Current adapters keep their IDs until their claims have been checked.
      return {
        material: [...previous, ...sources],
        stored,
        aliases: new Map(sources.map((source, index) => [source.id, stored[index]!.id])),
      };
    },
  };
}

export function normalizedCandidateId(
  candidateId: string,
  scope: { providerId: string; branch: ResearchBranch; roundIndex: number },
) {
  return `candidate-${createHash('sha256')
    .update(`${scope.providerId}:${scope.branch}:${scope.roundIndex}:${candidateId}`)
    .digest('hex')
    .slice(0, 24)}`;
}

export function validateCandidates(
  candidates: Candidate[],
  supportedCandidateIds: string[],
  evidence: { material: Evidence[]; aliases: Map<string, string> },
  scope: { providerId: string; branch: ResearchBranch; roundIndex: number; businessModelLabels: string[] },
): Pick<BranchResult, 'candidates' | 'rejections'> {
  const result: Pick<BranchResult, 'candidates' | 'rejections'> = { candidates: [], rejections: [] };
  const byId = new Map<string, Evidence>();
  for (const source of evidence.material) if (!byId.has(source.id)) byId.set(source.id, source);
  const supported = new Set(supportedCandidateIds);
  const labels = new Set(scope.businessModelLabels);
  for (const candidate of candidates) {
    const passages = candidatePassages(candidate);
    const candidateId = normalizedCandidateId(candidate.id, scope);
    const normalizedPassages = [
      ...new Map(
        passages.map(passage => {
          const normalized = { ...passage, evidenceId: evidence.aliases.get(passage.evidenceId) ?? passage.evidenceId };
          return [JSON.stringify(normalized), normalized] as const;
        }),
      ).values(),
    ];
    const normalizedCandidate = candidateSchema.safeParse({
      ...candidate,
      id: candidateId,
      evidenceId: normalizedPassages[0]!.evidenceId,
      ...(candidate.inference
        ? { inference: { ...candidate.inference, additionalPassages: normalizedPassages.slice(1) } }
        : {}),
    });
    const checks = {
      evidenceKnown: passages.every(passage => byId.has(passage.evidenceId)),
      exactQuotePresent: passages.every(passage => byId.get(passage.evidenceId)?.excerpt.includes(passage.quote)),
      semanticSupported: supported.has(candidate.id),
      configuredLabel:
        candidate.attribute !== 'businessModel' || (typeof candidate.value === 'string' && labels.has(candidate.value)),
      provenanceValid: normalizedCandidate.success,
    };
    // Exact attribution and semantic support are separate checks.
    if (checks.exactQuotePresent && checks.semanticSupported && checks.configuredLabel && normalizedCandidate.success)
      result.candidates.push(normalizedCandidate.data);
    else {
      result.rejections.push({
        branch: scope.branch,
        candidateId,
        evidenceId: `evidence-${createHash('sha256').update(candidate.evidenceId).digest('hex').slice(0, 24)}`,
        attribute: candidate.attribute,
        value: candidate.value,
        reason: !checks.evidenceKnown
          ? 'unknown_evidence_id'
          : !checks.exactQuotePresent
            ? 'exact_quote_absent'
            : !checks.configuredLabel
              ? 'unconfigured_business_model'
              : !checks.provenanceValid
                ? 'candidate_provenance_invalid'
                : 'semantic_verification_rejected',
        checks,
        diagnostic: rejectedEvidenceDiagnostic(candidate, passages, evidence.material, evidence.aliases),
      });
    }
  }
  return result;
}

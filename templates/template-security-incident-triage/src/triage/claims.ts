import { DomainError } from '../domain/errors.js';
import { canonicalJson } from '../evidence/canonicalize.js';
import type { DecisionContext } from './decision-context.js';
import {
  IncidentSummaryV1Schema,
  SummaryAnalysisCandidateSchema,
  type SeverityDecision,
  type IncidentSummaryV1,
  type SummaryAnalysisCandidate,
} from './decision-contracts.js';
import { claimRequirements } from './policy-registry.js';
import { resolveEvidenceRequirement } from './policy.js';

const evidenceFactNarrators: Readonly<Record<string, (value: unknown) => string | undefined>> = {
  'role.previous': () => 'A previous role snapshot is available.',
  'role.current': () => 'A current role-change event is available.',
  'actor.id': () => 'An actor identifier is attributed to the role change.',
  'change.approved': value =>
    value === false
      ? 'No approved change is recorded for the role transition.'
      : 'An approved change is recorded for the role transition.',
  'session.active': value => (value === true ? 'The scoped session is active.' : undefined),
  'session.subject': () => 'The scoped session is linked to the incident subject.',
  'login.country': () => 'A country signal is recorded for the scoped login.',
  'login.ipPresent': value => (value === true ? 'A source IP reference is present for the scoped login.' : undefined),
  'policy.allowedCountry': () => 'A tenant country policy is available.',
  'session.abnormalHistory': value =>
    value === true
      ? 'Abnormal recent session activity is recorded.'
      : 'Recent scoped session history has no configured abnormality signal.',
  'device.identifierPresent': value =>
    value === true ? 'A scoped application-issued device identifier is present.' : undefined,
  'device.signatureValid': value =>
    value === true ? 'The application-issued device identifier has a valid signature.' : undefined,
  'device.authorized': value =>
    value === false
      ? 'The scoped device is absent from the authorized-device list.'
      : value === true
        ? 'The scoped device is present in the authorized-device list.'
        : undefined,
};

export function createSummaryCandidate(context: DecisionContext): SummaryAnalysisCandidate {
  return SummaryAnalysisCandidateSchema.parse({
    schemaVersion: 1,
    factTokens: trustedClaimEvidence(context).map(({ index }) => `fact-${index + 1}`),
    hypothesisCodes: [],
  });
}

export function buildIncidentSummary(
  context: DecisionContext,
  decision: SeverityDecision,
  candidate: unknown,
): IncidentSummaryV1 {
  const parsed = SummaryAnalysisCandidateSchema.safeParse(candidate);
  const expected = createSummaryCandidate(context);
  if (!parsed.success || canonicalJson(parsed.data) !== canonicalJson(expected))
    throw new DomainError('VALIDATION_FAILED');
  const facts = parsed.data.factTokens.map(token => {
    const index = Number(token.slice('fact-'.length)) - 1;
    const trusted = trustedClaimEvidence(context).find(item => item.index === index);
    if (!trusted) throw new DomainError('VALIDATION_FAILED');
    const { evidence, text } = trusted;
    const references = [`[evidence:${evidence.evidenceId}]`];
    if (evidence.fact.factType === 'policy.allowedCountry') references.push(decision.runbookReference);
    return { text, references };
  });
  return IncidentSummaryV1Schema.parse({
    schemaVersion: 1,
    incidentId: decision.incidentId,
    summary: summaryText(context.correlation.context.incidentKind, decision.severity),
    facts,
    hypotheses: [],
  });
}

export function validateSummaryReferences(
  summary: IncidentSummaryV1,
  context: DecisionContext,
  decision: SeverityDecision,
) {
  const allowedEvidence = new Set(
    trustedClaimEvidence(context).map(({ evidence }) => `[evidence:${evidence.evidenceId}]`),
  );
  for (const claim of summary.facts) {
    if (!claim.references.some(reference => allowedEvidence.has(reference))) throw new DomainError('VALIDATION_FAILED');
    for (const reference of claim.references) {
      if (reference.startsWith('[evidence:') && !allowedEvidence.has(reference))
        throw new DomainError('VALIDATION_FAILED');
      if (reference.startsWith('[runbook:') && reference !== decision.runbookReference)
        throw new DomainError('VALIDATION_FAILED');
    }
  }
  const expected = buildIncidentSummary(context, decision, createSummaryCandidate(context));
  if (canonicalJson(summary) !== canonicalJson(expected)) throw new DomainError('VALIDATION_FAILED');
}

function trustedClaimEvidence(context: DecisionContext) {
  const requirements = claimRequirements[context.correlation.context.incidentKind];
  return context.evidence.flatMap((evidence, index) => {
    const requirement = requirements.find(item => item.factType === evidence.fact.factType);
    if (!requirement) return [];
    const resolution = resolveEvidenceRequirement(context.evidence, requirement, context.correlation.context);
    const text = renderTrustedEvidenceClaim(evidence.fact.factType, evidence.fact.value);
    return resolution.status === 'valid' && resolution.evidence.evidenceId === evidence.evidenceId && text
      ? [{ evidence, index, text }]
      : [];
  });
}

function renderTrustedEvidenceClaim(factType: unknown, value: unknown): string | undefined {
  if (typeof factType !== 'string') return undefined;
  return evidenceFactNarrators[factType]?.(value);
}

function summaryText(kind: string, severity: string): string {
  const label = {
    unauthorized_privilege_change: 'privilege-change',
    disallowed_country_login: 'country-login',
    unknown_device_login: 'device-login',
  }[kind];
  return `The integrity-verified ${label ?? 'identity'} incident is classified ${severity}; facts below remain evidence-attributed.`;
}

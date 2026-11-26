import { randomUUID } from 'node:crypto';
import type { Evidence } from '../../src/discovery/contracts.js';

export const planningSemanticCases = [
  ['empty', true],
  ['playbook', true],
  ['novel', true],
  ['cve', true],
  ['ssrf', true],
  ['ssrf-novel', true],
  ['ssrf-cve', true],
  ['tool-mismatch', false],
  ['non-ssrf-active', false],
  ['ssrf-passive', false],
  ['advisory-id-only', false],
  ['advisory-revision-only', false],
  ['non-cve-advisory', false],
  ['novel-advisory', false],
  ['cve-without-advisory', false],
  ['duplicate-evidence', false],
  ['combined', false],
] as const;
export type PlanningSemanticCase = (typeof planningSemanticCases)[number][0];

// These independent vectors describe the existing accepted contract, not a model verdict.
/** Run bounded local planning cases and verify the persisted hypotheses match the supplied evidence. */
export function planningSemanticHypotheses(input: any, selected: PlanningSemanticCase) {
  if (selected === 'empty') return [];
  const rules = input.hypothesisRules;
  const activeCategory = rules?.active ?? 'ssrf';
  const advisoryOrigin = rules?.advisory ?? 'cve';
  const [advisoryId, advisoryRevision] = rules?.pairedAdvisoryFields ?? ['advisoryId', 'advisoryRevision'];
  const category = selected.startsWith('ssrf') ? activeCategory : 'idor';
  const book = planningCatalog(input).find((item: any) => item.category === category);
  const candidate = input.advisoryCandidates[0];
  const proposal: Record<string, any> = {
    origin: 'playbook',
    category,
    toolId: book.toolId,
    scanId: input.scanId,
    evidenceIds: [input.evidence.find((item: any) => item.kind === 'endpoint').id],
    referenceIds: [book.references[0]],
    preconditions: [],
    expectedBehavior: 'The owned resource remains within its authorized boundary.',
    risk: category === activeCategory ? 'active' : 'passive',
    maxRequests: 2,
    maxDurationSeconds: 15,
    maxTokens: 128,
    maxRefinements: 0,
  };
  if (selected === 'novel' || selected === 'ssrf-novel' || selected === 'novel-advisory') proposal.origin = 'novel';
  if (['cve', 'ssrf-cve', 'advisory-id-only', 'advisory-revision-only', 'cve-without-advisory'].includes(selected))
    proposal.origin = advisoryOrigin;
  if (['cve', 'ssrf-cve', 'non-cve-advisory', 'novel-advisory'].includes(selected)) {
    proposal[advisoryId] = candidate.id;
    proposal[advisoryRevision] = candidate.revision;
  }
  if (selected === 'advisory-id-only') proposal[advisoryId] = candidate.id;
  if (selected === 'advisory-revision-only') proposal[advisoryRevision] = candidate.revision;
  if (selected === 'tool-mismatch')
    proposal.toolId = planningCatalog(input).find((item: any) => item.category === 'bfla').toolId;
  if (selected === 'non-ssrf-active' || selected === 'combined') proposal.risk = 'active';
  if (selected === 'ssrf-passive') proposal.risk = 'passive';
  if (selected === 'duplicate-evidence' || selected === 'combined') proposal.evidenceIds.push(proposal.evidenceIds[0]);
  if (selected === 'combined') {
    proposal.toolId = planningCatalog(input).find((item: any) => item.category === 'bfla').toolId;
    proposal.origin = advisoryOrigin;
    proposal[advisoryRevision] = candidate.revision;
  }
  return [proposal];
}

export function planningEvidence(scanId: string): Evidence {
  return {
    id: randomUUID(),
    scanId,
    targetId: randomUUID(),
    observedAt: new Date().toISOString(),
    observation: {
      kind: 'endpoint',
      role: 'public',
      profileId: randomUUID(),
      source: 'katana-http',
      provenance: 'upstream-response',
      origin: 'http://allowed.lab:18080',
      path: '/catalog',
      method: 'GET',
      parameterNames: [],
      status: 200,
    },
    sha256: 'a'.repeat(64),
    expiresAt: null,
    confirmationEligible: false,
  };
}

export function planningCatalog(input: any): any[] {
  return input.playbooks.map((row: any[]) =>
    Object.fromEntries(input.playbookFields.map((field: string, index: number) => [field, row[index]])),
  );
}

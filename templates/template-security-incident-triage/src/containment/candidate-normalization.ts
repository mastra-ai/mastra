import { DomainError } from '../domain/errors.js';
import { ContainmentAnalysisCandidateSchema, type ContainmentAnalysisCandidate } from '../triage/decision-contracts.js';

export function normalizeContainmentCandidate(candidateValue: unknown): ContainmentAnalysisCandidate {
  const candidate = ContainmentAnalysisCandidateSchema.parse(candidateValue);
  const seen = new Set<string>();
  const actions = [...candidate.actions].sort((left, right) => compareUtf16(semanticKey(left), semanticKey(right)));
  for (const action of actions) {
    if (seen.has(action.actionType)) throw new DomainError('CONFLICT');
    seen.add(action.actionType);
  }
  return ContainmentAnalysisCandidateSchema.parse({
    schemaVersion: candidate.schemaVersion,
    actions,
  });
}

function semanticKey(action: ContainmentAnalysisCandidate['actions'][number]): string {
  return `${action.actionType}\0${action.targetToken}\0${action.inputToken}`;
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

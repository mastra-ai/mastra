import { sha256Canonical, type SecurityEvalInput } from './dataset-contract.js';

/**
 * Stable binding used by the operational containment-plan record.  It derives
 * only from the input fixture and the domain action, never from ground truth
 * or an evaluated payload.
 */
export function securityEvalPlanHash(input: SecurityEvalInput, action: string, target: string): string {
  return sha256Canonical({
    caseId: input.caseId,
    tenantAlias: input.fixture.tenantAlias,
    incidentAlias: input.fixture.incidentAlias,
    action,
    target,
    runbook: input.fixture.runbook,
  });
}

export function securityEvalActionForInput(input: SecurityEvalInput): string {
  return input.scenario === 'privilege' ? 'restore_previous_role' : 'revoke_session';
}

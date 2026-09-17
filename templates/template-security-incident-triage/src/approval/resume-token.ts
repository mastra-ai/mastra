import { createHash, createHmac } from 'node:crypto';

import { canonicalizePlanValue } from '../containment/plan-canonicalization.js';
import { DomainError } from '../domain/errors.js';
import type { ApprovalDecision } from '../schemas/approval.js';

const TOKEN_PREFIX = 'p6r1_';
const DIGEST_DOMAIN = 'security-incident-triage:resume-token:v1\0';
const TOKEN_DOMAIN = 'security-incident-triage:resume-token-material:v1\0';

export function decisionFingerprint(
  decision: Omit<ApprovalDecision, 'decidedAt'> | ApprovalDecision,
  workflowRunId: string,
): string {
  const value = decision as ApprovalDecision;
  const semantic = {
    schemaVersion: value.schemaVersion,
    approvalId: value.approvalId,
    planId: value.planId,
    incidentId: value.incidentId,
    tenantId: value.tenantId,
    planHashVersion: value.planHashVersion,
    planHash: value.planHash,
    decision: value.decision,
    decidedBy: value.decidedBy,
    decidedByRole: value.decidedByRole,
    reason: value.reason ?? null,
  };
  return createHash('sha256')
    .update(
      canonicalizePlanValue({
        ...semantic,
        workflowRunId,
      }),
    )
    .digest('hex');
}

export function deriveResumeToken(
  secret: string,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    approvalId: string;
    decisionFingerprint: string;
  }>,
): string {
  if (secret.length < 32) throw new DomainError('VALIDATION_FAILED');
  const material = canonicalizePlanValue(input);
  return `${TOKEN_PREFIX}${createHmac('sha256', secret).update(TOKEN_DOMAIN).update(material).digest('base64url')}`;
}

export function digestResumeToken(token: string): string {
  if (
    token.length < 32 ||
    token.length > 512 ||
    !token.startsWith(TOKEN_PREFIX) ||
    !/^p6r1_[A-Za-z0-9_-]+$/u.test(token)
  ) {
    throw new DomainError('VALIDATION_FAILED');
  }
  return createHash('sha256').update(DIGEST_DOMAIN).update(token).digest('hex');
}

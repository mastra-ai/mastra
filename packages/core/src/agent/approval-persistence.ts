import { ErrorCategory, ErrorDomain, MastraError } from '../error';

export const APPROVAL_PERSISTENCE_MODES = ['full', 'minimal'] as const;
export type ApprovalPersistenceMode = (typeof APPROVAL_PERSISTENCE_MODES)[number];

export function resolveApprovalPersistenceMode(value: unknown): ApprovalPersistenceMode {
  if (value === undefined) return 'full';
  if (value === 'full' || value === 'minimal') return value;
  throw new MastraError({
    id: 'AGENT_INVALID_APPROVAL_PERSISTENCE',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Invalid approvalPersistence value "${String(value)}". Expected "full" or "minimal".`,
    details: { value: String(value) },
  });
}

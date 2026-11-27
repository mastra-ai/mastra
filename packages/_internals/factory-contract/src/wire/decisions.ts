// Browser-safe: part of @internal/factory-contract, which Factory's server and UIs share.

export const FACTORY_DISPATCH_FAILURE_CODES = [
  'session_unavailable',
  'source_control_missing',
  'source_repository_missing',
  'source_repository_ambiguous',
  'unsupported_provider_item',
  'notification_delivery_failed',
  'run_terminal_event_missing',
  'run_incomplete',
  'skill_delivery_ambiguous',
  'run_overdue',
  'repository_git_missing',
  'repository_sandbox_unresponsive',
  'repository_egress_blocked',
  'repository_clone_failed',
  'repository_pull_failed',
  'repository_push_failed',
  'repository_commit_failed',
  'repository_cli_missing',
  'repository_pr_failed',
  'run_configuration_invalid',
  'run_credentials_unavailable',
  'run_user_unauthenticated',
  'factory_org_key_missing',
  'run_failed',
  'unknown',
] as const;

export type FactoryDispatchFailureCode = (typeof FACTORY_DISPATCH_FAILURE_CODES)[number];

/** `dismissed` is human rejection; `superseded` means newer Factory state made a proposal obsolete. */
export type FactoryDecisionStatus =
  | 'pending'
  | 'proposed'
  | 'dismissed'
  | 'superseded'
  | 'leased'
  | 'retry'
  | 'succeeded'
  | 'failed';

/** What a person can do to a queued effect from the board or the Rules page. */
export type FactoryDecisionAction = 'approve' | 'dismiss' | 'retry';

export interface FactoryDecisionSummary {
  id: string;
  evaluationId: string;
  workItemId: string | null;
  type: string;
  /** Session slot a proposed run fills, so the card can name what it starts. */
  role: string | null;
  /** Where a linked card is synced from; `null` for effects that are not `upsertLinkedWorkItem`. */
  source: 'github-issue' | 'github-pr' | 'gitlab-issue' | 'gitlab-pr' | 'linear-issue' | 'manual' | null;
  status: FactoryDecisionStatus;
  attempts: number;
  failureOccurrence: number;
  failureCode: FactoryDispatchFailureCode | null;
  canRetry: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface FactoryDecisionPage {
  decisions: FactoryDecisionSummary[];
  nextCursor?: string;
}

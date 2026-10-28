import { credentialTenantFailureReason } from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialTenantFailureReason } from '@mastra/code-sdk/agents/credential-resolver';
import type {
  FactoryDispatchFailureCode,
  StoredFactoryDispatchFailureCode,
} from '../storage/domains/work-items/base.js';

interface FactoryDispatchFailureMetadata {
  canRetry: boolean;
  manualRetryOnly?: true;
  label: string;
}

const FAILURE_METADATA = {
  session_unavailable: { canRetry: true, label: 'Factory session unavailable' },
  source_control_missing: { canRetry: true, label: 'Source-control connection unavailable' },
  source_repository_missing: { canRetry: true, label: 'Source repository unavailable' },
  source_repository_ambiguous: { canRetry: true, label: 'Choose a repository for this work item' },
  unsupported_provider_item: { canRetry: false, label: 'Unsupported provider work item' },
  notification_delivery_failed: { canRetry: true, label: 'Factory message delivery failed' },
  run_terminal_event_missing: { canRetry: false, label: 'Agent run terminal event was not observed' },
  skill_delivery_ambiguous: { canRetry: false, label: 'Factory skill delivery could not be confirmed' },
  run_overdue: { canRetry: false, label: 'Agent run is overdue' },
  repository_git_missing: { canRetry: false, label: 'Git is unavailable in the workspace' },
  repository_egress_blocked: { canRetry: false, label: 'Repository network access is blocked' },
  repository_clone_failed: { canRetry: true, label: 'Repository clone failed' },
  repository_pull_failed: { canRetry: true, label: 'Repository update failed' },
  repository_push_failed: { canRetry: true, label: 'Repository push failed' },
  repository_commit_failed: { canRetry: true, label: 'Repository commit failed' },
  repository_cli_missing: { canRetry: false, label: 'GitHub CLI is unavailable in the workspace' },
  repository_pr_failed: { canRetry: true, label: 'Pull request creation failed' },
  run_configuration_invalid: { canRetry: false, label: 'Run configuration rejected by provider' },
  run_credentials_unavailable: { canRetry: true, label: 'Model credentials unavailable for the run' },
  // The run's user names an organization id that is not a string; every retry reads the same user.
  run_user_organization_invalid: { canRetry: false, label: 'Run started with an unusable organization id' },
  // The run's request carries no user, so every retry fails the same way; a person has to start it.
  run_user_unauthenticated: { canRetry: false, label: 'Run started without an authenticated user' },
  // A rerun on its own lands on the same account and its limit; a person picks the remedy, then retries.
  run_provider_limited: { canRetry: true, manualRetryOnly: true, label: 'Provider rate limit or quota reached' },
  run_failed: { canRetry: true, label: 'Agent run ended in error' },
  unknown: { canRetry: true, label: 'Factory automation failed' },
  // Retired: no path writes these any more, stored rows still read through here.
  plan_awaiting_approval: { canRetry: false, label: 'Plan waiting for review' },
  run_awaiting_input: { canRetry: false, label: 'Agent is waiting for an answer' },
} satisfies Record<StoredFactoryDispatchFailureCode, FactoryDispatchFailureMetadata>;

export class FactoryDispatchError extends Error {
  constructor(
    readonly code: FactoryDispatchFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FactoryDispatchError';
  }
}

const CREDENTIAL_TENANT_FAILURE_CODES = {
  'missing-user-context': 'run_user_unauthenticated',
  'invalid-organization-id': 'run_user_organization_invalid',
  'no-policy-for-principal': 'run_credentials_unavailable',
} satisfies Record<CredentialTenantFailureReason, FactoryDispatchFailureCode>;

export function credentialTenantFailureCode(error: unknown): FactoryDispatchFailureCode | undefined {
  const reason = credentialTenantFailureReason(error);
  return reason && CREDENTIAL_TENANT_FAILURE_CODES[reason];
}

export function factoryDispatchFailureCode(error: unknown): FactoryDispatchFailureCode {
  if (error instanceof FactoryDispatchError) return error.code;
  return credentialTenantFailureCode(error) ?? 'unknown';
}

export function factoryDispatchFailureMetadata(
  code: StoredFactoryDispatchFailureCode | null,
): FactoryDispatchFailureMetadata {
  return code === null ? FAILURE_METADATA.unknown : FAILURE_METADATA[code];
}

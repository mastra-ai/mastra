import { credentialTenantFailureReason } from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialTenantFailureReason } from '@mastra/code-sdk/agents/credential-resolver';
import type {
  FactoryDispatchFailureCode,
  StoredFactoryDispatchFailureCode,
} from '../storage/domains/work-items/base.js';

type FactoryRetryPolicy = 'automatic' | 'manual' | 'never';

interface FactoryDispatchFailurePolicy {
  retry: FactoryRetryPolicy;
  label: string;
}

interface FactoryDispatchFailureMetadata extends FactoryDispatchFailurePolicy {
  canRetry: boolean;
}

const FAILURE_METADATA = {
  session_unavailable: { retry: 'automatic', label: 'Factory session unavailable' },
  source_control_missing: { retry: 'automatic', label: 'Source-control connection unavailable' },
  source_repository_missing: { retry: 'automatic', label: 'Source repository unavailable' },
  source_repository_ambiguous: { retry: 'automatic', label: 'Choose a repository for this work item' },
  unsupported_provider_item: { retry: 'never', label: 'Unsupported provider work item' },
  notification_delivery_failed: { retry: 'automatic', label: 'Factory message delivery failed' },
  run_terminal_event_missing: { retry: 'never', label: 'Agent run terminal event was not observed' },
  skill_delivery_ambiguous: { retry: 'never', label: 'Factory skill delivery could not be confirmed' },
  run_overdue: { retry: 'never', label: 'Agent run is overdue' },
  repository_git_missing: { retry: 'never', label: 'Git is unavailable in the workspace' },
  repository_egress_blocked: { retry: 'never', label: 'Repository network access is blocked' },
  repository_clone_failed: { retry: 'automatic', label: 'Repository clone failed' },
  repository_pull_failed: { retry: 'automatic', label: 'Repository update failed' },
  repository_push_failed: { retry: 'automatic', label: 'Repository push failed' },
  repository_commit_failed: { retry: 'automatic', label: 'Repository commit failed' },
  repository_cli_missing: { retry: 'never', label: 'GitHub CLI is unavailable in the workspace' },
  repository_pr_failed: { retry: 'automatic', label: 'Pull request creation failed' },
  run_configuration_invalid: { retry: 'never', label: 'Run configuration rejected by provider' },
  run_credentials_unavailable: { retry: 'automatic', label: 'Model credentials unavailable for the run' },
  // The run's user names an organization id that is not a string; every retry reads the same user.
  run_user_organization_invalid: { retry: 'never', label: 'Run started with an unusable organization id' },
  // The run's request carries no user, so every retry fails the same way; a person has to start it.
  run_user_unauthenticated: { retry: 'never', label: 'Run started without an authenticated user' },
  // A rerun on its own lands on the same account and its limit; a person picks the remedy, then retries.
  run_provider_limited: { retry: 'manual', label: 'Provider rate limit or quota reached' },
  run_failed: { retry: 'automatic', label: 'Agent run ended in error' },
  unknown: { retry: 'automatic', label: 'Factory automation failed' },
  // Retired: no path writes these any more, stored rows still read through here.
  plan_awaiting_approval: { retry: 'never', label: 'Plan waiting for review' },
  run_awaiting_input: { retry: 'never', label: 'Agent is waiting for an answer' },
} satisfies Record<StoredFactoryDispatchFailureCode, FactoryDispatchFailurePolicy>;

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
  const policy: FactoryDispatchFailurePolicy = FAILURE_METADATA[code ?? 'unknown'];
  return { ...policy, canRetry: policy.retry !== 'never' };
}

import type {
  FactoryDispatchFailureCode,
  StoredFactoryDispatchFailureCode,
} from '../storage/domains/work-items/base.js';

interface FactoryDispatchFailureMetadata {
  /** A person may press Retry. */
  canRetry: boolean;
  label: string;
}

// `manual`: a person retries once they fixed what the run tripped on; the dispatcher never redelivers it.
type RetryPolicy = boolean | 'manual';

const FAILURE_METADATA = {
  session_unavailable: { canRetry: true, label: 'Factory session unavailable' },
  source_control_missing: { canRetry: true, label: 'Source-control connection unavailable' },
  source_repository_missing: { canRetry: true, label: 'Source repository unavailable' },
  unsupported_provider_item: { canRetry: false, label: 'Unsupported provider work item' },
  notification_delivery_failed: { canRetry: true, label: 'Factory message delivery failed' },
  run_overdue: { canRetry: false, label: 'Agent run is overdue' },
  repository_git_missing: { canRetry: false, label: 'Git is unavailable in the workspace' },
  repository_egress_blocked: { canRetry: false, label: 'Repository network access is blocked' },
  repository_clone_failed: { canRetry: true, label: 'Repository clone failed' },
  repository_pull_failed: { canRetry: true, label: 'Repository update failed' },
  repository_push_failed: { canRetry: true, label: 'Repository push failed' },
  repository_commit_failed: { canRetry: true, label: 'Repository commit failed' },
  repository_cli_missing: { canRetry: false, label: 'GitHub CLI is unavailable in the workspace' },
  repository_pr_failed: { canRetry: true, label: 'Pull request creation failed' },
  run_configuration_invalid: { canRetry: 'manual', label: 'Run configuration rejected by provider' },
  unknown: { canRetry: true, label: 'Factory automation failed' },
  // Retired: no path writes these any more, stored rows still read through here.
  plan_awaiting_approval: { canRetry: false, label: 'Plan waiting for review' },
  run_awaiting_input: { canRetry: false, label: 'Agent is waiting for an answer' },
} satisfies Record<StoredFactoryDispatchFailureCode, { canRetry: RetryPolicy; label: string }>;

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

export function factoryDispatchFailureCode(error: unknown): FactoryDispatchFailureCode {
  return error instanceof FactoryDispatchError ? error.code : 'unknown';
}

export function factoryDispatchFailureMetadata(
  code: StoredFactoryDispatchFailureCode | null,
): FactoryDispatchFailureMetadata {
  const { canRetry, label } = code === null ? FAILURE_METADATA.unknown : FAILURE_METADATA[code];
  return { canRetry: canRetry !== false, label };
}

export function dispatcherRedelivers(code: FactoryDispatchFailureCode): boolean {
  return FAILURE_METADATA[code].canRetry === true;
}

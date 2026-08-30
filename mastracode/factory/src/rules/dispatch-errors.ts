import type { FactoryDispatchFailureCode } from '../storage/domains/work-items/base.js';

interface FactoryDispatchFailureMetadata {
  /**
   * Whether running this decision again could ever succeed. One question, two
   * readers: the dispatcher stops rescheduling when it is false, and the card
   * drops its Retry affordance for the same reason.
   */
  retryable: boolean;
  label: string;
}

const FAILURE_METADATA = {
  session_unavailable: { retryable: true, label: 'Factory session unavailable' },
  source_control_missing: { retryable: true, label: 'Source-control connection unavailable' },
  source_repository_missing: { retryable: true, label: 'Source repository unavailable' },
  unsupported_provider_item: { retryable: false, label: 'Unsupported provider work item' },
  notification_delivery_failed: { retryable: true, label: 'Factory message delivery failed' },
  plan_awaiting_approval: { retryable: false, label: 'Plan waiting for review' },
  repository_git_missing: { retryable: false, label: 'Git is unavailable in the workspace' },
  repository_egress_blocked: { retryable: false, label: 'Repository network access is blocked' },
  repository_clone_failed: { retryable: true, label: 'Repository clone failed' },
  repository_pull_failed: { retryable: true, label: 'Repository update failed' },
  repository_push_failed: { retryable: true, label: 'Repository push failed' },
  repository_commit_failed: { retryable: true, label: 'Repository commit failed' },
  repository_cli_missing: { retryable: false, label: 'GitHub CLI is unavailable in the workspace' },
  repository_pr_failed: { retryable: true, label: 'Pull request creation failed' },
  unknown: { retryable: true, label: 'Factory automation failed' },
} satisfies Record<FactoryDispatchFailureCode, FactoryDispatchFailureMetadata>;

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
  code: FactoryDispatchFailureCode | null,
): FactoryDispatchFailureMetadata {
  return code === null ? FAILURE_METADATA.unknown : FAILURE_METADATA[code];
}

import type { FactoryDispatchFailureCode } from '../storage/domains/work-items/base.js';

interface FactoryDispatchFailureMetadata {
  canRetry: boolean;
  label: string;
}

const FAILURE_METADATA = {
  session_unavailable: { canRetry: true, label: 'Factory session unavailable' },
  source_control_missing: { canRetry: true, label: 'Source-control connection unavailable' },
  source_repository_missing: { canRetry: true, label: 'Source repository unavailable' },
  unsupported_provider_item: { canRetry: false, label: 'Unsupported provider work item' },
  notification_delivery_failed: { canRetry: true, label: 'Factory message delivery failed' },
  plan_awaiting_approval: { canRetry: false, label: 'Plan waiting for review' },
  run_awaiting_input: { canRetry: false, label: 'Agent is waiting for an answer' },
  repository_git_missing: { canRetry: false, label: 'Git is unavailable in the workspace' },
  repository_egress_blocked: { canRetry: false, label: 'Repository network access is blocked' },
  repository_clone_failed: { canRetry: true, label: 'Repository clone failed' },
  repository_pull_failed: { canRetry: true, label: 'Repository update failed' },
  repository_push_failed: { canRetry: true, label: 'Repository push failed' },
  repository_commit_failed: { canRetry: true, label: 'Repository commit failed' },
  repository_cli_missing: { canRetry: false, label: 'GitHub CLI is unavailable in the workspace' },
  repository_pr_failed: { canRetry: true, label: 'Pull request creation failed' },
  unknown: { canRetry: true, label: 'Factory automation failed' },
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

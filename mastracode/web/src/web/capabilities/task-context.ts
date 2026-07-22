import type { GetIntakeIssueInput } from './intake.js';
import type { PullRequestRef } from './version-control.js';

export const TASK_CONTEXT_LIMITS = {
  identifier: 128,
  title: 512,
  description: 64_000,
  state: 512,
  url: 2_048,
  listItems: 50,
  listItem: 100,
} as const;

export interface TaskContextDetail {
  identifier: string;
  title: string;
  description: string | null;
  state: string | null;
  labels: string[];
  assignees: string[];
  url: string | null;
}

export interface TaskContext {
  getIssue?(input: GetIntakeIssueInput): Promise<TaskContextDetail | null>;
  getPullRequest?(input: PullRequestRef): Promise<TaskContextDetail | null>;
}

function boundedUrl(value: string | null): string | null {
  if (!value || value.length > TASK_CONTEXT_LIMITS.url) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function boundedTaskContextDetail(detail: TaskContextDetail): TaskContextDetail {
  return {
    identifier: detail.identifier.slice(0, TASK_CONTEXT_LIMITS.identifier),
    title: detail.title.slice(0, TASK_CONTEXT_LIMITS.title),
    description: detail.description ? detail.description.slice(0, TASK_CONTEXT_LIMITS.description) : null,
    state: detail.state ? detail.state.slice(0, TASK_CONTEXT_LIMITS.state) : null,
    labels: detail.labels
      .slice(0, TASK_CONTEXT_LIMITS.listItems)
      .map(label => label.slice(0, TASK_CONTEXT_LIMITS.listItem)),
    assignees: detail.assignees
      .slice(0, TASK_CONTEXT_LIMITS.listItems)
      .map(assignee => assignee.slice(0, TASK_CONTEXT_LIMITS.listItem)),
    url: boundedUrl(detail.url),
  };
}

export class TaskContextProviderRequestError extends Error {
  readonly code = 'TASK_CONTEXT_PROVIDER_REQUEST_FAILED';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TaskContextProviderRequestError';
  }
}

export function isTaskContextProviderRequestError(error: unknown): error is TaskContextProviderRequestError {
  return (
    error instanceof TaskContextProviderRequestError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'TASK_CONTEXT_PROVIDER_REQUEST_FAILED' &&
      'name' in error &&
      typeof error.name === 'string' &&
      'message' in error &&
      typeof error.message === 'string')
  );
}

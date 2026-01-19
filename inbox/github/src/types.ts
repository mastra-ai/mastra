import type { Octokit } from '@octokit/rest';
import type { Task, CreateTaskInput, RetryConfig } from '@mastra/core';

/**
 * GitHub issue data as received from the API or webhook.
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
    avatar_url?: string;
  } | null;
  labels: Array<{
    name?: string;
    color?: string;
  }>;
  assignees?: Array<{
    login: string;
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

/**
 * Payload structure for GitHub issue tasks.
 */
export interface GitHubIssuePayload {
  issueNumber: number;
  title: string;
  body: string | null;
  author: string;
  labels: string[];
  assignees: string[];
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filter options for which issues to sync.
 */
export interface GitHubIssueFilter {
  /**
   * Only sync issues with these labels.
   */
  labels?: string[];

  /**
   * Only sync issues in this state.
   * @default 'open'
   */
  state?: 'open' | 'closed' | 'all';

  /**
   * Only sync issues assigned to this user.
   */
  assignee?: string;

  /**
   * Only sync issues created by this user.
   */
  creator?: string;

  /**
   * Only sync issues updated after this date.
   */
  since?: Date;

  /**
   * Custom filter function for additional filtering.
   */
  filter?: (issue: GitHubIssue) => boolean;
}

/**
 * Function to convert a GitHub issue to task input.
 */
export type IssueToTaskFn = (issue: GitHubIssue) => CreateTaskInput<GitHubIssuePayload> | null;

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /**
   * Number of tasks created or updated.
   */
  synced: number;

  /**
   * Number of tasks cancelled (issue closed).
   */
  cancelled: number;

  /**
   * Number of errors encountered.
   */
  errors: number;
}

/**
 * Options for sync operation.
 */
export interface SyncOptions {
  /**
   * Only sync issues updated after this date.
   */
  since?: Date;

  /**
   * Maximum number of issues to sync.
   */
  limit?: number;
}

/**
 * Configuration for GitHubInbox.
 */
export interface GitHubInboxConfig {
  /**
   * Inbox ID. Defaults to 'github-{owner}-{repo}'.
   */
  id?: string;

  /**
   * GitHub repository owner (user or organization).
   */
  owner: string;

  /**
   * GitHub repository name.
   */
  repo: string;

  /**
   * Octokit instance for API calls.
   * Required for sync() and onComplete actions.
   */
  octokit: Octokit;

  /**
   * Webhook secret for verifying webhook signatures.
   * Required for handleWebhook().
   */
  webhookSecret?: string;

  /**
   * Filter which issues to sync.
   */
  filter?: GitHubIssueFilter;

  /**
   * Custom function to convert issues to tasks.
   * Return null to skip an issue.
   */
  issueToTask?: IssueToTaskFn;

  /**
   * How long a task can be claimed before it's released.
   * @default 1800000 (30 minutes)
   */
  claimTimeout?: number;

  /**
   * Retry configuration for failed tasks.
   */
  retry?: RetryConfig;

  /**
   * Called when a task completes successfully.
   * Use this to comment on the issue, close it, etc.
   */
  onComplete?: (task: Task<GitHubIssuePayload>, result: unknown) => Promise<void>;

  /**
   * Called when a task fails.
   * Use this to comment on the issue, add labels, etc.
   */
  onError?: (task: Task<GitHubIssuePayload>, error: Error) => Promise<void>;
}

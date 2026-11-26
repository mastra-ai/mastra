/**
 * GitLab webhook payload types, written by hand from GitLab's webhook docs
 * (https://docs.gitlab.com/user/project/integrations/webhook_events/):
 * GitLab publishes no machine-readable schema for its webhooks.
 *
 * Fields in the docs' tables use the documented types. A field is `| null`
 * where the docs say so or an example shows `null`, and optional where the
 * docs call it conditional or EE-only, or it was added in a recent GitLab
 * version that self-managed instances may not run yet.
 */

/** GitLab webhook payloads by Connect event type: the `X-Gitlab-Event` header. */
export interface GitlabWebhookPayloads {
  'Issue Hook': GitlabIssueHook;
  'Merge Request Hook': GitlabMergeRequestHook;
  'Note Hook': GitlabNoteHook;
  'Push Hook': GitlabPushHook;
}

/** The user who triggered an event. */
export interface GitlabUser {
  id: number;
  name: string;
  username: string;
  avatar_url: string;
  email: string;
}

/** An assignee or reviewer. */
export interface GitlabUserSummary {
  id?: number;
  name: string;
  username: string;
  avatar_url: string;
  email?: string;
}

/** A reviewer, with their review state. */
export interface GitlabReviewer extends GitlabUserSummary {
  state?: string;
  re_requested?: boolean;
}

export interface GitlabProject {
  id: number;
  name: string;
  description: string | null;
  web_url: string;
  avatar_url: string | null;
  git_ssh_url: string;
  git_http_url: string;
  namespace: string;
  visibility_level: number;
  path_with_namespace: string;
  default_branch: string;
  ci_config_path?: string | null;
  /** @deprecated Use `web_url`. */
  homepage?: string;
  /** @deprecated Use `git_ssh_url` or `git_http_url`. */
  url?: string;
  /** @deprecated Use `git_ssh_url`. */
  ssh_url?: string;
  /** @deprecated Use `git_http_url`. */
  http_url?: string;
}

/** The payload's deprecated `repository`: the project's repository details. */
export interface GitlabRepository {
  name: string;
  url: string;
  description: string | null;
  homepage: string;
  git_http_url?: string;
  git_ssh_url?: string;
  visibility_level?: number;
}

export interface GitlabLabel {
  id: number;
  title: string;
  color: string;
  project_id: number | null;
  created_at: string;
  updated_at: string;
  template: boolean;
  description: string | null;
  /** `ProjectLabel` or `GroupLabel`. */
  type: string;
  group_id: number | null;
}

export interface GitlabCommitAuthor {
  name: string;
  email: string;
}

/** A changed attribute: its value before and after the event. */
export interface GitlabChange {
  previous: unknown;
  current: unknown;
}

/** The attributes the event changed, by attribute name. */
export type GitlabChanges = Record<string, GitlabChange | undefined>;

// ---------------------------------------------------------------------------
// Push Hook

export interface GitlabPushCommit {
  id: string;
  message: string;
  title: string;
  timestamp: string;
  url: string;
  author: GitlabCommitAuthor;
  added: string[];
  modified: string[];
  removed: string[];
}

/** A push to a branch. Tag pushes are `Tag Push Hook`. */
export interface GitlabPushHook {
  object_kind: 'push';
  event_name: 'push';
  before: string;
  after: string;
  ref: string;
  ref_protected: boolean;
  /** Null when the push deletes the branch. */
  checkout_sha: string | null;
  /** Null when GitLab omits the message, as for some generated pushes. */
  message: string | null;
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_avatar: string;
  project_id: number;
  project: GitlabProject;
  /** The newest 20 commits at most; `total_commits_count` counts them all. */
  commits: GitlabPushCommit[];
  total_commits_count: number;
  push_options: Record<string, unknown>;
  /** @deprecated Use `project`. */
  repository: GitlabRepository;
}

// ---------------------------------------------------------------------------
// Issue Hook

export interface GitlabIssueAttributes {
  id: number;
  iid: number;
  title: string;
  description: string;
  /** The work item type, such as `Issue`, `Incident` or `Task`. */
  type: string;
  url: string;
  state: 'opened' | 'closed';
  state_id: number;
  action: 'open' | 'close' | 'reopen' | 'update';
  assignee_ids: number[];
  /** @deprecated The first assignee only. Use `assignee_ids`. */
  assignee_id: number | null;
  author_id: number;
  project_id: number;
  created_at: string;
  updated_at: string;
  updated_by_id: number | null;
  last_edited_at: string | null;
  last_edited_by_id: number | null;
  relative_position: number | null;
  milestone_id: number | null;
  confidential: boolean;
  discussion_locked: boolean | null;
  due_date: string | null;
  start_date?: string | null;
  moved_to_id: number | null;
  duplicated_to_id: number | null;
  time_estimate: number;
  total_time_spent: number;
  time_change: number;
  human_total_time_spent: string | null;
  human_time_estimate: string | null;
  human_time_change: string | null;
  weight: number | null;
  health_status?: string | null;
  severity?: string;
  /** Only for issue types that support escalations, such as incidents. */
  escalation_status?: string;
  /** Only for issue types that support escalations, such as incidents. */
  escalation_policy?: { id: number; name: string };
  labels: GitlabLabel[];
}

/**
 * An issue or other work item was opened, closed, reopened or updated.
 * `object_kind` is `issue` for issues and Service Desk issues, and
 * `work_item` for other work items.
 */
export interface GitlabIssueHook {
  object_kind: 'issue' | 'work_item';
  event_type: string;
  user: GitlabUser;
  project: GitlabProject;
  object_attributes: GitlabIssueAttributes;
  /** @deprecated Use `project`. */
  repository: GitlabRepository;
  assignees?: GitlabUserSummary[];
  /** @deprecated The first assignee only. Use `assignees`. */
  assignee?: GitlabUserSummary;
  labels: GitlabLabel[];
  changes: GitlabChanges;
}

// ---------------------------------------------------------------------------
// Merge Request Hook

export interface GitlabLastCommit {
  id: string;
  message: string;
  title?: string;
  timestamp: string;
  url: string;
  author: GitlabCommitAuthor;
}

export interface GitlabApprovalRule {
  id: number;
  name: string;
  approvals_required: number;
  rule_type: string;
  merge_request_id: number;
  project_id: number;
  [field: string]: unknown;
}

/** A merge request's current state. */
export interface GitlabMergeRequestAttributes {
  /** The action that triggered the webhook. */
  action: 'open' | 'close' | 'reopen' | 'update' | 'approval' | 'approved' | 'unapproval' | 'unapproved' | 'merge';
  /** When the action occurred (GitLab 18.10). */
  actioned_at?: string;
  id: number;
  iid: number;
  title: string;
  description: string;
  url: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  /** `1` opened, `2` closed, `3` merged, `4` locked. */
  state_id: number;
  draft: boolean;
  /** @deprecated Use `draft`. */
  work_in_progress?: boolean;
  author_id: number;
  assignee_ids: number[];
  /** @deprecated Use `assignee_ids`. */
  assignee_id?: number | null;
  reviewer_ids: number[];
  source_branch: string;
  source_project_id: number;
  source: GitlabProject;
  target_branch: string;
  target_project_id: number;
  target: GitlabProject;
  /** Whether the target branch is protected (GitLab 19.2). */
  target_branch_protected?: boolean;
  last_commit: GitlabLastCommit;
  labels: GitlabLabel[];
  milestone_id: number | null;
  head_pipeline_id: number | null;
  merge_status: string;
  detailed_merge_status: string;
  merge_commit_sha: string | null;
  /** When the merge request was merged (GitLab 19.1). */
  merged_at?: string | null;
  merge_error: string | null;
  merge_params: Record<string, unknown>;
  merge_user_id: number | null;
  /** Whether auto-merge is enabled. */
  merge_when_pipeline_succeeds: boolean;
  /** Only when the merge request was merged with squash. */
  squash_commit_sha?: string | null;
  /** Only on `update`, when there are code changes. */
  oldrev?: string;
  blocking_discussions_resolved: boolean;
  first_contribution: boolean;
  prepared_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by_id: number | null;
  last_edited_at: string | null;
  last_edited_by_id: number | null;
  time_estimate: number;
  total_time_spent: number;
  time_change: number;
  human_time_estimate: string | null;
  human_total_time_spent: string | null;
  human_time_change: string | null;
  system: boolean;
  /** Only when `system` is `true`. */
  system_action?: string;
  /** Approval rules (EE only). */
  approval_rules?: GitlabApprovalRule[];
  /** Lines added (EE only, GitLab 19.6). `null` until merged. */
  added_lines?: number | null;
  /** Lines removed (EE only, GitLab 19.6). `null` until merged. */
  deleted_lines?: number | null;
  /** `added_lines` plus `deleted_lines` (EE only, GitLab 19.6). `null` until merged. */
  changed_lines?: number | null;
  /** Files changed in the latest diff (GitLab 19.6). */
  file_count?: number;
}

/** A merge request was opened, updated, approved, merged or closed. */
export interface GitlabMergeRequestHook {
  object_kind: 'merge_request';
  event_type: 'merge_request';
  user: GitlabUser;
  project: GitlabProject;
  object_attributes: GitlabMergeRequestAttributes;
  changes: GitlabChanges;
  assignees?: GitlabUserSummary[];
  reviewers?: GitlabReviewer[];
  labels: GitlabLabel[];
  /** @deprecated Use `project`. */
  repository: GitlabRepository;
}

// ---------------------------------------------------------------------------
// Note Hook

export interface GitlabNoteAttributes {
  id: number;
  note: string;
  noteable_type: 'Commit' | 'MergeRequest' | 'Issue' | 'Snippet';
  noteable_id: number | null;
  action: 'create' | 'update';
  internal?: boolean;
  author_id: number;
  project_id: number;
  created_at: string;
  updated_at: string;
  attachment: string | null;
  line_code: string | null;
  commit_id: string;
  system: boolean;
  st_diff: Record<string, unknown> | null;
  url: string;
}

export interface GitlabNoteCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author: GitlabCommitAuthor;
}

/** The commented issue, as the Note Hook sends it. */
export interface GitlabNoteIssue {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: string;
  assignee_ids: number[];
  /** @deprecated The first assignee only. Use `assignee_ids`. */
  assignee_id: number | null;
  author_id: number;
  project_id: number;
  milestone_id: number | null;
  created_at: string;
  updated_at: string;
  labels: GitlabLabel[];
  [field: string]: unknown;
}

export interface GitlabNoteSnippet {
  id: number;
  title: string;
  description: string;
  content: string;
  author_id: number;
  project_id: number;
  created_at: string;
  updated_at: string;
  file_name: string;
  type: string;
  visibility_level: number;
  url: string;
}

/**
 * A comment was made or edited on a commit, merge request, issue or snippet.
 * The commented object is under the key `noteable_type` names.
 */
export interface GitlabNoteHook {
  object_kind: 'note';
  /** `note`, or `confidential_note` on confidential issues. */
  event_type: 'note' | 'confidential_note';
  user: GitlabUser;
  project_id: number;
  project: GitlabProject;
  /** @deprecated Use `project`. */
  repository: GitlabRepository;
  object_attributes: GitlabNoteAttributes;
  commit?: GitlabNoteCommit;
  /** The merge request's attributes, without `action`, `actioned_at`, `oldrev` and `system_action`. */
  merge_request?: Omit<GitlabMergeRequestAttributes, 'action' | 'actioned_at' | 'oldrev' | 'system_action'>;
  issue?: GitlabNoteIssue;
  snippet?: GitlabNoteSnippet;
}

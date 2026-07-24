import type { IntegrationConnection } from './connection.js';

export interface IntakeSource {
  id: string;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface IntakeItem {
  source: {
    type: string;
    externalId: string;
    url?: string;
  };
  sourceId: string;
  title: string;
  status?: string;
  labels?: string[];
  assignee?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface IntakeItemPage {
  items: IntakeItem[];
  nextCursor: string | null;
}

export interface ListIntakeSourcesInput {
  orgId: string;
  userId: string;
}

export interface ListIntakeItemsInput extends ListIntakeSourcesInput {
  sourceIds: string[];
  cursor?: string;
}

/** Provider-neutral issue returned by every Intake integration. */
export interface IntakeIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  author: string | null;
  state: string | null;
  stateType: string | null;
  priority: string | null;
  assignee: string | null;
  source: string | null;
  labels: string[];
  commentCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeIssueComment {
  author: string | null;
  body: string;
  createdAt: string;
}

export interface IntakeIssueDetail extends IntakeIssue {
  description: string | null;
  comments: IntakeIssueComment[];
}

export interface IntakeIssuePage {
  issues: IntakeIssue[];
  nextCursor: string | null;
}

export interface ListIntakeIssuesInput {
  connection: IntegrationConnection;
  /** Provider-defined source ids: repositories for GitHub, projects for Linear. */
  sourceIds: string[];
  /** Provider label names used to filter the issue listing. */
  labels?: string[];
  cursor?: string;
}

export interface GetIntakeIssueInput {
  connection: IntegrationConnection;
  sourceId?: string;
  issueId: string;
}

export interface CreateIntakeCommentInput extends GetIntakeIssueInput {
  body: string;
  /** End user the comment should be attributed to, when the provider supports acting on a user's behalf. */
  actingUserId?: string;
}

export interface CreatedIntakeComment {
  id: string;
  url: string;
}

/**
 * Provider-neutral target state for `Intake.updateIssue`.
 *
 * `byType` uses the workflow-state family so callers don't have to know per-team
 * state names; `byName` is escape hatch for teams that need a specific state.
 * Adapters that don't support custom states (GitHub) ignore `byName` with a
 * warn log.
 */
export type IntakeIssueTargetState =
  { kind: 'byType'; stateType: 'unstarted' | 'started' | 'completed' | 'canceled' } | { kind: 'byName'; name: string };

export interface UpdateIntakeIssueInput extends GetIntakeIssueInput {
  state: IntakeIssueTargetState;
  /** End user the state change should be attributed to, when the provider supports acting on a user's behalf. */
  actingUserId?: string;
}

export interface ResolveIntakeDispatchInput {
  orgId: string;
  externalSource: { type: string; externalId: string };
}

export interface ResolvedIntakeDispatch {
  connection: IntegrationConnection;
  sourceId?: string;
  issueId: string;
}

/** Fixed issue-oriented contract implemented by GitHub, Linear, and future sources. */
export interface Intake {
  /**
   * Resolve the connection and provider-specific identifiers needed to call
   * this capability from a background dispatch context.
   */
  resolveIntakeDispatch?(input: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null>;
  listSources(input: ListIntakeSourcesInput): Promise<IntakeSource[]>;
  listItems(input: ListIntakeItemsInput): Promise<IntakeItemPage>;
  listIssues(input: ListIntakeIssuesInput): Promise<IntakeIssuePage>;
  getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null>;
  createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null>;
  /**
   * Move an issue to a target state. Returns the refreshed `IntakeIssue` on
   * success, or `null` when the target is not applicable (e.g., a GitHub PR,
   * or no matching workflow state). Adapters MUST NOT throw for policy misses
   * — only for infrastructure errors (network, auth). This distinction lets
   * the executor idempotency guard treat `null` as "done, nothing to do".
   */
  updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null>;
}

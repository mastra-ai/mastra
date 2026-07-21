import type { IntegrationConnection } from './connection.js';

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
}

export interface CreatedIntakeComment {
  id: string;
  url: string;
}

/** Fixed issue-oriented contract implemented by GitHub, Linear, and future sources. */
export interface Intake {
  listIssues(input: ListIntakeIssuesInput): Promise<IntakeIssuePage>;
  getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null>;
  createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null>;
}

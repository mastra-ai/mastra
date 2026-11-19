import type {
  GithubActor,
  GithubComment,
  GithubIssue,
  GithubPullRequest,
  GithubReview,
  GithubReviewComment,
  GithubReviewers,
} from './transport.js';

/**
 * Adapters from GitHub's REST responses to the platform's camelCase shapes,
 * each mirroring the platform's own normalizer (`github-resources.ts`), so the
 * Connect transport answers exactly what the legacy routes answer.
 */

type RawActor = { login?: string; avatar_url?: string; html_url?: string } | null | undefined;

export function toActor(raw: RawActor): GithubActor {
  if (!raw?.login) return null;
  return { login: raw.login, avatarUrl: raw.avatar_url ?? null, htmlUrl: raw.html_url ?? null };
}

export interface RawIssue {
  number: number;
  state: string;
  title: string;
  body?: string | null;
  html_url: string;
  labels?: Array<string | { name?: string }>;
  assignees?: Array<{ login: string }> | null;
  comments?: number;
  user?: RawActor;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

export function toIssue(raw: RawIssue): GithubIssue {
  return {
    number: raw.number,
    state: raw.state === 'open' ? 'open' : 'closed',
    title: raw.title,
    body: raw.body ?? null,
    htmlUrl: raw.html_url,
    labels: (raw.labels ?? [])
      .map(label => (typeof label === 'string' ? label : label.name))
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
    assignees: (raw.assignees ?? []).map(assignee => assignee.login),
    commentCount: raw.comments ?? 0,
    user: toActor(raw.user),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/** GitHub's issue listing also returns pull requests; the platform drops them. */
export function isPullRequestIssue(raw: RawIssue): boolean {
  return raw.pull_request !== undefined && raw.pull_request !== null;
}

export interface RawPullRequest {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  html_url: string;
  merged?: boolean;
  merged_at?: string | null;
  mergeable?: boolean | null;
  draft?: boolean;
  head: { ref: string; sha: string };
  base: { ref: string; repo: { id: number; full_name: string } };
  user?: RawActor;
  assignees?: Array<{ login?: string } | null> | null;
  requested_reviewers?: Array<{ login?: string } | null> | null;
  created_at: string;
  updated_at: string;
}

export function toPullRequest(raw: RawPullRequest): GithubPullRequest {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body?.trim() ? raw.body : null,
    state: raw.state === 'closed' ? 'closed' : 'open',
    htmlUrl: raw.html_url,
    merged: raw.merged ?? Boolean(raw.merged_at),
    mergeable: typeof raw.mergeable === 'boolean' ? raw.mergeable : null,
    draft: raw.draft ?? false,
    head: { ref: raw.head.ref, sha: raw.head.sha },
    base: { ref: raw.base.ref, repo: { id: raw.base.repo.id, fullName: raw.base.repo.full_name } },
    user: toActor(raw.user),
    assignees: (raw.assignees ?? []).flatMap(assignee => (assignee?.login ? [assignee.login] : [])),
    requestedReviewers: (raw.requested_reviewers ?? []).flatMap(reviewer => (reviewer?.login ? [reviewer.login] : [])),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export interface RawComment {
  id: number;
  body?: string | null;
  html_url: string;
  user?: RawActor;
  created_at: string;
  updated_at: string;
}

export function toComment(raw: RawComment): GithubComment {
  return {
    id: raw.id,
    body: raw.body ?? '',
    htmlUrl: raw.html_url,
    user: toActor(raw.user),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export interface RawReviewComment extends RawComment {
  path: string;
  line?: number | null;
  side?: string | null;
  commit_id: string;
  in_reply_to_id?: number | null;
}

export function toReviewComment(raw: RawReviewComment): GithubReviewComment {
  return {
    ...toComment(raw),
    path: raw.path,
    line: raw.line ?? null,
    side: raw.side === 'LEFT' || raw.side === 'RIGHT' ? raw.side : null,
    commitId: raw.commit_id,
    replyToId: raw.in_reply_to_id ?? null,
  };
}

export interface RawReview {
  id: number;
  html_url?: string | null;
  body?: string | null;
  state: string;
  commit_id?: string | null;
  submitted_at?: string | null;
  user?: RawActor;
}

const REVIEW_STATES = new Set(['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

export function toReview(raw: RawReview): GithubReview {
  const state = raw.state.toUpperCase();
  return {
    id: raw.id,
    htmlUrl: raw.html_url ?? null,
    body: raw.body?.trim() ? raw.body : null,
    state: REVIEW_STATES.has(state) ? (state as GithubReview['state']) : 'PENDING',
    commitId: raw.commit_id ?? null,
    submittedAt: raw.submitted_at ?? null,
    user: toActor(raw.user),
  };
}

export interface RawReviewers {
  users?: Array<{ login: string }> | null;
  teams?: Array<{ slug: string }> | null;
  requested_reviewers?: Array<{ login: string }> | null;
  requested_teams?: Array<{ slug: string }> | null;
}

export function toReviewers(raw: RawReviewers): GithubReviewers {
  return {
    users: (raw.users ?? raw.requested_reviewers ?? []).map(user => user.login),
    teams: (raw.teams ?? raw.requested_teams ?? []).map(team => team.slug),
  };
}

/** The platform prepends this to an installation write made for a person. */
export function withAttribution(body: string | undefined, attribution: string | undefined): string | undefined {
  if (!attribution) return body;
  const header = `> Opened by ${attribution}`;
  return body && body.length > 0 ? `${header}\n\n${body}` : header;
}

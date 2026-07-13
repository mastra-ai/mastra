/**
 * Browser-side helpers for the Factory pages (Intake / Review).
 *
 * Reads a GitHub project's open issues and open (non-draft) pull requests
 * through the server's `/web/github/projects/:id/*` routes, which are behind
 * the WorkOS auth gate and scoped to the caller's organization. Tokens never
 * reach the browser — the server talks to GitHub with its installation token.
 */

export interface GithubIssue {
  number: number;
  title: string;
  url: string;
  author: string | null;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  url: string;
  author: string | null;
  baseBranch: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface GithubIssuePage {
  issues: GithubIssue[];
  /** Next 1-based page to request, or `null` on the last page. */
  nextPage: number | null;
}

export interface GithubPullRequestPage {
  pullRequests: GithubPullRequest[];
  nextPage: number | null;
}

/** GET helper for the read-only per-project GitHub endpoints. */
async function getProjectResource<T>(
  baseUrl: string,
  githubProjectId: string,
  resource: string,
  page: number,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const search = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, value);
  }
  const url = `${baseUrl}/web/github/projects/${encodeURIComponent(githubProjectId)}/${resource}?${search}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** List one page of a project's open GitHub issues (PRs excluded server-side). */
export async function listProjectIssues(
  baseUrl: string,
  githubProjectId: string,
  page: number,
  label?: string,
): Promise<GithubIssuePage> {
  return getProjectResource<GithubIssuePage>(baseUrl, githubProjectId, 'issues', page, { label });
}

export interface StartIssueTriageResult {
  ok: true;
}

/** Start classification-only issue triage through the same seam used by GitHub webhooks. */
export async function startProjectIssueTriage(
  baseUrl: string,
  githubProjectId: string,
  issue: GithubIssue,
): Promise<StartIssueTriageResult> {
  const res = await fetch(
    `${baseUrl}/web/github/projects/${encodeURIComponent(githubProjectId)}/issues/${issue.number}/triage`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: issue.title, url: issue.url, labels: issue.labels }),
    },
  );
  let body: { error?: string; message?: string; ok?: unknown } | undefined;
  try {
    body = (await res.json()) as { error?: string; message?: string; ok?: unknown };
  } catch {
    if (res.ok) throw new Error('Invalid triage response');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (body?.message) message = body.message;
    else if (body?.error) message = body.error;
    throw new Error(message);
  }
  if (body?.ok !== true) {
    throw new Error('Invalid triage response');
  }
  return { ok: true };
}

/** List one page of a project's open pull requests (drafts excluded server-side). */
export async function listProjectPullRequests(
  baseUrl: string,
  githubProjectId: string,
  page: number,
): Promise<GithubPullRequestPage> {
  return getProjectResource<GithubPullRequestPage>(baseUrl, githubProjectId, 'prs', page);
}

/**
 * Browser-side helpers for the Factory pages (Intake / Review).
 *
 * Reads one issue or pull request of a linked repository through the server's
 * `/web/github/projects/:projectRepositoryId/*` routes, which are behind the
 * WorkOS auth gate and scoped to the caller's organization. Tokens never
 * reach the browser — the server talks to GitHub with its installation token.
 */

export interface GithubIssue {
  /** GitHub repository id; numbers repeat across a project's repositories. */
  repositoryId?: number;
  number: number;
  title: string;
  url: string;
  author: string | null;
  assignee?: string | null;
  assignees?: string[];
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
}

export interface GithubPullRequest {
  /** GitHub repository id; numbers repeat across a project's repositories. */
  repositoryId?: number;
  number: number;
  title: string;
  url: string;
  author: string | null;
  assignees?: string[];
  requestedReviewers?: string[];
  labels?: string[];
  baseBranch: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface GithubIssueDetail extends GithubIssue {
  description: string | null;
}

export interface GithubPullRequestDetail extends GithubPullRequest {
  description: string | null;
}

/** GET helper for the read-only per-repository GitHub endpoints. */
async function getRepositoryResource<T>(
  baseUrl: string,
  githubProjectId: string,
  resource: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, value);
  }
  const query = search.size === 0 ? '' : `?${search}`;
  const url = `${baseUrl}/web/github/projects/${encodeURIComponent(githubProjectId)}/${resource}${query}`;
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

export async function getRepositoryIssue(
  baseUrl: string,
  githubProjectId: string,
  number: number,
): Promise<GithubIssueDetail> {
  return getRepositoryResource<GithubIssueDetail>(baseUrl, githubProjectId, `issues/${number}`);
}

export async function getRepositoryPullRequest(
  baseUrl: string,
  githubProjectId: string,
  number: number,
): Promise<GithubPullRequestDetail> {
  return getRepositoryResource<GithubPullRequestDetail>(baseUrl, githubProjectId, `prs/${number}`);
}

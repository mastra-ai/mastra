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

/** GET helper for the read-only per-project GitHub endpoints. */
async function getProjectResource<T>(baseUrl: string, githubProjectId: string, resource: string): Promise<T> {
  const res = await fetch(`${baseUrl}/web/github/projects/${encodeURIComponent(githubProjectId)}/${resource}`, {
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

/** List a project's open GitHub issues (pull requests excluded server-side). */
export async function listProjectIssues(baseUrl: string, githubProjectId: string): Promise<GithubIssue[]> {
  const body = await getProjectResource<{ issues: GithubIssue[] }>(baseUrl, githubProjectId, 'issues');
  return body.issues;
}

/** List a project's open pull requests (drafts excluded server-side). */
export async function listProjectPullRequests(baseUrl: string, githubProjectId: string): Promise<GithubPullRequest[]> {
  const body = await getProjectResource<{ pullRequests: GithubPullRequest[] }>(baseUrl, githubProjectId, 'prs');
  return body.pullRequests;
}

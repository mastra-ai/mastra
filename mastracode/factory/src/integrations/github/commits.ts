/**
 * Read with the installation token that already clones and pushes, not through
 * `getInstallationOctokit`: the Platform deployment answers that with a
 * pull-request-only stub, so `repos.*` is undefined there at runtime while the
 * cast keeps the compiler quiet.
 */

import type { VersionControl } from '../../capabilities/version-control.js';

const GITHUB_API = 'https://api.github.com';

export interface RepositoryCommit {
  sha: string;
  message: string;
  author: string | null;
  avatarUrl: string | null;
  committedAt: string | null;
  url: string;
}

interface GithubCommitResponse {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name?: string; date?: string } | null };
  author: { login: string; avatar_url: string } | null;
}

export async function listRepositoryCommits(
  github: { versionControl: Pick<VersionControl, 'getRepositoryAccess'> },
  input: {
    orgId: string;
    project: { repository: { id: string; slug: string } };
    branch: string;
    limit: number;
  },
): Promise<RepositoryCommit[]> {
  const access = await github.versionControl.getRepositoryAccess({
    orgId: input.orgId,
    repositoryId: input.project.repository.id,
  });

  const query = new URLSearchParams({ sha: input.branch, per_page: String(input.limit) });
  const response = await fetch(`${GITHUB_API}/repos/${input.project.repository.slug}/commits?${query}`, {
    headers: {
      accept: 'application/vnd.github+json',
      ...(access.authorization ? { authorization: `Bearer ${access.authorization.token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub rejected the commit listing for ${input.project.repository.slug} (${response.status}).`);
  }

  const commits = (await response.json()) as GithubCommitResponse[];
  return commits.map(entry => ({
    sha: entry.sha,
    message: entry.commit.message.split('\n')[0] ?? '',
    author: entry.author?.login ?? entry.commit.author?.name ?? null,
    avatarUrl: entry.author?.avatar_url ?? null,
    committedAt: entry.commit.author?.date ?? null,
    url: entry.html_url,
  }));
}

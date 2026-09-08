import type { RepositoryCommit } from '@mastra/factory/integrations/github/commits';

import { requestJson } from './request';

export type { RepositoryCommit };

export interface RepositoryCommitsPage {
  commits: RepositoryCommit[];
  branch: string;
}

/** Newest commits on a linked repository's branch; the server defaults to its default branch. */
export function fetchRepositoryCommits(
  baseUrl: string,
  projectRepositoryId: string,
  options: { limit: number; signal?: AbortSignal },
): Promise<RepositoryCommitsPage> {
  const query = new URLSearchParams({ limit: String(options.limit) });
  return requestJson(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/commits?${query}`, {
    signal: options.signal,
  });
}

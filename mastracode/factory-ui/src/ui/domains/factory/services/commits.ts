import type { RepositoryCommit } from '@mastra/factory/integrations/github/commits';

import { requestJson } from './request';

export type { RepositoryCommit };

export interface RepositoryCommitsPage {
  commits: RepositoryCommit[];
  branch: string;
}

export function commitTimeMs(commit: RepositoryCommit): number | undefined {
  const atMs = Date.parse(commit.committedAt ?? '');
  return Number.isNaN(atMs) ? undefined : atMs;
}

export function fetchRepositoryCommits(
  baseUrl: string,
  projectRepositoryId: string,
  options: { limit: number; fromSha?: string; page?: number; signal?: AbortSignal },
): Promise<RepositoryCommitsPage> {
  const query = new URLSearchParams({ limit: String(options.limit) });
  if (options.fromSha !== undefined) query.set('from', options.fromSha);
  if (options.page !== undefined) query.set('page', String(options.page));
  return requestJson(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/commits?${query}`, {
    signal: options.signal,
  });
}

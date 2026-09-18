import type { WorkItemRow } from '../../storage/domains/work-items/base.js';

export function cardBelongsToRepository(item: WorkItemRow, repositoryId: number, repositoryFullName: string): boolean {
  const url = item.externalSource?.url;
  if (url) {
    const match = /^https?:\/\/[^/]+\/(.+)\/(?:issues|pull)\/\d+(?:[/?#]|$)/.exec(url);
    if (match && match[1] === repositoryFullName) return true;
  }
  return item.metadata?.githubRepositoryId === repositoryId;
}

export function canonicalSourceKey(kind: 'issue' | 'pull-request', itemNumber: number): string {
  return kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`;
}

export function legacySourceKey(repositoryId: number, kind: 'issue' | 'pull-request', itemNumber: number): string {
  return `github:${repositoryId}:${kind}:${itemNumber}`;
}

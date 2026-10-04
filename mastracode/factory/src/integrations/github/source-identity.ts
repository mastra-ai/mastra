import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';

/**
 * Canonical source keys (`github-issue:N`, `github-pr:N`) do not identify a
 * repository, so a project linked to several repositories could bind repo A's
 * event to repo B's same-numbered card. The card's intake-stamped URL is
 * authoritative; the intake-stamped `githubRepositoryId` covers URL-less
 * cards. A card with neither signal cannot be attributed by number alone.
 */
export function cardBelongsToRepository(item: WorkItemRow, repositoryId: number, repositoryFullName: string): boolean {
  const url = item.externalSource?.url;
  if (url) {
    const match = /^https?:\/\/[^/]+\/(.+)\/(?:issues|pull)\/\d+(?:[/?#]|$)/.exec(url);
    if (match && match[1] === repositoryFullName) return true;
  }
  // A renamed repository leaves the old owner/name in the card URL, so a URL
  // mismatch still defers to the stable intake-stamped repository id.
  return item.metadata?.githubRepositoryId === repositoryId;
}

export function canonicalSourceKey(kind: 'issue' | 'pull-request', itemNumber: number): string {
  return kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`;
}

export function legacySourceKey(repositoryId: number, kind: 'issue' | 'pull-request', itemNumber: number): string {
  return `github:${repositoryId}:${kind}:${itemNumber}`;
}

/** Reuse an attributed existing card, otherwise scope new intake to its repository. */
export async function githubIntakeSourceKey(
  storage: WorkItemsStorage,
  input: {
    orgId: string;
    factoryProjectId: string;
    repositoryId: number;
    repositoryFullName: string;
    kind: 'issue' | 'pull-request';
    number: number;
  },
): Promise<string> {
  const canonical = canonicalSourceKey(input.kind, input.number);
  const existing = await storage.getByProjectSource({
    orgId: input.orgId,
    factoryProjectId: input.factoryProjectId,
    source: { integrationId: 'github', type: input.kind, externalId: canonical },
  });
  return existing && cardBelongsToRepository(existing, input.repositoryId, input.repositoryFullName)
    ? canonical
    : legacySourceKey(input.repositoryId, input.kind, input.number);
}

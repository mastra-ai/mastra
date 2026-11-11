import type { RepositoryAccess, VersionControl } from '../capabilities/version-control.js';

/** The most repositories one Platform GitHub token can name. */
const REPOSITORIES_PER_TOKEN = 10;
/**
 * How long a group the provider refused or failed to mint is skipped. A failed
 * group mint is often a rate limit, so retrying it for every repository in the
 * group would add requests exactly when there is no budget for them.
 */
const GROUP_RETRY_AFTER_MS = 60_000;

/**
 * Access to each of an environment's repositories, minted a group at a time.
 * Asking for one repository asks for its group of up to ten, so a provider
 * that can grant a group mints one token for it and serves every repository in
 * it from that token, instead of minting one per repository (eleven
 * repositories: two mints, not eleven). The group token stays with these
 * callers: a plain `getRepositoryAccess` elsewhere still gets a token for its
 * own repository only. A group the provider can't grant falls back to the
 * repository's own token.
 */
export function groupedRepositoryAccess(
  versionControl: Pick<VersionControl, 'getRepositoryAccess' | 'getRepositoriesAccess'>,
  orgId: string,
  repositoryIds: readonly string[],
  now: () => number = Date.now,
): (repositoryId: string) => Promise<RepositoryAccess> {
  const ids = [...new Set(repositoryIds)];
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += REPOSITORIES_PER_TOKEN) groups.push(ids.slice(i, i + REPOSITORIES_PER_TOKEN));
  const skipUntil = new Map<string[], number>();
  return async repositoryId => {
    const group = groups.find(candidate => candidate.includes(repositoryId));
    if (group && group.length > 1 && versionControl.getRepositoriesAccess && (skipUntil.get(group) ?? 0) <= now()) {
      // Parallel callers share the provider's in-flight mint and cache.
      // Best-effort: the repository's own token still works without it.
      const access = await versionControl.getRepositoriesAccess({ orgId, repositoryIds: group }).catch(() => undefined);
      const own = access?.repositories?.[repositoryId];
      if (own) return own;
      skipUntil.set(group, now() + GROUP_RETRY_AFTER_MS);
    }
    return versionControl.getRepositoryAccess({ orgId, repositoryId });
  };
}

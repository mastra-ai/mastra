import type { RepositoryAccess, VersionControl } from '../capabilities/version-control.js';

/** The most repositories one Platform GitHub token can name. */
const REPOSITORIES_PER_TOKEN = 10;

/**
 * Access to each of an environment's repositories, minted a group at a time.
 * Asking for one repository first asks for its group of up to ten, so a
 * provider that can grant a group mints one token for it and serves every
 * repository in it from that token, instead of minting one per repository
 * (eleven repositories: two mints, not eleven). A group the provider can't
 * grant falls back to the repository's own token.
 */
export function groupedRepositoryAccess(
  versionControl: Pick<VersionControl, 'getRepositoryAccess' | 'getRepositoriesAccess'>,
  orgId: string,
  repositoryIds: readonly string[],
): (repositoryId: string) => Promise<RepositoryAccess> {
  const ids = [...new Set(repositoryIds)];
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += REPOSITORIES_PER_TOKEN) groups.push(ids.slice(i, i + REPOSITORIES_PER_TOKEN));
  // Callers cloning in parallel share one request per group.
  const inFlight = new Map<string[], Promise<unknown>>();
  return async repositoryId => {
    const group = groups.find(candidate => candidate.includes(repositoryId));
    if (group && group.length > 1 && versionControl.getRepositoriesAccess) {
      let pending = inFlight.get(group);
      if (!pending) {
        // Best-effort: the repository's own token still works without it.
        pending = versionControl
          .getRepositoriesAccess({ orgId, repositoryIds: group })
          .catch(() => undefined)
          .finally(() => inFlight.delete(group));
        inFlight.set(group, pending);
      }
      await pending;
    }
    return versionControl.getRepositoryAccess({ orgId, repositoryId });
  };
}

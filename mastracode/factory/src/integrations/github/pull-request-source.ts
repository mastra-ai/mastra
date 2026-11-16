import { sourceExternalId } from '../../boards/semantics.js';
import type { WorkItemSourceRow } from '../../storage/domains/work-items/work-item-schema.js';

/**
 * Whether a card's source row is pull request `pullRequestNumber` of this repository. Numbers
 * repeat across repositories, so the row's URL, or the repository id stamped on it, must name
 * this repository as well.
 */
export function isRepositoryPullRequest(
  source: WorkItemSourceRow,
  repositoryId: number,
  repositoryFullName: string,
  pullRequestNumber: number,
): boolean {
  if (source.integrationId !== 'github' || source.sourceType !== 'pull-request') return false;
  const key = sourceExternalId(source);
  if (key !== `github-pr:${pullRequestNumber}` && key !== `github:${repositoryId}:pull-request:${pullRequestNumber}`) {
    return false;
  }
  const match = source.url ? /^https?:\/\/[^/]+\/(.+)\/pull\/\d+(?:[/?#]|$)/.exec(source.url) : null;
  return match ? match[1] === repositoryFullName : source.metadata?.githubRepositoryId === repositoryId;
}

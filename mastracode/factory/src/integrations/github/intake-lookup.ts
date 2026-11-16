import { cardRuleFacts } from '../../boards/card-facts.js';
import type { IntakeItemLookup } from '../../boards/intake-lookup.js';
import { externalSourceForWorkItem } from '../../rules/types.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { GithubIssueFetcher, GithubPullRequestFetcher, GithubRulesIntegration } from './rules.js';
import { trustedCollaborator } from './rules.js';

const GITHUB_ITEM_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)(?:[/?#].*)?$/i;

export interface GithubIntakeLookupDeps extends Pick<GithubRulesIntegration, 'getRepositoryCollaboratorPermission'> {
  sourceControl(): SourceControlStorageHandle;
  fetchIssueState: GithubIssueFetcher;
  fetchPullRequestState: GithubPullRequestFetcher;
}

/**
 * Reads a GitHub issue or pull request for the intake tester, only from a repository linked to the
 * project and only through that link's installation. It builds the facts the webhook arrival would
 * carry, with author trust from the author's repository access. Factory's own pull requests aren't
 * recognized as Factory-authored here; they already have cards, which the tester reads first.
 */
export function githubIntakeLookup(deps: GithubIntakeLookupDeps): IntakeItemLookup {
  return {
    async lookup(scope, url) {
      const match = GITHUB_ITEM_URL.exec(url.trim());
      if (!match) return undefined;
      const slug = `${match[1]}/${match[2]}`.toLowerCase();
      const number = Number(match[4]);
      const connections = await deps.sourceControl().connections.listWithRepositories({
        orgId: scope.orgId,
        factoryProjectIds: [scope.factoryProjectId],
      });
      const linked = connections
        .flatMap(connection =>
          connection.repositories.map(link => ({ installation: connection.installation, repository: link.repository })),
        )
        .find(({ repository }) => repository?.slug.toLowerCase() === slug);
      if (!linked?.repository) return { status: 'not_linked' };
      const installationId = Number(linked.installation.externalId);
      const repository = linked.repository.slug;
      const read = { installationId, repository, number };

      // An issue URL can name a pull request; GitHub redirects it, and the issue read refuses it.
      const issue = match[3]?.toLowerCase() === 'issues' ? await deps.fetchIssueState(read) : undefined;
      const asPullRequest = issue ? undefined : await deps.fetchPullRequestState(read);
      const item = issue ?? asPullRequest;
      if (!item) return { status: 'not_found' };

      const author = item.author;
      const trusted = author
        ? await trustedCollaborator(deps, { installationId, repository, login: author }).catch(() => false)
        : false;
      const kind = asPullRequest ? 'github-pr' : 'github-issue';
      const metadata: Record<string, unknown> = {
        githubRepositoryId: Number(linked.repository.externalId),
        ...(asPullRequest ? { githubPullRequestNumber: number } : { githubIssueNumber: number }),
        ...(item.createdAt ? { sourceCreatedAt: item.createdAt } : {}),
        ...(author ? { author } : {}),
        state: item.state,
        authorTrusted: trusted,
        assignees: item.assignees ?? [],
        labels: item.labels ?? [],
        ...(asPullRequest
          ? {
              draft: asPullRequest.draft,
              merged: asPullRequest.merged,
              requestedReviewers: asPullRequest.requestedReviewers ?? [],
              headBranch: asPullRequest.headBranch,
              baseBranch: asPullRequest.baseBranch,
            }
          : {}),
      };
      const sourceKey = `github:${linked.repository.externalId}:${asPullRequest ? 'pull-request' : 'issue'}:${number}`;
      return {
        status: 'found',
        title: item.title,
        url: item.url,
        facts: cardRuleFacts({
          title: item.title,
          metadata,
          externalSource: externalSourceForWorkItem(kind, sourceKey, item.url),
        }),
      };
    },
  };
}

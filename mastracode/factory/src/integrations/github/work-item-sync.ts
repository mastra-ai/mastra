import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext, WorkItemSync } from '../base.js';
import { resolveRepository } from './acceptance-labels.js';
import {
  githubRulesOptions,
  reconcilableIssueNumber,
  reconcilablePullRequestNumber,
  reconciledPullRequestMetadata,
  sweepTrustLookup,
} from './rules.js';
import type { GithubIssueFetcher, GithubPullRequestFetcher, GithubRulesIntegration } from './rules.js';

/**
 * Syncs one GitHub card from GitHub: the issue's or pull request's title, state, labels, assignees,
 * author and the author's trust, written the way the reconcile sweeps write them. It replays no
 * event, and leaves a closed source alone: the close reaches the card through its webhook or the
 * sweep, which needs the card's stored state to still read open.
 */
export function attachGithubWorkItemSync(
  github: GithubRulesIntegration,
  context: IntegrationContext,
  fetchIssue: GithubIssueFetcher,
  fetchPullRequest: GithubPullRequestFetcher,
): WorkItemSync | undefined {
  const options = githubRulesOptions(github, context);
  if (!options) return undefined;
  return createGithubWorkItemSync({ ...options, fetchIssue, fetchPullRequest });
}

export function createGithubWorkItemSync(options: {
  github: Pick<GithubRulesIntegration, 'getRepositoryCollaboratorPermission'>;
  sourceControl: SourceControlStorageHandle;
  storage: Pick<WorkItemsStorage, 'syncCard'>;
  fetchIssue: GithubIssueFetcher;
  fetchPullRequest: GithubPullRequestFetcher;
}): WorkItemSync {
  const { github, fetchIssue, fetchPullRequest } = options;
  return async (item: Card) => {
    const source = item.externalSource;
    if (source?.integrationId !== 'github') return;
    const repositoryId = item.workItem.metadata?.githubRepositoryId;
    if (typeof repositoryId !== 'number') return;
    const target = await resolveRepository(options.sourceControl, item.orgId, item.factoryProjectId, repositoryId);
    if (!target) return;
    const repository = { id: repositoryId, fullName: target.slug, installationId: target.installationId };
    const trusted = sweepTrustLookup(github, repository);
    const fetch = { installationId: target.installationId, repository: target.slug };

    if (source.type === 'issue') {
      const number = reconcilableIssueNumber(item, repository);
      const state = number ? await fetchIssue({ ...fetch, number }) : undefined;
      // A closed issue is the sweep's: it replays the close before writing the state.
      if (!number || !state || state.state === 'closed') return;
      const authorTrusted = state.author === undefined ? undefined : await trusted(state.author);
      await options.storage.syncCard({
        orgId: item.orgId,
        id: item.id,
        userId: 'factory-rule-dispatcher',
        patch: {
          ...(state.title && state.title !== item.title ? { title: state.title } : {}),
          metadata: {
            githubRepositoryId: repositoryId,
            githubIssueNumber: number,
            state: state.state,
            ...(state.author === undefined ? {} : { author: state.author }),
            ...(state.assignees === undefined ? {} : { assignees: state.assignees }),
            ...(state.labels === undefined ? {} : { labels: state.labels }),
            ...(authorTrusted === undefined ? {} : { authorTrusted }),
          },
        },
      });
      return;
    }

    if (source.type === 'pull-request') {
      const number = reconcilablePullRequestNumber(item, repository);
      const state = number ? await fetchPullRequest({ ...fetch, number }) : undefined;
      // A closed or merged PR is the sweep's: it replays the merge before writing the state.
      if (!number || !state || state.state === 'closed') return;
      const authorTrusted = state.author ? await trusted(state.author) : undefined;
      await options.storage.syncCard({
        orgId: item.orgId,
        id: item.id,
        userId: 'factory-rule-dispatcher',
        patch: {
          ...(state.title && state.title !== item.title ? { title: state.title } : {}),
          metadata: reconciledPullRequestMetadata(state, undefined, authorTrusted),
        },
      });
    }
  };
}

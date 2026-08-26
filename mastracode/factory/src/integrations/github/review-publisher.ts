import type { VersionControl } from '../../capabilities/version-control.js';
import type { FactoryReviewPublisher, PublishedReview } from '../../rules/review-tool.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { WorkItemRow } from '../../storage/domains/work-items/base.js';

type PullRequestTarget = { slug: string; pullRequestNumber: number };

/** Card URLs pin the repository; a canonical key alone does not, so it is not trusted here. */
function pullRequestTarget(item: Pick<WorkItemRow, 'externalSource'>): PullRequestTarget | null {
  const url = item.externalSource?.url;
  if (!url) return null;
  const match = /^https?:\/\/[^/]+\/(.+)\/pull\/(\d+)(?:[/?#]|$)/.exec(url);
  return match ? { slug: match[1]!, pullRequestNumber: Number(match[2]) } : null;
}

// GitHub answers 422 when the token authored the PR and cannot vote on it.
function refusedTheVerdict(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 422;
}

export function createGithubReviewPublisher(options: {
  storage: Pick<SourceControlStorageHandle, 'connections' | 'installations' | 'projectRepositories' | 'repositories'>;
  versionControl: Pick<VersionControl, 'createReview' | 'createComment'>;
}): FactoryReviewPublisher {
  return {
    async publish({ orgId, factoryProjectId, item, verdict, body }): Promise<PublishedReview> {
      const target = pullRequestTarget(item);
      if (!target) throw new Error('The bound work item does not carry a pull request URL to publish against.');

      const connections = await options.storage.connections.list({ orgId, factoryProjectId });
      for (const connection of connections) {
        const [installation, projectRepositories] = await Promise.all([
          options.storage.installations.get({ orgId, id: connection.installationId }),
          options.storage.projectRepositories.list({ orgId, connectionId: connection.id }),
        ]);
        if (!installation) continue;
        for (const projectRepository of projectRepositories) {
          const repository = await options.storage.repositories.get({ orgId, id: projectRepository.repositoryId });
          if (repository?.slug !== target.slug) continue;

          const ref = {
            connection: { type: 'app-installation' as const, installationId: Number(installation.externalId) },
            sourceId: repository.slug,
            pullRequestId: String(target.pullRequestNumber),
          };
          try {
            const review = await options.versionControl.createReview({ ...ref, event: verdict, body });
            return { url: review.url, event: verdict };
          } catch (error) {
            if (!refusedTheVerdict(error)) throw error;
            // A comment review would reach `pullRequestReviewSubmitted`, which only
            // acts on `changes_requested`; the handoff rule reading the verdict off
            // the first line runs on issue comments, so the fallback posts one.
            const comment = await options.versionControl.createComment({ ...ref, body });
            return { url: comment.url, event: 'comment' };
          }
        }
      }
      throw new Error(`No configured repository in this Factory project matches ${target.slug}.`);
    },
  };
}

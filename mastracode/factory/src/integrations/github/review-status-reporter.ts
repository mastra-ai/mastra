import { pullRequestSourceNumber, reviewedPullRequest } from '../../boards/index.js';
import type { PullRequestRef, VersionControl } from '../../capabilities/version-control.js';
import type { FactoryReviewStatusEvent, FactoryReviewStatusReporter } from '../../rules/dispatcher.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { Card } from '../../storage/domains/work-items/base.js';
import { resolveRepository } from './acceptance-labels.js';
import type { ReviewStatusState, ReviewStatusStats } from './review-status-comment.js';
import { publishReviewStatus } from './review-status.js';

const REVIEW_STATUS_ASSETS =
  'https://raw.githubusercontent.com/mastra-ai/mastra/main/mastracode/factory/assets/review-status';
export const DEFAULT_REVIEW_STATUS_GIF_URL = `${REVIEW_STATUS_ASSETS}/reviewing-light.gif`;
export const DEFAULT_REVIEW_STATUS_GIF_DARK_URL = `${REVIEW_STATUS_ASSETS}/reviewing-dark.gif`;

/**
 * Where the reviewing animation is served from. By default both theme variants
 * come from this repository. A self-hosted `FACTORY_REVIEW_STATUS_GIF_URL` is
 * used for every theme unless `FACTORY_REVIEW_STATUS_GIF_DARK_URL` adds a dark
 * variant for it; a custom image is never paired with a stock one.
 */
export function reviewStatusAnimationFromEnv(env: Record<string, string | undefined>): {
  gifUrl: string;
  gifDarkUrl?: string;
} {
  const gifUrl = env.FACTORY_REVIEW_STATUS_GIF_URL?.trim();
  const gifDarkUrl = env.FACTORY_REVIEW_STATUS_GIF_DARK_URL?.trim();
  if (!gifUrl) return { gifUrl: DEFAULT_REVIEW_STATUS_GIF_URL, gifDarkUrl: DEFAULT_REVIEW_STATUS_GIF_DARK_URL };
  return gifDarkUrl ? { gifUrl, gifDarkUrl } : { gifUrl };
}

const COMMIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export interface GithubReviewStatusReporterDeps {
  github: {
    versionControl: VersionControl;
    isFactoryCommentAuthor(login: string | null | undefined): boolean;
  };
  sourceControl: SourceControlStorageHandle;
  workItems: { get(input: { orgId: string; id: string }): Promise<Card | null> };
  /** How the comment names the reviewer, e.g. "Shipyard". */
  reviewerName: string;
  gifUrl: string;
  gifDarkUrl?: string;
}

function commitSha(value: unknown): string | undefined {
  return typeof value === 'string' && COMMIT_SHA.test(value.toLowerCase()) ? value.toLowerCase() : undefined;
}

/**
 * Keeps the review-status comment on a GitHub pull request in step with the
 * dispatcher's review runs. Every number it shows is read, not estimated:
 * duration from the dispatcher's own clock, the verdict and commit only when
 * this run recorded them, inline comments counted on GitHub. Anything it cannot
 * read is left out. Never throws.
 */
export function createGithubReviewStatusReporter(deps: GithubReviewStatusReporterDeps): FactoryReviewStatusReporter {
  const isFactoryAuthor = (login: string | null | undefined) => deps.github.isFactoryCommentAuthor(login);
  return async event => {
    try {
      const item = await deps.workItems.get({ orgId: event.orgId, id: event.workItemId });
      if (!item || item.externalSource?.integrationId !== 'github') return;
      // An issue card reviews the pull request attached to it.
      const attached = item.externalSource.type === 'pull-request' ? undefined : reviewedPullRequest(item);
      if (item.externalSource.type !== 'pull-request' && attached?.integrationId !== 'github') return;
      const repositoryId = attached?.metadata?.githubRepositoryId ?? item.workItem.metadata?.githubRepositoryId;
      const number = attached ? pullRequestSourceNumber(attached) : item.workItem.metadata?.githubPullRequestNumber;
      if (typeof repositoryId !== 'number' || typeof number !== 'number' || number < 1) return;
      const target = await resolveRepository(deps.sourceControl, event.orgId, event.factoryProjectId, repositoryId);
      if (!target) return;
      const ref: PullRequestRef = {
        connection: { type: 'app-installation', installationId: target.installationId },
        sourceId: target.slug,
        pullRequestId: String(number),
      };
      const head = event.phase === 'reviewing' ? commitSha(item.metadata?.pullRequestHeadSha) : undefined;
      const state: ReviewStatusState = {
        run: event.run,
        requestedAt: event.requestedAt.toISOString(),
        generation: event.generation,
        attempt: event.attempt,
        phase: event.phase,
        ...(event.startedAt ? { startedAt: event.startedAt.toISOString() } : {}),
        ...(head ? { head } : {}),
      };
      const final = event.phase === 'completed' || event.phase === 'failed' || event.phase === 'cancelled';
      await publishReviewStatus(
        deps.github.versionControl,
        ref,
        {
          state,
          reviewerName: deps.reviewerName,
          repository: target.slug,
          gifUrl: deps.gifUrl,
          ...(deps.gifDarkUrl ? { gifDarkUrl: deps.gifDarkUrl } : {}),
          ...(event.reason ? { reason: event.reason } : {}),
          ...(event.replayed ? { continuesRun: true } : {}),
          ...(final ? { stats: recorded => readStats(item, event, recorded) } : {}),
        },
        isFactoryAuthor,
      );
    } catch (error) {
      console.warn(`[factory] could not update the review status for work item ${event.workItemId}:`, error);
    }
  };
}

async function readStats(
  item: Card,
  event: FactoryReviewStatusEvent,
  state: ReviewStatusState,
): Promise<ReviewStatusStats> {
  // A run that never started reviewed nothing: no duration or verdict to show.
  if (!state.startedAt) return {};
  const startedAt = Date.parse(state.startedAt);
  const stats: ReviewStatusStats = {};
  if (event.endedAt) stats.durationMs = Math.max(0, event.endedAt.getTime() - startedAt);
  // The card keeps the latest verdict; it is this run's only if recorded after the run started.
  const verdict = item.metadata?.reviewVerdict;
  const reviewedAt = item.metadata?.reviewedAt;
  if (
    event.phase === 'completed' &&
    (verdict === 'approve' || verdict === 'request changes') &&
    typeof reviewedAt === 'string' &&
    Date.parse(reviewedAt) >= startedAt
  ) {
    stats.verdict = verdict;
    const reviewedHeadSha = commitSha(item.metadata?.reviewedHeadSha);
    if (reviewedHeadSha) stats.reviewedHeadSha = reviewedHeadSha;
  }
  return stats;
}

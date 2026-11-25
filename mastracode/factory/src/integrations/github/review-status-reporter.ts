import { pullRequestSourceNumber, reviewedPullRequest } from '../../boards/index.js';
import type { PullRequestRef, VersionControl } from '../../capabilities/version-control.js';
import { factorySessionUrl } from '../../links.js';
import type { FactoryReviewStatusEvent, FactoryReviewStatusReporter } from '../../rules/dispatcher.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { Card } from '../../storage/domains/work-items/base.js';
import { resolveRepository } from './acceptance-labels.js';
import { reviewStatusCheck, supersededCheck } from './review-status-check.js';
import type { ReviewStatusCheck } from './review-status-check.js';
import { isSessionUrl } from './review-status-comment.js';
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
const FINAL_PHASES = new Set(['completed', 'failed', 'cancelled']);
const CHECKS_REFUSED_FOR_MS = 60 * 60 * 1000;

/**
 * Whether GitHub refused the check because the app may not publish checks. A
 * rate limit is also a 403 on GitHub, so a 403 counts only with GitHub's
 * permission wording.
 */
function isChecksPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.message} ${(error as { detail?: unknown }).detail ?? ''}`.toLowerCase();
  if (text.includes('checks: write')) return true;
  return (error as { status?: unknown }).status === 403 && text.includes('resource not accessible by integration');
}

export interface GithubReviewStatusReporterDeps {
  github: {
    versionControl: VersionControl;
    isFactoryCommentAuthor(login: string | null | undefined): boolean;
  };
  sourceControl: SourceControlStorageHandle;
  workItems: { get(input: { orgId: string; id: string }): Promise<Card | null> };
  /** How the comment names the reviewer, e.g. "Shipyard". */
  reviewerName: string;
  now?: () => number;
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
  // An installation that may not publish checks is left alone for a while,
  // rather than refused and logged on every step of every review.
  const refusedUntil = new Map<number, number>();
  const now = deps.now ?? Date.now;
  const checksRefused = (installationId: number) => (refusedUntil.get(installationId) ?? 0) > now();
  const refuseChecks = (installationId: number) => refusedUntil.set(installationId, now() + CHECKS_REFUSED_FOR_MS);
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
        connection: { type: 'app-installation', installationId: target.installationId, orgId: event.orgId },
        sourceId: target.slug,
        pullRequestId: String(number),
      };
      const head = event.phase === 'reviewing' ? commitSha(item.metadata?.pullRequestHeadSha) : undefined;
      const session = event.session
        ? factorySessionUrl({ factoryProjectId: event.factoryProjectId, ...event.session })
        : undefined;
      const state: ReviewStatusState = {
        run: event.run,
        requestedAt: event.requestedAt.toISOString(),
        generation: event.generation,
        attempt: event.attempt,
        phase: event.phase,
        ...(event.startedAt ? { startedAt: event.startedAt.toISOString() } : {}),
        ...(head ? { head } : {}),
        ...(isSessionUrl(session) ? { session } : {}),
      };
      const final = event.phase === 'completed' || event.phase === 'failed' || event.phase === 'cancelled';
      const published = await publishReviewStatus(
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
          // A finished run reports on the commit it reviewed, else where its
          // check already is; a run in flight on the commit it started on, else
          // the current head.
          checkHead: ({ state: recorded, stats, previous }) =>
            (final ? (stats?.reviewedHeadSha ?? previous?.checkHead) : undefined) ??
            recorded.head ??
            commitSha(item.metadata?.pullRequestHeadSha),
        },
        isFactoryAuthor,
      );
      // The check follows the comment: a step the comment refused as stale or
      // skipped never replaces a newer run's check.
      if (published.action !== 'created' && published.action !== 'updated') return;
      const publishCheck = deps.github.versionControl.publishCommitCheck;
      if (!publishCheck) return;
      const checkTarget = { connection: ref.connection, sourceId: ref.sourceId };
      const publish = async (headSha: string, check: ReviewStatusCheck) => {
        // An installation that refused checks is skipped while a review is in
        // flight; a check that ends one is still tried, so none is left open.
        if (check.status === 'in-progress' && checksRefused(target.installationId)) return;
        try {
          await publishCheck.call(deps.github.versionControl, { ...checkTarget, headSha, ...check });
        } catch (error) {
          if (isChecksPermissionError(error)) refuseChecks(target.installationId);
          console.warn(`[factory] could not publish the review check for work item ${event.workItemId}:`, error);
        }
      };
      const checkHead = published.state.checkHead;
      if (checkHead) {
        await publish(
          checkHead,
          reviewStatusCheck({
            reviewerName: deps.reviewerName,
            state: published.state,
            ...(published.stats ? { stats: published.stats } : {}),
            ...(event.reason ? { reason: event.reason } : {}),
            commentUrl: published.url,
          }),
        );
      }
      // A check still open on another commit (this run moved, or the run this
      // one replaced never ended) is closed, so none stays in progress.
      const previous = published.previous;
      if (previous?.checkHead && previous.checkHead !== checkHead && !FINAL_PHASES.has(previous.phase)) {
        await publish(previous.checkHead, supersededCheck(deps.reviewerName, previous.run === published.state.run));
      }
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

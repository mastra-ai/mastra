import type { PullRequestComment, PullRequestRef, VersionControl } from '../../capabilities/version-control.js';
import {
  parseReviewStatusState,
  renderReviewStatusComment,
  REVIEW_STATUS_COMMENT_MARKER,
  supersedesReviewStatus,
} from './review-status-comment.js';
import type {
  ReviewStatusPhase,
  ReviewStatusState,
  ReviewStatusStats,
  ReviewStatusView,
} from './review-status-comment.js';

type CommentPort = Pick<VersionControl, 'listComments' | 'createComment' | 'updateComment' | 'deleteComment'>;

export type ReviewStatusPublishResult =
  | { action: 'created' | 'updated'; commentId: string; url: string }
  | { action: 'stale'; commentId: string }
  | { action: 'skipped' };

const CREATING_PHASES = new Set<ReviewStatusPhase>(['queued', 'reviewing', 'retrying', 'failed']);
const FRESH_ATTEMPT_PHASES = new Set<ReviewStatusPhase>(['queued', 'retrying']);

export interface ReviewStatusStep extends Omit<ReviewStatusView, 'stats'> {
  /** Stats for a final step, read once the start time and head of the run are known. */
  stats?: (state: ReviewStatusState) => Promise<ReviewStatusStats>;
  /** Ends the run an earlier attempt started, so that attempt's start time and head still apply. */
  continuesRun?: boolean;
}

async function listAll<T>(page: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const next = await page(cursor);
    items.push(...next.items);
    cursor = next.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

function byId(left: PullRequestComment, right: PullRequestComment): number {
  const a = Number(left.id);
  const b = Number(right.id);
  if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
  return left.id.localeCompare(right.id);
}

/**
 * Writes one lifecycle step into the pull request's Factory review-status
 * comment: edits the oldest one Factory authored, or creates it. A step older
 * than what the comment already shows is dropped. Extra marked comments left by
 * a creation race are deleted so the pull request settles on one.
 */
export async function publishReviewStatus(
  versionControl: CommentPort,
  ref: PullRequestRef,
  step: ReviewStatusStep,
  isFactoryAuthor: (login: string | null | undefined) => boolean,
): Promise<ReviewStatusPublishResult> {
  const comments = await listAll(async cursor => {
    const page = await versionControl.listComments({ ...ref, ...(cursor ? { cursor } : {}) });
    return { items: page.comments, nextCursor: page.nextCursor };
  });
  const marked = comments
    .filter(comment => comment.body.includes(REVIEW_STATUS_COMMENT_MARKER) && isFactoryAuthor(comment.author))
    .sort(byId);
  const [canonical, ...duplicates] = marked;
  for (const duplicate of duplicates) {
    try {
      await versionControl.deleteComment({
        connection: ref.connection,
        sourceId: ref.sourceId,
        commentId: duplicate.id,
      });
    } catch (error) {
      console.warn(`[factory] could not delete duplicate review-status comment ${duplicate.id}:`, error);
    }
  }
  const existing = canonical ? parseReviewStatusState(canonical.body) : undefined;
  if (canonical && !supersedesReviewStatus(existing, step.state)) {
    return { action: 'stale', commentId: canonical.id };
  }
  // Later steps of an attempt carry only what changed; the start time, head and
  // session link come from the step that recorded them. A new attempt (queued or waiting to
  // retry) starts clean, so it never reports an earlier attempt's timing, unless
  // it is only ending the run that earlier attempt started.
  const state =
    existing?.run === step.state.run &&
    (existing.attempt === step.state.attempt || step.continuesRun === true) &&
    !FRESH_ATTEMPT_PHASES.has(step.state.phase)
      ? {
          ...step.state,
          ...((step.state.startedAt ?? existing.startedAt)
            ? { startedAt: step.state.startedAt ?? existing.startedAt }
            : {}),
          ...((step.state.head ?? existing.head) ? { head: step.state.head ?? existing.head } : {}),
          ...((step.state.session ?? existing.session) ? { session: step.state.session ?? existing.session } : {}),
        }
      : step.state;
  // A run only ends a comment it opened: a run cancelled or finished before it
  // ever showed progress leaves no trace, and never replaces another run's result.
  if (!CREATING_PHASES.has(state.phase) && existing?.run !== state.run) return { action: 'skipped' };
  const { stats: readStats, continuesRun: _continuesRun, ...view } = step;
  const stats = readStats ? await readStats(state) : undefined;
  const body = renderReviewStatusComment({ ...view, state, ...(stats ? { stats } : {}) });
  if (!canonical) {
    const created = await versionControl.createComment({ ...ref, body });
    return { action: 'created', commentId: created.id, url: created.url };
  }
  const updated = await versionControl.updateComment({
    connection: ref.connection,
    sourceId: ref.sourceId,
    commentId: canonical.id,
    body,
  });
  return { action: 'updated', commentId: updated.id, url: updated.url };
}

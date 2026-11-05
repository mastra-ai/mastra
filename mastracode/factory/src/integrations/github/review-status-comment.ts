/**
 * The one status comment Factory keeps on a pull request while it reviews it.
 * The host writes it from the review run's lifecycle, so a crashed or failed
 * run still resolves the comment instead of leaving it claiming work is live.
 *
 * The comment carries its own state in a hidden line. That state orders writes:
 * a newer review run takes the comment over, and a late write from an older run
 * (or an earlier step of the same run) is dropped instead of overwriting it.
 */

export const REVIEW_STATUS_COMMENT_MARKER = '<!-- mastra-factory-review-status -->';
const STATE_PREFIX = '<!-- mastra-factory-review-status:state ';
const STATE_SUFFIX = ' -->';

export type ReviewStatusPhase = 'queued' | 'reviewing' | 'retrying' | 'completed' | 'failed' | 'cancelled';

/** What the hidden state line records; everything else in the comment is derived from it. */
export interface ReviewStatusState {
  /** The review run: the dispatcher decision that started it. Retries keep it. */
  run: string;
  /** When the run was requested; orders runs against each other. */
  requestedAt: string;
  /** The dispatcher delivery generation; grows on every retry, manual ones included. */
  generation: number;
  /** The dispatcher attempt, shown to readers. A manual retry restarts it. */
  attempt: number;
  phase: ReviewStatusPhase;
  /** When the agent was handed the review. Absent until the run starts. */
  startedAt?: string;
  /** The pull request head when the run started. */
  head?: string;
}

export interface ReviewStatusStats {
  verdict?: 'approve' | 'request changes';
  /** The commit the recorded verdict covers. */
  reviewedHeadSha?: string;
  durationMs?: number;
  inlineFindings?: number;
  filesWithFindings?: number;
}

export interface ReviewStatusView {
  state: ReviewStatusState;
  stats?: ReviewStatusStats;
  /** Why the run failed or will retry; already sanitized by the dispatcher. */
  reason?: string;
  reviewerName: string;
  gifUrl: string;
}

const PHASE_RANK: Record<ReviewStatusPhase, number> = {
  queued: 0,
  reviewing: 1,
  retrying: 2,
  completed: 3,
  failed: 3,
  cancelled: 3,
};

const SAFE_TOKEN = /^[A-Za-z0-9:._-]{1,200}$/;
const COMMIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function isPhase(value: unknown): value is ReviewStatusPhase {
  return typeof value === 'string' && value in PHASE_RANK;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && SAFE_TOKEN.test(value) && !Number.isNaN(Date.parse(value));
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Reads the hidden state line. Anything malformed reads as no state. */
export function parseReviewStatusState(body: string | null | undefined): ReviewStatusState | undefined {
  if (!body) return undefined;
  const start = body.indexOf(STATE_PREFIX);
  if (start < 0) return undefined;
  const end = body.indexOf(STATE_SUFFIX, start + STATE_PREFIX.length);
  if (end < 0) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(body.slice(start + STATE_PREFIX.length, end));
  } catch {
    return undefined;
  }
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.run !== 'string' || !SAFE_TOKEN.test(value.run)) return undefined;
  if (!isTimestamp(value.requestedAt) || !isPhase(value.phase)) return undefined;
  if (!isCount(value.generation) || !isCount(value.attempt)) return undefined;
  return {
    run: value.run,
    requestedAt: value.requestedAt,
    generation: value.generation,
    attempt: value.attempt,
    phase: value.phase,
    ...(isTimestamp(value.startedAt) ? { startedAt: value.startedAt } : {}),
    ...(typeof value.head === 'string' && COMMIT_SHA.test(value.head) ? { head: value.head } : {}),
  };
}

/**
 * Whether `next` may overwrite a comment holding `existing`. A different run
 * wins only when it was requested later. Within one run, steps only move
 * forward: a later delivery generation, or a later phase of the same one. So a
 * duplicate or late write never rewinds the comment, and a final status is only
 * replaced when the run is retried.
 */
export function supersedesReviewStatus(existing: ReviewStatusState | undefined, next: ReviewStatusState): boolean {
  if (!existing) return true;
  if (existing.run !== next.run) {
    const existingAt = Date.parse(existing.requestedAt);
    const nextAt = Date.parse(next.requestedAt);
    return nextAt > existingAt || (nextAt === existingAt && next.run > existing.run);
  }
  if (next.generation !== existing.generation) return next.generation > existing.generation;
  if (next.attempt !== existing.attempt) return next.attempt > existing.attempt;
  return PHASE_RANK[next.phase] > PHASE_RANK[existing.phase];
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Plain, single-line text that cannot break out of the code span it is rendered in. */
function inlineCode(text: string, max = 300): string {
  const flat = text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/`/g, "'")
    .trim();
  const clipped = flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  return `\`${clipped}\``;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function stateLine(state: ReviewStatusState): string {
  return `${STATE_PREFIX}${JSON.stringify(state)}${STATE_SUFFIX}`;
}

function finalHeading(view: ReviewStatusView): string {
  const { phase } = view.state;
  if (phase === 'failed') return '### ❌ Review failed';
  if (phase === 'cancelled') return '### ⏹️ Review cancelled';
  const verdict = view.stats?.verdict;
  if (verdict === 'approve') return '### ✅ Review complete: approved';
  if (verdict === 'request changes') return '### 🔁 Review complete: changes requested';
  return '### ☑️ Review finished';
}

function statsTable(view: ReviewStatusView): string[] {
  const { stats = {}, state } = view;
  const rows: Array<[string, string]> = [];
  if (stats.verdict) rows.push(['Verdict', stats.verdict === 'approve' ? 'Approve' : 'Request changes']);
  if (stats.reviewedHeadSha) rows.push(['Reviewed commit', `\`${shortSha(stats.reviewedHeadSha)}\``]);
  else if (state.head) rows.push(['Head when the review started', `\`${shortSha(state.head)}\``]);
  if (stats.durationMs !== undefined) rows.push(['Duration', formatDuration(stats.durationMs)]);
  if (stats.inlineFindings !== undefined) {
    const files =
      stats.inlineFindings > 0 && stats.filesWithFindings !== undefined
        ? ` across ${plural(stats.filesWithFindings, 'file')}`
        : '';
    rows.push(['Inline comments', `${stats.inlineFindings}${files}`]);
  }
  if (state.attempt > 1) rows.push(['Attempts', String(state.attempt)]);
  if (rows.length === 0) return [];
  return ['', '| | |', '| --- | --- |', ...rows.map(([label, value]) => `| ${label} | ${value} |`)];
}

export function gifAltText(reviewerName: string): string {
  return `Animated ASCII spinner: ${reviewerName} is reviewing this pull request`;
}

/** The whole comment body for one lifecycle step. */
export function renderReviewStatusComment(view: ReviewStatusView): string {
  const { state, reviewerName } = view;
  const lines = [REVIEW_STATUS_COMMENT_MARKER, stateLine(state)];
  switch (state.phase) {
    case 'queued':
      lines.push(
        '### ⏳ Review queued',
        '',
        `${reviewerName} accepted the review request. The review has not started yet; this comment updates when it does.`,
      );
      break;
    case 'retrying':
      lines.push(
        '### ⏳ Review queued for retry',
        '',
        `Attempt ${state.attempt} did not finish${view.reason ? `: ${inlineCode(view.reason)}` : '.'}`,
        `${reviewerName} retries automatically; this comment updates when the next attempt starts.`,
      );
      break;
    case 'reviewing': {
      const since = state.startedAt ? ` since ${state.startedAt.replace(/\.\d+Z$/, 'Z')}` : '';
      const head = state.head ? ` on \`${shortSha(state.head)}\`` : '';
      lines.push(
        '### Reviewing…',
        '',
        `![${gifAltText(reviewerName)}](${view.gifUrl})`,
        '',
        `${reviewerName} is reviewing this pull request${head}${since}. This comment updates when the review finishes.`,
      );
      break;
    }
    case 'completed':
      lines.push(finalHeading(view), ...statsTable(view));
      if (!view.stats?.verdict) {
        lines.push('', 'The review run ended without recording a verdict for this pass.');
      }
      break;
    case 'failed':
      lines.push(
        finalHeading(view),
        '',
        `The review did not finish${view.reason ? `: ${inlineCode(view.reason)}` : '.'}`,
        ...statsTable(view),
        '',
        `Request a review from ${reviewerName} again to retry.`,
      );
      break;
    case 'cancelled':
      lines.push(
        finalHeading(view),
        '',
        'This review pass was replaced before it finished, either by a newer review request or because the pull request moved on.',
        ...statsTable(view),
      );
      break;
  }
  return `${lines.join('\n')}\n`;
}

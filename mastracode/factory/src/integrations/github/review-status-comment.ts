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
}

export interface ReviewStatusView {
  state: ReviewStatusState;
  stats?: ReviewStatusStats;
  /** Why the run failed or will retry; already sanitized by the dispatcher. */
  reason?: string;
  reviewerName: string;
  /** `owner/name` of the pull request's repository, used to link the commit in the footer. */
  repository?: string;
  /** The animation shown while reviewing; also the fallback for readers without a theme preference. */
  gifUrl: string;
  /** The same animation drawn for GitHub's dark theme, swapped in with `prefers-color-scheme`. */
  gifDarkUrl?: string;
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

const REPOSITORY_SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function commitLink(sha: string, repository: string | undefined): string {
  const code = `\`${shortSha(sha)}\``;
  return repository && REPOSITORY_SLUG.test(repository)
    ? `[${code}](https://github.com/${repository}/commit/${sha})`
    : code;
}

/**
 * A quiet line under a finished status: the commit and how long the run took. Only a recorded
 * verdict's commit is called reviewed; otherwise it is the head the run started on.
 */
function footer(view: ReviewStatusView): string[] {
  const { stats = {}, state } = view;
  const parts: string[] = [];
  if (stats.reviewedHeadSha && stats.verdict && state.phase === 'completed')
    parts.push(`Reviewed ${commitLink(stats.reviewedHeadSha, view.repository)}`);
  else if (state.head) parts.push(`Started on ${commitLink(state.head, view.repository)}`);
  if (stats.durationMs !== undefined) parts.push(`took ${formatDuration(stats.durationMs)}`);
  if (parts.length === 0) return [];
  const line = parts.join(' · ');
  return ['', `<sub>${line.charAt(0).toUpperCase()}${line.slice(1)}</sub>`];
}

export function gifAltText(reviewerName: string): string {
  return `Animated ASCII factory with smoke puffing from its chimneys: ${reviewerName} is reviewing this pull request`;
}

function htmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Display width for the 468px-wide animation; GitHub keeps the aspect ratio when only the width is set. */
const ANIMATION_WIDTH = 360;

/** The reviewing animation, matched to the reader's GitHub theme when a dark variant is configured. */
function animation(view: ReviewStatusView): string[] {
  const img = `<img src="${htmlAttribute(view.gifUrl)}" alt="${htmlAttribute(gifAltText(view.reviewerName))}" width="${ANIMATION_WIDTH}">`;
  if (!view.gifDarkUrl) return [img];
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${htmlAttribute(view.gifDarkUrl)}">`,
    `  <source media="(prefers-color-scheme: light)" srcset="${htmlAttribute(view.gifUrl)}">`,
    `  ${img}`,
    '</picture>',
  ];
}

type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

/** The GitHub alert that colors each status: blue while waiting or running, green for approval, purple for a result to act on, yellow for a retry or cancellation, red for a failure. */
function alertType(view: ReviewStatusView): AlertType {
  switch (view.state.phase) {
    case 'queued':
    case 'reviewing':
      return 'NOTE';
    case 'retrying':
    case 'cancelled':
      return 'WARNING';
    case 'failed':
      return 'CAUTION';
    case 'completed':
      return view.stats?.verdict === 'approve' ? 'TIP' : 'IMPORTANT';
  }
}

/** The status content for one lifecycle step, before it is wrapped in its alert. */
function statusLines(view: ReviewStatusView): string[] {
  const { state, reviewerName } = view;
  switch (state.phase) {
    case 'queued':
      return [
        '### ⏳ Review queued',
        '',
        `${reviewerName} accepted the review request. The review has not started yet; this comment updates when it does.`,
      ];
    case 'retrying':
      return [
        '### ⏳ Review queued for retry',
        '',
        `The last attempt did not finish${view.reason ? `: ${inlineCode(view.reason)}` : '.'}`,
        `${reviewerName} retries automatically; this comment updates when the next attempt starts.`,
      ];
    case 'reviewing': {
      const since = state.startedAt ? ` since ${state.startedAt.replace(/\.\d+Z$/, 'Z')}` : '';
      const head = state.head ? ` on \`${shortSha(state.head)}\`` : '';
      return [
        '### Reviewing…',
        '',
        ...animation(view),
        '',
        `${reviewerName} is reviewing this pull request${head}${since}. This comment updates when the review finishes.`,
      ];
    }
    case 'completed':
      return [
        finalHeading(view),
        ...(view.stats?.verdict ? [] : ['', 'The review run ended without recording a verdict for this pass.']),
        ...footer(view),
      ];
    case 'failed':
      return [
        finalHeading(view),
        '',
        `The review did not finish${view.reason ? `: ${inlineCode(view.reason)}` : '.'}`,
        '',
        `Request a review from ${reviewerName} again to retry.`,
        ...footer(view),
      ];
    case 'cancelled':
      return [
        finalHeading(view),
        '',
        'This review pass was replaced before it finished, either by a newer review request or because the pull request moved on.',
        ...footer(view),
      ];
  }
}

/** The whole comment body for one lifecycle step: the hidden markers, then the status inside a GitHub alert. */
export function renderReviewStatusComment(view: ReviewStatusView): string {
  const quoted = statusLines(view).map(line => (line ? `> ${line}` : '>'));
  return `${[REVIEW_STATUS_COMMENT_MARKER, stateLine(view.state), `> [!${alertType(view)}]`, ...quoted].join('\n')}\n`;
}

/**
 * What the New page's starter cards count over every card of the project: failed runs, review
 * feedback, waiting pull requests, undecided and untriaged cards, unplanned bugs, the largest area
 * backlog and stale pull requests. Counted here so the page reads a few numbers, never the cards.
 */

import { boardForWorkItem } from '../boards/semantics.js';
import { FACTORY_ROLE_STAGES, FACTORY_RULE_STAGES } from '../rules/types.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
/** An area needs this many cards waiting before a sweep is worth suggesting. */
const SWEEP_MIN = 3;
const GITHUB_TYPE_LABELS = new Set([
  'bug',
  'documentation',
  'duplicate',
  'enhancement',
  'good first issue',
  'help wanted',
  'invalid',
  'question',
  'wontfix',
]);
/** The columns the Review board shows; a review card holding none of them sits in Intake. */
const REVIEW_BOARD_STAGES = ['intake', 'review', 'done', 'canceled'];
/** The lanes a pull request's own card moves through on Work. */
const WORK_PULL_REQUEST_STAGES = ['intake', 'pr-review', 'done', 'canceled'];
/** Lanes a card parked in Intake resumes into, shallowest first. */
const WORKING_LANES: readonly string[] = [...Object.values(FACTORY_ROLE_STAGES), 'pr-review'];

export interface WorkItemStarters {
  /** Open cards whose latest run failed. */
  failed: number;
  /** Factory's open pull requests whose current review asked for changes. */
  changesRequested: number;
  /** Open pull requests waiting in Intake (on Work, or Review where older ones were filed) opened in the last month. */
  review: { count: number; oldestOpenedAt?: string };
  /** Cards triage looked at and left in Work Intake for a person to decide on. */
  undecided: number;
  /** Cards in Work Intake that triage has not run on. */
  untriaged: number;
  /** Bugs not started that have no plan. */
  unplannedBugs: number;
  /** The area label with the most cards not started, when it has enough of them. */
  sweep?: { area: string; count: number };
  /** Open pull requests waiting in Intake for over a month. */
  stale: number;
}

function metadataOf(item: WorkItemRow): Record<string, unknown> {
  return item.metadata ?? {};
}

function labelsOf(item: WorkItemRow): string[] {
  const labels = metadataOf(item).labels;
  return Array.isArray(labels) ? labels.filter((label): label is string => typeof label === 'string') : [];
}

function inColumn(item: WorkItemRow, stage: string, columns: readonly string[]): boolean {
  if (item.stages.includes(stage)) return true;
  return stage === 'intake' && !columns.some(column => item.stages.includes(column));
}

function isOpen(item: WorkItemRow): boolean {
  return !item.stages.some(stage => stage === 'done' || stage === 'canceled');
}

function isPullRequest(item: WorkItemRow): boolean {
  return item.externalSource?.type === 'pull-request';
}

function inIntake(item: WorkItemRow): boolean {
  return boardForWorkItem(item) === 'work' && !isPullRequest(item) && inColumn(item, 'intake', FACTORY_RULE_STAGES);
}

function notStarted(item: WorkItemRow): boolean {
  return (
    inIntake(item) || (boardForWorkItem(item) === 'work' && !isPullRequest(item) && item.stages.includes('triage'))
  );
}

/** A pull request's own card, on Work or on the Review board it used to be filed on. */
function reviewedPullRequest(item: WorkItemRow): boolean {
  const board = boardForWorkItem(item);
  return isPullRequest(item) && (board === 'work' || board === 'review');
}

function pullRequestIsOpen(item: WorkItemRow): boolean {
  const metadata = metadataOf(item);
  if (metadata.merged === true || metadata.state === 'closed') return false;
  if (metadata.state === 'open') return metadata.draft !== true;
  if (item.stages.includes('done') || item.stages.includes('canceled')) return false;
  return metadata.draft !== true;
}

function waitsForReview(item: WorkItemRow): boolean {
  return (
    reviewedPullRequest(item) &&
    inColumn(item, 'intake', boardForWorkItem(item) === 'work' ? WORK_PULL_REQUEST_STAGES : REVIEW_BOARD_STAGES) &&
    pullRequestIsOpen(item)
  );
}

/** When the upstream issue or pull request opened, falling back to when the card was made. */
function openedAt(item: WorkItemRow): number {
  const source = metadataOf(item).sourceCreatedAt;
  const parsed = typeof source === 'string' ? Date.parse(source) : Number.NaN;
  return Number.isNaN(parsed) ? item.createdAt.getTime() : parsed;
}

/** A current request for changes: a push past the reviewed head makes the verdict outdated. */
function changesRequested(item: WorkItemRow): boolean {
  const metadata = metadataOf(item);
  if (!reviewedPullRequest(item) || metadata.factoryAuthored !== true) return false;
  if (!pullRequestIsOpen(item) || metadata.reviewVerdict !== 'request changes') return false;
  const reviewed = typeof metadata.reviewedHeadSha === 'string' ? metadata.reviewedHeadSha : undefined;
  const head = typeof metadata.pullRequestHeadSha === 'string' ? metadata.pullRequestHeadSha : undefined;
  return reviewed === undefined || head === undefined || reviewed.toLowerCase() === head.toLowerCase();
}

/**
 * Triage ran and left the card in Intake for a person to decide on. A card that has been past
 * Triage since (a parked build, say) resumes instead, so it is not waiting on a decision.
 */
function awaitsDecision(item: WorkItemRow): boolean {
  if (item.sessions.triage === undefined) return false;
  const visited = new Set(item.stageHistory.map(entry => entry.stage));
  const lane = WORKING_LANES.filter(stage => visited.has(stage)).at(-1);
  return lane === undefined || lane === 'triage';
}

function isBug(item: WorkItemRow): boolean {
  return labelsOf(item).some(label => label.toLowerCase() === 'bug');
}

function areaLabels(item: WorkItemRow): string[] {
  return labelsOf(item).filter(label => !label.includes(':') && !GITHUB_TYPE_LABELS.has(label.toLowerCase()));
}

/** `failedIds`: cards whose latest run failed, whatever stage they sit in. */
export function workItemStarters(
  items: readonly WorkItemRow[],
  failedIds: ReadonlySet<string>,
  now: Date,
): WorkItemStarters {
  const monthAgo = now.getTime() - MONTH_MS;
  const starters: WorkItemStarters = {
    failed: 0,
    changesRequested: 0,
    review: { count: 0 },
    undecided: 0,
    untriaged: 0,
    unplannedBugs: 0,
    stale: 0,
  };
  let oldestReview = Number.POSITIVE_INFINITY;
  const byArea = new Map<string, number>();
  for (const item of items) {
    if (failedIds.has(item.id) && isOpen(item)) starters.failed += 1;
    if (changesRequested(item)) starters.changesRequested += 1;
    if (waitsForReview(item)) {
      const opened = openedAt(item);
      if (opened >= monthAgo) {
        starters.review.count += 1;
        oldestReview = Math.min(oldestReview, opened);
      } else {
        starters.stale += 1;
      }
    }
    if (inIntake(item) && item.sessions.triage === undefined) starters.untriaged += 1;
    if (inIntake(item) && awaitsDecision(item)) starters.undecided += 1;
    if (!notStarted(item)) continue;
    if (isBug(item) && item.sessions.plan === undefined) starters.unplannedBugs += 1;
    for (const area of areaLabels(item)) byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  if (starters.review.count > 0) starters.review.oldestOpenedAt = new Date(oldestReview).toISOString();
  const largest = [...byArea].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0];
  if (largest && largest[1] >= SWEEP_MIN) starters.sweep = { area: largest[0], count: largest[1] };
  return starters;
}

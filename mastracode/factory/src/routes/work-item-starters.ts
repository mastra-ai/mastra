/**
 * What the draft page's starter buttons count: each number is the cards one button would act on,
 * read off the project's default board. The page words the buttons; the rules for which cards
 * count live here, so the page never downloads the board to count them.
 */

import type { z } from 'zod';

import type { InstalledBoard } from '../boards/index.js';
import { boardFlow, boardForWorkItem, isPullRequestCard } from '../boards/index.js';
import type { FactoryRuleBoardFlow } from '../rules/types.js';
import type { Card, FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';
import { workItemBranchSource } from '../work-item-branch.js';
import type { workItemStartersResponseSchema } from './contracts.js';

export type WorkItemStarters = z.infer<typeof workItemStartersResponseSchema>;

/**
 * The decisions a board's cards show their run state from: one page of these statuses, newest
 * first. Failures older than that page are not counted, on the cards or here.
 */
export const CARD_DECISION_STATUSES = ['pending', 'proposed', 'leased', 'retry', 'failed'] as const;
export const CARD_DECISION_PAGE_SIZE = 50;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A pull request waiting longer than this is stale rather than waiting for review. */
const REVIEW_HORIZON_MS = 30 * DAY_MS;

/** Labels GitHub ships with every repository: they say what kind of issue it is, not which area. */
const GITHUB_TYPE_LABELS = [
  'bug',
  'documentation',
  'duplicate',
  'enhancement',
  'good first issue',
  'help wanted',
  'invalid',
  'question',
  'wontfix',
];

/** The cards whose newest decision past proposal failed: a proposal waits on a person, it is not the run's state. */
export function cardsWithFailedRun(
  decisions: readonly Pick<FactoryDeferredDecisionRecord, 'workItemId' | 'status'>[],
): Set<string> {
  const settled = new Set<string>();
  const failed = new Set<string>();
  for (const { workItemId, status } of decisions) {
    // A decision about no card says nothing of a card's run.
    if (workItemId === null || status === 'proposed' || settled.has(workItemId)) continue;
    settled.add(workItemId);
    if (status === 'failed') failed.add(workItemId);
  }
  return failed;
}

/**
 * What the card's source says about it. A Factory card has no source: its facts are its work
 * item's with the card's own on top, as clients read them. A synced one keeps them on its work item.
 */
function sourceFacts(card: Card): Record<string, unknown> {
  const { workItem } = card;
  if (workItem.provider === 'factory') return { ...workItem.metadata, ...card.metadata };
  return { ...workItem.metadata, labels: workItem.labels, state: workItem.state };
}

function labelsOf({ labels }: Record<string, unknown>): string[] {
  return Array.isArray(labels) ? labels.filter((label): label is string => typeof label === 'string') : [];
}

function isPullRequest(card: Card): boolean {
  return isPullRequestCard({ source: workItemBranchSource(card.externalSource) });
}

/** An open pull request that is not a draft. A source that reports no state is read off the card: `finished` says it sits in a terminal phase. */
function isOpenPullRequest(facts: Record<string, unknown>, finished: boolean): boolean {
  if (facts.state === 'merged' || facts.merged === true || facts.state === 'closed') return false;
  if (facts.state !== 'open' && finished) return false;
  return facts.draft !== true;
}

function openedAt(card: Card, { sourceCreatedAt }: Record<string, unknown>): number {
  const opened = typeof sourceCreatedAt === 'string' ? Date.parse(sourceCreatedAt) : Number.NaN;
  return Number.isNaN(opened) ? card.createdAt.getTime() : opened;
}

/** A review verdict given on an earlier head no longer speaks for the pull request. */
function verdictOutdated({ reviewedHeadSha, pullRequestHeadSha }: Record<string, unknown>): boolean {
  return (
    typeof reviewedHeadSha === 'string' &&
    typeof pullRequestHeadSha === 'string' &&
    reviewedHeadSha.toLowerCase() !== pullRequestHeadSha.toLowerCase()
  );
}

/** The seats of a board's loop the starters ask about. */
interface StarterSeats {
  /** The phase that triages a card and the context its session is kept under. */
  triage?: { phase: string; context: string };
  /** The context that plans and builds. */
  planner?: string;
  /** The phase that plans before the build, when the board has one. */
  planPhase?: string;
  /** The working phases, in declaration order. */
  working: string[];
}

function starterSeats(board: InstalledBoard, flow: FactoryRuleBoardFlow): StarterSeats {
  const working = Object.keys(board.phases).filter(phase => board.phaseKind(phase) === 'working');
  const triageContext = flow.triage === undefined ? undefined : board.roleForPhase(flow.triage);
  const build = flow.build;
  return {
    working,
    ...(flow.triage !== undefined && triageContext !== undefined
      ? { triage: { phase: flow.triage, context: triageContext } }
      : {}),
    ...(flow.buildRole !== undefined ? { planner: flow.buildRole } : {}),
    ...(build !== undefined
      ? {
          planPhase: working.find(
            phase =>
              phase !== build && board.roleForPhase(phase) === flow.buildRole && board.allowsTransition(phase, build),
          ),
        }
      : {}),
  };
}

/**
 * Whether a triaged card resting in the first phase waits on a person's decision: its next move
 * is still triage, because no later working phase has held it.
 */
function awaitsTriageDecision(board: InstalledBoard, seats: StarterSeats, card: Card): boolean {
  const { triage } = seats;
  if (!triage || card.sessions[triage.context] === undefined) return false;
  const deepest = seats.working.findLast(phase => card.stageHistory.some(entry => entry.stage === phase));
  if (deepest === undefined) return true;
  const resume = board.allowsTransition(board.initialPhase, deepest) ? deepest : (seats.planPhase ?? deepest);
  return resume === triage.phase;
}

/**
 * Count the cards behind each starter. `cards` are the project's cards as storage holds them,
 * `failedCardIds` the cards whose run failed ({@link cardsWithFailedRun}).
 */
export function workItemStarters({
  board,
  cards,
  failedCardIds,
  now,
}: {
  board: InstalledBoard | undefined;
  cards: readonly Card[];
  failedCardIds: ReadonlySet<string>;
  now: number;
}): WorkItemStarters {
  const starters: WorkItemStarters = {
    failed: 0,
    changesRequested: 0,
    review: { count: 0 },
    undecided: 0,
    untriaged: 0,
    unplannedBugs: 0,
    stale: 0,
  };
  if (!board) return starters;

  const flow = boardFlow(board);
  const seats = starterSeats(board, flow);
  const firstPhase = Object.keys(board.phases)[0];
  const triagePhase = flow.triage;
  const horizon = now - REVIEW_HORIZON_MS;
  const areas = new Map<string, number>();
  let oldestOpenedAt = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    // Finished is judged by the default board's terminal phases for every card, as the buttons always have.
    const finished = card.stages.some(stage => board.isTerminal(stage));
    if (failedCardIds.has(card.id) && !finished) starters.failed += 1;
    if (boardForWorkItem(card) !== board.id) continue;

    // A card in none of the board's phases rests in the first one when that is where cards start.
    const resting =
      card.stages.includes(board.initialPhase) ||
      (board.initialPhase === firstPhase && !card.stages.some(stage => Object.hasOwn(board.phases, stage)));

    if (isPullRequest(card)) {
      const facts = sourceFacts(card);
      if (!isOpenPullRequest(facts, finished)) continue;
      // Factory's verdict sits on the card, over what the source reports.
      const verdict = { ...card.workItem.metadata, ...card.metadata };
      if (
        verdict.factoryAuthored === true &&
        verdict.reviewVerdict === 'request changes' &&
        !verdictOutdated(verdict)
      ) {
        starters.changesRequested += 1;
      }
      if (!resting) continue;
      const opened = openedAt(card, facts);
      if (opened < horizon) {
        starters.stale += 1;
      } else {
        starters.review.count += 1;
        oldestOpenedAt = Math.min(oldestOpenedAt, opened);
      }
      continue;
    }

    if (resting && seats.triage) {
      if (card.sessions[seats.triage.context] === undefined) starters.untriaged += 1;
      else if (awaitsTriageDecision(board, seats, card)) starters.undecided += 1;
    }

    const notStarted = resting || (triagePhase !== undefined && card.stages.includes(triagePhase));
    if (!notStarted) continue;
    const labels = labelsOf(sourceFacts(card));
    if (
      seats.planner !== undefined &&
      labels.some(label => label.toLowerCase() === 'bug') &&
      card.sessions[seats.planner] === undefined &&
      // Cards planned before planning moved into the build context hold their planner under `plan`.
      card.sessions.plan === undefined
    ) {
      starters.unplannedBugs += 1;
    }
    for (const label of labels) {
      if (label.includes(':') || GITHUB_TYPE_LABELS.includes(label.toLowerCase())) continue;
      areas.set(label, (areas.get(label) ?? 0) + 1);
    }
  }

  if (starters.review.count > 0) starters.review.oldestOpenedAt = new Date(oldestOpenedAt).toISOString();
  const [largest] = [...areas].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  if (largest) starters.sweep = { area: largest[0], count: largest[1] };
  return starters;
}

import { hasLabel, metadataLabels, pullRequestStatusForItem, sourceCreatedAt, sourceMetadata } from './boardItems';
import { boardLoop, phaseKindOf } from './boardFlow';
import type { BoardInfo } from './boardFlow';
import { belongsToBoard, itemAppearsInStage } from './boardStages';
import { awaitsTriageDecision, triageDecisions } from './cardPrimaryAction';
import { reviewVerdict } from './reviewVerdict';
import type { FactoryDecisionSummary } from './services/decisions';
import { isPullRequestSource } from './services/workItems';
import type { WorkItem } from './services/workItems';

export type StarterKind = 'unblock' | 'feedback' | 'review' | 'decide' | 'triage' | 'bug' | 'sweep' | 'stale';

interface StarterFact {
  label: string;
  value: number;
  unit?: string;
  action: string;
}

export interface StarterPrompt extends StarterFact {
  kind: StarterKind;
  prompt: string;
}

const SHOWN = 6;
const BATCH = 5;
const SWEEP_MIN = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
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
/** The default board, by its own names: starters speak of its rest phase and the choices triage leaves. */
function prompts(board: BoardInfo): Record<StarterKind, string> {
  const boardName = board.name ?? board.title;
  const restPhase = board.phases.find(phase => phase.id === board.initialPhase);
  const rest = `${restPhase?.name ?? restPhase?.title ?? board.initialPhase} on the ${boardName} board`;
  const choices = new Intl.ListFormat('en', { type: 'disjunction' }).format(
    triageDecisions(board).map(({ label }) => label),
  );
  return {
    unblock: `Look at the open cards whose last run failed, ${BATCH} at most. For each one, find out why the run failed. Retry the ones you can fix, and tell me what the others need.`,
    feedback: `Find Factory's open pull requests whose latest review asked for changes, ${BATCH} at most. Make the changes each review comment asks for, push them, and request a new review.`,
    review: `Start a review session for each of the ${BATCH} oldest open pull requests in ${rest} that were opened in the last month.`,
    decide: `Go through the ${BATCH} oldest cards triage left in ${rest} for a person to decide on. For each one, say in a line what it is and suggest ${choices}, with your reason. Change nothing until I say so.`,
    triage: `Triage the ${BATCH} newest untriaged cards in ${rest}. Accept the clear ones and flag the rest for me.`,
    bug: `Of the open bugs on the ${boardName} board that nobody has planned yet, pick the one with the biggest impact and draft a plan to fix it.`,
    sweep: `Find the area label with the most open cards on the ${boardName} board that nobody has started yet. Group those cards by root cause, point out duplicates, and draft a plan for the biggest group. Change nothing until I say so.`,
    stale: `Go through the ${BATCH} oldest pull requests that have waited in ${rest} for over a month. For each one, suggest closing it or keeping it open, and say why. Close nothing until I say so.`,
  };
}

function upTo(total: number, verb: string): string {
  return total === 1 ? `${verb} it` : `${verb} ${Math.min(BATCH, total)}`;
}

function theBatch(total: number, verb: string, which: string): string {
  return total === 1 ? `${verb} it` : `${verb} the ${Math.min(BATCH, total)} ${which}`;
}

function openedAt(item: WorkItem): number {
  return Date.parse(sourceCreatedAt(sourceMetadata(item)) ?? item.createdAt);
}

function isOpen(board: BoardInfo, item: WorkItem): boolean {
  return !item.stages.some(stage => phaseKindOf(board, stage) === 'terminal');
}

/** On the default board, waiting in the phase new cards rest in. */
function inRest(board: BoardInfo, item: WorkItem): boolean {
  return belongsToBoard(item, board.id) && itemAppearsInStage(item, board.initialPhase, board.phases);
}

function inIntake(board: BoardInfo, item: WorkItem): boolean {
  return !isPullRequestSource(item.source) && inRest(board, item);
}

function notStarted(board: BoardInfo, item: WorkItem): boolean {
  const triage = boardLoop(board)?.triage?.phase;
  return (
    inIntake(board, item) ||
    (belongsToBoard(item, board.id) &&
      !isPullRequestSource(item.source) &&
      triage !== undefined &&
      item.stages.includes(triage))
  );
}

/** A pull request's own card on the default board. */
function reviewedPullRequest(board: BoardInfo, item: WorkItem): boolean {
  return isPullRequestSource(item.source) && belongsToBoard(item, board.id);
}

function waitsForReview(board: BoardInfo, item: WorkItem): boolean {
  return reviewedPullRequest(board, item) && inRest(board, item) && pullRequestStatusForItem(item) === 'open';
}

function areaLabels(item: WorkItem): string[] {
  return metadataLabels(sourceMetadata(item)).filter(
    label => !label.includes(':') && !GITHUB_TYPE_LABELS.has(label.toLowerCase()),
  );
}

function unblock(
  board: BoardInfo,
  cards: readonly WorkItem[],
  effectByItem: ReadonlyMap<string, FactoryDecisionSummary>,
) {
  const failed = cards.filter(item => effectByItem.get(item.id)?.status === 'failed' && isOpen(board, item)).length;
  if (failed === 0) return undefined;
  return { label: 'Failed runs', value: failed, action: upTo(failed, 'Debug and retry') };
}

function feedback(board: BoardInfo, cards: readonly WorkItem[]) {
  const changesRequested = cards.filter(item => {
    if (!reviewedPullRequest(board, item) || item.metadata.factoryAuthored !== true) return false;
    if (pullRequestStatusForItem(item) !== 'open') return false;
    const verdict = reviewVerdict(item.metadata);
    return verdict !== undefined && !verdict.approved && !verdict.outdated;
  }).length;
  if (changesRequested === 0) return undefined;
  return { label: 'Changes requested', value: changesRequested, action: 'Make the changes' };
}

function review(board: BoardInfo, cards: readonly WorkItem[], now: number) {
  const since = now - MONTH_MS;
  const opened = cards
    .filter(item => waitsForReview(board, item))
    .map(openedAt)
    .filter(time => time >= since);
  if (opened.length === 0) return undefined;
  const days = Math.floor((now - Math.min(...opened)) / DAY_MS);
  return {
    label: 'Longest review wait',
    value: days,
    unit: days === 1 ? 'day' : 'days',
    action: theBatch(opened.length, 'Review', 'oldest'),
  };
}

function decide(board: BoardInfo, cards: readonly WorkItem[]) {
  const undecided = cards.filter(
    item => inIntake(board, item) && awaitsTriageDecision(item, board.initialPhase, board),
  ).length;
  if (undecided === 0) return undefined;
  return { label: 'Triaged, waiting for you', value: undecided, action: 'Help me decide' };
}

function triage(board: BoardInfo, cards: readonly WorkItem[]) {
  const context = boardLoop(board)?.triage?.context;
  if (context === undefined) return undefined;
  const untriaged = cards.filter(item => inIntake(board, item) && item.sessions[context] === undefined).length;
  if (untriaged === 0) return undefined;
  return {
    label: `Untriaged in ${board.phases.find(phase => phase.id === board.initialPhase)?.title ?? board.initialPhase}`,
    value: untriaged,
    action: theBatch(untriaged, 'Triage', 'newest'),
  };
}

function bug(board: BoardInfo, cards: readonly WorkItem[]) {
  const loop = boardLoop(board);
  const planner = (loop?.plan ?? loop?.build)?.context;
  if (planner === undefined) return undefined;
  const unplanned = cards.filter(
    item =>
      notStarted(board, item) &&
      hasLabel(metadataLabels(sourceMetadata(item)), 'bug') &&
      item.sessions[planner] === undefined &&
      // Cards planned before planning ran in the build context hold a `plan` session.
      item.sessions.plan === undefined,
  ).length;
  if (unplanned === 0) return undefined;
  return {
    label: 'Bugs with no plan',
    value: unplanned,
    action: unplanned === 1 ? 'Plan a fix' : 'Plan a fix for one',
  };
}

function sweep(board: BoardInfo, cards: readonly WorkItem[]) {
  const byArea = new Map<string, number>();
  for (const item of cards.filter(card => notStarted(board, card))) {
    for (const area of areaLabels(item)) byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  const largest = [...byArea].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0];
  if (largest === undefined || largest[1] < SWEEP_MIN) return undefined;
  const [area, waiting] = largest;
  return { label: `${area} backlog`, value: waiting, action: 'Group by root cause' };
}

function stale(board: BoardInfo, cards: readonly WorkItem[], now: number) {
  const before = now - MONTH_MS;
  const forgotten = cards.filter(item => waitsForReview(board, item) && openedAt(item) < before).length;
  if (forgotten === 0) return undefined;
  return { label: 'Stale pull requests', value: forgotten, action: 'Flag what to close' };
}

export function starterPrompts({
  board,
  cards,
  effectByItem,
  now,
}: {
  /** The project's default board; without it there is nothing to suggest. */
  board: BoardInfo | undefined;
  cards: readonly WorkItem[];
  effectByItem: ReadonlyMap<string, FactoryDecisionSummary>;
  now: Date;
}): StarterPrompt[] {
  if (!board) return [];
  const at = now.getTime();
  const texts = prompts(board);
  const facts: Array<[StarterKind, StarterFact | undefined]> = [
    ['unblock', unblock(board, cards, effectByItem)],
    ['feedback', feedback(board, cards)],
    ['review', review(board, cards, at)],
    ['decide', decide(board, cards)],
    ['triage', triage(board, cards)],
    ['bug', bug(board, cards)],
    ['sweep', sweep(board, cards)],
    ['stale', stale(board, cards, at)],
  ];
  return facts
    .flatMap(([kind, fact]) => (fact === undefined ? [] : [{ kind, prompt: texts[kind], ...fact }]))
    .slice(0, SHOWN);
}

import { hasLabel, metadataLabels, pullRequestStatusForItem, sourceCreatedAt } from './boardItems';
import { belongsToBoard, boardStages, itemAppearsInStage } from './boardStages';
import { awaitsTriageDecision } from './cardPrimaryAction';
import { reviewVerdict } from './reviewVerdict';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem } from './services/workItems';
import { BOARD_STAGES, isTerminalStage } from './stages';

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

const PROMPTS: Record<StarterKind, string> = {
  unblock: `Find the open cards whose last Factory run failed, ${BATCH} at most. Work out why each run failed, retry the fixable ones, and tell me what the others need.`,
  feedback: `Find the open Factory pull requests where the Factory review requested changes, ${BATCH} at most. Address each review comment, push the fixes, and re-request review.`,
  review: `Start a review session for each of the ${BATCH} oldest open pull requests waiting in Intake on the Review board, opened in the last month.`,
  decide: `Go through the ${BATCH} oldest cards on the Work board that triage classified but nobody has accepted yet. Summarize each in one line and recommend accepting, merging, or closing it. Change nothing until I say so.`,
  triage: `Triage the ${BATCH} newest cards in Intake on the Work board that triage has not classified yet. Accept the obvious ones and flag the unclear ones for me.`,
  bug: 'Pick the highest-impact open bug on the Work board that nobody has planned yet, and draft a plan to fix it.',
  sweep:
    'Find the area label with the most open cards waiting on the Work board. Group those cards by root cause, flag duplicates, and draft a plan for the biggest group.',
  stale: `Go through the ${BATCH} oldest pull requests that have waited in Intake on the Review board for over a month. For each one, recommend closing or reviving it and say why. Close nothing until I say so.`,
};

function upTo(total: number, verb: string): string {
  return total === 1 ? `${verb} it` : `${verb} ${Math.min(BATCH, total)}`;
}

function theBatch(total: number, verb: string, which: string): string {
  return total === 1 ? `${verb} it` : `${verb} the ${Math.min(BATCH, total)} ${which}`;
}

function openedAt(item: WorkItem): number {
  return Date.parse(sourceCreatedAt(item.metadata) ?? item.createdAt);
}

function isOpen(item: WorkItem): boolean {
  return !item.stages.some(isTerminalStage);
}

function inIntake(item: WorkItem): boolean {
  return belongsToBoard(item, 'work') && itemAppearsInStage(item, 'intake', BOARD_STAGES);
}

function notStarted(item: WorkItem): boolean {
  return inIntake(item) || (belongsToBoard(item, 'work') && item.stages.includes('triage'));
}

function waitsForReview(item: WorkItem): boolean {
  return (
    belongsToBoard(item, 'review') &&
    itemAppearsInStage(item, 'intake', boardStages('review')) &&
    pullRequestStatusForItem(item) === 'open'
  );
}

function areaLabels(item: WorkItem): string[] {
  return metadataLabels(item.metadata).filter(
    label => !label.includes(':') && !GITHUB_TYPE_LABELS.has(label.toLowerCase()),
  );
}

function unblock(cards: readonly WorkItem[], effectByItem: ReadonlyMap<string, FactoryDecisionSummary>) {
  const failed = cards.filter(item => effectByItem.get(item.id)?.status === 'failed' && isOpen(item)).length;
  if (failed === 0) return undefined;
  return { label: 'Failed runs', value: failed, action: upTo(failed, 'Unblock') };
}

function feedback(cards: readonly WorkItem[]) {
  const changesRequested = cards.filter(item => {
    if (!belongsToBoard(item, 'review') || item.metadata.factoryAuthored !== true) return false;
    if (pullRequestStatusForItem(item) !== 'open') return false;
    const verdict = reviewVerdict(item.metadata);
    return verdict !== undefined && !verdict.approved && !verdict.outdated;
  }).length;
  if (changesRequested === 0) return undefined;
  return { label: 'Changes requested', value: changesRequested, action: 'Fix the feedback' };
}

function review(cards: readonly WorkItem[], now: number) {
  const since = now - MONTH_MS;
  const opened = cards
    .filter(waitsForReview)
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

function decide(cards: readonly WorkItem[]) {
  const undecided = cards.filter(
    item => notStarted(item) && awaitsTriageDecision(item, inIntake(item) ? 'intake' : 'triage'),
  ).length;
  if (undecided === 0) return undefined;
  return { label: 'Needs your decision', value: undecided, action: theBatch(undecided, 'Decide on', 'oldest') };
}

function triage(cards: readonly WorkItem[]) {
  const untriaged = cards.filter(item => inIntake(item) && item.triageType === null).length;
  if (untriaged === 0) return undefined;
  return { label: 'Untriaged in Intake', value: untriaged, action: theBatch(untriaged, 'Triage', 'newest') };
}

function bug(cards: readonly WorkItem[]) {
  const unplanned = cards.filter(
    item =>
      notStarted(item) &&
      (item.triageType === 'bug' || hasLabel(metadataLabels(item.metadata), 'bug')) &&
      item.sessions.plan === undefined,
  ).length;
  if (unplanned === 0) return undefined;
  return {
    label: 'Bugs with no plan',
    value: unplanned,
    action: unplanned === 1 ? 'Plan a fix for it' : 'Plan a fix for one',
  };
}

function sweep(cards: readonly WorkItem[]) {
  const byArea = new Map<string, number>();
  for (const item of cards.filter(notStarted)) {
    for (const area of areaLabels(item)) byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  const largest = [...byArea].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0];
  if (largest === undefined || largest[1] < SWEEP_MIN) return undefined;
  const [area, waiting] = largest;
  return { label: `Waiting in ${area}`, value: waiting, action: 'Sweep the area' };
}

function stale(cards: readonly WorkItem[], now: number) {
  const before = now - MONTH_MS;
  const forgotten = cards.filter(item => waitsForReview(item) && openedAt(item) < before).length;
  if (forgotten === 0) return undefined;
  return { label: 'Stale pull requests', value: forgotten, action: upTo(forgotten, 'Close or revive') };
}

export function starterPrompts({
  cards,
  effectByItem,
  now,
}: {
  cards: readonly WorkItem[];
  effectByItem: ReadonlyMap<string, FactoryDecisionSummary>;
  now: Date;
}): StarterPrompt[] {
  const at = now.getTime();
  const facts: Array<[StarterKind, StarterFact | undefined]> = [
    ['unblock', unblock(cards, effectByItem)],
    ['feedback', feedback(cards)],
    ['review', review(cards, at)],
    ['decide', decide(cards)],
    ['triage', triage(cards)],
    ['bug', bug(cards)],
    ['sweep', sweep(cards)],
    ['stale', stale(cards, at)],
  ];
  return facts
    .flatMap(([kind, fact]) => (fact === undefined ? [] : [{ kind, prompt: PROMPTS[kind], ...fact }]))
    .slice(0, SHOWN);
}

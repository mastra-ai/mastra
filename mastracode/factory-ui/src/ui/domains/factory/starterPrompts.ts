import { hasLabel, metadataLabels, pullRequestStatusForItem, sourceCreatedAt } from './boardItems';
import { belongsToBoard, boardStages, itemAppearsInStage } from './boardStages';
import { awaitsTriageDecision, TRIAGE_DECISIONS } from './cardPrimaryAction';
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
const TRIAGE_CHOICES = new Intl.ListFormat('en', { type: 'disjunction' }).format(
  TRIAGE_DECISIONS.map(({ label }) => label),
);

const PROMPTS: Record<StarterKind, string> = {
  unblock: `Look at the open cards whose last run failed, ${BATCH} at most. For each one, find out why the run failed. Retry the ones you can fix, and tell me what the others need.`,
  feedback: `Find Factory's open pull requests whose latest review asked for changes, ${BATCH} at most. Make the changes each review comment asks for, push them, and request a new review.`,
  review: `Start a review session for each of the ${BATCH} oldest open pull requests in Intake on the Review board that were opened in the last month.`,
  decide: `Go through the ${BATCH} oldest cards on the Work board that triage classified and nobody has accepted yet. For each one, say in a line what it is and suggest ${TRIAGE_CHOICES}, with your reason. Change nothing until I say so.`,
  triage: `Triage the ${BATCH} newest untriaged cards in Intake on the Work board. Accept the clear ones and flag the rest for me.`,
  bug: 'Of the open bugs on the Work board that nobody has planned yet, pick the one with the biggest impact and draft a plan to fix it.',
  sweep:
    'Find the area label with the most open cards on the Work board that nobody has started yet. Group those cards by root cause, point out duplicates, and draft a plan for the biggest group.',
  stale: `Go through the ${BATCH} oldest pull requests that have waited in Intake on the Review board for over a month. For each one, suggest closing it or keeping it open, and say why. Close nothing until I say so.`,
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
  return { label: 'Failed runs', value: failed, action: upTo(failed, 'Debug and retry') };
}

function feedback(cards: readonly WorkItem[]) {
  const changesRequested = cards.filter(item => {
    if (!belongsToBoard(item, 'review') || item.metadata.factoryAuthored !== true) return false;
    if (pullRequestStatusForItem(item) !== 'open') return false;
    const verdict = reviewVerdict(item.metadata);
    return verdict !== undefined && !verdict.approved && !verdict.outdated;
  }).length;
  if (changesRequested === 0) return undefined;
  return { label: 'Changes requested', value: changesRequested, action: 'Make the changes' };
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
  return { label: 'Not yet accepted', value: undecided, action: 'Help me decide' };
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
    action: unplanned === 1 ? 'Plan a fix' : 'Plan a fix for one',
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
  return { label: `${area} backlog`, value: waiting, action: 'Group by root cause' };
}

function stale(cards: readonly WorkItem[], now: number) {
  const before = now - MONTH_MS;
  const forgotten = cards.filter(item => waitsForReview(item) && openedAt(item) < before).length;
  if (forgotten === 0) return undefined;
  return { label: 'Stale pull requests', value: forgotten, action: 'Flag what to close' };
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

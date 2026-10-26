import { hasLabel, metadataLabels, pullRequestStatusForItem, sourceCreatedAt, workItemKey } from './boardItems';
import { belongsToBoard, boardStages, itemAppearsInStage } from './boardStages';
import { reviewVerdict } from './components/WorkItemCardRows';
import type { FactoryDecisionSummary } from './services/decisions';
import type { WorkItem } from './services/workItems';
import { BOARD_STAGES, isTerminalStage } from './stages';

export type StarterKind = 'unblock' | 'feedback' | 'review' | 'triage' | 'bug' | 'shipped';

export interface StarterPrompt {
  kind: StarterKind;
  title: string;
  detail: string;
  prompt: string;
}

const LISTED = 5;
const RECAPPED = 20;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function count(amount: number, noun: string): string {
  return `${amount} ${noun}${amount === 1 ? '' : 's'}`;
}

function label(item: WorkItem): string {
  const key = workItemKey(item);
  return key === undefined ? item.title : `${key} ${item.title}`;
}

function openedAt(item: WorkItem): number {
  return Date.parse(sourceCreatedAt(item.metadata) ?? item.createdAt);
}

function enteredAt(item: WorkItem, stage: string): number | undefined {
  const entry = item.stageHistory.findLast(candidate => candidate.stage === stage);
  return entry && Date.parse(entry.enteredAt);
}

function arrivedAt(item: WorkItem): number {
  return enteredAt(item, 'intake') ?? Date.parse(item.createdAt);
}

function isOpen(item: WorkItem): boolean {
  return !item.stages.some(isTerminalStage);
}

function starter(
  kind: StarterKind,
  title: string,
  lines: readonly string[],
  { lead, ask, limit = LISTED }: { lead: string; ask?: string; limit?: number },
): StarterPrompt {
  const rest = lines.length - limit;
  const listed = lines
    .slice(0, limit)
    .map(line => `- ${line}`)
    .join('\n');
  const prompt = [`${lead}\n${listed}`, rest > 0 ? `And ${rest} more on the board.` : undefined, ask]
    .filter(part => part !== undefined)
    .join('\n\n');
  return { kind, title, detail: lines.slice(0, 3).join(' · '), prompt };
}

function unblock(cards: readonly WorkItem[], effectByItem: ReadonlyMap<string, FactoryDecisionSummary>) {
  const failed = cards.flatMap(item => {
    const effect = effectByItem.get(item.id);
    if (effect?.status !== 'failed' || !isOpen(item)) return [];
    const error = effect.lastError?.split('\n')[0]?.trim();
    return [error ? `${label(item)}: ${error}` : label(item)];
  });
  if (failed.length === 0) return undefined;
  return starter('unblock', `Unblock ${count(failed.length, 'failed run')}`, failed, {
    lead: 'These Factory runs failed:',
    ask: 'Find out why each one failed, retry what’s fixable, and list the rest for me with what they need.',
  });
}

function feedback(cards: readonly WorkItem[]) {
  const changesRequested = cards.filter(item => {
    if (!belongsToBoard(item, 'review') || item.metadata.factoryAuthored !== true) return false;
    if (pullRequestStatusForItem(item) !== 'open') return false;
    const verdict = reviewVerdict(item.metadata);
    return verdict !== undefined && !verdict.approved && !verdict.outdated;
  });
  if (changesRequested.length === 0) return undefined;
  return starter(
    'feedback',
    `Fix review feedback on ${count(changesRequested.length, 'Factory pull request')}`,
    changesRequested.map(label),
    {
      lead: 'The Factory review requested changes on these pull requests:',
      ask: 'Address each review comment, push the fixes, and re-request review.',
    },
  );
}

function review(cards: readonly WorkItem[]) {
  const waiting = cards
    .filter(
      item =>
        belongsToBoard(item, 'review') &&
        itemAppearsInStage(item, 'intake', boardStages('review')) &&
        pullRequestStatusForItem(item) === 'open',
    )
    .sort((a, b) => openedAt(a) - openedAt(b));
  if (waiting.length === 0) return undefined;
  return starter('review', `Review ${count(waiting.length, 'open pull request')}`, waiting.map(label), {
    lead: 'Start a review session for each of these open pull requests, oldest first:',
  });
}

function triage(cards: readonly WorkItem[]) {
  const arrived = cards
    .filter(item => belongsToBoard(item, 'work') && itemAppearsInStage(item, 'intake', BOARD_STAGES))
    .sort((a, b) => arrivedAt(b) - arrivedAt(a));
  if (arrived.length === 0) return undefined;
  return starter('triage', `Triage ${count(arrived.length, 'card')} in Intake`, arrived.map(label), {
    lead: 'Triage these cards in Intake on the Work board, newest first:',
    ask: 'Accept the obvious ones and flag the rest for me.',
  });
}

function bug(cards: readonly WorkItem[]) {
  const unplanned = cards
    .filter(
      item =>
        belongsToBoard(item, 'work') &&
        (itemAppearsInStage(item, 'intake', BOARD_STAGES) || item.stages.includes('triage')) &&
        (item.triageType === 'bug' || hasLabel(metadataLabels(item.metadata), 'bug')) &&
        item.sessions.plan === undefined,
    )
    .sort((a, b) => openedAt(a) - openedAt(b));
  if (unplanned.length === 0) return undefined;
  const title =
    unplanned.length === 1 ? 'Plan a fix for the open bug' : `Plan a fix for one of ${unplanned.length} open bugs`;
  return starter('bug', title, unplanned.map(label), {
    lead: 'Pick the highest-impact bug below and draft a plan to fix it:',
  });
}

function shipped(cards: readonly WorkItem[], now: Date) {
  const since = now.getTime() - WEEK_MS;
  const done = cards
    .flatMap(item => {
      const at = item.stages.includes('done') ? enteredAt(item, 'done') : undefined;
      return at !== undefined && at >= since ? [{ item, at }] : [];
    })
    .sort((a, b) => b.at - a.at)
    .map(({ item }) => label(item));
  if (done.length === 0) return undefined;
  return starter('shipped', `Recap ${count(done.length, 'card')} done this week`, done, {
    lead: 'Summarize what shipped this week from the cards that reached Done:',
    ask: 'Group them by theme and call out anything still waiting on someone.',
    limit: RECAPPED,
  });
}

/** What the person could start on now, built from the board; a theme with nothing behind it is left out. */
export function starterPrompts({
  cards,
  effectByItem,
  now,
}: {
  cards: readonly WorkItem[];
  effectByItem: ReadonlyMap<string, FactoryDecisionSummary>;
  now: Date;
}): StarterPrompt[] {
  return [
    unblock(cards, effectByItem),
    feedback(cards),
    review(cards),
    triage(cards),
    bug(cards),
    shipped(cards, now),
  ].filter(prompt => prompt !== undefined);
}

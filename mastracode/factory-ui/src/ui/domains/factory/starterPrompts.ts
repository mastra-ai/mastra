import { hasLabel, metadataLabels, pullRequestStatusForItem, sourceCreatedAt, workItemKey } from './boardItems';
import { belongsToBoard, boardStages, itemAppearsInStage } from './boardStages';
import { reviewVerdict } from './reviewVerdict';
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
const RECAP_EXAMPLES = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function count(amount: number, noun: string): string {
  return `${amount} ${noun}${amount === 1 ? '' : 's'}`;
}

function batch(total: number, noun: string): string {
  return total > LISTED ? `${LISTED} of ${count(total, noun)}` : count(total, noun);
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
  {
    lead,
    ask,
    limit = LISTED,
    scope = 'batch',
  }: { lead: string; ask?: string; limit?: number; scope?: 'batch' | 'examples' },
): StarterPrompt {
  const rest = lines.length - limit;
  const listed = lines
    .slice(0, limit)
    .map(line => `- ${line}`)
    .join('\n');
  const leaveRest = rest > 0 && scope === 'batch' ? `Leave the other ${rest} for another session.` : undefined;
  const prompt = [`${lead}\n${listed}`, leaveRest, ask].filter(part => part !== undefined).join('\n\n');
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
  return starter('unblock', `Unblock ${batch(failed.length, 'failed run')}`, failed, {
    lead: 'These Factory runs failed:',
    ask: 'Find out why each one failed, retry the fixable ones, and tell me what the remaining ones need.',
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
    `Fix review feedback on ${batch(changesRequested.length, 'Factory pull request')}`,
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
  return starter('review', `Review ${batch(waiting.length, 'open pull request')}`, waiting.map(label), {
    lead: 'Start a review session for each of these open pull requests, oldest first:',
  });
}

function triage(cards: readonly WorkItem[]) {
  const arrived = cards
    .filter(
      item =>
        belongsToBoard(item, 'work') && itemAppearsInStage(item, 'intake', BOARD_STAGES) && item.triageType === null,
    )
    .sort((a, b) => arrivedAt(b) - arrivedAt(a));
  if (arrived.length === 0) return undefined;
  return starter('triage', `Triage ${batch(arrived.length, 'card')} in Intake`, arrived.map(label), {
    lead: 'Triage these cards in Intake on the Work board, newest first:',
    ask: 'Accept the obvious ones and flag the unclear ones for me.',
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
  if (unplanned.length === 1) {
    return starter('bug', 'Plan a fix for the open bug', unplanned.map(label), {
      lead: 'Draft a plan to fix this bug:',
    });
  }
  return starter('bug', `Plan a fix for one of ${unplanned.length} open bugs`, unplanned.map(label), {
    lead: `Pick the highest-impact of the ${unplanned.length} open bugs nobody has planned yet and draft a plan to fix it. The oldest:`,
    scope: 'examples',
  });
}

function shipped(cards: readonly WorkItem[], now: Date) {
  const since = now.getTime() - WEEK_MS;
  const done = cards
    .flatMap(item => {
      const at = item.stages.includes('done') ? enteredAt(item, 'done') : undefined;
      return at !== undefined && at >= since ? [{ item, at }] : [];
    })
    .sort((a, b) => b.at - a.at);
  if (done.length === 0) return undefined;
  const merged = done.filter(({ item }) => belongsToBoard(item, 'review')).length;
  const scale = [
    merged > 0 ? count(merged, 'pull request') : undefined,
    done.length > merged ? count(done.length - merged, 'card') : undefined,
  ]
    .filter(part => part !== undefined)
    .join(' and ');
  const day = new Date(since).toISOString().slice(0, 10);
  const latest = done.map(({ item }) => label(item));
  return starter('shipped', `Recap ${count(done.length, 'card')} done this week`, latest, {
    lead: `Summarize what shipped since ${day}: ${scale} reached Done. The latest:`,
    ask: 'Group it by theme and call out anything still waiting on someone.',
    limit: RECAP_EXAMPLES,
    scope: 'examples',
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

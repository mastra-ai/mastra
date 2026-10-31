import { TRIAGE_DECISIONS } from './cardPrimaryAction';
import type { WorkItemStarters } from './services/workItems';

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
const DAY_MS = 24 * 60 * 60 * 1000;
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
    'Find the area label with the most open cards on the Work board that nobody has started yet. Group those cards by root cause, point out duplicates, and draft a plan for the biggest group. Change nothing until I say so.',
  stale: `Go through the ${BATCH} oldest pull requests that have waited in Intake on the Review board for over a month. For each one, suggest closing it or keeping it open, and say why. Close nothing until I say so.`,
};

function upTo(total: number, verb: string): string {
  return total === 1 ? `${verb} it` : `${verb} ${Math.min(BATCH, total)}`;
}

function theBatch(total: number, verb: string, which: string): string {
  return total === 1 ? `${verb} it` : `${verb} the ${Math.min(BATCH, total)} ${which}`;
}

function review({ count, oldestOpenedAt }: WorkItemStarters['review'], now: number): StarterFact | undefined {
  if (count === 0 || oldestOpenedAt === undefined) return undefined;
  const days = Math.max(0, Math.floor((now - Date.parse(oldestOpenedAt)) / DAY_MS));
  return {
    label: 'Longest review wait',
    value: days,
    unit: days === 1 ? 'day' : 'days',
    action: theBatch(count, 'Review', 'oldest'),
  };
}

/** Turns the server's starter counts into the New page's starter cards, most urgent first. */
export function starterPrompts({ starters, now }: { starters: WorkItemStarters; now: Date }): StarterPrompt[] {
  const { failed, changesRequested, undecided, untriaged, unplannedBugs, sweep, stale } = starters;
  const facts: Array<[StarterKind, StarterFact | undefined]> = [
    [
      'unblock',
      failed > 0 ? { label: 'Failed runs', value: failed, action: upTo(failed, 'Debug and retry') } : undefined,
    ],
    [
      'feedback',
      changesRequested > 0
        ? { label: 'Changes requested', value: changesRequested, action: 'Make the changes' }
        : undefined,
    ],
    ['review', review(starters.review, now.getTime())],
    ['decide', undecided > 0 ? { label: 'Not yet accepted', value: undecided, action: 'Help me decide' } : undefined],
    [
      'triage',
      untriaged > 0
        ? { label: 'Untriaged in Intake', value: untriaged, action: theBatch(untriaged, 'Triage', 'newest') }
        : undefined,
    ],
    [
      'bug',
      unplannedBugs > 0
        ? {
            label: 'Bugs with no plan',
            value: unplannedBugs,
            action: unplannedBugs === 1 ? 'Plan a fix' : 'Plan a fix for one',
          }
        : undefined,
    ],
    [
      'sweep',
      sweep ? { label: `${sweep.area} backlog`, value: sweep.count, action: 'Group by root cause' } : undefined,
    ],
    ['stale', stale > 0 ? { label: 'Stale pull requests', value: stale, action: 'Flag what to close' } : undefined],
  ];
  return facts
    .flatMap(([kind, fact]) => (fact === undefined ? [] : [{ kind, prompt: PROMPTS[kind], ...fact }]))
    .slice(0, SHOWN);
}

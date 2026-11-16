import { STATUS_EVENTS } from '@mastra/factory/boards/board-events';
import {
  CircleCheck,
  CircleDot,
  Eye,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  Inbox,
  PencilLine,
  RotateCcw,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { IntakeRouteInfo } from '../../../api/types';

/** An event a rule can trigger on. */
export type RuleEvent = IntakeRouteInfo['on'][number];

/** The events a rule can trigger on, as the route contract lists them: one lane each, in this order. */
export const LANE_EVENTS: readonly RuleEvent[] = STATUS_EVENTS;

/** The event an item with no card arrives on. */
export const OPENED_EVENT: RuleEvent = 'work_item.opened';

/** Lanes in two sections, as the events split: `work_item.*` are issues, `pull_request.*` are pull requests. */
export const LANE_SECTIONS: readonly { title: string; events: readonly RuleEvent[] }[] = [
  { title: 'Issues', events: LANE_EVENTS.filter(event => !event.startsWith('pull_request.')) },
  { title: 'Pull requests', events: LANE_EVENTS.filter(event => event.startsWith('pull_request.')) },
];

/** The pre-rename event: stored rules on it take issues and card-less pull requests, and show in the Issue opened lane. */
export const LEGACY_OPENED_EVENT = 'work_item.created';

/** Events that can file an item with no card yet, through intake. */
const FILES_CARDLESS = new Set([
  'work_item.opened',
  'work_item.reopened',
  'work_item.updated',
  'pull_request.opened',
  'pull_request.reopened',
  'pull_request.updated',
]);

interface LaneText {
  label: string;
  description: string;
  icon: LucideIcon;
}

const LANE_TEXT: Record<string, LaneText> = {
  [LEGACY_OPENED_EVENT]: {
    label: 'Issue or pull request opened (legacy)',
    description: 'Takes new issues and pull requests with no card yet.',
    icon: Inbox,
  },
  'work_item.opened': {
    label: 'Issue opened',
    description: 'A new issue arrives.',
    icon: Inbox,
  },
  'work_item.reopened': {
    label: 'Issue reopened',
    description: 'A closed issue is opened again.',
    icon: RotateCcw,
  },
  'work_item.updated': {
    label: 'Issue labels or assignees change',
    description: 'Someone adds or removes a label or an assignee on an issue.',
    icon: PencilLine,
  },
  'work_item.closed': {
    label: 'Issue closed',
    description: 'The card’s issue is closed.',
    icon: CircleCheck,
  },
  'pull_request.opened': {
    label: 'Pull request opened',
    description: 'Links to its issue’s card if one exists; otherwise filed as a new card.',
    icon: GitPullRequest,
  },
  'pull_request.reopened': {
    label: 'Pull request reopened',
    description: 'A closed pull request is opened again.',
    icon: GitPullRequestArrow,
  },
  'pull_request.updated': {
    label: 'Pull request labels or assignees change',
    description: 'Someone adds or removes a label or an assignee on a pull request.',
    icon: PencilLine,
  },
  'pull_request.synchronized': {
    label: 'Pull request gets new commits',
    description: 'Someone pushes to the card’s pull request.',
    icon: GitCommitHorizontal,
  },
  'pull_request.review_requested': {
    label: 'Review requested',
    description: 'A reviewer is requested on the card’s pull request.',
    icon: Eye,
  },
  'pull_request.merged': {
    label: 'Pull request merged',
    description: 'The card’s pull request is merged.',
    icon: GitMerge,
  },
  'pull_request.closed': {
    label: 'Pull request closed unmerged',
    description: 'The card’s pull request is closed without merging.',
    icon: GitPullRequestClosed,
  },
};

/** An event the UI has no words for yet still gets a lane, named from its id: `pull_request.labeled` → "Pull request labeled". */
export function laneText(event: string): LaneText {
  const known = LANE_TEXT[event];
  if (known) return known;
  const words = event.replace(/[._]/g, ' ').trim();
  return {
    label: words.charAt(0).toUpperCase() + words.slice(1),
    description: '',
    icon: event.startsWith('pull_request.') ? GitPullRequest : event.startsWith('work_item.') ? CircleDot : Zap,
  };
}

export function isOpenedLane(event: string): boolean {
  return event === OPENED_EVENT;
}

/** Whether a lane can file an item with no card yet, through intake. */
export function filesCardless(event: string): boolean {
  return FILES_CARDLESS.has(event);
}

/** Whether a rule may place an item with no card, so it may only name its own board. */
export function placesCardless(on: readonly string[]): boolean {
  return on.some(filesCardless);
}

/** Whether a stored rule still listens on the pre-rename `work_item.created`. */
export function isLegacyOpened(rule: IntakeRouteInfo): boolean {
  const on: readonly string[] = rule.on;
  return on.includes(LEGACY_OPENED_EVENT);
}

/** The rules a lane checks, in order. A rule naming several events shows in each of their lanes. */
export function laneRules(rules: readonly IntakeRouteInfo[], event: RuleEvent): IntakeRouteInfo[] {
  return rules.filter(rule => rule.on.includes(event) || (isOpenedLane(event) && isLegacyOpened(rule)));
}

/** The first rule in a lane that takes every item, so no rule below it is ever reached; -1 when none does. */
export function catchAllIndex(lane: readonly IntakeRouteInfo[]): number {
  return lane.findIndex(rule => rule.enabled && rule.when === null && !rule.target.joinClosedIssue);
}

/** Where a board sits in intake order, in words: "Checked after Ship, before Work". */
export function intakePosition(order: readonly { boardKey: string; name: string }[], boardKey: string): string {
  const at = order.findIndex(board => board.boardKey === boardKey);
  if (at === -1) return 'Not in the intake order yet';
  if (order.length === 1) return 'The only board intake checks';
  const before = order[at - 1]?.name;
  const after = order[at + 1]?.name;
  if (before && after) return `Checked after ${before}, before ${after}`;
  return before ? `Checked last, after ${before}` : `Checked first, before ${after}`;
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const last = n % 10;
  if (teen || last > 3 || last === 0) return `${n}th`;
  return `${n}${last === 1 ? 'st' : last === 2 ? 'nd' : 'rd'}`;
}

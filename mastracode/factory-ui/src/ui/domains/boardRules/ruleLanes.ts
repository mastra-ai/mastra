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

/** Events that also file an item with no card: reopened with no card, or updated while Not routed. */
const CARDLESS_TOO = new Set(['work_item.reopened', 'work_item.updated']);

interface LaneText {
  label: string;
  description: string;
  icon: LucideIcon;
}

const LANE_TEXT: Record<string, LaneText> = {
  'work_item.opened': {
    label: 'Issue or pull request opened',
    description: 'A new issue or pull request reaches the Factory.',
    icon: Inbox,
  },
  'work_item.reopened': {
    label: 'Issue reopened',
    description: 'A closed issue or pull request is opened again.',
    icon: RotateCcw,
  },
  'work_item.updated': {
    label: 'Issue labels or assignees change',
    description: 'Someone adds or removes a label or an assignee.',
    icon: PencilLine,
  },
  'work_item.closed': {
    label: 'Issue closed',
    description: 'The issue or pull request behind the card is closed.',
    icon: CircleCheck,
  },
  'pull_request.opened': {
    label: 'Pull request opened',
    description: 'A pull request is opened for the card or linked to it.',
    icon: GitPullRequest,
  },
  'pull_request.reopened': {
    label: 'Pull request reopened',
    description: 'A linked pull request is opened again.',
    icon: GitPullRequestArrow,
  },
  'pull_request.updated': {
    label: 'Pull request labels or assignees change',
    description: 'Someone adds or removes a label or an assignee on a linked pull request.',
    icon: PencilLine,
  },
  'pull_request.synchronized': {
    label: 'Pull request gets new commits',
    description: 'Someone pushes to a linked pull request.',
    icon: GitCommitHorizontal,
  },
  'pull_request.review_requested': {
    label: 'Review requested',
    description: 'A reviewer is requested on a linked pull request.',
    icon: Eye,
  },
  'pull_request.merged': {
    label: 'Pull request merged',
    description: 'A linked pull request is merged.',
    icon: GitMerge,
  },
  'pull_request.closed': {
    label: 'Pull request closed unmerged',
    description: 'A linked pull request is closed without merging.',
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

export function alsoFilesCardless(event: string): boolean {
  return CARDLESS_TOO.has(event);
}

/** Whether a rule may place an item with no card, so it may only name its own board. */
export function placesCardless(on: readonly string[]): boolean {
  return on.some(event => isOpenedLane(event) || alsoFilesCardless(event));
}

/** The rules a lane checks, in order. A rule naming several events shows in each of their lanes. */
export function laneRules(rules: readonly IntakeRouteInfo[], event: RuleEvent): IntakeRouteInfo[] {
  return rules.filter(rule => rule.on.includes(event));
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

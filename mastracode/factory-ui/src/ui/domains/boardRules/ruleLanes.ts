import { SETTLING_PULL_REQUEST_EVENTS, STATUS_EVENTS, testsField } from '@mastra/factory/boards/board-events';
import { kindsTakenWhole } from '@mastra/factory/boards/intake-order';
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

/** The events new issues and pull requests arrive on: an issue on `work_item.opened`, a pull request with no issue card on `pull_request.opened`. */
const ARRIVAL_LANES: readonly RuleEvent[] = ['work_item.opened', 'pull_request.opened'];

/**
 * Lanes in two sections, by who their rules see: new issues and pull requests, offered to every board in intake order,
 * and cards already on this board, which no other board sees.
 */
export const LANE_SECTIONS: readonly { title: string; events: readonly RuleEvent[] }[] = [
  { title: 'New issues and pull requests', events: LANE_EVENTS.filter(event => ARRIVAL_LANES.includes(event)) },
  { title: 'Cards on this board', events: LANE_EVENTS.filter(event => !ARRIVAL_LANES.includes(event)) },
];

/** The pre-rename event: stored rules on it take new issues and card-less pull requests, so they show in both arrival lanes. */
export const LEGACY_OPENED_EVENT = 'work_item.created';

/** Every event a rule filing new issues or pull requests listens on, legacy included. */
const ARRIVAL_EVENTS = new Set<string>([...ARRIVAL_LANES, LEGACY_OPENED_EVENT]);

interface LaneText {
  label: string;
  description: string;
  icon: LucideIcon;
  /** GitLab reports no such event for a merge request: a reopen arrives as opened, and it has no review requests. */
  githubOnly?: true;
}

const LANE_TEXT: Record<string, LaneText> = {
  [LEGACY_OPENED_EVENT]: {
    label: 'Issue or pull request opened (legacy)',
    description: 'Takes new issues, and pull requests with no card yet.',
    icon: Inbox,
  },
  'work_item.opened': {
    label: 'Issue opened',
    description: 'A new issue, incident or alert arrives from a connected source.',
    icon: Inbox,
  },
  'work_item.reopened': {
    label: 'Issue reopened',
    description: 'The card’s issue is opened again.',
    icon: RotateCcw,
  },
  'work_item.updated': {
    label: 'Issue labels or assignees change',
    description: 'Someone adds or removes a label or an assignee on the card’s issue.',
    icon: PencilLine,
  },
  'work_item.closed': {
    label: 'Issue closed',
    description: 'The card’s issue is closed.',
    icon: CircleCheck,
  },
  'pull_request.opened': {
    label: 'Pull request opened',
    description:
      'A GitHub pull request or GitLab merge request arrives. It joins the card of the issue it closes, or gets a card of its own.',
    icon: GitPullRequest,
  },
  'pull_request.reopened': {
    label: 'Pull request reopened',
    description: 'A closed pull request is opened again.',
    icon: GitPullRequestArrow,
    githubOnly: true,
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
    githubOnly: true,
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

/** "1 rule", "3 rules". */
export const ruleCount = (count: number) => (count === 1 ? '1 rule' : `${count} rules`);

/** What a rule with no conditions takes on a lane: "Every new issue", "Every pull request" or "Every card". */
export function everythingOn(event: string): string {
  if (event === 'pull_request.opened') return 'Every pull request';
  return isOpenedLane(event) ? 'Every new issue' : 'Every card';
}

/**
 * Whether a lane is where new items arrive, so its rules file items with no card. Only these do: a reopened issue
 * with no card comes back as opened, and a label or assignee change never files one.
 */
export function isOpenedLane(event: string): boolean {
  return ARRIVAL_LANES.some(lane => lane === event);
}

/**
 * Whether a rule files new items: it listens on an arrival event, legacy `work_item.created` included. An item with
 * no card can only be filed on the rule's own board, so such a rule can't send cards to another one.
 */
export function placesArrival(on: readonly string[]): boolean {
  return on.some(event => ARRIVAL_EVENTS.has(event));
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

/**
 * What a board takes when new items arrive: how many of its enabled rules can file one (rules below a lane's catch-all
 * are never reached, so they don't count), and whether both arrival lanes end in a rule taking everything left.
 */
export function newItemRules(rules: readonly IntakeRouteInfo[]): { count: number; catchesAll: boolean } {
  const reached = new Set<string>();
  let catchesAll = true;
  for (const event of ARRIVAL_LANES) {
    // A rule joining a pull request to its issue's card files nothing new.
    const lane = laneRules(rules, event).filter(
      rule => rule.enabled && !rule.target.joinClosedIssue && !movesCardsOnly(rule, event),
    );
    const catchAll = catchAllIndex(lane, event);
    if (catchAll === -1) catchesAll = false;
    for (const rule of catchAll === -1 ? lane : lane.slice(0, catchAll + 1)) reached.add(rule.id);
  }
  return { count: reached.size, catchesAll };
}

/**
 * The first rule in a lane that takes every item, so no rule below it is ever reached; -1 when none does. A rule
 * whose target can't take cards (its `problems`, such as a deleted board) is skipped, so it stops nothing. In an
 * arrival lane, a rule testing nothing but the item's kind takes every item of that kind, as intake order reads it,
 * and a rule stored by 0.28 on `pull_request.opened` takes no new pull request: it only moves cards.
 */
export function catchAllIndex(lane: readonly IntakeRouteInfo[], event: RuleEvent): number {
  const kind = event === 'pull_request.opened' ? 'pull_request' : event === 'work_item.opened' ? 'issue' : undefined;
  return lane.findIndex(
    rule =>
      rule.enabled &&
      !rule.target.joinClosedIssue &&
      rule.problems.length === 0 &&
      (kind === undefined ? rule.when === null : kindsTakenWhole(rule).includes(kind)),
  );
}

/** Whether a rule on `pull_request.opened` was stored by 0.28, so there it moves cards and files no pull request. */
export function movesCardsOnly(rule: IntakeRouteInfo, event: RuleEvent): boolean {
  return event === 'pull_request.opened' && rule.pullRequestOpenedMovesOnly === true;
}

/**
 * Whether the rule's old outsider gate holds on this lane: stored before rules decided outsiders'
 * pull requests and not asking about `pullRequest.trusted` itself, it skips outside authors' pull
 * requests on every pull request event that doesn't settle one — so there it never takes everything.
 */
export function skipsOutsidersOn(rule: IntakeRouteInfo, event: RuleEvent): boolean {
  return (
    rule.outsiderPullRequestsGated === true &&
    event.startsWith('pull_request.') &&
    !SETTLING_PULL_REQUEST_EVENTS.has(event) &&
    !testsField(rule.when, 'pullRequest.trusted')
  );
}

/**
 * The rule above `index` in a lane that keeps it from ever being reached; -1 when none does. Only a rule with no
 * conditions hides everything below it: on an arrival lane the same rules also move the issue cards a pull request
 * links to or was opened from, so a rule testing only the kind hides just the rules that need that kind too. A rule
 * whose old outsider gate holds (`skipsOutsidersOn`) lets outside authors' pull requests fall through, so it hides
 * nothing on those lanes — unless the rule below skips them too, and nothing falls through to it either.
 */
export function shadowedBy(lane: readonly IntakeRouteInfo[], event: RuleEvent, index: number): number {
  const rule = lane[index];
  if (!rule) return -1;
  const kinds = requiredKinds(rule);
  return lane.slice(0, index).findIndex(taker => {
    if (skipsOutsidersOn(taker, event) && !skipsOutsidersOn(rule, event)) return false;
    if (catchAllIndex([taker], event) !== 0) return false;
    if (taker.when === null) return true;
    const needs = kindsTakenWhole(taker);
    return kinds.some(kind => needs.includes(kind));
  });
}

/** The kinds a rule's `when` requires outright (`source.kind equals …` among its AND conditions). */
function requiredKinds(rule: IntakeRouteInfo): string[] {
  if (rule.when?.operator !== 'AND') return [];
  return rule.when.conditions.flatMap(condition =>
    'field' in condition &&
    condition.field === 'source.kind' &&
    condition.operator === 'equals' &&
    typeof condition.value === 'string'
      ? [condition.value]
      : [],
  );
}

/**
 * Where a new item no rule on this board takes goes next: "Otherwise: Work is asked next", or "Otherwise: Not routed"
 * on the last board. Falls back to a generic line while the intake order is loading or doesn't list the board.
 */
export function arrivalFallback(order: readonly { boardKey: string; name: string }[] | undefined, boardKey: string) {
  const at = order?.findIndex(board => board.boardKey === boardKey) ?? -1;
  if (!order || at === -1) return 'Otherwise: the next board is asked';
  const next = order[at + 1]?.name;
  return next ? `Otherwise: ${next} is asked next` : 'Otherwise: Not routed';
}

const FILLER_WORDS = new Set([
  'a',
  'all',
  'an',
  'and',
  'board',
  'card',
  'cards',
  'every',
  'go',
  'goes',
  'has',
  'if',
  'in',
  'is',
  'it',
  'item',
  'items',
  'its',
  'move',
  'moves',
  'new',
  'of',
  'on',
  'only',
  'or',
  'the',
  'this',
  'to',
  'when',
  'work',
]);

function meaningfulWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(word => !FILLER_WORDS.has(word))
    .map(word => word.replace(/s$/, ''));
}

/**
 * Whether a rule's name only restates what its card already shows (lane, conditions and target), as the names the
 * builder suggests do: "When labels has security, move to Backlog". Then the card shows no name, only what it says.
 */
export function nameRepeats(name: string, shown: string): boolean {
  const seen = new Set(meaningfulWords(shown));
  return meaningfulWords(name).every(word => seen.has(word));
}

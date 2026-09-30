export type RuleMoment = 'arrives' | 'after-run' | 'any-time';

export type StoryRule = {
  id: string;
  title: string;
  lanes: string[];
  when: string;
  then: string;
  conditions: string[];
  moment: RuleMoment;
  /** Built-in rules have no config to edit yet: the UI must say so instead of pointing nowhere. */
  source: 'config' | 'built-in';
};

export const HOLD_NON_BUGS_RULE = 'hold-non-bugs-for-accept';
export const AUTO_START_RULE = 'auto-start-runs';
export const APPROVAL_RULE = 'wait-for-approval';
export const SLACK_RULE = 'slack-mention-opens-card';
export const REVIEW_RULE = 'review-open-pull-requests';

export const STORY_RULES: StoryRule[] = [
  {
    id: 'triage-new-issues',
    title: 'Triage new issues',
    lanes: ['intake'],
    when: 'New GitHub issue',
    then: 'Run triage',
    conditions: ['Runs on its own', 'Linked repository only'],
    moment: 'arrives',
    source: 'config',
  },
  {
    id: HOLD_NON_BUGS_RULE,
    title: 'Hold non-bugs for Accept',
    lanes: ['intake', 'triage'],
    when: 'Triage labels it anything but a bug',
    then: 'Wait for someone to Accept',
    conditions: ['Bugs move on by themselves'],
    moment: 'after-run',
    source: 'built-in',
  },
  {
    id: 'investigate-needs-approval',
    title: 'Investigate flagged issues',
    lanes: ['triage'],
    when: 'Issue labelled “status: needs approval”',
    then: 'Suggest an investigation',
    conditions: ['Requires approval'],
    moment: 'any-time',
    source: 'config',
  },
  {
    id: 'plan-accepted-work',
    title: 'Plan accepted work',
    lanes: ['planning'],
    when: 'Someone accepts a triaged card',
    then: 'Start planning',
    conditions: ['Runs on its own'],
    moment: 'arrives',
    source: 'config',
  },
  {
    id: REVIEW_RULE,
    title: 'Review pull requests',
    lanes: ['review'],
    when: 'A pull request opens',
    then: 'Start a review',
    conditions: ['Runs on its own', 'Linked repository only', 'Approves or requests changes on the last commit'],
    moment: 'arrives',
    source: 'config',
  },
  {
    id: SLACK_RULE,
    title: 'Slack mentions open a card',
    lanes: [],
    when: 'Someone mentions Factory in Slack',
    then: 'Open a card and start a session',
    conditions: ['Settings pick who pays for channels and DMs'],
    moment: 'any-time',
    source: 'config',
  },
  {
    id: AUTO_START_RULE,
    title: 'Auto-start lanes',
    lanes: [],
    when: 'A card arrives in a lane set to auto-start',
    then: 'Start the run with nobody around',
    conditions: ['Only when the Factory account pays: nobody is there to bill'],
    moment: 'arrives',
    source: 'built-in',
  },
  {
    id: APPROVAL_RULE,
    title: 'Wait for approval',
    lanes: [],
    when: 'A run reaches a plan, a risky tool or an approval step',
    then: 'Pause and ask a person',
    conditions: ['Auto-approve plans is off', 'Anyone can answer; the first reply takes ownership'],
    moment: 'any-time',
    source: 'built-in',
  },
];

export function ruleById(id: string): StoryRule {
  return (
    STORY_RULES.find(rule => rule.id === id) ?? {
      id,
      title: id,
      lanes: [],
      when: 'A card matches this rule',
      then: 'Suggest a run',
      conditions: ['Requires approval'],
      moment: 'any-time',
      source: 'config',
    }
  );
}

export function rulesOnLane(stageId: string): StoryRule[] {
  return STORY_RULES.filter(rule => rule.lanes.includes(stageId));
}

export const RULE_SOURCE_LABELS: Record<StoryRule['source'], string> = {
  config: 'Defined in factory.config.ts',
  'built-in': 'Built into Factory · not configurable yet',
};

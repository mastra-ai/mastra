import type { FactoryDecisionStatus } from './services/decisions';

export type RuleDecisionGroupKey = 'all' | 'active' | 'proposed' | 'failed' | 'succeeded';

export interface RuleDecisionGroup {
  key: RuleDecisionGroupKey;
  /** `undefined` lists every status. */
  statuses: FactoryDecisionStatus[] | undefined;
}

const ALL_EFFECTS: RuleDecisionGroup = { key: 'all', statuses: undefined };

/**
 * The Rules page's `?group=` filters. Kept out of the page module so the route
 * loader can start the same decisions query without loading the page's code.
 */
export const RULE_DECISION_GROUPS: readonly RuleDecisionGroup[] = [
  ALL_EFFECTS,
  { key: 'active', statuses: ['pending', 'leased', 'retry'] },
  { key: 'proposed', statuses: ['proposed'] },
  { key: 'failed', statuses: ['failed'] },
  { key: 'succeeded', statuses: ['succeeded'] },
];

/** The group a `?group=` value selects; unknown or missing values show every effect. */
export function ruleDecisionGroup(requested: string | null): RuleDecisionGroup {
  return RULE_DECISION_GROUPS.find(group => group.key === requested) ?? ALL_EFFECTS;
}

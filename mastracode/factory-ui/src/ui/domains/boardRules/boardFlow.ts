import type { IntakeRouteInfo } from '../../../api/types';
import { LANE_EVENTS, laneRules, shadowedBy } from './ruleLanes';

export interface BoardFlow {
  /** Rules that can move cards into each phase, this board's and other boards', by phase key. */
  into: Map<string, IntakeRouteInfo[]>;
  /** This board's rules that send its cards to another board. */
  leaving: IntakeRouteInfo[];
}

/**
 * Which rules can land cards in each of a board's phases. A rule counts once, and only when it can fire: on, sound,
 * and not below a rule in its lane that takes every card.
 */
export function boardFlow(rules: readonly IntakeRouteInfo[], board: { key: string; initialPhase: string }): BoardFlow {
  const live = new Set<IntakeRouteInfo>();
  for (const source of new Set(rules.map(rule => rule.target.boardKey))) {
    const sourceRules = rules.filter(rule => rule.target.boardKey === source);
    for (const event of LANE_EVENTS) {
      const lane = laneRules(sourceRules, event);
      lane.forEach((rule, index) => {
        if (rule.enabled && rule.problems.length === 0 && shadowedBy(lane, event, index) === -1) live.add(rule);
      });
    }
  }

  const into = new Map<string, IntakeRouteInfo[]>();
  const leaving: IntakeRouteInfo[] = [];
  for (const rule of live) {
    const own = rule.target.boardKey === board.key;
    const destination = rule.target.moveToBoardKey ?? rule.target.boardKey;
    if (destination !== board.key) {
      if (own) leaving.push(rule);
      continue;
    }
    const phase = rule.target.phaseKey ?? board.initialPhase;
    into.set(phase, [...(into.get(phase) ?? []), rule]);
  }
  return { into, leaving };
}

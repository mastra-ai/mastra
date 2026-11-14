import type { IntakeDryRunResponse, IntakeTestResponse } from '../../../api/types';

type DryRunBoard = IntakeDryRunResponse['boards'][number];
type DryRunRule = DryRunBoard['rules'][number];
type TestRule = IntakeTestResponse['boards'][number]['rules'][number];
type FailedCondition = NonNullable<TestRule['failed']>[number];

function items(count: number): string {
  return count === 1 ? '1 item' : `${count} items`;
}

function names(keys: readonly string[], boardName: (key: string) => string): string {
  const named = keys.map(boardName);
  return named.length <= 1 ? (named[0] ?? '') : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
}

/** A rule's counts as separate pieces: `takes 6`, then `lost 3 to Ship, 1 to Platform` when it loses any. */
export function ruleCounts(rule: Pick<DryRunRule, 'takes' | 'lost'>, boardName: (key: string) => string): string[] {
  const lost = rule.lost.filter(entry => entry.keys.length > 0);
  const takes = `takes ${rule.takes.length}`;
  if (lost.length === 0) return [takes];
  return [takes, `lost ${lost.map(entry => `${entry.keys.length} to ${boardName(entry.boardKey)}`).join(', ')}`];
}

/** `filed 4 in the last 30 days`. */
export function ruleFiledLabel(rule: Pick<DryRunRule, 'filed'>): string {
  return `filed ${rule.filed} in the last 30 days`;
}

/** `Would take 14 of the last 200 items. 9 more matched this board's rules but Ship took them first.` */
export function boardSummary(
  board: Pick<DryRunBoard, 'takes' | 'lostTo'>,
  sampled: number,
  boardName: (key: string) => string,
): string {
  const taken = `Would take ${board.takes.length} of the last ${items(sampled)}.`;
  const lostTo = board.lostTo.filter(entry => entry.keys.length > 0);
  const lost = new Set(lostTo.flatMap(entry => entry.keys)).size;
  if (lost === 0) return taken;
  return `${taken} ${lost} more matched this board's rules but ${names(
    lostTo.map(entry => entry.boardKey),
    boardName,
  )} took them first.`;
}

/** With unsaved rules or order: `12 of the last 200 items would now land on a different board.` */
export function changedSummary(changed: number, sampled: number): string {
  if (changed === 0) return `None of the last ${items(sampled)} would land anywhere new.`;
  return `${changed} of the last ${items(sampled)} would now land on a different board.`;
}

/** `3 of the last 200 items match no board's rules and would not be routed.` */
export function notRoutedSummary(notRouted: number, sampled: number): string | null {
  if (notRouted === 0) return null;
  return `${notRouted} of the last ${items(sampled)} match no board's rules and would not be routed.`;
}

function show(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? 'empty' : value.map(show).join(', ');
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** One failed condition: `item.labels is bug, wanted contains ship`; `item.author has no value`. */
export function failedConditionLabel(condition: FailedCondition): string {
  const wanted = condition.value === undefined ? condition.operator : `${condition.operator} ${show(condition.value)}`;
  if (condition.actual === null || condition.actual === undefined) {
    return `${condition.field} has no value, wanted ${wanted}`;
  }
  return `${condition.field} is ${show(condition.actual)}, wanted ${wanted}`;
}

/** What one rule answered: `yes`, `no, item.labels is bug, wanted contains ship`, `matched, but Ship › Bugs took it first`. */
export function ruleVerdictLabel(rule: TestRule, ruleName: (boardKey: string, routeId: string) => string): string {
  switch (rule.outcome) {
    case 'took':
      return 'yes';
    case 'lost':
      return rule.to
        ? `matched, but ${ruleName(rule.to.boardKey, rule.to.routeId)} took it first`
        : 'matched, but an earlier rule took it';
    case 'phase_refuses':
      return `matched, but its phase ${rule.phase} can't hold this item`;
    case 'disabled':
      return 'off';
    case 'no_match':
      return rule.failed && rule.failed.length > 0 ? `no, ${rule.failed.map(failedConditionLabel).join('; ')}` : 'no';
  }
}

import type { IntakeDryRunResponse, IntakeTestResponse } from '../../../api/types';

type DryRunBoard = IntakeDryRunResponse['boards'][number];
type DryRunRule = DryRunBoard['rules'][number];
type TestRule = IntakeTestResponse['boards'][number]['rules'][number];
type FailedCondition = NonNullable<TestRule['failed']>[number];
type CardMove = IntakeTestResponse['moves'][number];
type MoveRule = CardMove['rules'][number];

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

/** With unsaved rules or order: `12 of the last 200 items would now land on a different board or phase.` */
export function changedSummary(changed: number, sampled: number): string {
  if (changed === 0) return `None of the last ${items(sampled)} would land anywhere new.`;
  return `${changed} of the last ${items(sampled)} would now land on a different board or phase.`;
}

/**
 * `3 of the last 200 items would not be routed because no board takes them.` That includes items a
 * rule matched but whose phase can't hold them.
 */
export function notRoutedSummary(notRouted: number, sampled: number): string | null {
  if (notRouted === 0) return null;
  return `${notRouted} of the last ${items(sampled)} would not be routed because no board takes them.`;
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

function changes(name: string, change: { added: string[]; removed: string[] } | undefined): string | null {
  if (!change) return null;
  const parts = [...change.added.map(value => `+${value}`), ...change.removed.map(value => `−${value}`)];
  return parts.length > 0 ? `${name} ${parts.join(' ')}` : null;
}

/** An event with what changed on it: `work_item.updated, labels +ship −bug`; `work_item.closed (completed)`. */
export function eventLabel(event: CardMove['event']): string {
  const head = event.reason ? `${event.type} (${event.reason})` : event.type;
  return [
    head,
    changes('labels', event.labels),
    changes('assignees', event.assignees),
    event.pullRequestTrusted === false ? 'from an untrusted author' : null,
  ]
    .filter(part => part !== null)
    .join(', ');
}

/** What an event would do to the card: `moves to Ship › inbox`; `stays where it is`. */
export function moveVerdictLabel(move: CardMove, boardName: (key: string) => string): string {
  switch (move.outcome) {
    case 'moves':
      return move.to ? `moves to ${boardName(move.to.boardKey)} › ${move.to.phase}` : 'moves';
    case 'stays':
      return 'stays where it is';
    case 'rule_default':
      return move.phase
        ? `no rule takes it, so the integration moves it to ${move.phase}`
        : "no rule takes it, and the integration doesn't move it";
    case 'ignored':
      return move.reason ? `ignored. ${move.reason}` : 'ignored';
  }
}

/** What one card-move rule answered: `yes`, `no, …`, `matched, but Ship added took it first`. */
export function moveRuleVerdictLabel(rule: MoveRule, ruleName: (routeId: string) => string): string {
  switch (rule.outcome) {
    case 'took':
      return 'yes';
    case 'lost':
      return rule.to
        ? `matched, but ${ruleName(rule.to.routeId)} took it first`
        : 'matched, but an earlier rule took it';
    case 'skipped':
      return rule.reason ? `matched, but ${rule.reason}` : "matched, but its target can't take the card";
    case 'disabled':
      return 'off';
    case 'no_match':
      return rule.failed && rule.failed.length > 0 ? `no, ${rule.failed.map(failedConditionLabel).join('; ')}` : 'no';
  }
}

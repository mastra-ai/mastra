import { MAX_RULE_GROUP_DEPTH, RULE_OPERATORS } from '@mastra/factory/rules/rule-group';
import type { RuleCondition, RuleGroup, RuleOperator, RuleValue } from '@mastra/factory/rules/rule-group';
import type { FilterBarField } from '@mastra/playground-ui/components/FilterBar';

export const VALUELESS = new Set(['exists', 'not_exists']);
export const MANY = new Set(['in', 'not_in']);

/** A condition being edited: its field, operator or value may still be missing. */
export type Row = { key: string; field: string; operator: string; value?: RuleValue };
export type Group = { key: string; logic: 'AND' | 'OR'; items: Item[] };
export type Item = Row | Group;

export const isGroup = (item: Item): item is Group => 'items' in item;

let nextKey = 0;
export const newKey = () => `condition-${++nextKey}`;

export const emptyRow = (): Row => ({ key: newKey(), field: '', operator: '' });

/** `depth` counts the top level as 0; a group there can hold another group while the rule stays within the server's depth. */
export const canNest = (depth: number) => depth + 2 <= MAX_RULE_GROUP_DEPTH;

export function fromRule(rule: RuleGroup | null | undefined): Group {
  const toItem = (member: RuleCondition | RuleGroup): Item =>
    'conditions' in member
      ? { key: newKey(), logic: member.operator, items: member.conditions.map(toItem) }
      : { key: newKey(), field: member.field, operator: member.operator, value: member.value };
  return { key: 'root', logic: rule?.operator ?? 'AND', items: rule?.conditions.map(toItem) ?? [] };
}

const isRuleOperator = (operator: string): operator is RuleOperator =>
  RULE_OPERATORS.some(candidate => candidate === operator);

function filled(row: Row): boolean {
  if (!row.field) return false;
  if (VALUELESS.has(row.operator)) return true;
  const { value } = row;
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value !== 'string' || value.trim() !== '';
}

/** The rule the rows stand for, and whether a row is still unfinished (left out until it is). Empty groups drop out. */
export function toRule(group: Group): { rule: RuleGroup | null; incomplete: boolean } {
  let incomplete = false;
  const toMember = (item: Item): RuleCondition | RuleGroup | undefined => {
    if (isGroup(item)) {
      const conditions = item.items.map(toMember).filter(member => member !== undefined);
      return conditions.length > 0 ? { operator: item.logic, conditions } : undefined;
    }
    const { operator } = item;
    if (!isRuleOperator(operator) || !filled(item)) {
      incomplete = true;
      return undefined;
    }
    return VALUELESS.has(operator)
      ? { field: item.field, operator }
      : { field: item.field, operator, value: item.value };
  };
  const conditions = group.items.map(toMember).filter(member => member !== undefined);
  return { rule: conditions.length > 0 ? { operator: group.logic, conditions } : null, incomplete };
}

/** The value a row starts with after its field or operator changes, carried over when it still fits. */
export function valueFor(
  field: FilterBarField,
  operator: string,
  previous: RuleValue | undefined,
): RuleValue | undefined {
  if (VALUELESS.has(operator)) return undefined;
  if (field.type === 'boolean') return typeof previous === 'boolean' ? previous : true;
  if (MANY.has(operator)) {
    if (Array.isArray(previous)) return previous;
    return previous === undefined || previous === '' ? [] : [previous];
  }
  if (Array.isArray(previous)) return previous[0];
  return previous;
}

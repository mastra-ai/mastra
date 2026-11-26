import type { FilterBarField } from '@mastra/playground-ui/components/FilterBar';

import {
  CONDITION_OPERATORS,
  isPresenceField,
  legacyConditionFields,
} from '../../../settings/components/conditionFields';
import { VALUELESS, canNest, emptyRow, isGroup, newKey } from '../../../settings/components/conditionTree';
import type { Group, Item, Row } from '../../../settings/components/conditionTree';
import { narrowSuggestions } from '../../../settings/components/sourceSuggestions';

const LEGACY_FIELDS = legacyConditionFields();

export function operatorLabel(field: FilterBarField | undefined, operator: string): string {
  return (
    field?.operatorLabels?.[operator] ??
    CONDITION_OPERATORS.find(candidate => candidate.id === operator)?.label ??
    operator
  );
}

/** The fields a row can pick, with a stored field the picker no longer offers kept so it can be changed away from. */
export function rowFields(row: Row, fields: FilterBarField[], limits: Row[]) {
  const legacy = LEGACY_FIELDS.find(candidate => candidate.id === row.field);
  const shown = legacy && !fields.some(candidate => candidate.id === legacy.id) ? [legacy, ...fields] : fields;
  const listed = shown.find(candidate => candidate.id === row.field);
  return { shown, field: listed && narrowSuggestions(listed, limits) };
}

/** A condition as one sentence, for its cell's accessible name: "Labels has bug, documentation". */
export function rowText(row: Row, fields: FilterBarField[]): string {
  const { field } = rowFields(row, fields, []);
  const { operator, values } = summarize(row, field);
  return [field?.label ?? (row.field || 'Choose a field'), operator, values.join(', ')].filter(Boolean).join(' ');
}

/** The group with `key`'s row replaced, or removed when `next` is undefined; groups left empty drop out. */
export function replaceRow(group: Group, key: string, next: Item | undefined): Group {
  const items = group.items.flatMap((item): Item[] => {
    if (item.key === key) return next ? [next] : [];
    if (!isGroup(item)) return [item];
    const inner = replaceRow(item, key, next);
    return inner.items.length > 0 ? [inner] : [];
  });
  return { ...group, items };
}

/** A new condition at the end of the top level, joined the way the top level already is; a lone one gets an "and". */
export function addCondition(root: Group): { root: Group; added: Row } {
  const added = emptyRow();
  const logic = root.items.length > 1 ? root.logic : 'AND';
  return { root: { ...root, logic, items: [...root.items, added] }, added };
}

/** Whether a new condition can join a row of `group`, `depth` levels down, by `logic` without nesting too deep. */
export function canJoin(group: Group, depth: number, logic: Group['logic']): boolean {
  return group.logic === logic || group.items.length === 1 || canNest(depth);
}

/**
 * A new condition joined to the row with `key` by `logic`: next to it when its group joins that way or holds only it,
 * otherwise the row and it as a new group; where the rule can't nest deeper, next to it in its group as it is.
 */
export function joinRow(root: Group, key: string, logic: Group['logic']): { root: Group; added: Row } {
  const added = emptyRow();
  const visit = (group: Group, depth: number): Group => {
    if (!group.items.some(item => item.key === key)) {
      return { ...group, items: group.items.map(item => (isGroup(item) ? visit(item, depth + 1) : item)) };
    }
    if (group.items.length === 1) return { ...group, logic, items: [...group.items, added] };
    const nest = group.logic !== logic && canNest(depth);
    return {
      ...group,
      items: group.items.flatMap((item): Item[] => {
        if (item.key !== key) return [item];
        return nest ? [{ key: newKey(), logic, items: [item, added] }] : [item, added];
      }),
    };
  };
  return { root: visit(root, 0), added };
}

/** The tree with the group with `key`, the top level included, joining its conditions by `logic`. */
export function setLogic(group: Group, key: string, logic: Group['logic']): Group {
  if (group.key === key) return { ...group, logic };
  return { ...group, items: group.items.map(item => (isGroup(item) ? setLogic(item, key, logic) : item)) };
}

/** The group without rows no field was ever picked for. */
export function dropBlank(group: Group): Group {
  const items = group.items.flatMap((item): Item[] => {
    if (!isGroup(item)) return item.field ? [item] : [];
    const inner = dropBlank(item);
    return inner.items.length > 0 ? [inner] : [];
  });
  return { ...group, items };
}

/** A condition as its cell reads it: "Labels" "has" "bug", or "Author trust" "is" "Outside author". */
export function summarize(row: Row, field: FilterBarField | undefined): { operator: string; values: string[] } {
  if (!field) return { operator: '', values: [] };
  const options = Array.isArray(field.suggestions) ? field.suggestions : [];
  const label = (value: unknown) => {
    const text = String(value);
    return options.find(option => option.value === text)?.label ?? text;
  };
  if (field.type === 'boolean') {
    const yes = (row.operator !== 'not_equals') === (row.value !== false);
    const fallback = yes ? 'Yes' : 'No';
    return { operator: 'is', values: [options.length > 0 ? label(yes) : fallback] };
  }
  if (isPresenceField(field.id) && (row.operator === 'exists' || row.operator === 'not_exists')) {
    return { operator: 'is', values: [row.operator === 'exists' ? 'Yes' : 'No'] };
  }
  const operator = row.operator ? operatorLabel(field, row.operator) : '';
  if (VALUELESS.has(row.operator) || row.value === undefined) return { operator, values: [] };
  const values = Array.isArray(row.value) ? row.value : [row.value];
  return { operator, values: values.map(label).filter(value => value !== '') };
}

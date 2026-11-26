import type { FilterBarField } from '@mastra/playground-ui/components/FilterBar';

import { operatorLabel } from './conditionControls';
import { isPresenceField } from '../../../settings/components/conditionFields';
import { VALUELESS, canNest, emptyRow, isGroup, newKey } from '../../../settings/components/conditionTree';
import type { Group, Item, Row } from '../../../settings/components/conditionTree';

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

/** A new condition the card must also meet, at the end; alternatives so far become one group of them. */
export function addCondition(root: Group): { root: Group; added: Row } {
  const added = emptyRow();
  if (root.logic === 'AND' || root.items.length <= 1) {
    return { root: { ...root, logic: 'AND', items: [...root.items, added] }, added };
  }
  return {
    root: { key: root.key, logic: 'AND', items: [{ key: newKey(), logic: 'OR', items: root.items }, added] },
    added,
  };
}

/** An alternative to the row with `key`: next to it in its "or" group, or the row and it as a new one. */
export function addAlternative(root: Group, key: string): { root: Group; added: Row } {
  const added = emptyRow();
  const visit = (group: Group, depth: number): Group => ({
    ...group,
    items: group.items.flatMap((item): Item[] => {
      if (isGroup(item)) return [visit(item, depth + 1)];
      if (item.key !== key) return [item];
      if (group.logic === 'OR' || !canNest(depth)) return [item, added];
      return [{ key: newKey(), logic: 'OR', items: [item, added] }];
    }),
  });
  return { root: visit(root, 0), added };
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

export function findRow(group: Group, key: string): Row | undefined {
  for (const item of group.items) {
    const found = isGroup(item) ? findRow(item, key) : item.key === key ? item : undefined;
    if (found) return found;
  }
  return undefined;
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

/** One short value fits after the operator; several, or a long one, go on their own line. */
export function valueInline(fieldLabel: string, operator: string, values: readonly string[]): boolean {
  const [only] = values;
  return values.length === 1 && only !== undefined && fieldLabel.length + operator.length + only.length <= 34;
}

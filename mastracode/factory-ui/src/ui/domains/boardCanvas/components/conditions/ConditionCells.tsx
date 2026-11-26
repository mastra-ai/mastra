import {
  ConditionCellList,
  ConditionRowButton,
  ConditionRowEditor,
  ConditionRowSummary,
} from '@mastra/playground-ui/domains/factory';
import type { ConditionCellNode } from '@mastra/playground-ui/domains/factory';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import type { FilterBarField, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { useState } from 'react';

import {
  CONDITION_OPERATORS,
  VALUE_PLACEHOLDERS,
  conditionFields,
  isPresenceField,
} from '../../../settings/components/conditionFields';
import type { Facts } from '../../../settings/components/conditionFields';
import { MANY, VALUELESS, fromRule, isGroup, toRule, valueFor } from '../../../settings/components/conditionTree';
import type { Group, Item, Row } from '../../../settings/components/conditionTree';
import { andLimits, repositoryHint } from '../../../settings/services/rules';
import {
  addAlternative,
  addCondition,
  dropBlank,
  operatorLabel,
  replaceRow,
  rowFields,
  rowText,
  summarize,
} from './cellModel';

export interface ConditionCellsProps {
  /** The accessible name of the list of conditions. */
  label: string;
  /** Read once: give the cells a new `key` to load a rule changed elsewhere. */
  rule: RuleGroup | null | undefined;
  facts: Facts;
  /** Values to pick from per field, such as a board's phases or the project's repositories. */
  options?: Record<string, FilterBarOption[]>;
  disabled: boolean;
  /** While there is no condition, a cell saying what that means: "Only if" with this chip, say "Every card". */
  everyText?: string;
  /** Under "+ Condition" while there is no condition, say "Leave empty to start every card on its own." */
  emptyHint?: string;
  /** The rule so far, unfinished rows left out, and whether one is still unfinished. */
  onChange: (rule: RuleGroup | null, unfinished: boolean) => void;
}

/** What every row needs to show itself and change the conditions. */
interface RowControls {
  fields: FilterBarField[];
  disabled: boolean;
  /** The row being edited. */
  selected: string | undefined;
  onSelect: (key: string) => void;
  onChange: (key: string, next: Row) => void;
  onRemove: (key: string) => void;
  onAlternative: (key: string) => void;
}

/** The conditions of the same group a row must hold with, which narrow its suggestions. */
function limitsOf(group: Group, parentLimits: Row[]): Row[] {
  return andLimits(
    group.logic,
    parentLimits,
    group.items.filter((item): item is Row => !isGroup(item)),
  );
}

/**
 * A rule's conditions as a flow of cells: each top-level condition, or "or" group of them, is one cell; clicking a
 * cell edits it in place, Escape or a click elsewhere in the panel closes it, and "+ Condition" adds one.
 */
export function ConditionCells({
  label,
  rule,
  facts,
  options,
  disabled,
  everyText,
  emptyHint,
  onChange,
}: ConditionCellsProps) {
  const fields = conditionFields(facts, options);
  const [root, setRoot] = useState(() => fromRule(rule));
  const [selected, setSelected] = useState<string>();
  // The row just added grows in; the rows the cells opened with are already there.
  const [entering, setEntering] = useState<string>();
  const { rule: current, incomplete } = toRule(root);
  const hint = repositoryHint(current);

  const update = (next: Group) => {
    setRoot(next);
    const result = toRule(next);
    onChange(result.rule, result.incomplete);
  };

  const collapse = () => {
    setSelected(undefined);
    const kept = dropBlank(root);
    if (JSON.stringify(kept) !== JSON.stringify(root)) update(kept);
  };

  const added = ({ root: next, added: row }: { root: Group; added: Row }) => {
    update(next);
    setSelected(row.key);
    setEntering(row.key);
  };

  const controls: RowControls = {
    fields,
    disabled,
    selected,
    onSelect: setSelected,
    onChange: (key, next) => update(replaceRow(root, key, next)),
    onRemove: key => {
      setSelected(undefined);
      update(replaceRow(root, key, undefined));
    },
    onAlternative: key => added(addAlternative(root, key)),
  };
  const topLimits = limitsOf(root, []);

  return (
    <ConditionCellList
      label={label}
      logic={root.logic}
      nodes={root.items.map(item => cellNode(item, topLimits, controls))}
      selected={selected}
      entering={entering}
      disabled={disabled}
      everyText={everyText}
      emptyHint={emptyHint}
      incomplete={incomplete}
      hint={hint}
      onAdd={() => added(addCondition(root))}
      onCollapse={collapse}
    />
  );
}

/** A row's cell, or a group's rows; `limits` are the conditions of its own group. */
function cellNode(item: Item, limits: Row[], controls: RowControls): ConditionCellNode {
  if (!isGroup(item)) {
    return {
      key: item.key,
      row: <ConditionRowCell row={item} limits={limits.filter(limit => limit !== item)} {...controls} />,
    };
  }
  const inner = limitsOf(item, limits);
  return { key: item.key, logic: item.logic, items: item.items.map(child => cellNode(child, inner, controls)) };
}

/** One row: its editor while selected, otherwise its summary, a button that selects it. */
function ConditionRowCell({
  row,
  limits,
  fields,
  disabled,
  selected,
  onSelect,
  onChange,
  onRemove,
  onAlternative,
}: RowControls & { row: Row; limits: Row[] }) {
  if (disabled) return <RowSummary row={row} fields={fields} />;
  if (selected === row.key) {
    return (
      <RowEditor
        row={row}
        fields={fields}
        limits={limits}
        onChange={next => onChange(row.key, next)}
        onRemove={() => onRemove(row.key)}
        onAlternative={() => onAlternative(row.key)}
      />
    );
  }
  return (
    <ConditionRowButton rowKey={row.key} text={rowText(row, fields)} onSelect={() => onSelect(row.key)}>
      <RowSummary row={row} fields={fields} />
    </ConditionRowButton>
  );
}

/** A condition read at a glance: its field on the left, the test on the right, the values as chips. */
function RowSummary({ row, fields }: { row: Row; fields: FilterBarField[] }) {
  const { field } = rowFields(row, fields, []);
  const { operator, values } = summarize(row, field);
  return <ConditionRowSummary row={row} field={field} operator={operator} values={values} />;
}

/** A condition being changed in its cell: field, test and value, with a way to remove it or add an alternative. */
function RowEditor({
  row,
  fields,
  limits,
  onChange,
  onRemove,
  onAlternative,
}: {
  row: Row;
  fields: FilterBarField[];
  /** The other conditions a card must meet with this one, which can narrow its suggestions. */
  limits: Row[];
  onChange: (row: Row) => void;
  onRemove: () => void;
  onAlternative: () => void;
}) {
  const { shown, field } = rowFields(row, fields, limits);
  // A stored comparison on a presence field (say, a pull request number) keeps its regular controls.
  const presence =
    !!field &&
    isPresenceField(field.id) &&
    (!row.operator || row.operator === 'exists' || row.operator === 'not_exists');

  return (
    <ConditionRowEditor
      row={row}
      fields={shown}
      field={field}
      presence={presence}
      valueless={VALUELESS.has(row.operator)}
      many={MANY.has(row.operator)}
      freeText={CONDITION_OPERATORS.find(operator => operator.id === row.operator)?.freeText === true}
      placeholder={field && VALUE_PLACEHOLDERS[field.id]}
      operatorLabel={operator => operatorLabel(field, operator)}
      onFieldChange={next => {
        const operator = next.operators?.[0] ?? 'equals';
        onChange({ ...row, field: next.id, operator, value: valueFor(next, operator, undefined) });
      }}
      onOperatorChange={operator => {
        if (field) onChange({ ...row, operator, value: valueFor(field, operator, row.value) });
      }}
      onChange={onChange}
      onRemove={onRemove}
      onAlternative={onAlternative}
    />
  );
}

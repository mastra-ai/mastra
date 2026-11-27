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
  addCondition,
  canJoin,
  dropBlank,
  joinRow,
  operatorLabel,
  replaceRow,
  rowFields,
  rowText,
  setLogic,
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

/** What every cell needs to show itself and change the conditions. */
interface CellControls {
  fields: FilterBarField[];
  disabled: boolean;
  /** The row being edited. */
  selected: string | undefined;
  onSelect: (key: string) => void;
  onChange: (key: string, next: Row) => void;
  onRemove: (key: string) => void;
  /** Adds a condition joined to the row with `key` by `logic`. */
  onJoin: (key: string, logic: Group['logic']) => void;
  /** Switches how the group with `key` joins its conditions. */
  onLogicChange: (key: string, logic: Group['logic']) => void;
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
 * A rule's conditions as a flow of cells: each top-level condition, or group of them, is one cell; clicking a
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

  const controls: CellControls = {
    fields,
    disabled,
    selected,
    onSelect: setSelected,
    onChange: (key, next) => update(replaceRow(root, key, next)),
    onRemove: key => {
      setSelected(undefined);
      update(replaceRow(root, key, undefined));
    },
    onJoin: (key, logic) => added(joinRow(root, key, logic)),
    onLogicChange: (key, logic) => update(setLogic(root, key, logic)),
  };
  const topLimits = limitsOf(root, []);

  return (
    <ConditionCellList
      label={label}
      logic={root.logic}
      onLogicChange={disabled ? undefined : logic => controls.onLogicChange(root.key, logic)}
      nodes={root.items.map(item => cellNode(item, root, 0, topLimits, controls))}
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

/** A row's cell, or a group's rows; `group` holds it, `depth` levels down, and `limits` are that group's conditions. */
function cellNode(item: Item, group: Group, depth: number, limits: Row[], controls: CellControls): ConditionCellNode {
  if (!isGroup(item)) {
    return {
      key: item.key,
      row: (
        <ConditionRowCell
          row={item}
          group={group}
          depth={depth}
          limits={limits.filter(limit => limit !== item)}
          {...controls}
        />
      ),
    };
  }
  const inner = limitsOf(item, limits);
  return {
    key: item.key,
    logic: item.logic,
    items: item.items.map(child => cellNode(child, item, depth + 1, inner, controls)),
    onLogicChange: controls.disabled ? undefined : logic => controls.onLogicChange(item.key, logic),
  };
}

/** One row: its editor while selected, otherwise its summary, a button that selects it. */
function ConditionRowCell({
  row,
  group,
  depth,
  limits,
  fields,
  disabled,
  selected,
  onSelect,
  onChange,
  onRemove,
  onJoin,
}: CellControls & { row: Row; group: Group; depth: number; limits: Row[] }) {
  if (disabled) return <RowSummary row={row} fields={fields} />;
  if (selected === row.key) {
    return (
      <RowEditor
        row={row}
        fields={fields}
        limits={limits}
        onChange={next => onChange(row.key, next)}
        onRemove={() => onRemove(row.key)}
        onAnd={canJoin(group, depth, 'AND') ? () => onJoin(row.key, 'AND') : undefined}
        onOr={canJoin(group, depth, 'OR') ? () => onJoin(row.key, 'OR') : undefined}
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

/** A condition being changed in its cell: field, test and value, with a way to remove it or join another to it. */
function RowEditor({
  row,
  fields,
  limits,
  onChange,
  onRemove,
  onAnd,
  onOr,
}: {
  row: Row;
  fields: FilterBarField[];
  /** The other conditions a card must meet with this one, which can narrow its suggestions. */
  limits: Row[];
  onChange: (row: Row) => void;
  onRemove: () => void;
  onAnd: (() => void) | undefined;
  onOr: (() => void) | undefined;
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
      onAnd={onAnd}
      onOr={onOr}
    />
  );
}

import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import type { FilterBarField, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { conditionFields } from '../../../settings/components/conditionFields';
import type { Facts } from '../../../settings/components/conditionFields';
import { fromRule, isGroup, toRule } from '../../../settings/components/conditionTree';
import type { Group, Item, Row } from '../../../settings/components/conditionTree';
import { andLimits, repositoryHint } from '../../../settings/services/rules';
import { GrowIn } from '../CanvasChrome';
import { addAlternative, addCondition, dropBlank, replaceRow } from './cellModel';
import { RowEditor, RowSummary, rowText } from './ConditionRow';
import { AddConditionButton, FLOW_CELL, FLOW_CELL_SELECTED, ValueChip, Wire } from './flowParts';

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

/** Whether the row being edited is `item` or sits inside it. */
function holds(item: Item, selected: string | undefined): boolean {
  if (selected === undefined) return false;
  if (isGroup(item)) return item.items.some(child => holds(child, selected));
  return item.key === selected;
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
  const list = useRef<HTMLDivElement>(null);
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

  // A click elsewhere in the panel closes the cell; the pickers' popups sit outside the panel and leave it open.
  const onOutsidePointerDown = useEffectEvent((event: PointerEvent) => {
    const scope = list.current?.closest('aside') ?? list.current;
    const cell = list.current?.querySelector('[data-editing]');
    if (!(event.target instanceof Node) || !scope?.contains(event.target) || cell?.contains(event.target)) return;
    collapse();
  });
  useEffect(() => {
    if (selected === undefined) return;
    const onPointerDown = (event: PointerEvent) => onOutsidePointerDown(event);
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) {
      return;
    }
    const key = selected;
    collapse();
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-row="${key}"]`)?.focus());
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
    <div ref={list} role="group" aria-label={label} className="flex flex-col">
      {root.items.length === 0 && everyText && (
        <div className={cn(FLOW_CELL, 'flex-row items-center justify-between')}>
          <Txt as="span" variant="body-sm" tone="muted">
            Only if
          </Txt>
          <ValueChip>{everyText}</ValueChip>
        </div>
      )}
      {root.items.map((item, index) => (
        <GrowIn key={item.key} enter={item.key === entering}>
          <div className="flex flex-col">
            {index > 0 && <Wire word={root.logic === 'OR' ? 'or' : undefined} />}
            <div
              data-editing={holds(item, selected) || undefined}
              onKeyDown={holds(item, selected) ? onKeyDown : undefined}
              className={cn(FLOW_CELL, 'gap-1', holds(item, selected) && FLOW_CELL_SELECTED)}
            >
              <ConditionItem item={item} limits={topLimits} entering={entering} {...controls} />
            </div>
          </div>
        </GrowIn>
      ))}
      {!disabled && (
        <>
          {(root.items.length > 0 || everyText) && <Wire />}
          <span className={cn('flex', root.items.length === 0 && !everyText ? 'self-start' : 'self-center')}>
            <AddConditionButton onClick={() => added(addCondition(root))} />
          </span>
        </>
      )}
      {!disabled && root.items.length === 0 && emptyHint && (
        <Txt as="p" variant="caption" tone="muted" className="mt-2">
          {emptyHint}
        </Txt>
      )}
      {incomplete && (
        <GrowIn>
          <Txt as="p" variant="caption" tone="muted" className="mt-2">
            Finish or remove unfinished conditions to save.
          </Txt>
        </GrowIn>
      )}
      {hint && (
        <Txt as="p" variant="caption" tone="muted" className="mt-2">
          {hint}
        </Txt>
      )}
    </div>
  );
}

/** A row, or a group's rows joined by "or" or "and"; `limits` are the conditions of its own group. */
function ConditionItem({
  item,
  limits,
  entering,
  ...controls
}: RowControls & { item: Item; limits: Row[]; entering: string | undefined }) {
  if (!isGroup(item)) {
    return <ConditionRowCell row={item} limits={limits.filter(limit => limit !== item)} {...controls} />;
  }
  const inner = limitsOf(item, limits);
  return item.items.map((child, index) => (
    <GrowIn key={child.key} enter={child.key === entering}>
      <div className="flex flex-col gap-1">
        {index > 0 && <Wire word={item.logic === 'OR' ? 'or' : 'and'} />}
        <ConditionGroupChild child={child} limits={inner} entering={entering} {...controls} />
      </div>
    </GrowIn>
  ));
}

/** A group inside a group is indented. */
function ConditionGroupChild({
  child,
  ...props
}: RowControls & { child: Item; limits: Row[]; entering: string | undefined }) {
  if (!isGroup(child)) return <ConditionItem item={child} {...props} />;
  return (
    <div className="border-border-strong flex flex-col gap-1 border-l pl-2.5">
      <ConditionItem item={child} {...props} />
    </div>
  );
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
    <button
      type="button"
      data-row={row.key}
      aria-label={`Edit condition: ${rowText(row, fields)}`}
      className="focus-visible:ring-foreground -m-1 rounded-xl p-1 text-left outline-hidden focus-visible:ring-1"
      onClick={() => onSelect(row.key)}
    >
      <RowSummary row={row} fields={fields} />
    </button>
  );
}

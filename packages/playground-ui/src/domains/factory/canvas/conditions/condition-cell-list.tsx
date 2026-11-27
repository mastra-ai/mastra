import { useEffect, useEffectEvent, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { GrowIn } from '../canvas-frame';
import { AddConditionButton, FLOW_CELL, FLOW_CELL_SELECTED, ValueChip, Wire } from '../flow-parts';
import { pinParentHeight } from '../pin-parent-height';
import { ConditionLogic } from './condition-logic';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

/**
 * A rule's conditions as the cells lay them out: a row, already rendered, or a group of them joined by "or" or
 * "and", switchable while `onLogicChange` is given. A row's `key` is the one `selected` and `entering` name.
 */
export type ConditionCellNode =
  | { key: string; row: ReactNode }
  | {
      key: string;
      logic: 'AND' | 'OR';
      items: ConditionCellNode[];
      onLogicChange?: (logic: 'AND' | 'OR') => void;
    };

const isCellGroup = (node: ConditionCellNode): node is Extract<ConditionCellNode, { items: unknown }> =>
  'items' in node;

/** Whether the row being edited is `node` or sits inside it. */
function holds(node: ConditionCellNode, selected: string | undefined): boolean {
  if (selected === undefined) return false;
  if (isCellGroup(node)) return node.items.some(child => holds(child, selected));
  return node.key === selected;
}

export interface ConditionCellListProps {
  /** The accessible name of the list of conditions. */
  label: string;
  /** How the top-level cells join: "or" between alternatives, a plain line otherwise. */
  logic: 'AND' | 'OR';
  /** Switches how the top-level cells join; without it the logic only shows. */
  onLogicChange?: (logic: 'AND' | 'OR') => void;
  nodes: ConditionCellNode[];
  /** The row being edited. */
  selected: string | undefined;
  /** The row just added, which grows in. */
  entering: string | undefined;
  disabled: boolean;
  /** While there is no condition, a cell saying what that means: "Only if" with this chip, say "Every card". */
  everyText?: string;
  /** Under "+ Condition" while there is no condition, say "Leave empty to start every card on its own." */
  emptyHint?: string;
  /** A row is still unfinished, so the conditions can't be saved yet. */
  incomplete: boolean;
  /** A note on what the conditions mean, under them. */
  hint?: string;
  /** "+ Condition" was clicked. */
  onAdd: () => void;
  /** Escape, or a click elsewhere in the panel, closes the row being edited. */
  onCollapse: () => void;
}

/**
 * A rule's conditions as a flow of cells: each top-level condition, or group of them, is one cell; clicking a
 * cell edits it in place, Escape or a click elsewhere in the panel closes it, and "+ Condition" adds one.
 */
export function ConditionCellList({
  label,
  logic,
  onLogicChange,
  nodes,
  selected,
  entering,
  disabled,
  everyText,
  emptyHint,
  incomplete,
  hint,
  onAdd,
  onCollapse,
}: ConditionCellListProps) {
  const list = useRef<HTMLDivElement>(null);

  // A click elsewhere in the panel closes the cell; the pickers' popups sit outside the panel and leave it open.
  const onOutsidePointerDown = useEffectEvent((event: PointerEvent) => {
    const scope = list.current?.closest('aside') ?? list.current;
    const cell = list.current?.querySelector('[data-editing]');
    if (!(event.target instanceof Node) || !scope?.contains(event.target) || cell?.contains(event.target)) return;
    onCollapse();
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
    onCollapse();
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-row="${key}"]`)?.focus());
  };

  return (
    <div ref={list} role="group" aria-label={label} className="flex flex-col">
      {nodes.length === 0 && everyText && (
        <div className={cn(FLOW_CELL, 'flex-row items-center justify-between')}>
          <Txt as="span" variant="body-sm" tone="muted">
            Only if
          </Txt>
          <ValueChip>{everyText}</ValueChip>
        </div>
      )}
      {nodes.map((node, index) => (
        <GrowIn key={node.key} enter={node.key === entering}>
          <div className="flex flex-col">
            {index > 0 && <JoinWire index={index} logic={logic} onLogicChange={onLogicChange} />}
            <div
              data-editing={holds(node, selected) || undefined}
              onKeyDown={holds(node, selected) ? onKeyDown : undefined}
              className={cn(FLOW_CELL, holds(node, selected) && FLOW_CELL_SELECTED)}
            >
              {/* Eases to the cell's new height as a condition opens for editing or closes, instead of jumping. */}
              <div className="-m-1 overflow-hidden transition-[height] duration-normal ease-out-custom motion-reduce:h-auto!">
                <div ref={pinParentHeight} className="flex flex-col gap-1 p-1">
                  <ConditionCellItem node={node} entering={entering} />
                </div>
              </div>
            </div>
          </div>
        </GrowIn>
      ))}
      {!disabled && (
        <>
          {(nodes.length > 0 || everyText) && <Wire />}
          <span className={cn('flex', nodes.length === 0 && !everyText ? 'self-start' : 'self-center')}>
            <AddConditionButton onClick={onAdd} />
          </span>
        </>
      )}
      {!disabled && nodes.length === 0 && emptyHint && (
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

/** A row, or a group's rows joined by "or" or "and". */
function ConditionCellItem({ node, entering }: { node: ConditionCellNode; entering: string | undefined }) {
  if (!isCellGroup(node)) return node.row;
  return node.items.map((child, index) => (
    <GrowIn key={child.key} enter={child.key === entering}>
      <div className="flex flex-col gap-1">
        {index > 0 && <JoinWire index={index} logic={node.logic} nested onLogicChange={node.onLogicChange} />}
        <ConditionCellGroupChild node={child} entering={entering} />
      </div>
    </GrowIn>
  ));
}

/** The wire before a group's `index`th condition; the first one switches the group's logic when it can change. */
function JoinWire({
  index,
  logic,
  nested,
  onLogicChange,
}: {
  index: number;
  logic: 'AND' | 'OR';
  /** Inside a cell, where "and" is spelled out; between cells it is a plain line. */
  nested?: boolean;
  onLogicChange: ((logic: 'AND' | 'OR') => void) | undefined;
}) {
  if (index === 1 && onLogicChange) return <ConditionLogic logic={logic} onChange={onLogicChange} />;
  if (logic === 'OR') return <Wire word="or" />;
  return <Wire word={nested ? 'and' : undefined} />;
}

/** A group inside a group is indented. */
function ConditionCellGroupChild({ node, entering }: { node: ConditionCellNode; entering: string | undefined }) {
  if (!isCellGroup(node)) return <ConditionCellItem node={node} entering={entering} />;
  return (
    <div className="flex flex-col gap-1 border-l border-border-strong pl-2.5">
      <ConditionCellItem node={node} entering={entering} />
    </div>
  );
}

/** A condition's summary as a button that opens it for editing; `text` reads the condition as one sentence. */
export function ConditionRowButton({
  rowKey,
  text,
  onSelect,
  children,
}: {
  rowKey: string;
  /** The condition as one sentence, for the button's accessible name: "Labels has bug, documentation". */
  text: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-row={rowKey}
      aria-label={`Edit condition: ${text}`}
      className="-m-1 rounded-xl p-1 text-left outline-hidden focus-visible:ring-1 focus-visible:ring-foreground"
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

import { PlusIcon, XIcon } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { FilterBarChip } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import { FilterBarInput } from './filter-bar-input';
import type { FilterBarGroup, FilterBarLogic } from './types';
import { isFilterBarGroup } from './types';
import { useSettleOnLeave } from './use-settle-on-leave';
import { Button } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';

export type FilterBarLogicToggleProps = {
  groupId: string;
  logic: FilterBarLogic;
  className?: string;
};

/** Tiny `and` / `or` button between two rows; every connector of a group shares its logic. */
export function FilterBarLogicToggle({ groupId, logic, className }: FilterBarLogicToggleProps) {
  const ctx = useFilterBarContext();
  const next: FilterBarLogic = logic === 'and' ? 'or' : 'and';
  return (
    <button
      type="button"
      data-slot="filter-bar-logic"
      data-logic={logic}
      aria-label={`Joined with ${logic}, switch to ${next}`}
      title={`Switch to ${next}`}
      className={cn(
        'filter-bar-logic w-fit shrink-0 cursor-pointer rounded-md px-1 text-column tracking-wide text-muted-foreground uppercase outline-none',
        'hover:bg-fill-subtle hover:text-foreground focus-visible:bg-fill-hover focus-visible:text-foreground',
        className,
      )}
      onClick={() => ctx.setLogic(groupId, next)}
    >
      {logic}
    </button>
  );
}

export type FilterBarGroupEditorProps = {
  group: FilterBarGroup;
  /** Nesting level of `group` (root-level group = 1). */
  depth: number;
  className?: string;
};

/**
 * Recursive rule builder shown in an advanced-filter popover: one editable chip per
 * condition, a shared connector between rows, nested groups as indented blocks, and
 * `+ Filter` / `+ Group` actions. The shared typeahead input renders inline at the end of
 * the group it is pointed at.
 */
export function FilterBarGroupEditor({ group, depth, className }: FilterBarGroupEditorProps) {
  const ctx = useFilterBarContext();
  const addFilterRef = useRef<HTMLButtonElement>(null);
  const focusAddFilter = useRef(false);
  const targeted = ctx.inputTarget === group.id;
  const canNest = depth < ctx.maxDepth;

  // `+ Filter` only mounts once the input has left; focus it on that render.
  useEffect(() => {
    if (targeted || !focusAddFilter.current) return;
    focusAddFilter.current = false;
    addFilterRef.current?.focus();
  }, [targeted]);

  const rows: ReactNode[] = [];
  const connector = (key: string) => (
    <FilterBarLogicToggle key={`${key}:logic`} groupId={group.id} logic={group.logic} />
  );
  for (const node of group.nodes) {
    if (rows.length > 0) rows.push(connector(node.id));
    rows.push(
      isFilterBarGroup(node) ? (
        <NestedGroupRow key={node.id} group={node} depth={depth + 1} />
      ) : (
        <Fragment key={node.id}>
          <FilterBarChip item={node} className="w-fit" />
        </Fragment>
      ),
    );
  }
  if (ctx.draft && ctx.draft.groupId === group.id) {
    const { id, fieldId, operatorId = '' } = ctx.draft;
    if (rows.length > 0) rows.push(connector(id));
    rows.push(
      <Fragment key={id}>
        <FilterBarChip draft item={{ id, fieldId, operatorId, value: '' }} className="w-fit" />
      </Fragment>,
    );
  }

  return (
    <div
      data-slot="filter-bar-group-editor"
      data-depth={depth}
      role="group"
      aria-label={`Conditions joined with ${group.logic}`}
      className={cn('flex min-w-0 flex-col items-start gap-1', className)}
    >
      {rows}
      {targeted && (
        <FilterBarInput
          groupId={group.id}
          placeholder="Add condition…"
          onLeave={() => {
            focusAddFilter.current = true;
          }}
          className={rows.length > 0 ? 'mt-1' : undefined}
        />
      )}
      {!targeted && (
        <div className="flex items-center gap-1">
          <Button
            ref={addFilterRef}
            variant="ghost"
            size="sm"
            icon={<PlusIcon />}
            onClick={() => ctx.openGroupInput(group.id)}
          >
            Filter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<PlusIcon />}
            disabled={!canNest}
            tooltip={canNest ? undefined : `Groups can nest ${ctx.maxDepth} levels deep`}
            onClick={() => ctx.addGroup(group.id, group.logic === 'and' ? 'or' : 'and')}
          >
            Group
          </Button>
        </div>
      )}
    </div>
  );
}

function NestedGroupRow({ group, depth }: { group: FilterBarGroup; depth: number }) {
  const ctx = useFilterBarContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const leaving = ctx.leaving.has(group.id);
  useSettleOnLeave(group.id, leaving, rootRef);

  return (
    <div
      ref={rootRef}
      data-slot="filter-bar-editor-nested"
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
      className={cn(
        'filter-bar-editor-nested flex w-full items-start gap-1 border-l-2 border-border pl-3',
        leaving && 'pointer-events-none',
      )}
    >
      <FilterBarGroupEditor group={group} depth={depth} className="min-w-0 flex-1" />
      {!leaving && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove group"
          tooltip="Remove group"
          onClick={() => ctx.removeGroup(group.id)}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}

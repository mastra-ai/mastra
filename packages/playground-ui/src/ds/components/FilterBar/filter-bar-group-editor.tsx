import { FolderIcon, FolderPlusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { FilterBarChip } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import { FilterBarInput } from './filter-bar-input';
import { countLeaves } from './filter-bar-tree';
import type { FilterBarGroup, FilterBarLogic } from './types';
import { isFilterBarGroup } from './types';
import { useSettleOnLeave } from './use-settle-on-leave';
import { Button } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';

const connectorClass =
  'flex h-control-sm w-14 shrink-0 items-center justify-center rounded-md text-column text-muted-foreground uppercase';

export type FilterBarLogicToggleProps = {
  groupId: string;
  logic: FilterBarLogic;
  className?: string;
};

/** `and` / `or` connector in front of a row; every connector of a group shares its logic. */
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
        connectorClass,
        'filter-bar-logic cursor-pointer border border-border bg-fill-subtle outline-none',
        'hover:bg-fill-hover hover:text-foreground focus-visible:bg-fill-hover focus-visible:text-foreground',
        className,
      )}
      onClick={() => ctx.setLogic(groupId, next)}
    >
      {logic}
    </button>
  );
}

/** Segmented `and | or` control shown in a nested group's header. */
function FilterBarLogicSwitch({ groupId, logic }: { groupId: string; logic: FilterBarLogic }) {
  const ctx = useFilterBarContext();
  return (
    <div
      role="radiogroup"
      aria-label="Group logic"
      className="flex h-control-sm items-center gap-0.5 rounded-md border border-border bg-fill-subtle p-0.5"
    >
      {(['and', 'or'] as const).map(value => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={logic === value}
          aria-label={`Join with ${value}`}
          className={cn(
            'h-full cursor-pointer rounded-sm px-1.5 text-column uppercase outline-none',
            'focus-visible:bg-fill-hover',
            logic === value ? 'bg-fill-hover text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => logic !== value && ctx.setLogic(groupId, value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export type FilterBarGroupEditorProps = {
  group: FilterBarGroup;
  /** Nesting level of `group` (root-level group = 1). */
  depth: number;
  /** Drops this group; rendered as a trailing `Clear all` in the footer. */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

/**
 * Recursive rule builder shown in an advanced-filter popover. Rows are laid out as
 * `connector | condition`: the first row reads `where`, the following ones carry the
 * group's `and` / `or` toggle. Nested groups render as bordered cards with their own
 * header (logic switch + remove) and footer. The shared typeahead input renders as the
 * last row of the group it is pointed at.
 */
export function FilterBarGroupEditor({
  group,
  depth,
  onRemove,
  removeLabel = 'Remove group',
  className,
}: FilterBarGroupEditorProps) {
  const ctx = useFilterBarContext();
  const addFilterRef = useRef<HTMLButtonElement>(null);
  const focusAddFilter = useRef(false);
  const targeted = ctx.inputTarget === group.id;
  const canNest = depth < ctx.maxDepth;

  // `+ Condition` is hidden while the input is open; focus it once it remounts.
  useEffect(() => {
    if (targeted || !focusAddFilter.current) return;
    focusAddFilter.current = false;
    addFilterRef.current?.focus();
  }, [targeted]);

  const rows: ReactNode[] = [];
  const connector = (key: string) =>
    rows.length === 0 ? (
      <span key={`${key}:where`} className={connectorClass}>
        where
      </span>
    ) : (
      <FilterBarLogicToggle key={`${key}:logic`} groupId={group.id} logic={group.logic} />
    );
  for (const node of group.nodes) {
    rows.push(
      <Fragment key={node.id}>
        {connector(node.id)}
        {isFilterBarGroup(node) ? (
          <NestedGroupCard group={node} depth={depth + 1} />
        ) : (
          <FilterBarChip item={node} className="w-fit" />
        )}
      </Fragment>,
    );
  }
  if (ctx.draft && ctx.draft.groupId === group.id) {
    const { id, fieldId, operatorId = '' } = ctx.draft;
    rows.push(
      <Fragment key={id}>
        {connector(id)}
        <FilterBarChip draft item={{ id, fieldId, operatorId, value: '' }} className="w-fit" />
      </Fragment>,
    );
  }
  if (targeted) {
    rows.push(
      <Fragment key="input">
        {connector('input')}
        <FilterBarInput
          groupId={group.id}
          placeholder="Add condition…"
          onLeave={() => {
            focusAddFilter.current = true;
          }}
        />
      </Fragment>,
    );
  }

  return (
    <div
      data-slot="filter-bar-group-editor"
      data-depth={depth}
      role="group"
      aria-label={`Conditions joined with ${group.logic}`}
      className={cn('flex min-w-0 flex-col', className)}
    >
      {rows.length > 0 && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1.5 p-2">{rows}</div>
      )}
      <div
        data-slot="filter-bar-editor-actions"
        className={cn('flex w-full items-center gap-1 p-1', rows.length > 0 && 'border-t border-border')}
      >
        {!targeted && (
          <Button
            ref={addFilterRef}
            variant="ghost"
            size="sm"
            icon={<PlusIcon />}
            onClick={() => ctx.openGroupInput(group.id)}
          >
            Condition
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<FolderPlusIcon />}
          className="text-muted-foreground"
          tooltip={canNest ? undefined : `Groups can nest ${ctx.maxDepth} levels deep`}
          disabled={!canNest}
          onClick={() => ctx.addGroup(group.id, group.logic === 'and' ? 'or' : 'and')}
        >
          Group
        </Button>
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2Icon />}
            className="ml-auto text-muted-foreground"
            aria-label={removeLabel}
            onClick={onRemove}
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
}

function NestedGroupCard({ group, depth }: { group: FilterBarGroup; depth: number }) {
  const ctx = useFilterBarContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const leaving = ctx.leaving.has(group.id);
  useSettleOnLeave(group.id, leaving, rootRef);
  const count = countLeaves(group);

  return (
    <div
      ref={rootRef}
      data-slot="filter-bar-editor-nested"
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
      className={cn(
        'filter-bar-editor-nested w-full overflow-hidden rounded-lg border border-border',
        leaving && 'pointer-events-none',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <FolderIcon className="size-3.5 text-muted-foreground" />
        <span className="text-label text-foreground">Group</span>
        <span className="text-label text-muted-foreground">
          · {count} {count === 1 ? 'condition' : 'conditions'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <FilterBarLogicSwitch groupId={group.id} logic={group.logic} />
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip="Remove group"
            disabled={leaving}
            onClick={() => ctx.removeGroup(group.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <FilterBarGroupEditor group={group} depth={depth} />
    </div>
  );
}

import { CopyIcon, LayersIcon, LayersPlusIcon, PencilIcon, TextCursorInputIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SavedViewNameInput } from './saved-view-name-input';
import type { SavedView } from './saved-view-schema';
import { SavedViewSummary } from './saved-view-summary';
import type { SavedViewsController } from './use-saved-views';
import { Button, buttonVariants } from '@/ds/components/Button/Button';
import { ContextMenu } from '@/ds/components/ContextMenu';
import type { FilterBarField, FilterBarOperator } from '@/ds/components/FilterBar/types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { controlHeight } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

const restingTabClass = buttonVariants({ variant: 'default', size: 'sm' });
const selectedTabClass = cn(
  buttonVariants({ variant: 'ghost', size: 'sm' }),
  'bg-fill-hover text-foreground not-disabled:hover:bg-fill-hover',
);
const editingTabClass = cn(
  controlHeight.sm,
  'inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-[.9em] text-label text-muted-foreground',
  '[&_svg]:size-3.5 [&_svg]:shrink-0',
);

export type SavedViewTabsProps<TSettings> = {
  views: SavedViewsController<TSettings>;
  fields: readonly FilterBarField[];
  operators: readonly FilterBarOperator[];
  defaultLabel: string;
  newViewSettings: NoInfer<TSettings>;
  describeSettings?: (settings: TSettings) => ReactNode;
  'aria-label'?: string;
  className?: string;
};

export function SavedViewTabs<TSettings>({
  views,
  fields,
  operators,
  defaultLabel,
  newViewSettings,
  describeSettings,
  'aria-label': ariaLabel = 'Views',
  className,
}: SavedViewTabsProps<TSettings>) {
  const [renamingViewId, setRenamingViewId] = useState<string>();
  const { draft } = views;
  const creating = draft !== undefined && draft.viewId === undefined;
  const defaultSelected = views.activeView === undefined && !creating;

  const renderViewTab = (view: SavedView<TSettings>) => {
    if (draft?.viewId === view.id) {
      return <EditingViewTab key={view.id} name={draft.name} onRename={name => views.change({ name })} />;
    }
    if (renamingViewId === view.id) {
      return (
        <span key={view.id} className={cn(restingTabClass, 'gap-1.5')}>
          <Icon data-slot="button-icon" size="sm">
            <LayersIcon aria-hidden />
          </Icon>
          <SavedViewNameInput
            name={view.name}
            onCommit={name => {
              setRenamingViewId(undefined);
              views.rename(view.id, name);
            }}
          />
        </span>
      );
    }
    return (
      <SavedViewTab
        key={view.id}
        view={view}
        selected={views.activeView?.id === view.id && !creating}
        fields={fields}
        operators={operators}
        settings={describeSettings?.(view.settings)}
        onSelect={() => views.select(view.id)}
        onEdit={() => views.edit(view.id)}
        onRename={() => setRenamingViewId(view.id)}
        onDuplicate={() => views.duplicate(view.id)}
        onDelete={() => views.remove(view.id)}
      />
    );
  };

  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <button
        type="button"
        aria-pressed={defaultSelected}
        className={defaultSelected ? selectedTabClass : restingTabClass}
        onClick={() => views.select(undefined)}
      >
        {defaultLabel}
      </button>
      {views.views.map(renderViewTab)}
      {creating ? (
        <EditingViewTab name={draft.name} onRename={name => views.change({ name })} />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="New view"
          disabled={draft !== undefined}
          onClick={() => views.create(newViewSettings)}
        >
          <LayersPlusIcon />
        </Button>
      )}
    </div>
  );
}

function EditingViewTab({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [renaming, setRenaming] = useState(false);
  return (
    <span aria-current="true" className={editingTabClass}>
      <LayersIcon aria-hidden />
      {renaming ? (
        <SavedViewNameInput
          name={name}
          onCommit={next => {
            setRenaming(false);
            if (next.trim()) onRename(next);
          }}
        />
      ) : (
        <>
          <span className="max-w-48 truncate">{name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            tooltip="Rename view"
            className="-mr-2 size-6"
            onClick={() => setRenaming(true)}
          >
            <PencilIcon />
          </Button>
        </>
      )}
    </span>
  );
}

function SavedViewTab<TSettings>({
  view,
  selected,
  fields,
  operators,
  settings,
  onSelect,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
}: {
  view: SavedView<TSettings>;
  selected: boolean;
  fields: readonly FilterBarField[];
  operators: readonly FilterBarOperator[];
  settings: ReactNode;
  onSelect: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <ContextMenu>
      <HoverCard>
        <ContextMenu.Trigger
          render={
            <HoverCardTrigger
              delay={400}
              render={
                <button
                  type="button"
                  aria-pressed={selected}
                  className={cn(selected ? selectedTabClass : restingTabClass, 'gap-1.5')}
                  onClick={onSelect}
                />
              }
            />
          }
        >
          <Icon data-slot="button-icon" size="sm">
            <LayersIcon aria-hidden />
          </Icon>
          <span className="max-w-48 truncate">{view.name}</span>
        </ContextMenu.Trigger>
        <HoverCardContent side="bottom" align="start" showArrow={false} className="flex flex-col gap-2.5">
          <Txt as="span" variant="label">
            {view.name}
          </Txt>
          <SavedViewSummary filters={view.filters} fields={fields} operators={operators} settings={settings} />
          <Button type="button" variant="default" size="sm" className="self-start" onClick={onEdit}>
            <PencilIcon aria-hidden />
            Edit view
          </Button>
        </HoverCardContent>
      </HoverCard>
      <ContextMenu.Content>
        <ContextMenu.Item onClick={onEdit}>
          <PencilIcon aria-hidden />
          Edit view
        </ContextMenu.Item>
        <ContextMenu.Item onClick={onRename}>
          <TextCursorInputIcon aria-hidden />
          Rename
        </ContextMenu.Item>
        <ContextMenu.Item onClick={onDuplicate}>
          <CopyIcon aria-hidden />
          Duplicate
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item variant="destructive" onClick={onDelete}>
          <Trash2Icon aria-hidden />
          Delete view
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  );
}

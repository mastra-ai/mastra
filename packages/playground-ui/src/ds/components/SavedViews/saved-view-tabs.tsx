import { CopyIcon, LayersIcon, LayersPlusIcon, PencilIcon, TextCursorInputIcon, Trash2Icon } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { SavedViewNameInput } from './saved-view-name-input';
import type { SavedView } from './saved-view-schema';
import { SavedViewSummary } from './saved-view-summary';
import type { SavedViewsController } from './use-saved-views';
import { Button, buttonVariants } from '@/ds/components/Button/Button';
import { ContextMenu } from '@/ds/components/ContextMenu';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import type { FilterBarField, FilterBarOperator } from '@/ds/components/FilterBar/types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Icon } from '@/ds/icons/Icon';
import { controlHeight } from '@/ds/primitives/control-size';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

const restingTabClass = buttonVariants({ variant: 'default', size: 'sm' });
const selectedTabClass = cn(
  buttonVariants({ variant: 'ghost', size: 'sm' }),
  'bg-fill-hover text-foreground not-disabled:hover:bg-fill-hover',
);
const editingTabClass = cn(
  controlHeight.sm,
  'inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-strong bg-fill-hover px-[.9em] text-label text-foreground',
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
      {views.views.map(view => {
        if (draft?.viewId === view.id) {
          return <EditingViewTab key={view.id} name={draft.name} onRename={name => views.change({ name })} />;
        }
        if (renamingViewId === view.id) {
          return (
            <RenamingViewTab
              key={view.id}
              name={view.name}
              onCommit={name => {
                setRenamingViewId(undefined);
                views.rename(view.id, name);
              }}
            />
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
      })}
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
          <span className="bg-warning-indicator size-1.5 shrink-0 rounded-full" aria-hidden />
          <VisuallyHidden>Unsaved changes</VisuallyHidden>
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

function RenamingViewTab({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  return (
    <span className={cn(restingTabClass, 'gap-1.5')}>
      <SavedViewTabIcon />
      <SavedViewNameInput name={name} onCommit={onCommit} />
    </span>
  );
}

function SavedViewTabIcon() {
  return (
    <Icon data-slot="button-icon" size="sm">
      <LayersIcon aria-hidden />
    </Icon>
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
  const actions: ViewAction[] = [
    { label: 'Edit view', icon: <PencilIcon aria-hidden />, onClick: onEdit },
    { label: 'Rename', icon: <TextCursorInputIcon aria-hidden />, onClick: onRename },
    { label: 'Duplicate', icon: <CopyIcon aria-hidden />, onClick: onDuplicate },
    { label: 'Delete view', icon: <Trash2Icon aria-hidden />, onClick: onDelete, destructive: true },
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const changeMenuOpen = (open: boolean) => {
    if (selected || !open) {
      setMenuOpen(open);
      return;
    }
    setPreviewOpen(false);
    onSelect();
  };

  return (
    <ContextMenu>
      <DropdownMenu open={selected && menuOpen} onOpenChange={changeMenuOpen}>
        <HoverCard open={!selected && previewOpen} onOpenChange={setPreviewOpen}>
          <ContextMenu.Trigger
            render={
              <HoverCardTrigger
                delay={400}
                render={
                  <DropdownMenu.Trigger
                    render={
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-haspopup={selected ? 'menu' : undefined}
                        className={cn(selected ? selectedTabClass : restingTabClass, 'gap-1.5')}
                      />
                    }
                  />
                }
              />
            }
          >
            <SavedViewTabIcon />
            <span className="max-w-48 truncate">{view.name}</span>
          </ContextMenu.Trigger>
          <HoverCardContent side="bottom" align="start" showArrow={false}>
            <SavedViewSummary filters={view.filters} fields={fields} operators={operators} settings={settings} />
          </HoverCardContent>
        </HoverCard>
        <DropdownMenu.Content align="start">
          {actions.map(action => (
            <Fragment key={action.label}>
              {action.destructive && <DropdownMenu.Separator />}
              <DropdownMenu.Item variant={action.destructive ? 'destructive' : 'default'} onClick={action.onClick}>
                {action.icon}
                {action.label}
              </DropdownMenu.Item>
            </Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
      <ContextMenu.Content>
        {actions.map(action => (
          <Fragment key={action.label}>
            {action.destructive && <ContextMenu.Separator />}
            <ContextMenu.Item variant={action.destructive ? 'destructive' : 'default'} onClick={action.onClick}>
              {action.icon}
              {action.label}
            </ContextMenu.Item>
          </Fragment>
        ))}
      </ContextMenu.Content>
    </ContextMenu>
  );
}

type ViewAction = { label: string; icon: ReactNode; onClick: () => void; destructive?: boolean };

import { CopyIcon, LayersIcon, LayersPlusIcon, PencilIcon, TextCursorInputIcon, Trash2Icon } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { SavedViewDeleteDialog } from './saved-view-delete-dialog';
import { SavedViewNameInput } from './saved-view-name-input';
import type { SavedView } from './saved-view-schema';
import { SavedViewSummary } from './saved-view-summary';
import { SavedViewUnsavedDialog } from './saved-view-unsaved-dialog';
import type { SavedViewsController } from './use-saved-views';
import { Button, buttonVariants } from '@/ds/components/Button/Button';
import { ContextMenu } from '@/ds/components/ContextMenu';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import type { FilterBarField, FilterBarOperator } from '@/ds/components/FilterBar/types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { controlHeight } from '@/ds/primitives/control-size';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

const restingTabClass = buttonVariants({ variant: 'default', size: 'sm' });
const selectedTabClass = buttonVariants({ variant: 'subtle', size: 'sm' });
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
  /** Asks before deleting a view. */
  confirmDelete?: boolean;
  /** Asks before switching away from a draft with unsaved changes. */
  confirmUnsavedSwitch?: boolean;
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
  confirmDelete = false,
  confirmUnsavedSwitch = false,
  'aria-label': ariaLabel = 'Views',
  className,
}: SavedViewTabsProps<TSettings>) {
  const [renamingViewId, setRenamingViewId] = useState<string>();
  const [deletingView, setDeletingView] = useState<SavedView<TSettings>>();
  // The tab picked while the draft had unsaved changes, held until the user decides.
  const [switchingTo, setSwitchingTo] = useState<{ viewId: string | undefined }>();
  const { draft } = views;
  const creating = draft !== undefined && draft.viewId === undefined;
  const defaultSelected = views.activeView === undefined && !creating;
  const error = views.storageError ?? (views.loadError !== undefined ? 'Could not load views.' : undefined);

  const select = (viewId: string | undefined) => {
    const leaving = creating || viewId !== views.activeView?.id;
    if (confirmUnsavedSwitch && views.unsaved && leaving) setSwitchingTo({ viewId });
    else views.select(viewId);
  };

  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <button
        type="button"
        aria-pressed={defaultSelected}
        className={defaultSelected ? selectedTabClass : restingTabClass}
        onClick={() => select(undefined)}
      >
        {defaultLabel}
      </button>
      {views.views.map(view => {
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
            unsaved={draft?.viewId === view.id && views.unsaved}
            fields={fields}
            operators={operators}
            settings={describeSettings?.(view.settings)}
            deleteLabel={confirmDelete ? 'Delete view…' : 'Delete view'}
            onSelect={() => select(view.id)}
            onEdit={() => views.edit(view.id)}
            onRename={() => setRenamingViewId(view.id)}
            onDuplicate={() => views.duplicate(view.id)}
            onDelete={() => (confirmDelete ? setDeletingView(view) : views.remove(view.id))}
          />
        );
      })}
      {error && (
        <Txt role="alert" variant="caption" className="w-full text-destructive-foreground">
          {error}
        </Txt>
      )}
      {creating ? (
        <EditingViewTab name={draft.name} unsaved onRename={name => views.change({ name })} />
      ) : (
        <Button
          type="button"
          size="icon-sm"
          tooltip="New view"
          disabled={draft !== undefined}
          onClick={() => views.create(newViewSettings)}
        >
          <LayersPlusIcon />
        </Button>
      )}
      {confirmDelete && (
        <SavedViewDeleteDialog
          view={deletingView}
          onConfirm={() => {
            if (deletingView) views.remove(deletingView.id);
          }}
          onClose={() => setDeletingView(undefined)}
        />
      )}
      {confirmUnsavedSwitch && (
        <SavedViewUnsavedDialog
          views={views}
          open={switchingTo !== undefined}
          onProceed={() => {
            if (switchingTo) views.select(switchingTo.viewId);
            setSwitchingTo(undefined);
          }}
          onCancel={() => setSwitchingTo(undefined)}
        />
      )}
    </div>
  );
}

function EditingViewTab({
  name,
  unsaved,
  onRename,
}: {
  name: string;
  unsaved: boolean;
  onRename: (name: string) => void;
}) {
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
          {unsaved && (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-warning-indicator" aria-hidden />
              <VisuallyHidden>Unsaved changes</VisuallyHidden>
            </>
          )}
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
  unsaved,
  fields,
  operators,
  settings,
  deleteLabel,
  onSelect,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
}: {
  view: SavedView<TSettings>;
  selected: boolean;
  unsaved: boolean;
  fields: readonly FilterBarField[];
  operators: readonly FilterBarOperator[];
  settings: ReactNode;
  deleteLabel: string;
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
    { label: deleteLabel, icon: <Trash2Icon aria-hidden />, onClick: onDelete, destructive: true },
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const changeMenuOpen = (open: boolean) => {
    setMenuOpen(selected && open);
    if (open) setPreviewOpen(false);
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
                        onClick={() => {
                          if (selected) return;
                          setPreviewOpen(false);
                          onSelect();
                        }}
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
            {unsaved && <span className="size-1.5 shrink-0 rounded-full bg-warning-indicator" aria-hidden />}
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

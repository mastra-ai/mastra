import {
  CopyIcon,
  LayersIcon,
  LayersPlusIcon,
  RotateCcwIcon,
  SaveIcon,
  TextCursorInputIcon,
  Trash2Icon,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { SavedViewDeleteDialog } from './saved-view-delete-dialog';
import { SavedViewNameInput } from './saved-view-name-input';
import type { SavedView } from './saved-view-schema';
import { SavedViewUnsavedDialog } from './saved-view-unsaved-dialog';
import { NEW_SAVED_VIEW_NAME } from './use-saved-views';
import type { SavedViewsController } from './use-saved-views';
import { Button, buttonVariants } from '@/ds/components/Button/Button';
import { ContextMenu } from '@/ds/components/ContextMenu';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

const restingTabClass = buttonVariants({ variant: 'default', size: 'sm' });
const selectedTabClass = buttonVariants({ variant: 'subtle', size: 'sm' });

export type SavedViewTabsProps<TState> = {
  views: SavedViewsController<TState>;
  /** Label of the tab that shows the page without a view, e.g. "All traces". */
  defaultLabel: string;
  /** Preview shown when hovering a view that is not active. */
  renderSummary?: (view: SavedView<TState>) => ReactNode;
  'aria-label'?: string;
  className?: string;
};

export function SavedViewTabs<TState>({
  views,
  defaultLabel,
  renderSummary,
  'aria-label': ariaLabel = 'Views',
  className,
}: SavedViewTabsProps<TState>) {
  const [renamingViewId, setRenamingViewId] = useState<string>();
  const [deletingView, setDeletingView] = useState<SavedView<TState>>();
  // The tab picked while the active view had unsaved changes, held until the user decides.
  const [switchingTo, setSwitchingTo] = useState<{ viewId: string | undefined }>();
  const defaultSelected = views.activeView === undefined;
  const loadError = views.loadError === undefined ? undefined : 'Could not load views.';
  const error = views.error ?? loadError;

  const select = (viewId: string | undefined) => {
    if (views.unsaved && viewId !== views.activeView?.id) setSwitchingTo({ viewId });
    else views.select(viewId);
  };
  const finishSwitch = () => {
    if (switchingTo) views.select(switchingTo.viewId);
    setSwitchingTo(undefined);
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
            <span key={view.id} className={cn(restingTabClass, 'gap-1.5')}>
              <SavedViewTabIcon />
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
        const selected = views.activeView?.id === view.id;
        return (
          <SavedViewTab
            key={view.id}
            name={view.name}
            selected={selected}
            unsaved={selected && views.unsaved}
            disabled={views.pending}
            summary={renderSummary?.(view)}
            onSelect={() => select(view.id)}
            onSave={() => views.save()}
            onReset={views.reset}
            onRename={() => setRenamingViewId(view.id)}
            onDuplicate={() => views.duplicate(view.id)}
            onDelete={() => setDeletingView(view)}
          />
        );
      })}
      <NewViewTab views={views} />
      {error && (
        <Txt role="alert" variant="caption" className="w-full text-destructive-foreground">
          {error}
        </Txt>
      )}
      <SavedViewDeleteDialog
        viewName={deletingView?.name}
        onConfirm={() => {
          if (deletingView) views.remove(deletingView.id);
        }}
        onClose={() => setDeletingView(undefined)}
      />
      <SavedViewUnsavedDialog
        views={views}
        open={switchingTo !== undefined}
        onProceed={finishSwitch}
        onCancel={() => setSwitchingTo(undefined)}
      />
    </div>
  );
}

function NewViewTab<TState>({ views }: { views: SavedViewsController<TState> }) {
  if (views.creating && views.pending) {
    return (
      <span aria-busy="true" className={cn(restingTabClass, 'gap-1.5 opacity-60')}>
        <SavedViewTabIcon />
        Saving view…
      </span>
    );
  }
  if (views.creating) {
    return (
      <span className={cn(restingTabClass, 'gap-1.5')}>
        <SavedViewTabIcon />
        <SavedViewNameInput name={NEW_SAVED_VIEW_NAME} onCommit={views.create} onCancel={views.cancelCreating} />
      </span>
    );
  }
  return (
    <Button
      type="button"
      size="icon-sm"
      tooltip="Create new view…"
      disabled={views.pending}
      onClick={views.startCreating}
    >
      <LayersPlusIcon />
    </Button>
  );
}

function SavedViewTabIcon() {
  return (
    <Icon data-slot="button-icon" size="sm">
      <LayersIcon aria-hidden />
    </Icon>
  );
}

type ViewAction = { label: string; icon: ReactNode; onClick: () => void; destructive?: boolean };

function SavedViewTab({
  name,
  selected,
  unsaved,
  disabled,
  summary,
  onSelect,
  onSave,
  onReset,
  onRename,
  onDuplicate,
  onDelete,
}: {
  name: string;
  selected: boolean;
  unsaved: boolean;
  disabled: boolean;
  summary: ReactNode;
  onSelect: () => void;
  onSave: () => void;
  onReset: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const changeActions: ViewAction[] = unsaved
    ? [
        { label: 'Save to this view', icon: <SaveIcon aria-hidden />, onClick: onSave },
        { label: 'Reset changes', icon: <RotateCcwIcon aria-hidden />, onClick: onReset },
      ]
    : [];
  const actions: ViewAction[] = [
    ...changeActions,
    { label: 'Rename', icon: <TextCursorInputIcon aria-hidden />, onClick: onRename },
    { label: 'Duplicate', icon: <CopyIcon aria-hidden />, onClick: onDuplicate },
    { label: 'Delete view…', icon: <Trash2Icon aria-hidden />, onClick: onDelete, destructive: true },
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
        <HoverCard open={!selected && summary !== undefined && previewOpen} onOpenChange={setPreviewOpen}>
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
                        disabled={disabled && !selected}
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
            <span className="max-w-48 truncate">{name}</span>
            {unsaved && <span className="size-1.5 shrink-0 rounded-full bg-warning-indicator" aria-hidden />}
          </ContextMenu.Trigger>
          <HoverCardContent side="bottom" align="start" showArrow={false}>
            {summary}
          </HoverCardContent>
        </HoverCard>
        <DropdownMenu.Content align="start">
          {actions.map(action => (
            <Fragment key={action.label}>
              {action.destructive && <DropdownMenu.Separator />}
              <DropdownMenu.Item
                variant={action.destructive ? 'destructive' : 'default'}
                disabled={disabled}
                onClick={action.onClick}
              >
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
            <ContextMenu.Item
              variant={action.destructive ? 'destructive' : 'default'}
              disabled={disabled}
              onClick={action.onClick}
            >
              {action.icon}
              {action.label}
            </ContextMenu.Item>
          </Fragment>
        ))}
      </ContextMenu.Content>
    </ContextMenu>
  );
}

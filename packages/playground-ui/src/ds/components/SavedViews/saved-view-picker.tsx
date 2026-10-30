import { CopyIcon, EllipsisIcon, LayersIcon, LayersPlusIcon, TextCursorInputIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import { MAX_SAVED_VIEW_NAME_CHARS } from './saved-view-schema';
import type { SavedView } from './saved-view-schema';
import type { SavedViewsController } from './use-saved-views';
import { Button } from '@/ds/components/Button/Button';
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxItemEnd,
  ComboboxList,
  ComboboxRoot,
  ComboboxSearch,
  ComboboxTrigger,
} from '@/ds/components/Combobox/combobox-parts';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Input } from '@/ds/components/Input/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Txt } from '@/ds/components/Txt';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type SavedViewPickerProps<TSettings> = {
  views: SavedViewsController<TSettings>;
  /** Names the page's unfiltered state, e.g. "All traces". */
  defaultLabel: string;
  newViewSettings: NoInfer<TSettings>;
  /** Muted text after a view in the list, e.g. "Shared". */
  describeView?: (view: SavedView<TSettings>) => ReactNode;
  /** Whether a view can be renamed, deleted or overwritten. Others can still be applied and duplicated. */
  canEdit?: (view: SavedView<TSettings>) => boolean;
  'aria-label'?: string;
  className?: string;
};

type PickerItem = { value: string; label: string; viewId: string | undefined };

const DEFAULT_ITEM_VALUE = '';

/**
 * A compact saved-views control for a page header: a searchable view picker, the active view's
 * actions, and save / reset once the page differs from the view. Driven by the same controller
 * as `SavedViewTabs`.
 */
export function SavedViewPicker<TSettings>({
  views,
  defaultLabel,
  newViewSettings,
  describeView,
  canEdit = () => true,
  'aria-label': ariaLabel = 'Views',
  className,
}: SavedViewPickerProps<TSettings>) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const { draft, activeView } = views;
  const creating = draft !== undefined && draft.viewId === undefined;
  const activeUnsaved = !creating && draft?.viewId !== undefined && views.unsaved;
  const editable = activeView !== undefined && canEdit(activeView);

  const items: PickerItem[] = [
    { value: DEFAULT_ITEM_VALUE, label: defaultLabel, viewId: undefined },
    ...views.views.map(view => ({ value: view.id, label: view.name, viewId: view.id })),
  ];
  const selected = items.find(item => item.viewId === activeView?.id) ?? items[0];
  const viewsById = new Map(views.views.map(view => [view.id, view]));

  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex min-w-0 items-center justify-end gap-1.5', className)}>
      {views.error && !creating && (
        <Txt role="alert" variant="caption" className="min-w-0 truncate text-destructive-foreground">
          {views.error}
        </Txt>
      )}
      {activeUnsaved && (
        <>
          <Button type="button" variant="ghost" size="sm" disabled={views.pending} onClick={views.discard}>
            Reset
          </Button>
          {editable && (
            <Button type="button" variant="default" size="sm" disabled={views.pending} onClick={views.save}>
              Save changes
            </Button>
          )}
        </>
      )}
      <div ref={anchorRef} className="flex min-w-0 items-center gap-0.5">
        <ComboboxRoot
          items={items}
          value={selected}
          onValueChange={(item: PickerItem | null) => {
            if (item) views.select(item.viewId);
          }}
          isItemEqualToValue={(item: PickerItem, value: PickerItem) => item.value === value.value}
          autoHighlight
        >
          <ComboboxTrigger size="sm" icon={<LayersIcon />} aria-label={`View: ${selected?.label}`} className="max-w-60">
            {selected?.label}
            {activeUnsaved && (
              <>
                <span className="ml-1.5 inline-block size-1.5 rounded-full bg-warning-indicator align-middle" />
                <VisuallyHidden>Unsaved changes</VisuallyHidden>
              </>
            )}
          </ComboboxTrigger>
          <ComboboxContent align="end">
            <ComboboxSearch placeholder="Search views…" />
            <ComboboxEmpty>No views found.</ComboboxEmpty>
            <ComboboxList>
              {(item: PickerItem) => {
                const view = item.viewId ? viewsById.get(item.viewId) : undefined;
                return (
                  <ComboboxItem key={item.value} value={item}>
                    <span className="truncate">{item.label}</span>
                    {view && describeView && <ComboboxItemEnd>{describeView(view)}</ComboboxItemEnd>}
                  </ComboboxItem>
                );
              }}
            </ComboboxList>
          </ComboboxContent>
        </ComboboxRoot>
        {activeView && !creating && (
          <DropdownMenu>
            <DropdownMenu.Trigger variant="ghost" size="icon-sm" tooltip="View actions">
              <EllipsisIcon />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              {editable && (
                <DropdownMenu.Item onClick={() => setRenaming(true)}>
                  <TextCursorInputIcon aria-hidden />
                  Rename
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item onClick={() => views.duplicate(activeView.id)}>
                <CopyIcon aria-hidden />
                Duplicate
              </DropdownMenu.Item>
              {editable && (
                <>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item variant="destructive" onClick={() => views.remove(activeView.id)}>
                    <Trash2Icon aria-hidden />
                    Delete view
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu>
        )}
      </div>
      <Popover
        open={creating}
        onOpenChange={open => {
          if (open) views.create(newViewSettings);
          else views.discard();
        }}
      >
        <PopoverTrigger variant="ghost" size="icon-sm" tooltip="Save as new view">
          <LayersPlusIcon />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          {creating && (
            <ViewNameForm
              title="Save as new view"
              initialName={draft.name}
              submitLabel="Save view"
              error={views.error}
              pending={views.pending}
              onNameChange={name => views.change({ name })}
              onSubmit={() => views.save()}
              onCancel={views.discard}
            />
          )}
        </PopoverContent>
      </Popover>
      {activeView && (
        <RenamePopover
          open={renaming}
          anchorRef={anchorRef}
          name={activeView.name}
          onClose={() => setRenaming(false)}
          onRename={name => views.rename(activeView.id, name)}
        />
      )}
    </div>
  );
}

function RenamePopover({
  open,
  anchorRef,
  name,
  onClose,
  onRename,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLDivElement | null>;
  name: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  return (
    <Popover open={open} onOpenChange={next => !next && onClose()}>
      <PopoverContent anchor={anchorRef} align="end" className="w-72">
        {open && (
          <ViewNameForm
            title="Rename view"
            initialName={name}
            submitLabel="Rename"
            onSubmit={next => {
              onRename(next);
              onClose();
            }}
            onCancel={onClose}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function ViewNameForm({
  title,
  initialName,
  submitLabel,
  error,
  pending,
  onNameChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialName: string;
  submitLabel: string;
  error?: string;
  pending?: boolean;
  onNameChange?: (name: string) => void;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSubmit(name);
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Txt as="h2" variant="label">
        {title}
      </Txt>
      <Input
        aria-label="View name"
        size="sm"
        autoFocus
        onFocus={event => event.currentTarget.select()}
        maxLength={MAX_SAVED_VIEW_NAME_CHARS}
        value={name}
        error={error !== undefined}
        onChange={event => {
          setName(event.target.value);
          onNameChange?.(event.target.value);
        }}
      />
      {error && (
        <Txt role="alert" variant="caption" className="text-destructive-foreground">
          {error}
        </Txt>
      )}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending || !name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

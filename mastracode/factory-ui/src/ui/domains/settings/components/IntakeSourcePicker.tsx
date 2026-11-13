import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@mastra/playground-ui/components/Drawer';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsListHeader, SettingsRow, SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { Fragment, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { useSidePanelDrawer } from '../../../lib/hooks/useSidePanelDrawer';

/** A source row in the picker drawer, which has no settings card around it to space its rows. */
const drawerRowLayout = 'flex min-h-11 w-full min-w-0 flex-wrap items-center gap-2 px-4 py-2 text-left';

export interface SourcePickerItem {
  id: string;
  label: string;
  detail?: string;
  hint?: string;
}

export function sourcePickerItemText(item: SourcePickerItem): string {
  return item.detail ? `${item.detail}: ${item.label}` : item.label;
}

export interface SourcePickerGroup {
  id: string;
  label?: string;
  items: SourcePickerItem[];
}

export interface SourcePickerProps {
  label: string;
  addLabel: string;
  itemIcon?: ReactNode;
  groups: SourcePickerGroup[];
  selectedIds: string[] | null;
  /** A save is in flight: shown as status, never blocks a control. */
  saving: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onToggleItem: (id: string) => void;
  itemDescription?: (id: string) => string | undefined;
  /** Label for a saved source that is no longer listed; defaults to its ID. */
  fallbackLabel?: (id: string) => string;
  itemActions?: (item: SourcePickerItem) => ReactNode;
  /** Full-width content under a selected item's row, for routing that doesn't fit beside it. */
  itemDetails?: (item: SourcePickerItem) => ReactNode;
  /** Replaces Add on available items in the drawer, and sits beside Remove on added ones. */
  pickControl?: (item: SourcePickerItem, focusSearch: () => void) => ReactNode;
}

interface SelectedSource {
  item: SourcePickerItem;
  groupLabel?: string;
}

function resolveSelected(
  groups: SourcePickerGroup[],
  ids: string[],
  fallbackLabel: SourcePickerProps['fallbackLabel'],
): SelectedSource[] {
  return ids.map(id => {
    const group = groups.find(candidate => candidate.items.some(item => item.id === id));
    const item = group?.items.find(candidate => candidate.id === id) ?? { id, label: fallbackLabel?.(id) ?? id };
    return { item, groupLabel: groups.length > 1 ? group?.label : undefined };
  });
}

function SourceItemSummary({
  item,
  icon,
  context,
  description,
}: {
  item: SourcePickerItem;
  icon?: ReactNode;
  context: (string | undefined)[];
  description?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
      {icon && (
        <span className="shrink-0" aria-hidden>
          {icon}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="caption" className="wrap-anywhere">
          <Metadata>
            {item.detail && <Metadata.Item>{item.detail}</Metadata.Item>}
            <Metadata.Item>{item.label}</Metadata.Item>
          </Metadata>
        </Txt>
        {context.some(Boolean) && (
          <Txt as="p" variant="meta" tone="muted" className="wrap-anywhere">
            <Metadata>
              {context.map((entry, position) => entry && <Metadata.Item key={position}>{entry}</Metadata.Item>)}
            </Metadata>
          </Txt>
        )}
        {description && (
          <Txt as="p" variant="meta" tone="muted" className="wrap-anywhere">
            {description}
          </Txt>
        )}
      </div>
    </div>
  );
}

function SavingStatus({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <Spinner size="sm" aria-label={`Saving ${label} selection`} />
      <Txt as="span" variant="caption" tone="muted" aria-hidden>
        Saving…
      </Txt>
    </span>
  );
}

export function SourcePicker(props: SourcePickerProps) {
  const {
    label,
    addLabel,
    itemIcon,
    groups,
    selectedIds,
    saving,
    loading,
    error,
    onRetry,
    onToggleItem,
    itemDescription,
    fallbackLabel,
    itemActions,
    itemDetails,
  } = props;
  const sidePanel = useSidePanelDrawer();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = resolveSelected(groups, selectedIds ?? [], fallbackLabel);

  return (
    <Drawer {...sidePanel} open={open} onOpenChange={setOpen}>
      {/* One cell of the provider's card; its rows take the card's row spacing themselves. */}
      <div role="group" aria-label={label} className="flex min-w-0 flex-col *:py-3.25 *:first:pt-0 *:last:pb-0">
        <SettingsListHeader
          action={
            <DrawerTrigger
              render={
                <Button ref={trigger} type="button" size="sm" icon={<Plus />} aria-label={`${addLabel} to ${label}`}>
                  {addLabel}
                </Button>
              }
            />
          }
        >
          <span className="flex items-center gap-2">
            {label}
            {selected.length > 0 && <Badge size="sm">{selected.length}</Badge>}
          </span>
        </SettingsListHeader>
        {selected.length > 0 && (
          <ul className="contents">
            {selected.map(({ item, groupLabel }) => {
              const details = itemDetails?.(item);
              return (
                <li
                  key={item.id}
                  className="border-border flex min-w-0 flex-wrap items-center gap-2 border-t py-3.25 last:pb-0"
                >
                  <SourceItemSummary
                    item={item}
                    icon={itemIcon}
                    context={[groupLabel, item.hint]}
                    description={itemDescription?.(item.id)}
                  />
                  <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
                    {itemActions?.(item)}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      aria-label={`Remove ${sourcePickerItemText(item)}`}
                      onClick={() => {
                        onToggleItem(item.id);
                        requestAnimationFrame(() => trigger.current?.focus());
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  {details && <div className="min-w-0 basis-full">{details}</div>}
                </li>
              );
            })}
          </ul>
        )}
        {loading && (
          <SettingsSkeleton label={`Loading ${label}`} variant="item" rows={1} className="border-border border-t" />
        )}
        {!open && (saving || error) && (
          <div className="flex flex-col gap-2">
            {saving && <SavingStatus label={label} />}
            {error && (
              <div className="flex items-center gap-2">
                <Txt as="p" variant="caption" tone="muted" role="alert" className="min-w-0 flex-1 wrap-anywhere">
                  {error}
                </Txt>
                {onRetry && (
                  <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={onRetry}>
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {open && <SourcePickerDrawer {...props} trigger={trigger} />}
    </Drawer>
  );
}

function SourcePickerDrawer({
  label,
  addLabel,
  groups,
  selectedIds,
  saving,
  loading,
  error,
  onRetry,
  onToggleItem,
  itemDescription,
  fallbackLabel,
  pickControl,
  trigger,
}: SourcePickerProps & { trigger: RefObject<HTMLButtonElement | null> }) {
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const addedHeading = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (item: SourcePickerItem) => sourcePickerItemText(item).toLowerCase().includes(normalizedQuery);
  const selected = new Set(selectedIds);
  const added = resolveSelected(groups, selectedIds ?? [], fallbackLabel).filter(({ item }) => matches(item));
  const available = groups
    .map(group => ({ ...group, items: group.items.filter(item => !selected.has(item.id) && matches(item)) }))
    .filter(group => group.items.length > 0);
  const emptyText = normalizedQuery ? (added.length === 0 ? 'No matches' : undefined) : 'No more sources available';
  // The search box sits outside the scrolling list, so focusing it keeps the list where it was.
  const focusSearch = () => searchInput.current?.focus();

  return (
    <DrawerContent initialFocus={searchInput} finalFocus={trigger} className="overflow-hidden">
      <DrawerHeader className="shrink-0">
        <DrawerTitle>{addLabel}</DrawerTitle>
        <div className="mt-3">
          <SearchInput
            ref={searchInput}
            label={`Search ${label}`}
            placeholder="Search"
            value={query}
            onValueChange={setQuery}
            className="w-full"
          />
        </div>
      </DrawerHeader>
      <DrawerBody className="min-h-0 overflow-x-hidden overflow-y-auto">
        {error ? (
          <SettingsRow label={label} description={error}>
            {onRetry && (
              <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={onRetry}>
                Retry
              </Button>
            )}
          </SettingsRow>
        ) : loading ? (
          <SettingsSkeleton label={`Loading ${label}`} variant="item" rows={3} />
        ) : (
          <>
            {added.length > 0 && (
              <section aria-labelledby={addedHeading}>
                <SectionHeading id={addedHeading}>Added</SectionHeading>
                <ul>
                  {added.map(({ item, groupLabel }) => (
                    <li key={item.id} className={drawerRowLayout}>
                      <SourceItemSummary
                        item={item}
                        context={[groupLabel, item.hint]}
                        description={itemDescription?.(item.id)}
                      />
                      <div className="ml-auto flex max-w-full min-w-0 items-center justify-end gap-2">
                        {pickControl?.(item, focusSearch)}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          tooltip="Remove"
                          aria-label={`Remove ${sourcePickerItemText(item)}`}
                          onClick={() => {
                            onToggleItem(item.id);
                            focusSearch();
                          }}
                        >
                          <X />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {added.length > 0 && available.length > 0 && <SectionHeading>Available</SectionHeading>}
            <div role="group" aria-label={label}>
              {available.length === 0
                ? emptyText && (
                    <Txt as="p" variant="caption" tone="muted">
                      {emptyText}
                    </Txt>
                  )
                : available.map(group => (
                    <Fragment key={group.id}>
                      {group.label && (
                        <SettingsRow
                          label={
                            <Txt as="span" variant="caption" tone="muted">
                              {group.label}
                            </Txt>
                          }
                        />
                      )}
                      <ul>
                        {group.items.map(item => (
                          <li key={`${group.id}:${item.id}`} className={drawerRowLayout}>
                            <SourceItemSummary item={item} context={[item.hint]} />
                            <div className="ml-auto flex max-w-full min-w-0 items-center justify-end gap-2">
                              {pickControl ? (
                                pickControl(item, focusSearch)
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<Plus />}
                                  aria-label={`Add ${sourcePickerItemText(item)}`}
                                  onClick={() => {
                                    onToggleItem(item.id);
                                    focusSearch();
                                  }}
                                >
                                  Add
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Fragment>
                  ))}
            </div>
          </>
        )}
      </DrawerBody>
      <DrawerFooter className="shrink-0">
        {saving && <SavingStatus label={label} />}
        <DrawerClose
          render={
            <Button size="sm" icon={<Check />}>
              Done
            </Button>
          }
        />
      </DrawerFooter>
    </DrawerContent>
  );
}

function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Txt as="h3" id={id} variant="meta" tone="muted" className="m-0 px-4 pt-4 pb-1">
      {children}
    </Txt>
  );
}

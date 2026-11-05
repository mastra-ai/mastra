import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
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
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { useSidePanelDrawer } from '../../../lib/hooks/useSidePanelDrawer';
import { SettingsAddRow } from './common/SettingsAddRow';
import { settingsRowLayout } from './common/settings-row-layout';

export interface SourcePickerItem {
  id: string;
  label: string;
  detail?: string;
  hint?: string;
  disabled?: boolean;
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
  pending: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onToggleItem: (id: string) => Promise<void>;
  itemDescription?: (id: string) => string | undefined;
  /** Label for a saved source that is no longer listed; defaults to its ID. */
  fallbackLabel?: (id: string) => string;
  itemActions?: (item: SourcePickerItem) => ReactNode;
  /** Full-width content under a selected item's row, for routing that doesn't fit beside it. */
  itemDetails?: (item: SourcePickerItem) => ReactNode;
  addControl?: (item: SourcePickerItem, focusSearch: () => void) => ReactNode;
}

export function SourcePicker(props: SourcePickerProps) {
  const {
    label,
    addLabel,
    itemIcon,
    groups,
    selectedIds,
    pending,
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
  const selected = selectedIds ?? [];
  const savingIndicator = pending && <Spinner size="sm" aria-label={`Saving ${label} selection`} />;

  return (
    <Drawer
      {...sidePanel}
      open={open}
      onOpenChange={nextOpen => {
        if (!pending) setOpen(nextOpen);
      }}
    >
      <div role="group" aria-label={label} className="flex w-full min-w-0 flex-col">
        {selected.length > 0 && (
          <ul className="divide-border border-border divide-y border-b">
            {selected.map(id => {
              const group = groups.find(candidate => candidate.items.some(item => item.id === id));
              const item: SourcePickerItem = group?.items.find(candidate => candidate.id === id) ?? {
                id,
                label: fallbackLabel?.(id) ?? id,
              };
              const groupLabel = groups.length > 1 ? group?.label : undefined;
              const description = itemDescription?.(id);
              const details = itemDetails?.(item);
              return (
                <li key={id} className={cn(settingsRowLayout, 'flex flex-wrap items-center')}>
                  <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                    {itemIcon && (
                      <span className="shrink-0" aria-hidden>
                        {itemIcon}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Txt as="span" variant="caption" className="wrap-anywhere">
                        <Metadata>
                          {item.detail && <Metadata.Item>{item.detail}</Metadata.Item>}
                          <Metadata.Item>{item.label}</Metadata.Item>
                        </Metadata>
                      </Txt>
                      {(groupLabel || item.hint) && (
                        <Txt as="p" variant="meta" tone="muted" className="wrap-anywhere">
                          <Metadata>
                            {groupLabel && <Metadata.Item>{groupLabel}</Metadata.Item>}
                            {item.hint && <Metadata.Item>{item.hint}</Metadata.Item>}
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
                  <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
                    {itemActions?.(item)}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      aria-label={`Remove ${sourcePickerItemText(item)}`}
                      disabled={pending || item.disabled}
                      onClick={async () => {
                        await onToggleItem(id);
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
        <DrawerTrigger
          render={
            <SettingsAddRow ref={trigger} aria-label={`${addLabel} to ${label}`} disabled={pending}>
              {addLabel}
            </SettingsAddRow>
          }
        />
        {!open && savingIndicator}
        {!open && error && (
          <div className="flex items-center gap-2 px-4 py-3">
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
        {!open && loading && (
          <div className="px-4 py-3">
            <Txt as="p" variant="caption" tone="muted" role="status">
              Loading {label}…
            </Txt>
          </div>
        )}
      </div>
      {open && <SourcePickerDrawer {...props} trigger={trigger} savingIndicator={savingIndicator} />}
    </Drawer>
  );
}

function SourcePickerDrawer({
  label,
  addLabel,
  groups,
  selectedIds,
  pending,
  loading,
  error,
  onRetry,
  onToggleItem,
  addControl,
  trigger,
  savingIndicator,
}: SourcePickerProps & {
  trigger: RefObject<HTMLButtonElement | null>;
  savingIndicator: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const selected = new Set(selectedIds);
  const matchingGroups = groups
    .map(group => ({
      ...group,
      items: group.items.filter(
        item => !selected.has(item.id) && sourcePickerItemText(item).toLowerCase().includes(normalizedQuery),
      ),
    }))
    .filter(group => group.items.length > 0);

  return (
    <DrawerContent
      initialFocus={searchInput}
      finalFocus={trigger}
      showCloseButton={!pending}
      aria-busy={pending || undefined}
      className="overflow-hidden"
    >
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
          <SettingsRow label={`Loading ${label}…`} />
        ) : (
          <div role="group" aria-label={label}>
            {matchingGroups.length === 0 ? (
              <Txt as="p" variant="caption" tone="muted">
                {normalizedQuery ? 'No matches' : 'No more sources available'}
              </Txt>
            ) : (
              matchingGroups.map(group => (
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
                  {group.items.map(item => (
                    <SettingsRow
                      key={`${group.id}:${item.id}`}
                      label={
                        <Metadata>
                          {item.detail && <Metadata.Item>{item.detail}</Metadata.Item>}
                          <Metadata.Item>{item.label}</Metadata.Item>
                        </Metadata>
                      }
                      description={item.hint}
                    >
                      {addControl ? (
                        addControl(item, () => searchInput.current?.focus())
                      ) : (
                        <Checkbox
                          checked={false}
                          aria-label={sourcePickerItemText(item)}
                          disabled={pending || item.disabled}
                          onCheckedChange={() => {
                            onToggleItem(item.id);
                            searchInput.current?.focus();
                          }}
                        />
                      )}
                    </SettingsRow>
                  ))}
                </Fragment>
              ))
            )}
          </div>
        )}
      </DrawerBody>
      <DrawerFooter className="shrink-0">
        {savingIndicator}
        <DrawerClose
          disabled={pending}
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

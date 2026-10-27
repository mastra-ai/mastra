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
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { SettingsAddRow } from './common/SettingsAddRow';
import { settingsRowLayout } from './common/settings-row-layout';

export interface SourcePickerItem {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface SourcePickerGroup {
  id: string;
  label?: string;
  items: SourcePickerItem[];
}

interface SourcePickerProps {
  label: string;
  addLabel?: string;
  itemIcon?: ReactNode;
  groups: SourcePickerGroup[];
  selectedIds: string[] | null;
  disabled: boolean;
  pending: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onToggleItem: (id: string) => Promise<void>;
}

export function SourcePicker(props: SourcePickerProps) {
  const {
    label,
    addLabel = 'Add project',
    itemIcon,
    groups,
    selectedIds,
    disabled,
    pending,
    loading,
    error,
    onRetry,
    onToggleItem,
  } = props;
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = selectedIds ?? [];
  const selectionDisabled = disabled || pending;
  const savingIndicator = pending && <Spinner size="sm" aria-label={`Saving ${label} selection`} />;

  return (
    <Drawer
      side={isMobile ? 'bottom' : 'right'}
      variant={isMobile ? 'default' : 'floating'}
      overlay="visible"
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
              const item = group?.items.find(candidate => candidate.id === id);
              const context = [groups.length > 1 ? group?.label : undefined, item?.hint].filter(Boolean).join(' · ');
              return (
                <li key={id} className={cn(settingsRowLayout, 'relative flex items-center')}>
                  {itemIcon && (
                    <span className="shrink-0" aria-hidden>
                      {itemIcon}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col pr-28">
                    <Txt as="span" variant="caption" className="wrap-anywhere">
                      {item?.label ?? id}
                    </Txt>
                    {context && (
                      <Txt as="p" variant="meta" tone="muted" className="wrap-anywhere">
                        {context}
                      </Txt>
                    )}
                  </div>
                  <div className="absolute top-1/2 right-4 -translate-y-1/2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      aria-label={`Remove ${item?.label ?? id}`}
                      disabled={selectionDisabled || item?.disabled}
                      onClick={async () => {
                        await onToggleItem(id);
                        requestAnimationFrame(() => trigger.current?.focus());
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <DrawerTrigger
          render={
            <SettingsAddRow ref={trigger} aria-label={`${addLabel} to ${label}`} disabled={selectionDisabled}>
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
      {open && (
        <SourcePickerDrawer
          {...props}
          disabled={selectionDisabled}
          addLabel={addLabel}
          trigger={trigger}
          savingIndicator={savingIndicator}
        />
      )}
    </Drawer>
  );
}

function SourcePickerDrawer({
  label,
  addLabel,
  groups,
  selectedIds,
  disabled,
  pending,
  loading,
  error,
  onRetry,
  onToggleItem,
  trigger,
  savingIndicator,
}: SourcePickerProps & {
  addLabel: string;
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
      items: group.items.filter(item => !selected.has(item.id) && item.label.toLowerCase().includes(normalizedQuery)),
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
            placeholder="Search…"
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
                    <SettingsRow key={`${group.id}:${item.id}`} label={item.label} description={item.hint}>
                      <Checkbox
                        checked={false}
                        aria-label={item.label}
                        disabled={disabled || item.disabled}
                        onCheckedChange={() => {
                          onToggleItem(item.id);
                          searchInput.current?.focus();
                        }}
                      />
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

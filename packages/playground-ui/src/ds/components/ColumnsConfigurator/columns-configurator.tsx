import { ArrowLeftIcon, Columns3Icon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ButtonWithTooltip } from '../Button';
import { Button } from '../Button/Button';
import { DropdownMenu } from '../DropdownMenu';
import { Input } from '../Input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '../Select';
import { cn } from '@/lib/utils';

export type ColumnConfig = {
  name: string;
  label: string;
};

export type CustomColumnSource = {
  id: string;
  label: string;
  discoveredKeys?: string[];
};

export type CustomColumnConfig = {
  name: string;
  label: string;
  source: string;
  key: string;
};

export type ColumnsConfiguratorProps = {
  columns: ColumnConfig[];
  visibleColumns: string[];
  onVisibleColumnsChange: (names: string[]) => void;
  requiredColumns?: string[];
  defaultVisibleColumns?: string[];
  optionalColumns?: ColumnConfig[];
  customColumns?: CustomColumnConfig[];
  customColumnSources?: CustomColumnSource[];
  onAddCustomColumn?: (column: Omit<CustomColumnConfig, 'name'>) => void;
  onRemoveCustomColumn?: (name: string) => void;
  disabled?: boolean;
  label?: string;
  resetLabel?: string;
  applyLabel?: string;
  cancelLabel?: string;
};

/** Sentinel value used in the Key Select to switch to manual entry mode. */
const MANUAL_KEY_SENTINEL = '__manual__';

function stopPointerBubble(e: PointerEvent) {
  e.stopPropagation();
}

/**
 * Turns a raw object key like `userPlan`, `user-plan`, or `user_plan` into
 * a space-separated label (`user Plan` / `user plan`).
 */
export function humanizeKey(key: string): string {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'h-8 py-1 px-3 flex items-center uppercase whitespace-nowrap text-neutral2 tracking-widest text-ui-xs border-b border-border1',
      )}
    >
      {children}
    </div>
  );
}

function CustomColumnForm({
  sources,
  existingColumns,
  builtInNames,
  onAdd,
  onClose,
}: {
  sources: CustomColumnSource[];
  existingColumns: CustomColumnConfig[];
  /** Names of built-in (predefined + optional) columns. Discovered keys whose
   *  name matches a built-in are hidden from suggestions to avoid duplicates. */
  builtInNames: Set<string>;
  onAdd: (column: Omit<CustomColumnConfig, 'name'>) => void;
  onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState<string>(sources[0]?.id ?? '');
  const [key, setKey] = useState('');
  const [keyMode, setKeyMode] = useState<'suggestion' | 'manual'>('suggestion');

  const activeSource = useMemo(() => sources.find(s => s.id === sourceId) ?? sources[0], [sources, sourceId]);

  const usedKeysForSource = useMemo(
    () => new Set(existingColumns.filter(c => c.source === activeSource?.id).map(c => c.key)),
    [existingColumns, activeSource],
  );

  const keyOptions = useMemo(
    () =>
      (activeSource?.discoveredKeys ?? [])
        .filter(k => !builtInNames.has(k))
        .map(k => ({
          label: k,
          value: k,
          disabled: usedKeysForSource.has(k),
        })),
    [activeSource, usedKeysForSource, builtInNames],
  );

  const trimmedKey = key.trim();
  const canSubmit = trimmedKey.length > 0 && !!activeSource && !usedKeysForSource.has(trimmedKey);

  const handleSelectKey = (value: string) => {
    if (value === MANUAL_KEY_SENTINEL) {
      setKeyMode('manual');
      setKey('');
      return;
    }
    setKey(value);
  };

  const switchToSuggestions = () => {
    setKeyMode('suggestion');
    setKey('');
  };

  const submit = () => {
    if (!canSubmit || !activeSource) return;
    const trimmedKey = key.trim();
    onAdd({
      source: activeSource.id,
      key: trimmedKey,
      label: humanizeKey(trimmedKey),
    });
    onClose();
  };

  return (
    <div className={cn('flex flex-col gap-3 p-3')} onPointerDown={stopPointerBubble}>
      {sources.length > 1 && (
        <div className={cn('flex flex-col gap-1')}>
          <span className={cn('text-ui-sm text-neutral3')}>Source</span>
          <Select value={activeSource?.id} onValueChange={setSourceId}>
            <SelectTrigger className={cn('w-full')}>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map(source => (
                <SelectItem key={source.id} value={source.id}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className={cn('flex flex-col gap-1')}>
        <div className={cn('flex items-center justify-between')}>
          <span className={cn('text-ui-sm text-neutral3')}>Key</span>
          {keyMode === 'manual' && (
            <button
              type="button"
              onClick={switchToSuggestions}
              className={cn('flex items-center gap-1 text-ui-xs text-neutral3 hover:text-neutral5')}
            >
              <ArrowLeftIcon className={cn('size-3')} />
              Back to suggestions
            </button>
          )}
        </div>
        {keyMode === 'suggestion' ? (
          <Select value={key || undefined} onValueChange={handleSelectKey}>
            <SelectTrigger className={cn('w-full')}>
              <SelectValue placeholder="Select key..." />
            </SelectTrigger>
            <SelectContent>
              {keyOptions.map(option => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
              {keyOptions.length > 0 && <SelectSeparator />}
              <SelectItem value={MANUAL_KEY_SENTINEL}>Type custom key…</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            size="sm"
            placeholder="e.g. tenantId"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') submit();
            }}
            autoFocus
          />
        )}
      </div>

      <div className={cn('flex items-center gap-2')}>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <div className={cn('flex-1')} />
        <Button size="sm" variant="primary" onClick={submit} disabled={!canSubmit}>
          <PlusIcon />
          Add column
        </Button>
      </div>
    </div>
  );
}

export function ColumnsConfigurator({
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  requiredColumns,
  defaultVisibleColumns,
  optionalColumns,
  customColumns,
  customColumnSources,
  onAddCustomColumn,
  onRemoveCustomColumn,
  disabled,
  label = 'Customize columns',
  resetLabel = 'Reset to default',
  applyLabel = 'Apply changes',
  cancelLabel = 'Cancel',
}: ColumnsConfiguratorProps) {
  const required = useMemo(() => new Set(requiredColumns ?? []), [requiredColumns]);
  const fallbackDefault = useMemo(() => columns.map(c => c.name), [columns]);
  const resetTarget = defaultVisibleColumns ?? fallbackDefault;
  const builtInNames = useMemo(
    () => new Set([...columns.map(c => c.name), ...(optionalColumns ?? []).map(c => c.name)]),
    [columns, optionalColumns],
  );

  // Whether the visible-column set differs from the default — used to surface
  // an indicator dot on the trigger so users can tell at a glance that
  // customizations are active. Custom-column definitions that aren't currently
  // visible (e.g. added then hidden, or persisted across a reset) don't count
  // — only what's actually rendered in the list matters.
  const isCustomized = useMemo(() => {
    if (visibleColumns.length !== resetTarget.length) return true;
    for (let i = 0; i < visibleColumns.length; i++) {
      if (visibleColumns[i] !== resetTarget[i]) return true;
    }
    return false;
  }, [visibleColumns, resetTarget]);

  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draftVisible, setDraftVisible] = useState<string[]>(visibleColumns);
  const [draftCustom, setDraftCustom] = useState<CustomColumnConfig[]>(customColumns ?? []);

  // Sync drafts whenever the dropdown opens, so toggling closed/open shows the current applied state.
  useEffect(() => {
    if (open) {
      setDraftVisible(visibleColumns);
      setDraftCustom(customColumns ?? []);
      setShowAddForm(false);
    }
  }, [open, visibleColumns, customColumns]);

  const draftVisibleSet = useMemo(() => new Set(draftVisible), [draftVisible]);
  const allColumns = useMemo(() => {
    const optionalConfigs: ColumnConfig[] = optionalColumns ?? [];
    const customAsConfigs: ColumnConfig[] = draftCustom.map(c => ({ name: c.name, label: c.label }));
    return [...columns, ...optionalConfigs, ...customAsConfigs];
  }, [columns, optionalColumns, draftCustom]);

  const handleToggle = (name: string, checked: boolean) => {
    if (required.has(name)) return;
    if (checked) {
      // Re-add in canonical column order so the table column order stays predictable
      const order = allColumns.map(c => c.name);
      const nextVisible = order.filter(n => draftVisibleSet.has(n) || n === name);
      setDraftVisible(nextVisible);
      return;
    }
    // Prevent hiding the last visible (non-required) column
    const remaining = draftVisible.filter(n => n !== name);
    if (remaining.length === 0) return;
    setDraftVisible(remaining);
  };

  const handleRemoveCustom = (e: MouseEvent<HTMLButtonElement>, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraftCustom(prev => prev.filter(c => c.name !== name));
    setDraftVisible(prev => prev.filter(n => n !== name));
  };

  const handleAddCustomToDraft = (column: Omit<CustomColumnConfig, 'name'>) => {
    const name = `${column.source}:${column.key}`;
    setDraftCustom(prev => (prev.some(c => c.name === name) ? prev : [...prev, { ...column, name }]));
    setDraftVisible(prev => (prev.includes(name) ? prev : [...prev, name]));
  };

  const handleReset = () => {
    onVisibleColumnsChange(resetTarget);
    setOpen(false);
  };

  const handleApply = () => {
    // Custom-column lifecycle is opt-in: both handlers must be wired for the
    // configurator to commit add/remove deltas. When they aren't, strip any
    // custom names out of the visible list so we never commit names whose
    // definitions the parent doesn't know about.
    const customsWired = !!onAddCustomColumn && !!onRemoveCustomColumn;
    if (customsWired) {
      const propCustomByName = new Map((customColumns ?? []).map(c => [c.name, c] as const));
      const draftByName = new Map(draftCustom.map(c => [c.name, c] as const));
      // Removals first, then additions (reduces the chance of stale references in callers).
      for (const c of customColumns ?? []) {
        if (!draftByName.has(c.name)) onRemoveCustomColumn(c.name);
      }
      for (const c of draftCustom) {
        if (!propCustomByName.has(c.name)) {
          const { name: _name, ...rest } = c;
          onAddCustomColumn(rest);
        }
      }
      onVisibleColumnsChange(draftVisible);
    } else {
      onVisibleColumnsChange(draftVisible.filter(name => builtInNames.has(name)));
    }
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const canReset = useMemo(() => {
    if (draftVisible.length !== resetTarget.length) return true;
    for (let i = 0; i < draftVisible.length; i++) {
      if (draftVisible[i] !== resetTarget[i]) return true;
    }
    return false;
  }, [draftVisible, resetTarget]);

  const hasChanges = useMemo(() => {
    if (draftVisible.length !== visibleColumns.length) return true;
    for (let i = 0; i < draftVisible.length; i++) {
      if (draftVisible[i] !== visibleColumns[i]) return true;
    }
    const props = customColumns ?? [];
    if (draftCustom.length !== props.length) return true;
    const propNames = new Set(props.map(c => c.name));
    for (const c of draftCustom) {
      if (!propNames.has(c.name)) return true;
    }
    return false;
  }, [draftVisible, draftCustom, visibleColumns, customColumns]);

  const renderToggle = (col: ColumnConfig, isRequired: boolean) => {
    const isChecked = isRequired || draftVisibleSet.has(col.name);
    return (
      <DropdownMenu.CheckboxItem
        key={col.name}
        checked={isChecked}
        disabled={isRequired}
        onCheckedChange={checked => handleToggle(col.name, Boolean(checked))}
        onSelect={e => e.preventDefault()}
      >
        {col.label}
      </DropdownMenu.CheckboxItem>
    );
  };

  const renderCustomToggle = (col: CustomColumnConfig) => {
    const isChecked = draftVisibleSet.has(col.name);
    const displayLabel = col.key;
    return (
      <DropdownMenu.CheckboxItem
        key={col.name}
        checked={isChecked}
        onCheckedChange={checked => handleToggle(col.name, Boolean(checked))}
        onSelect={e => e.preventDefault()}
      >
        <span className={cn('truncate flex-1')}>{displayLabel}</span>
        {onRemoveCustomColumn && (
          <button
            type="button"
            aria-label={`Remove ${displayLabel}`}
            onClick={e => handleRemoveCustom(e, col.name)}
            onPointerDown={stopPointerBubble}
            className={cn(
              'ml-2 inline-flex items-center justify-center rounded hover:bg-surface5 text-neutral3 hover:text-neutral5 size-5',
            )}
          >
            <XIcon className={cn('size-3.5')} />
          </button>
        )}
      </DropdownMenu.CheckboxItem>
    );
  };

  const canAddCustom = !!onAddCustomColumn && !!customColumnSources && customColumnSources.length > 0;

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <ButtonWithTooltip
          disabled={disabled}
          aria-label={label}
          tooltipContent={isCustomized ? 'Update column customization' : label}
          indicator={isCustomized}
        >
          <Columns3Icon />
        </ButtonWithTooltip>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        className={cn('max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))]')}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className={cn('flex flex-col h-96 w-md')}>
          <div className={cn('grid gap-0 p-1 pb-0 grid-cols-[1fr_1fr] flex-1 min-h-0')}>
            <div className={cn('flex flex-col min-h-0 border-r border-border1')}>
              <SectionHeading>Predefined columns</SectionHeading>
              <div className={cn('flex-1 overflow-y-auto pt-2 pb-3')}>
                {columns.map(col => renderToggle(col, required.has(col.name)))}
                {(optionalColumns ?? []).map(col => renderToggle(col, false))}
              </div>
            </div>

            <div className={cn('flex flex-col min-h-0')}>
              <SectionHeading>{showAddForm && canAddCustom ? 'Add Custom column' : 'Custom columns'}</SectionHeading>
              {showAddForm && canAddCustom ? (
                <CustomColumnForm
                  sources={customColumnSources!}
                  existingColumns={draftCustom}
                  builtInNames={builtInNames}
                  onAdd={handleAddCustomToDraft}
                  onClose={() => setShowAddForm(false)}
                />
              ) : (
                <>
                  <div className={cn('flex-1 overflow-y-auto pl-2 pt-2 pb-3')}>
                    {draftCustom.map(col => renderCustomToggle(col))}
                  </div>
                  {canAddCustom && (
                    <div className={cn('border-t border-border1 p-3.5')} onPointerDown={stopPointerBubble}>
                      <Button size="sm" onClick={() => setShowAddForm(true)} className="w-full">
                        <PlusIcon />
                        Add custom column
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={cn('border-t border-border1 p-3 pt-4 flex items-center gap-2')}>
            <Button size="md" onClick={handleReset} variant="ghost" disabled={!canReset}>
              <RotateCcwIcon />
              {resetLabel}
            </Button>
            <div className={cn('flex-1')} />
            <Button size="md" onClick={handleCancel} variant="ghost">
              {cancelLabel}
            </Button>
            <Button size="md" variant="primary" onClick={handleApply} disabled={!hasChanges}>
              {applyLabel}
            </Button>
          </div>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

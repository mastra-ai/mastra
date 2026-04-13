import type { EntityType } from '@mastra/core/observability';
import {
  Button,
  DatePicker,
  TimePicker,
  DropdownMenu,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Searchbar,
  Switch,
  cn,
} from '@mastra/playground-ui';
import { Portal as DropdownMenuPortal, SubContent as DropdownMenuSubContent } from '@radix-ui/react-dropdown-menu';
import { isValid, parse } from 'date-fns';
import { CalendarIcon, FilterIcon, XIcon, SearchIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useState, useMemo, useCallback } from 'react';

// UI-specific entity options that map to API EntityType values
// Using the enum values (lowercase strings) for the type field
export type EntityOptions =
  | { value: string; label: string; type: EntityType.AGENT }
  | { value: string; label: string; type: EntityType.WORKFLOW_RUN }
  | { value: string; label: string; type: 'all' };

export type MetadataFilter = { key: string; value: string };

export type TraceDatePreset = 'all' | 'last-24h' | 'last-3d' | 'last-7d' | 'last-14d' | 'last-30d' | 'custom';

/** Canonical list of context field IDs used for trace filtering and value extraction */
export const CONTEXT_FIELD_IDS = [
  'environment',
  'serviceName',
  'source',
  'scope',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'experimentId',
  'spanType',
  'entityName',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
] as const;

/** Label and group metadata for each context field, keyed by field ID */
const CONTEXT_FIELD_META: Record<string, { label: string; group: string }> = {
  environment: { label: 'Environment', group: 'Deployment' },
  serviceName: { label: 'Service Name', group: 'Deployment' },
  source: { label: 'Source', group: 'Deployment' },
  scope: { label: 'Scope', group: 'Deployment' },
  userId: { label: 'User ID', group: 'Identity' },
  organizationId: { label: 'Organization ID', group: 'Identity' },
  resourceId: { label: 'Resource ID', group: 'Identity' },
  runId: { label: 'Run ID', group: 'Correlation' },
  sessionId: { label: 'Session ID', group: 'Correlation' },
  threadId: { label: 'Thread ID', group: 'Correlation' },
  requestId: { label: 'Request ID', group: 'Correlation' },
  experimentId: { label: 'Experiment ID', group: 'Experimentation' },
  spanType: { label: 'Span Type', group: 'Span' },
  entityName: { label: 'Entity Name', group: 'Entity' },
  parentEntityType: { label: 'Parent Entity Type', group: 'Entity' },
  parentEntityId: { label: 'Parent Entity ID', group: 'Entity' },
  parentEntityName: { label: 'Parent Entity Name', group: 'Entity' },
  rootEntityType: { label: 'Root Entity Type', group: 'Entity' },
  rootEntityId: { label: 'Root Entity ID', group: 'Entity' },
  rootEntityName: { label: 'Root Entity Name', group: 'Entity' },
};

/** All string-valued filter fields from tracesFilterSchema (beyond entity/status/tags/metadata) */
const CONTEXT_FILTER_CATEGORIES: { id: string; label: string; group: string }[] = CONTEXT_FIELD_IDS.map(id => ({
  id,
  ...CONTEXT_FIELD_META[id],
}));

const DATE_PRESETS: { value: TraceDatePreset; label: string; ms?: number }[] = [
  { value: 'all', label: 'All' },
  { value: 'last-24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: 'last-3d', label: 'Last 3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { value: 'last-7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'last-14d', label: 'Last 14 days', ms: 14 * 24 * 60 * 60 * 1000 },
  { value: 'last-30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'custom', label: 'Custom range...' },
];

function buildDateWithTime(date: Date, timeStr: string): Date | null {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const combined = parse(timeStr, 'h:mm a', dateOnly);
  return isValid(combined) ? combined : null;
}

/** SubContent that renders via Portal so it escapes parent overflow/backdrop-filter */
const subContentClass = cn(
  'bg-surface5 backdrop-blur-xl z-50 min-w-32 overflow-auto rounded-lg p-2 shadow-md',
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
);

function PortalSubContent({ className, children, ...props }: ComponentPropsWithoutRef<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuSubContent className={cn(subContentClass, className)} {...props}>
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  );
}

/** Minimum items before showing a search bar in a submenu */
const SUBMENU_SEARCH_THRESHOLD = 6;

function SubMenuSearch({
  value,
  onChange,
  label = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className={cn('px-2 pb-2')}>
      <div
        className={cn(
          'flex items-center gap-2 border border-border1 rounded-md px-2 py-1',
          'focus-within:border-neutral2',
        )}
      >
        <SearchIcon className={cn('text-neutral3 h-3.5 w-3.5 shrink-0')} />
        <input
          type="text"
          placeholder="Search..."
          aria-label={label}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          className={cn('bg-transparent text-ui-sm text-neutral4 placeholder:text-neutral3 outline-hidden w-full')}
        />
      </div>
    </div>
  );
}

type TracesToolsProps = {
  selectedEntity?: EntityOptions;
  entityOptions?: EntityOptions[];
  onEntityChange: (val: EntityOptions) => void;
  selectedDateFrom?: Date | undefined;
  selectedDateTo?: Date | undefined;
  onReset?: () => void;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
  isLoading?: boolean;
  groupByThread?: boolean;
  onGroupByThreadChange?: (value: boolean) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  datePreset?: TraceDatePreset;
  onDatePresetChange?: (preset: TraceDatePreset) => void;
  selectedTags?: string[];
  availableTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  errorOnly?: boolean;
  onErrorOnlyChange?: (value: boolean) => void;
  selectedMetadata?: Record<string, string>;
  availableMetadata?: Record<string, string[]>;
  onMetadataChange?: (metadata: Record<string, string>) => void;
  contextFilters?: Record<string, string>;
  availableContextValues?: Record<string, string[]>;
  onContextFiltersChange?: (filters: Record<string, string>) => void;
};

export function TracesTools({
  onEntityChange,
  onReset,
  selectedEntity,
  entityOptions,
  onDateChange,
  selectedDateFrom,
  selectedDateTo,
  isLoading,
  groupByThread,
  onGroupByThreadChange,
  searchQuery: _searchQuery,
  onSearchChange,
  datePreset = 'all',
  onDatePresetChange,
  selectedTags,
  availableTags,
  onTagsChange,
  errorOnly,
  onErrorOnlyChange,
  selectedMetadata,
  availableMetadata,
  onMetadataChange,
  contextFilters,
  availableContextValues,
  onContextFiltersChange,
}: TracesToolsProps) {
  const [filterSearch, setFilterSearch] = useState('');
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState<Date | undefined>(selectedDateFrom);
  const [draftDateTo, setDraftDateTo] = useState<Date | undefined>(selectedDateTo);
  const [draftTimeFrom, setDraftTimeFrom] = useState('12:00 AM');
  const [draftTimeTo, setDraftTimeTo] = useState('11:59 PM');
  const [entitySearch, setEntitySearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [metadataKeySearch, setMetadataKeySearch] = useState('');
  const [subValueSearch, setSubValueSearch] = useState('');
  const [contextFieldSearch, setContextFieldSearch] = useState('');
  const [customRangeError, setCustomRangeError] = useState<string | undefined>();

  const resetSubSearch = useCallback(
    (setter: (v: string) => void) => (open: boolean) => {
      if (!open) setter('');
    },
    [],
  );

  const datePresetLabel = DATE_PRESETS.find(p => p.value === datePreset)?.label ?? 'All';

  const handleDatePresetSelect = (preset: TraceDatePreset) => {
    onDatePresetChange?.(preset);
    if (preset === 'custom') {
      setDraftDateFrom(selectedDateFrom);
      setDraftDateTo(selectedDateTo);
      setDraftTimeFrom('12:00 AM');
      setDraftTimeTo('11:59 PM');
      setCustomRangeOpen(true);
      return;
    }
    const entry = DATE_PRESETS.find(p => p.value === preset);
    if (entry?.ms) {
      onDateChange?.(new Date(Date.now() - entry.ms), 'from');
      onDateChange?.(undefined, 'to');
    } else {
      // "All" — no date filtering
      onDateChange?.(undefined, 'from');
      onDateChange?.(undefined, 'to');
    }
  };

  const applyCustomRange = () => {
    const fromDate = draftDateFrom ? (buildDateWithTime(draftDateFrom, draftTimeFrom) ?? draftDateFrom) : undefined;
    const toDate = draftDateTo ? (buildDateWithTime(draftDateTo, draftTimeTo) ?? draftDateTo) : undefined;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      setCustomRangeError('Start date/time must be before end date/time');
      return;
    }
    setCustomRangeError(undefined);
    onDateChange?.(fromDate, 'from');
    onDateChange?.(toDate, 'to');
    setCustomRangeOpen(false);
  };

  const metadataCount = Object.keys(selectedMetadata ?? {}).length;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedEntity && selectedEntity.value !== 'all') count++;
    if (errorOnly) count++;
    if ((selectedTags ?? []).length > 0) count++;
    if (metadataCount > 0) count++;
    if (contextFilters) {
      count += Object.values(contextFilters).filter(v => v.trim()).length;
    }
    return count;
  }, [selectedEntity, errorOnly, selectedTags, metadataCount, contextFilters]);

  const contextFilterGroups = useMemo(() => {
    const groups: Record<string, { id: string; label: string }[]> = {};
    for (const cat of CONTEXT_FILTER_CATEGORIES) {
      if (!groups[cat.group]) groups[cat.group] = [];
      groups[cat.group].push({ id: cat.id, label: cat.label });
    }
    return groups;
  }, []);

  const metadataKeys = useMemo(() => Object.keys(availableMetadata ?? {}).sort(), [availableMetadata]);

  const filterCategories = useMemo(() => {
    const q = filterSearch.toLowerCase();
    const categories = [
      { id: 'status', label: 'Status' },
      { id: 'entity-type', label: 'Entity Type' },
      { id: 'tags', label: 'Tags' },
      { id: 'metadata', label: 'Metadata' },
      ...Object.keys(contextFilterGroups).map(group => ({ id: `ctx-${group}`, label: group })),
    ];
    if (!q) return categories;
    return categories.filter(c => {
      if (c.label.toLowerCase().includes(q)) return true;
      if (c.id.startsWith('ctx-')) {
        const group = c.label;
        return contextFilterGroups[group]?.some(f => f.label.toLowerCase().includes(q));
      }
      if (c.id === 'metadata') {
        return metadataKeys.some(k => k.toLowerCase().includes(q));
      }
      return false;
    });
  }, [filterSearch, contextFilterGroups, metadataKeys]);

  return (
    <div className={cn('grid gap-3')}>
      {/* Toolbar row */}
      <div className={cn('flex items-center gap-3')}>
        {/* Search */}
        {onSearchChange && (
          <div className={cn('flex-1 max-w-sm')}>
            <Searchbar
              onSearch={onSearchChange}
              label="Search traces"
              placeholder="Search name, ID, content..."
              size="md"
            />
          </div>
        )}

        {/* Date Preset / Custom Range */}
        {datePreset === 'custom' ? (
          <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="md" disabled={isLoading}>
                <CalendarIcon />
                {selectedDateFrom ? selectedDateFrom.toLocaleDateString() : 'Start'} {' \u2013 '}
                {selectedDateTo ? selectedDateTo.toLocaleDateString() : 'End'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className={cn('w-auto p-0')}>
              <div className={cn('flex')}>
                <div className={cn('border-r border-border1')}>
                  <span className={cn('text-ui-sm text-neutral3 font-medium px-4 pt-3 block')}>Start</span>
                  <DatePicker
                    mode="single"
                    selected={draftDateFrom}
                    month={draftDateFrom}
                    onSelect={setDraftDateFrom}
                    disabled={isLoading}
                    toDate={draftDateTo}
                  />
                  <TimePicker
                    className="mx-4 mb-3 w-auto"
                    defaultValue={draftTimeFrom}
                    onValueChange={setDraftTimeFrom}
                  />
                </div>
                <div>
                  <span className={cn('text-ui-sm text-neutral3 font-medium px-4 pt-3 block')}>End</span>
                  <DatePicker
                    mode="single"
                    selected={draftDateTo}
                    month={draftDateTo}
                    onSelect={setDraftDateTo}
                    disabled={isLoading}
                    fromDate={draftDateFrom}
                  />
                  <TimePicker className="mx-4 mb-3 w-auto" defaultValue={draftTimeTo} onValueChange={setDraftTimeTo} />
                </div>
              </div>
              {customRangeError && <p className={cn('text-ui-sm text-red-500 px-4 pb-1')}>{customRangeError}</p>}
              <div className={cn('flex justify-between items-center px-4 pb-3')}>
                <button
                  type="button"
                  className={cn('text-ui-sm text-neutral3 hover:text-neutral4')}
                  onClick={() => {
                    setCustomRangeError(undefined);
                    handleDatePresetSelect('all');
                  }}
                >
                  &larr; Presets
                </button>
                <Button variant="primary" size="sm" onClick={applyCustomRange}>
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="md" disabled={isLoading}>
                <CalendarIcon />
                {datePresetLabel}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start">
              {DATE_PRESETS.map(preset => (
                <DropdownMenu.Item key={preset.value} onSelect={() => handleDatePresetSelect(preset.value)}>
                  {preset.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
        )}

        {/* Filter Dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" size="md" disabled={isLoading}>
              <FilterIcon />
              Filter
              {activeFilterCount > 0 && (
                <span
                  className={cn(
                    'ml-0.5 inline-flex items-center justify-center rounded-full bg-accent1/50 text-neutral5 text-ui-sm w-5 h-5',
                  )}
                >
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" className={cn('min-w-48')}>
            {/* Search filters */}
            <div className={cn('px-2 pb-2')}>
              <div
                className={cn(
                  'flex items-center gap-2 border border-border1 rounded-md px-2 py-1',
                  'focus-within:border-neutral2',
                )}
              >
                <SearchIcon className={cn('text-neutral3 h-3.5 w-3.5 shrink-0')} />
                <input
                  type="text"
                  placeholder="Search filters..."
                  aria-label="Search filters"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  className={cn(
                    'bg-transparent text-ui-sm text-neutral4 placeholder:text-neutral3 outline-hidden w-full',
                  )}
                />
              </div>
            </div>

            <DropdownMenu.Separator />

            {/* Status */}
            {filterCategories.some(c => c.id === 'status') && onErrorOnlyChange && (
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  Status
                  {errorOnly && <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>}
                </DropdownMenu.SubTrigger>
                <PortalSubContent>
                  <DropdownMenu.CheckboxItem
                    checked={!errorOnly}
                    onCheckedChange={() => onErrorOnlyChange(false)}
                    onSelect={e => e.preventDefault()}
                  >
                    All
                  </DropdownMenu.CheckboxItem>
                  <DropdownMenu.CheckboxItem
                    checked={errorOnly}
                    onCheckedChange={() => onErrorOnlyChange(true)}
                    onSelect={e => e.preventDefault()}
                  >
                    Error only
                  </DropdownMenu.CheckboxItem>
                </PortalSubContent>
              </DropdownMenu.Sub>
            )}

            {/* Entity Type */}
            {filterCategories.some(c => c.id === 'entity-type') && entityOptions && (
              <DropdownMenu.Sub onOpenChange={resetSubSearch(setEntitySearch)}>
                <DropdownMenu.SubTrigger>
                  Entity Type
                  {selectedEntity && selectedEntity.value !== 'all' && (
                    <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>
                  )}
                </DropdownMenu.SubTrigger>
                <PortalSubContent>
                  {entityOptions.length >= SUBMENU_SEARCH_THRESHOLD && (
                    <SubMenuSearch value={entitySearch} onChange={setEntitySearch} label="Search entity types" />
                  )}
                  <DropdownMenu.RadioGroup
                    value={selectedEntity?.value ?? 'all'}
                    onValueChange={val => {
                      const entity = entityOptions.find(e => e.value === val);
                      if (entity) onEntityChange(entity);
                    }}
                  >
                    {entityOptions
                      .filter(
                        option => !entitySearch || option.label.toLowerCase().includes(entitySearch.toLowerCase()),
                      )
                      .map(option => (
                        <DropdownMenu.RadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenu.RadioItem>
                      ))}
                  </DropdownMenu.RadioGroup>
                </PortalSubContent>
              </DropdownMenu.Sub>
            )}

            {/* Tags */}
            {filterCategories.some(c => c.id === 'tags') && onTagsChange && (availableTags ?? []).length > 0 && (
              <DropdownMenu.Sub onOpenChange={resetSubSearch(setTagSearch)}>
                <DropdownMenu.SubTrigger>
                  Tags
                  {(selectedTags ?? []).length > 0 && (
                    <span className={cn('ml-auto text-ui-sm text-accent1')}>{selectedTags?.length}</span>
                  )}
                </DropdownMenu.SubTrigger>
                <PortalSubContent>
                  {(availableTags ?? []).length >= SUBMENU_SEARCH_THRESHOLD && (
                    <SubMenuSearch value={tagSearch} onChange={setTagSearch} label="Search tags" />
                  )}
                  {(availableTags ?? [])
                    .filter(tag => !tagSearch || tag.toLowerCase().includes(tagSearch.toLowerCase()))
                    .map(tag => (
                      <DropdownMenu.CheckboxItem
                        key={tag}
                        checked={(selectedTags ?? []).includes(tag)}
                        onCheckedChange={checked => {
                          if (checked) {
                            onTagsChange([...(selectedTags ?? []), tag]);
                          } else {
                            onTagsChange((selectedTags ?? []).filter(t => t !== tag));
                          }
                        }}
                        onSelect={e => e.preventDefault()}
                      >
                        {tag}
                      </DropdownMenu.CheckboxItem>
                    ))}
                </PortalSubContent>
              </DropdownMenu.Sub>
            )}

            {/* Metadata */}
            {filterCategories.some(c => c.id === 'metadata') && onMetadataChange && metadataKeys.length > 0 && (
              <DropdownMenu.Sub onOpenChange={resetSubSearch(setMetadataKeySearch)}>
                <DropdownMenu.SubTrigger>
                  Metadata
                  {metadataCount > 0 && <span className={cn('ml-auto text-ui-sm text-accent1')}>{metadataCount}</span>}
                </DropdownMenu.SubTrigger>
                <PortalSubContent className={cn('max-h-80')}>
                  {metadataKeys.length >= SUBMENU_SEARCH_THRESHOLD && (
                    <SubMenuSearch
                      value={metadataKeySearch}
                      onChange={setMetadataKeySearch}
                      label="Search metadata keys"
                    />
                  )}
                  {metadataKeys
                    .filter(key => !metadataKeySearch || key.toLowerCase().includes(metadataKeySearch.toLowerCase()))
                    .map(key => {
                      const values = availableMetadata?.[key] ?? [];
                      const selectedValue = selectedMetadata?.[key];
                      return (
                        <DropdownMenu.Sub key={key} onOpenChange={resetSubSearch(setSubValueSearch)}>
                          <DropdownMenu.SubTrigger>
                            <span className={cn('truncate')}>{key}</span>
                            {selectedValue && <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>}
                          </DropdownMenu.SubTrigger>
                          <PortalSubContent className={cn('max-h-80')}>
                            {values.length >= SUBMENU_SEARCH_THRESHOLD && (
                              <SubMenuSearch
                                value={subValueSearch}
                                onChange={setSubValueSearch}
                                label="Search metadata values"
                              />
                            )}
                            {/* "Any" option to clear the selection for this key */}
                            <DropdownMenu.CheckboxItem
                              checked={!selectedValue}
                              onCheckedChange={() => {
                                const next = { ...selectedMetadata };
                                delete next[key];
                                onMetadataChange(next);
                              }}
                              onSelect={e => e.preventDefault()}
                            >
                              Any
                            </DropdownMenu.CheckboxItem>
                            <DropdownMenu.Separator />
                            {values
                              .filter(
                                value => !subValueSearch || value.toLowerCase().includes(subValueSearch.toLowerCase()),
                              )
                              .map(value => (
                                <DropdownMenu.CheckboxItem
                                  key={value}
                                  checked={selectedValue === value}
                                  onCheckedChange={checked => {
                                    const next = { ...selectedMetadata };
                                    if (checked) {
                                      next[key] = value;
                                    } else {
                                      delete next[key];
                                    }
                                    onMetadataChange(next);
                                  }}
                                  onSelect={e => e.preventDefault()}
                                >
                                  <span className={cn('truncate')}>{value}</span>
                                </DropdownMenu.CheckboxItem>
                              ))}
                          </PortalSubContent>
                        </DropdownMenu.Sub>
                      );
                    })}
                </PortalSubContent>
              </DropdownMenu.Sub>
            )}

            {/* Context filter groups */}
            {onContextFiltersChange &&
              Object.entries(contextFilterGroups).map(([group, fields]) => {
                if (!filterCategories.some(c => c.id === `ctx-${group}`)) return null;
                const q = filterSearch.toLowerCase();
                const visibleFields = q
                  ? fields.filter(f => f.label.toLowerCase().includes(q) || group.toLowerCase().includes(q))
                  : fields;
                // Only show fields that have available values
                const fieldsWithValues = visibleFields.filter(f => (availableContextValues?.[f.id] ?? []).length > 0);
                if (fieldsWithValues.length === 0) return null;
                const activeInGroup = fieldsWithValues.filter(f => contextFilters?.[f.id]?.trim()).length;
                return (
                  <DropdownMenu.Sub key={group} onOpenChange={resetSubSearch(setContextFieldSearch)}>
                    <DropdownMenu.SubTrigger>
                      {group}
                      {activeInGroup > 0 && (
                        <span className={cn('ml-auto text-ui-sm text-accent1')}>{activeInGroup}</span>
                      )}
                    </DropdownMenu.SubTrigger>
                    <PortalSubContent className={cn('max-h-80')}>
                      {fieldsWithValues.length >= SUBMENU_SEARCH_THRESHOLD && (
                        <SubMenuSearch
                          value={contextFieldSearch}
                          onChange={setContextFieldSearch}
                          label="Search context fields"
                        />
                      )}
                      {fieldsWithValues
                        .filter(
                          field =>
                            !contextFieldSearch || field.label.toLowerCase().includes(contextFieldSearch.toLowerCase()),
                        )
                        .map(field => {
                          const values = availableContextValues?.[field.id] ?? [];
                          const selectedValue = contextFilters?.[field.id];
                          return (
                            <DropdownMenu.Sub key={field.id} onOpenChange={resetSubSearch(setSubValueSearch)}>
                              <DropdownMenu.SubTrigger>
                                <span className={cn('truncate')}>{field.label}</span>
                                {selectedValue && <span className={cn('ml-auto text-ui-sm text-accent1')}>1</span>}
                              </DropdownMenu.SubTrigger>
                              <PortalSubContent className={cn('max-h-80')}>
                                {values.length >= SUBMENU_SEARCH_THRESHOLD && (
                                  <SubMenuSearch
                                    value={subValueSearch}
                                    onChange={setSubValueSearch}
                                    label="Search context values"
                                  />
                                )}
                                {/* "Any" option to clear the selection for this field */}
                                <DropdownMenu.CheckboxItem
                                  checked={!selectedValue}
                                  onCheckedChange={() => {
                                    const next = { ...contextFilters };
                                    delete next[field.id];
                                    onContextFiltersChange(next);
                                  }}
                                  onSelect={e => e.preventDefault()}
                                >
                                  Any
                                </DropdownMenu.CheckboxItem>
                                <DropdownMenu.Separator />
                                {values
                                  .filter(
                                    value =>
                                      !subValueSearch || value.toLowerCase().includes(subValueSearch.toLowerCase()),
                                  )
                                  .map(value => (
                                    <DropdownMenu.CheckboxItem
                                      key={value}
                                      checked={selectedValue === value}
                                      onCheckedChange={checked => {
                                        const next = { ...contextFilters };
                                        if (checked) {
                                          next[field.id] = value;
                                        } else {
                                          delete next[field.id];
                                        }
                                        onContextFiltersChange(next);
                                      }}
                                      onSelect={e => e.preventDefault()}
                                    >
                                      <span className={cn('truncate')}>{value}</span>
                                    </DropdownMenu.CheckboxItem>
                                  ))}
                              </PortalSubContent>
                            </DropdownMenu.Sub>
                          );
                        })}
                    </PortalSubContent>
                  </DropdownMenu.Sub>
                );
              })}

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onSelect={() => onReset?.()}>
                  <XIcon />
                  Clear all filters
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>

        {/* Reset */}
        {onReset && (
          <Button disabled={isLoading} size="md" onClick={() => onReset()}>
            <XIcon />
            Reset
          </Button>
        )}

        {/* Group by thread (view toggle, not a data filter) */}
        {onGroupByThreadChange && (
          <label className={cn('flex gap-2 items-center shrink-0 cursor-pointer')}>
            <Switch checked={groupByThread} onCheckedChange={onGroupByThreadChange} disabled={isLoading} />
            <span className={cn('text-ui-md text-neutral3')}>Group by thread</span>
          </label>
        )}
      </div>
    </div>
  );
}

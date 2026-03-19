import { SelectField } from '@/ds/components/FormFields';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Button } from '@/ds/components/Button/Button';
import { Switch } from '@/ds/components/Switch/switch';
import { MultiCombobox } from '@/ds/components/Combobox/multi-combobox';
import { Searchbar } from '@/ds/components/Searchbar/searchbar';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { EntityType } from '@mastra/core/observability';
import { Icon } from '@/ds/icons/Icon';

// UI-specific entity options that map to API EntityType values
// Using the enum values (lowercase strings) for the type field
export type EntityOptions =
  | { value: string; label: string; type: EntityType.AGENT }
  | { value: string; label: string; type: EntityType.WORKFLOW_RUN }
  | { value: string; label: string; type: 'all' };

export type MetadataFilter = { key: string; value: string };

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
  selectedTags?: string[];
  availableTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  errorOnly?: boolean;
  onErrorOnlyChange?: (value: boolean) => void;
  metadataFilters?: MetadataFilter[];
  onMetadataFiltersChange?: (filters: MetadataFilter[]) => void;
};

function MetadataFilterRow({
  filter,
  onUpdate,
  onRemove,
  disabled,
}: {
  filter: MetadataFilter;
  onUpdate: (updated: MetadataFilter) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2')}>
      <input
        type="text"
        value={filter.key}
        onChange={e => onUpdate({ ...filter, key: e.target.value })}
        placeholder="Key"
        disabled={disabled}
        className={cn(
          'bg-surface1 border border-border1 rounded-md px-2 py-1 text-ui-md text-neutral4 w-32',
          'placeholder:text-neutral3 focus:outline-none focus:border-neutral2',
        )}
      />
      <span className={cn('text-ui-md text-neutral3')}>=</span>
      <input
        type="text"
        value={filter.value}
        onChange={e => onUpdate({ ...filter, value: e.target.value })}
        placeholder="Value"
        disabled={disabled}
        className={cn(
          'bg-surface1 border border-border1 rounded-md px-2 py-1 text-ui-md text-neutral4 w-40',
          'placeholder:text-neutral3 focus:outline-none focus:border-neutral2',
        )}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={cn('text-neutral3 hover:text-neutral4 p-1')}
        aria-label="Remove metadata filter"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

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
  searchQuery,
  onSearchChange,
  selectedTags,
  availableTags,
  onTagsChange,
  errorOnly,
  onErrorOnlyChange,
  metadataFilters,
  onMetadataFiltersChange,
}: TracesToolsProps) {
  const tagOptions = (availableTags ?? []).map(tag => ({ value: tag, label: tag }));

  const handleAddMetadataFilter = () => {
    onMetadataFiltersChange?.([...(metadataFilters ?? []), { key: '', value: '' }]);
  };

  const handleUpdateMetadataFilter = (index: number, updated: MetadataFilter) => {
    const next = [...(metadataFilters ?? [])];
    next[index] = updated;
    onMetadataFiltersChange?.(next);
  };

  const handleRemoveMetadataFilter = (index: number) => {
    const next = (metadataFilters ?? []).filter((_, i) => i !== index);
    onMetadataFiltersChange?.(next);
  };

  return (
    <div className={cn('grid gap-4')}>
      {onSearchChange && (
        <div className={cn('max-w-md')}>
          <Searchbar
            onSearch={onSearchChange}
            label="Search traces"
            placeholder="Search by name or metadata..."
            size="md"
          />
        </div>
      )}
      <div className={cn('flex flex-wrap gap-x-8 gap-y-4')}>
        <SelectField
          label="Filter by Entity"
          name={'select-entity'}
          placeholder="Select..."
          options={entityOptions || []}
          onValueChange={val => {
            const entity = entityOptions?.find(entity => entity.value === val);
            if (entity) {
              onEntityChange(entity);
            }
          }}
          value={selectedEntity?.value || ''}
          className="min-w-[20rem]"
          disabled={isLoading}
        />

        {onTagsChange && tagOptions.length > 0 && (
          <div className={cn('grid gap-1')}>
            <span className={cn('text-ui-md text-neutral3')}>Filter by Tags</span>
            <MultiCombobox
              options={tagOptions}
              value={selectedTags ?? []}
              onValueChange={onTagsChange}
              placeholder="Select tags..."
              searchPlaceholder="Search tags..."
              emptyText="No tags found"
              disabled={isLoading}
              size="md"
            />
          </div>
        )}

        <div className={cn('flex gap-4 items-center flex-wrap')}>
          <span className={cn('shrink-0 text-ui-md text-neutral3')}>Filter by Date & time range</span>
          <DateTimePicker
            placeholder="From"
            value={selectedDateFrom}
            maxValue={selectedDateTo}
            onValueChange={date => onDateChange?.(date, 'from')}
            className="min-w-32"
            defaultTimeStrValue="12:00 AM"
            disabled={isLoading}
          />
          <DateTimePicker
            placeholder="To"
            value={selectedDateTo}
            minValue={selectedDateFrom}
            onValueChange={date => onDateChange?.(date, 'to')}
            className="min-w-32"
            defaultTimeStrValue="11:59 PM"
            disabled={isLoading}
          />

          {onErrorOnlyChange && (
            <label className={cn('flex gap-2 items-center shrink-0 cursor-pointer')}>
              <Switch checked={errorOnly} onCheckedChange={onErrorOnlyChange} disabled={isLoading} />
              <span className={cn('text-ui-md text-neutral3')}>Errors only</span>
            </label>
          )}

          <label className={cn('flex gap-2 items-center shrink-0 cursor-pointer')}>
            <Switch checked={groupByThread} onCheckedChange={onGroupByThreadChange} disabled={isLoading} />
            <span className={cn('text-ui-md text-neutral3')}>Group by thread</span>
          </label>

          <Button variant="light" size="lg" className="min-w-32" onClick={onReset} disabled={isLoading}>
            <Icon>
              <XIcon />
            </Icon>
            Reset
          </Button>
        </div>
      </div>

      {onMetadataFiltersChange && (
        <div className={cn('flex flex-wrap items-center gap-3')}>
          <span className={cn('text-ui-md text-neutral3 shrink-0')}>Metadata filters</span>
          {(metadataFilters ?? []).map((filter, i) => (
            <MetadataFilterRow
              key={i}
              filter={filter}
              onUpdate={updated => handleUpdateMetadataFilter(i, updated)}
              onRemove={() => handleRemoveMetadataFilter(i)}
              disabled={isLoading}
            />
          ))}
          <Button variant="light" size="sm" onClick={handleAddMetadataFilter} disabled={isLoading}>
            + Add filter
          </Button>
        </div>
      )}
    </div>
  );
}

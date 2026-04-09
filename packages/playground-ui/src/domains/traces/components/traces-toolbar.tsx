import { XIcon } from 'lucide-react';
import { useMemo, useCallback } from 'react';

import type { EntityOptions, TraceDatePreset } from '../types';
import { CONTEXT_FIELD_IDS, METADATA_FILTER_EXCLUDED_KEYS, PROMOTED_METADATA_FILTER_FIELDS } from '../types';
import { Button } from '@/ds/components/Button/Button';
import type { SelectDataFilterCategory, SelectDataFilterState } from '@/ds/components/DataFilter';
import { SelectDataFilter } from '@/ds/components/DataFilter';
import { DateTimeRangePicker } from '@/ds/components/DateTimeRangePicker';
import { ListSearch } from '@/ds/components/ListSearch/list-search';
import { Switch } from '@/ds/components/Switch/switch';
import { cn } from '@/lib/utils';

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
  entityName: { label: 'Root Entity Name', group: 'Entity' },
  parentEntityType: { label: 'Parent Entity Type', group: 'Entity' },
  parentEntityId: { label: 'Parent Entity ID', group: 'Entity' },
  parentEntityName: { label: 'Parent Entity Name', group: 'Entity' },
  rootEntityType: { label: 'Root Entity Type', group: 'Entity' },
  rootEntityId: { label: 'Root Entity ID', group: 'Entity' },
};

const promotedMetadataEntries = Object.entries(PROMOTED_METADATA_FILTER_FIELDS);
const metadataExcludedKeys = new Set<string>(METADATA_FILTER_EXCLUDED_KEYS);

type TracesToolbarProps = {
  selectedEntity?: EntityOptions;
  entityOptions?: EntityOptions[];
  onEntityChange: (val?: EntityOptions) => void;
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

export function TracesToolbar({
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
}: TracesToolbarProps) {
  const categories: SelectDataFilterCategory[] = useMemo(() => {
    const cats: SelectDataFilterCategory[] = [];

    if (onErrorOnlyChange) {
      cats.push({
        id: 'status',
        label: 'Status',
        values: [{ value: 'error', label: 'Error only' }],
        mode: 'multi',
      });
    }

    if (entityOptions) {
      cats.push({
        id: 'entity-type',
        label: 'Root Entity Type',
        values: entityOptions.map(o => ({ value: o.entityType, label: o.label })),
        mode: 'single',
      });
    }

    if (onTagsChange && (availableTags ?? []).length > 0) {
      cats.push({
        id: 'tags',
        label: 'Tags',
        values: (availableTags ?? []).map(t => ({ value: t, label: t })),
        mode: 'multi',
      });
    }

    if (onMetadataChange) {
      for (const key of Object.keys(availableMetadata ?? {}).sort()) {
        if (metadataExcludedKeys.has(key)) continue;
        const values = availableMetadata?.[key] ?? [];
        if (values.length === 0) continue;
        cats.push({
          id: `meta:${key}`,
          label: key,
          group: 'Metadata',
          values: values.map(v => ({ value: v, label: v })),
          mode: 'single',
        });
      }
    }

    if (onContextFiltersChange) {
      for (const fieldId of CONTEXT_FIELD_IDS) {
        const meta = CONTEXT_FIELD_META[fieldId];
        if (!meta) continue;
        const values = availableContextValues?.[fieldId] ?? [];
        if (values.length === 0) continue;
        cats.push({
          id: `ctx:${fieldId}`,
          label: meta.label,
          group: meta.group,
          values: values.map(v => ({ value: v, label: v })),
          mode: 'single',
        });
      }
    }

    if (onMetadataChange) {
      for (const [fieldId, meta] of promotedMetadataEntries) {
        const values = availableMetadata?.[fieldId] ?? [];
        if (values.length === 0) continue;
        cats.push({
          id: `meta-promoted:${fieldId}`,
          label: meta.label,
          group: meta.group,
          values: values.map(v => ({ value: v, label: v })),
          mode: 'single',
        });
      }
    }

    return cats;
  }, [
    onErrorOnlyChange,
    entityOptions,
    onTagsChange,
    availableTags,
    onMetadataChange,
    availableMetadata,
    onContextFiltersChange,
    availableContextValues,
  ]);

  const filterState: SelectDataFilterState = useMemo(() => {
    const state: SelectDataFilterState = {};

    if (errorOnly) {
      state['status'] = ['error'];
    }

    if (selectedEntity) {
      state['entity-type'] = [selectedEntity.entityType];
    }

    if ((selectedTags ?? []).length > 0) {
      state['tags'] = selectedTags ?? [];
    }

    if (selectedMetadata) {
      for (const [key, value] of Object.entries(selectedMetadata)) {
        if (key in PROMOTED_METADATA_FILTER_FIELDS) {
          state[`meta-promoted:${key}`] = [value];
        } else {
          state[`meta:${key}`] = [value];
        }
      }
    }

    if (contextFilters) {
      for (const [fieldId, value] of Object.entries(contextFilters)) {
        if (value.trim()) {
          state[`ctx:${fieldId}`] = [value];
        }
      }
    }

    return state;
  }, [errorOnly, selectedEntity, selectedTags, selectedMetadata, contextFilters]);

  const handleFilterChange = useCallback(
    (next: SelectDataFilterState) => {
      // Status
      const nextStatus = next['status'] ?? [];
      const nextErrorOnly = nextStatus.includes('error');
      if (nextErrorOnly !== !!errorOnly) {
        onErrorOnlyChange?.(nextErrorOnly);
      }

      // Entity
      const nextEntityVal = (next['entity-type'] ?? [])[0];
      const currentEntityVal = selectedEntity?.entityType;
      if (nextEntityVal !== currentEntityVal) {
        const entity = entityOptions?.find(e => e.entityType === nextEntityVal);
        if (entity) onEntityChange(entity);
        else if (!nextEntityVal) {
          onEntityChange(undefined);
        }
      }

      // Tags
      const nextTags = next['tags'] ?? [];
      if (JSON.stringify(nextTags) !== JSON.stringify(selectedTags ?? [])) {
        onTagsChange?.(nextTags);
      }

      // Metadata
      const nextMeta: Record<string, string> = {};
      for (const [key, values] of Object.entries(next)) {
        if (key.startsWith('meta:') && values.length > 0) {
          nextMeta[key.slice(5)] = values[0];
        }
        if (key.startsWith('meta-promoted:') && values.length > 0) {
          nextMeta[key.slice(14)] = values[0];
        }
      }
      if (JSON.stringify(nextMeta) !== JSON.stringify(selectedMetadata ?? {})) {
        onMetadataChange?.(nextMeta);
      }

      // Context filters
      const nextCtx: Record<string, string> = {};
      for (const [key, values] of Object.entries(next)) {
        if (key.startsWith('ctx:') && values.length > 0) {
          nextCtx[key.slice(4)] = values[0];
        }
      }
      if (JSON.stringify(nextCtx) !== JSON.stringify(contextFilters ?? {})) {
        onContextFiltersChange?.(nextCtx);
      }
    },
    [
      errorOnly,
      onErrorOnlyChange,
      selectedEntity,
      entityOptions,
      onEntityChange,
      selectedTags,
      onTagsChange,
      selectedMetadata,
      onMetadataChange,
      contextFilters,
      onContextFiltersChange,
    ],
  );

  const hasActiveFilters = useMemo(() => Object.values(filterState).some(v => v.length > 0), [filterState]);

  return (
    <div className={cn('grid gap-3')}>
      <div className={cn('flex items-center gap-3')}>
        {onSearchChange && (
          <ListSearch
            onSearch={onSearchChange}
            size="md"
            label="Search traces"
            placeholder="Search name, ID, content..."
          />
        )}

        <DateTimeRangePicker
          preset={datePreset}
          onPresetChange={onDatePresetChange}
          dateFrom={selectedDateFrom}
          dateTo={selectedDateTo}
          onDateChange={onDateChange}
          disabled={isLoading}
        />

        <SelectDataFilter
          categories={categories}
          value={filterState}
          onChange={handleFilterChange}
          align="end"
          disabled={isLoading}
        />

        {onGroupByThreadChange && (
          <label className={cn('flex gap-2 items-center shrink-0 cursor-pointer')}>
            <Switch checked={groupByThread} onCheckedChange={onGroupByThreadChange} disabled={isLoading} />
            <span className={cn('text-ui-md text-neutral3')}>Group by thread</span>
          </label>
        )}

        {onReset && (hasActiveFilters || datePreset !== 'last-24h' || !!searchQuery) && (
          <Button disabled={isLoading} size="md" className="ml-auto" onClick={() => onReset()}>
            <XIcon />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

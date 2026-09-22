import { Button } from '@mastra/playground-ui/components/Button';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { XIcon } from 'lucide-react';
import { DATASET_EXPERIMENT_OPTIONS } from './datasets-list/helpers';
import type { DatasetTargetType } from './target-type-options';
import { TargetFilter } from '@/domains/shared/components/target-filter';

export interface DatasetsToolbarTagOption {
  value: string;
  label: string;
}

export interface DatasetsToolbarProps {
  search: string;
  onSearchChange: (query: string) => void;
  experimentFilter: string;
  onExperimentFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  tagOptions: DatasetsToolbarTagOption[];
  targetType: DatasetTargetType | '';
  onTargetTypeChange: (type: DatasetTargetType | '') => void;
  targetId: string;
  onTargetIdChange: (id: string) => void;
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export function DatasetsToolbar({
  search,
  onSearchChange,
  experimentFilter,
  onExperimentFilterChange,
  tagFilter,
  onTagFilterChange,
  tagOptions,
  targetType,
  onTargetTypeChange,
  targetId,
  onTargetIdChange,
  onReset,
  hasActiveFilters,
}: DatasetsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="max-w-120 min-w-64 flex-1">
        <ListSearch
          label="Search datasets"
          placeholder="Filter by dataset name"
          value={search}
          onSearch={onSearchChange}
        />
      </div>
      <div className="flex items-center gap-2">
        <TargetFilter
          targetType={targetType}
          targetId={targetId}
          onTargetTypeChange={onTargetTypeChange}
          onTargetIdChange={onTargetIdChange}
        />
        <SelectFieldBlock
          label="Experiments"
          labelIsHidden
          name="filter-experiments"
          options={[...DATASET_EXPERIMENT_OPTIONS]}
          value={experimentFilter}
          onValueChange={onExperimentFilterChange}
          className="whitespace-nowrap"
        />
        {tagOptions.length > 1 && (
          <SelectFieldBlock
            label="Tags"
            labelIsHidden
            name="filter-tags"
            options={tagOptions}
            value={tagFilter}
            onValueChange={onTagFilterChange}
            className="whitespace-nowrap"
          />
        )}
        {onReset && hasActiveFilters && (
          <Button onClick={onReset} size="sm" variant="default" icon={<XIcon />}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

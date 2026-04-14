import { Button, ButtonsGroup, SelectFieldBlock, ListSearch } from '@mastra/playground-ui';
import { XIcon } from 'lucide-react';
import { DATASET_EXPERIMENT_OPTIONS, DATASET_TARGET_OPTIONS } from './datasets-list/helpers';

export interface DatasetsToolbarTagOption {
  value: string;
  label: string;
}

export interface DatasetsToolbarProps {
  search: string;
  onSearchChange: (query: string) => void;
  targetFilter: string;
  onTargetFilterChange: (value: string) => void;
  experimentFilter: string;
  onExperimentFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  tagOptions: DatasetsToolbarTagOption[];
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export function DatasetsToolbar({
  search,
  onSearchChange,
  targetFilter,
  onTargetFilterChange,
  experimentFilter,
  onExperimentFilterChange,
  tagFilter,
  onTagFilterChange,
  tagOptions,
  onReset,
  hasActiveFilters,
}: DatasetsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListSearch
        label="Search datasets"
        placeholder="Filter by dataset name"
        value={search}
        onSearch={onSearchChange}
      />
      <ButtonsGroup>
        <SelectFieldBlock
          label="Target"
          labelIsHidden
          name="filter-target"
          options={[...DATASET_TARGET_OPTIONS]}
          value={targetFilter}
          onValueChange={onTargetFilterChange}
          className="whitespace-nowrap"
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
          <Button onClick={onReset} size="sm" variant="light">
            <XIcon className="size-3" /> Reset
          </Button>
        )}
      </ButtonsGroup>
    </div>
  );
}

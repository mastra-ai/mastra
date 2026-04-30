import { Button, ButtonsGroup, SelectFieldBlock, ListSearch } from '@mastra/playground-ui';
import { XIcon } from 'lucide-react';
import { EXPERIMENT_STATUS_OPTIONS } from './experiments-list';

export interface ExperimentsToolbarDatasetOption {
  value: string;
  label: string;
}

export interface ExperimentsToolbarProps {
  search: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  datasetFilter: string;
  onDatasetFilterChange: (value: string) => void;
  datasetOptions: ExperimentsToolbarDatasetOption[];
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export function ExperimentsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  datasetFilter,
  onDatasetFilterChange,
  datasetOptions,
  onReset,
  hasActiveFilters,
}: ExperimentsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListSearch
        label="Search experiments"
        placeholder="Filter by experiment, dataset, or target"
        value={search}
        onSearch={onSearchChange}
      />
      <ButtonsGroup>
        <SelectFieldBlock
          label="Status"
          labelIsHidden
          name="filter-status"
          options={[...EXPERIMENT_STATUS_OPTIONS]}
          value={statusFilter}
          onValueChange={onStatusFilterChange}
          className="whitespace-nowrap"
        />
        <SelectFieldBlock
          label="Dataset"
          labelIsHidden
          name="filter-dataset"
          options={datasetOptions}
          value={datasetFilter}
          onValueChange={onDatasetFilterChange}
          className="whitespace-nowrap"
        />
        {onReset && hasActiveFilters && (
          <Button onClick={onReset} size="sm" variant="default">
            <XIcon className="size-3" /> Reset
          </Button>
        )}
      </ButtonsGroup>
    </div>
  );
}

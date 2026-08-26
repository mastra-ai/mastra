import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Play, XIcon } from 'lucide-react';
import { EXPERIMENT_STATUS_OPTIONS } from './experiments-list-options';

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
  onRunClick?: () => void;
  runTooltip?: string;
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
  onRunClick,
  runTooltip = 'Run an experiment',
}: ExperimentsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="max-w-120 min-w-64 flex-1">
        <ListSearch
          label="Search experiments"
          placeholder="Filter by experiment, dataset, or target"
          value={search}
          onSearch={onSearchChange}
        />
      </div>
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
      {onRunClick && (
        <Button onClick={onRunClick} tooltip={runTooltip} variant="primary" className="ml-auto shrink-0">
          <Play />
          Run Experiment
        </Button>
      )}
    </div>
  );
}

import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup, ButtonsGroupText } from '@mastra/playground-ui/components/ButtonsGroup';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { GitCompare, Play, XIcon } from 'lucide-react';
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
  /** When omitted the Compare entry point is hidden. */
  onCompareClick?: () => void;
  /** When provided, the comparison selection controls replace the Compare/Run actions. */
  selection?: ExperimentsToolbarSelection;
}

export interface ExperimentsToolbarSelection {
  selectedCount: number;
  onExecuteCompare: () => void;
  onCancelSelection: () => void;
  /** When set, the "Compare Experiments" action is disabled and this reason is shown. */
  compareDisabledReason?: string;
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
  onCompareClick,
  selection,
}: ExperimentsToolbarProps) {
  const canCompare = selection?.selectedCount === 2 && !selection.compareDisabledReason;

  return (
    <div className="min-h-form-default flex flex-wrap items-center gap-2">
      <div className="max-w-120 min-w-48 flex-1">
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
          <Button onClick={onReset} size="sm" variant="default" icon={<XIcon />}>
            Reset
          </Button>
        )}
      </ButtonsGroup>
      {selection ? (
        <ButtonsGroup className="ml-auto shrink-0 whitespace-nowrap">
          <ButtonsGroupText className="gap-2">
            <Badge size="sm" variant={selection.selectedCount < 2 ? 'red' : 'green'}>
              {selection.selectedCount} / 2
            </Badge>
            selected
            {selection.compareDisabledReason && (
              <span className="text-accent2">· {selection.compareDisabledReason}</span>
            )}
          </ButtonsGroupText>
          <Button variant="primary" disabled={!canCompare} onClick={selection.onExecuteCompare} icon={<GitCompare />}>
            Compare Experiments
          </Button>
          <Button onClick={selection.onCancelSelection}>Cancel</Button>
        </ButtonsGroup>
      ) : (
        <ButtonsGroup className="ml-auto shrink-0">
          {onCompareClick && (
            <Button
              onClick={onCompareClick}
              tooltip="Select two experiments of the same dataset to compare"
              icon={<GitCompare />}
            >
              Compare
            </Button>
          )}
          {onRunClick && (
            <Button onClick={onRunClick} tooltip={runTooltip} variant="primary" icon={<Play />}>
              Run Experiment
            </Button>
          )}
        </ButtonsGroup>
      )}
    </div>
  );
}

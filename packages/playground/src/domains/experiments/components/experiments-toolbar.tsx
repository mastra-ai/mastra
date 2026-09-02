import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { GitCompare, MoveRightIcon, Play, XIcon } from 'lucide-react';
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
  /** When provided, the toolbar renders the comparison selection controls instead of the filters. */
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
  if (selection) {
    const { selectedCount, onExecuteCompare, onCancelSelection, compareDisabledReason } = selection;
    const canCompare = selectedCount === 2 && !compareDisabledReason;
    return (
      <div className="flex w-full items-center justify-end gap-4">
        <div className="flex items-center gap-5">
          <div className="text-neutral3 flex items-center gap-2 pl-6 text-sm">
            <Badge size="md" variant={selectedCount < 2 ? 'red' : 'green'}>
              {selectedCount}
            </Badge>
            <span>of 2 experiments selected</span>
            {compareDisabledReason && <span className="text-accent2">— {compareDisabledReason}</span>}
            <MoveRightIcon />
          </div>
          <ButtonsGroup>
            <Button variant="primary" disabled={!canCompare} onClick={onExecuteCompare}>
              <GitCompare className="h-4 w-4" />
              Compare Experiments
            </Button>
            <Button onClick={onCancelSelection}>Cancel</Button>
          </ButtonsGroup>
        </div>
      </div>
    );
  }

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
      <ButtonsGroup className="ml-auto shrink-0">
        {onCompareClick && (
          <Button onClick={onCompareClick} tooltip="Select two experiments of the same dataset to compare">
            <GitCompare />
            Compare
          </Button>
        )}
        {onRunClick && (
          <Button onClick={onRunClick} tooltip={runTooltip} variant="primary">
            <Play />
            Run Experiment
          </Button>
        )}
      </ButtonsGroup>
    </div>
  );
}

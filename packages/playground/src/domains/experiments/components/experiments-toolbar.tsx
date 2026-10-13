import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ExperimentsBulkActions } from './experiments-bulk-actions';
import type { ExperimentsBulkActionsProps } from './experiments-bulk-actions';
import { ExperimentsFilterBar } from './experiments-filter-bar';
import type { ExperimentsFilters } from './experiments-filter-bar';

export interface ExperimentsToolbarDatasetOption {
  value: string;
  label: string;
}

export interface ExperimentsToolbarProps extends ExperimentsFilters {
  onFiltersChange: (next: ExperimentsFilters) => void;
  datasetOptions: ExperimentsToolbarDatasetOption[];
  selection: ExperimentsBulkActionsProps;
}

export function ExperimentsToolbar({
  search,
  statusFilter,
  datasetFilter,
  datasetOptions,
  targetType,
  targetId,
  onFiltersChange,
  selection,
}: ExperimentsToolbarProps) {
  return (
    <ActionRow>
      <ActionRow.Start>
        <ExperimentsFilterBar
          search={search}
          statusFilter={statusFilter}
          datasetFilter={datasetFilter}
          datasetOptions={datasetOptions}
          targetType={targetType}
          targetId={targetId}
          onChange={onFiltersChange}
        />
      </ActionRow.Start>
      <ActionRow.End>
        <ExperimentsBulkActions {...selection} />
      </ActionRow.End>
    </ActionRow>
  );
}

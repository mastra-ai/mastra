import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ExperimentsBulkActions } from './experiments-bulk-actions';
import type { ExperimentsBulkActionsProps } from './experiments-bulk-actions';
import { ExperimentsComparableLegend } from './experiments-comparable-legend';
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
  /** Dataset of the first selected experiment, explained by the legend. */
  comparableDatasetId?: string;
  /** Name of that dataset, when known. */
  comparableDatasetName?: string;
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
  comparableDatasetId,
  comparableDatasetName,
}: ExperimentsToolbarProps) {
  return (
    <>
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
      </ActionRow>
      <ActionRow>
        <ActionRow.Start className="self-end">
          <ExperimentsComparableLegend datasetId={comparableDatasetId} datasetName={comparableDatasetName} />
        </ActionRow.Start>
        <ActionRow.End>
          <ExperimentsBulkActions {...selection} />
        </ActionRow.End>
      </ActionRow>
    </>
  );
}

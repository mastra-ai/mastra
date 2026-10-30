import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ExperimentsBulkActions } from './experiments-bulk-actions';
import type { ExperimentsBulkActionsProps } from './experiments-bulk-actions';
import { ExperimentsComparableLegend } from './experiments-comparable-legend';
import type { ExperimentsComparableLegendProps } from './experiments-comparable-legend';
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
  /** Dataset of the first selected experiment, named by the legend. */
  comparableDataset?: ExperimentsComparableLegendProps['dataset'];
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
  comparableDataset,
}: ExperimentsToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
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
          <ExperimentsComparableLegend dataset={comparableDataset} />
        </ActionRow.Start>
        <ActionRow.End>
          <ExperimentsBulkActions {...selection} />
        </ActionRow.End>
      </ActionRow>
    </div>
  );
}

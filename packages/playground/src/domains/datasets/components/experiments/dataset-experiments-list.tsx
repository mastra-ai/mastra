import type { DatasetExperiment } from '@mastra/client-js';
import { DataList, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Play } from 'lucide-react';
import {
  EXPERIMENT_DETAIL_COLUMNS,
  EXPERIMENT_NAME_COLUMN,
  experimentColumnLabels,
} from '@/domains/experiments/components/experiment-columns';
import { ExperimentRowCells } from '@/domains/experiments/components/experiment-row-cells';

const COLUMNS = `${EXPERIMENT_NAME_COLUMN} ${EXPERIMENT_DETAIL_COLUMNS}`;

const columnHeaders = [
  { label: experimentColumnLabels.experiment },
  { label: experimentColumnLabels.target },
  { label: experimentColumnLabels.status },
  { label: experimentColumnLabels.items, className: 'text-center' },
  { label: experimentColumnLabels.succeeded, className: 'text-center' },
  { label: experimentColumnLabels.failed, className: 'text-center' },
  { label: experimentColumnLabels.review, className: 'text-center' },
  { label: experimentColumnLabels.date },
];

export interface DatasetExperimentsListProps {
  experiments: DatasetExperiment[];
  isSelectionActive: boolean;
  selectedExperimentIds: string[];
  onRowClick: (experimentId: string) => void;
  onToggleSelection: (experimentId: string) => void;
}

export function DatasetExperimentsList({
  experiments,
  isSelectionActive,
  selectedExperimentIds,
  onRowClick,
  onToggleSelection,
}: DatasetExperimentsListProps) {
  const { containerRef, getRowProps } = useDataListKeyboard({ count: experiments.length });

  if (experiments.length === 0) {
    return <EmptyDatasetExperimentsList />;
  }

  const gridColumns = [isSelectionActive ? 'auto' : '', COLUMNS].filter(Boolean).join(' ');

  return (
    <DataList columns={gridColumns} variant="striped" scrollRef={containerRef}>
      <DataList.Top hasLeadingCell={isSelectionActive}>
        {isSelectionActive && <DataList.TopCell>&nbsp;</DataList.TopCell>}
        {isSelectionActive ? (
          <DataList.TopCells colStart={2}>
            {columnHeaders.map(col => (
              <DataList.TopCell key={col.label} className={col.className}>
                {col.label}
              </DataList.TopCell>
            ))}
          </DataList.TopCells>
        ) : (
          columnHeaders.map(col => (
            <DataList.TopCell key={col.label} className={col.className}>
              {col.label}
            </DataList.TopCell>
          ))
        )}
      </DataList.Top>

      {experiments.map((experiment, index) => {
        const isSelected = selectedExperimentIds.includes(experiment.id);
        const rowCells = <ExperimentRowCells experiment={experiment} />;

        const handleRowClick = () => (isSelectionActive ? onToggleSelection(experiment.id) : onRowClick(experiment.id));

        if (!isSelectionActive) {
          return (
            <DataList.RowButton key={experiment.id} onClick={handleRowClick} {...getRowProps(index)}>
              {rowCells}
            </DataList.RowButton>
          );
        }

        return (
          <DataList.RowWrapper key={experiment.id}>
            <DataList.SelectCell
              checked={isSelected}
              onToggle={() => onToggleSelection(experiment.id)}
              aria-label={`Select experiment ${experiment.id}`}
            />
            <DataList.RowButton
              flushLeft
              colStart={2}
              featured={isSelected}
              onClick={handleRowClick}
              {...getRowProps(index)}
            >
              {rowCells}
            </DataList.RowButton>
          </DataList.RowWrapper>
        );
      })}
    </DataList>
  );
}

function EmptyDatasetExperimentsList() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <EmptyState
        iconSlot={<Play className="text-neutral3 h-8 w-8" />}
        titleSlot="No experiments yet"
        descriptionSlot="Trigger an experiment to evaluate your dataset against an agent, workflow, or scorer."
      />
    </div>
  );
}

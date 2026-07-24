import type { DatasetExperiment } from '@mastra/client-js';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { format, isThisYear, isToday } from 'date-fns';
import { Play } from 'lucide-react';

const experimentsListColumns = [
  { name: 'experiment', label: 'Experiment', size: 'minmax(9rem,1fr)' },
  { name: 'status', label: 'Status', size: '5rem' },
  { name: 'targetType', label: 'Type', size: '6rem' },
  { name: 'target', label: 'Target', size: 'minmax(0,1fr)' },
  { name: 'counts', label: 'Counts', size: '7rem' },
  { name: 'date', label: 'Created', size: '10rem' },
];

/**
 * Primary label for an experiment row: its name (falling back to the short ID),
 * with the short ID shown as a secondary line when a name is present. The
 * description, when set, surfaces in a tooltip.
 */
function ExperimentNameCell({ experiment }: { experiment: DatasetExperiment }) {
  const id = getShortId(experiment.id) ?? experiment.id;

  if (!experiment.name) {
    return (
      <DataList.Cell height="compact" className="min-w-0">
        <span className="block truncate text-ui-smd font-mono text-neutral3">{id}</span>
      </DataList.Cell>
    );
  }

  const label = (
    <span className="flex min-w-0 flex-col gap-0.5 py-0.5 text-left">
      <span className="block truncate text-ui-md text-neutral4">{experiment.name}</span>
      <span className="block truncate text-ui-sm font-mono text-neutral2">{id}</span>
    </span>
  );

  return (
    <DataList.Cell height="compact" className="min-w-0">
      {experiment.description ? (
        <Tooltip>
          <TooltipTrigger asChild>{label}</TooltipTrigger>
          <TooltipContent>{experiment.description}</TooltipContent>
        </Tooltip>
      ) : (
        label
      )}
    </DataList.Cell>
  );
}

export interface DatasetExperimentsListProps {
  experiments: DatasetExperiment[];
  isSelectionActive: boolean;
  selectedExperimentIds: string[];
  onRowClick: (experimentId: string) => void;
  onToggleSelection: (experimentId: string) => void;
}

function formatDate(date: Date): string {
  const dayMonth = isToday(date) ? 'Today' : format(date, 'MMM dd');
  const year = !isThisYear(date) ? format(date, 'yyyy') : '';
  const time = format(date, "'at' h:mm aaa");
  return `${dayMonth} ${year} ${time}`.replace(/\s+/g, ' ').trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DatasetExperimentsList({
  experiments,
  isSelectionActive,
  selectedExperimentIds,
  onRowClick,
  onToggleSelection,
}: DatasetExperimentsListProps) {
  if (experiments.length === 0) {
    return <EmptyDatasetExperimentsList />;
  }

  const gridColumns = [isSelectionActive ? 'auto' : '', ...experimentsListColumns.map(c => c.size)]
    .filter(Boolean)
    .join(' ');

  return (
    <DataList columns={gridColumns}>
      <DataList.Top hasLeadingCell={isSelectionActive}>
        {isSelectionActive && <DataList.TopCell>&nbsp;</DataList.TopCell>}
        {isSelectionActive ? (
          <DataList.TopCells colStart={2}>
            {experimentsListColumns.map(col => (
              <DataList.TopCell key={col.name}>{col.label}</DataList.TopCell>
            ))}
          </DataList.TopCells>
        ) : (
          experimentsListColumns.map(col => <DataList.TopCell key={col.name}>{col.label}</DataList.TopCell>)
        )}
      </DataList.Top>

      {experiments.map(experiment => {
        const isSelected = selectedExperimentIds.includes(experiment.id);
        const createdAtDate = new Date(experiment.createdAt);

        const rowCells = (
          <>
            <ExperimentNameCell experiment={experiment} />
            <DataList.Cell height="compact">
              {experiment.status && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center w-10 relative bg-transparent h-full">
                      <div
                        className={cn('w-2 h-2 rounded-full', {
                          'bg-green-600': ['success', 'completed'].includes(experiment.status),
                          'bg-red-700': ['error', 'failed'].includes(experiment.status),
                          'bg-yellow-500': ['pending', 'running'].includes(experiment.status),
                        })}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{capitalize(experiment.status)}</TooltipContent>
                </Tooltip>
              )}
            </DataList.Cell>
            <DataList.Cell height="compact">{experiment.targetType}</DataList.Cell>
            <DataList.Cell height="compact" className="min-w-0">
              <span className="block truncate">{experiment.targetId}</span>
            </DataList.Cell>
            <DataList.Cell height="compact">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex gap-1">
                    {experiment.succeededCount > 0 && <Chip color="green">{experiment.succeededCount}</Chip>}
                    {experiment.failedCount > 0 && <Chip color="red">{experiment.failedCount}</Chip>}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {experiment.succeededCount} Succeeded
                  <br />
                  {experiment.failedCount} Failed
                </TooltipContent>
              </Tooltip>
            </DataList.Cell>
            <DataList.Cell height="compact" className="min-w-0">
              <span className="block text-ui-smd text-neutral2 truncate">{formatDate(createdAtDate)}</span>
            </DataList.Cell>
          </>
        );

        const handleRowClick = () => (isSelectionActive ? onToggleSelection(experiment.id) : onRowClick(experiment.id));

        if (!isSelectionActive) {
          return (
            <DataList.RowButton key={experiment.id} onClick={handleRowClick}>
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
            <DataList.RowButton flushLeft colStart={2} featured={isSelected} onClick={handleRowClick}>
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
        iconSlot={<Play className="w-8 h-8 text-neutral3" />}
        titleSlot="No experiments yet"
        descriptionSlot="Trigger an experiment to evaluate your dataset against an agent, workflow, or scorer."
      />
    </div>
  );
}

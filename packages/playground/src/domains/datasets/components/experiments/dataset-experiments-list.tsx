import type { DatasetExperiment } from '@mastra/client-js';
import {
  Checkbox,
  Chip,
  EmptyState,
  EntityList,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@mastra/playground-ui';
import { format, isThisYear, isToday } from 'date-fns';
import { Play } from 'lucide-react';

const experimentsListColumns = [
  { name: 'experimentId', label: 'ID', size: '6rem' },
  { name: 'status', label: 'Status', size: '4rem' },
  { name: 'targetType', label: 'Type', size: '4rem' },
  { name: 'target', label: 'Target', size: '1fr' },
  { name: 'counts', label: 'Counts', size: '7rem' },
  { name: 'date', label: 'Created', size: '10rem' },
];

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

  const gridColumns = [isSelectionActive ? '2rem' : '', ...experimentsListColumns.map(c => c.size)]
    .filter(Boolean)
    .join(' ');

  return (
    <EntityList columns={gridColumns}>
      <EntityList.Top>
        {isSelectionActive && <EntityList.TopCell>&nbsp;</EntityList.TopCell>}
        {experimentsListColumns.map(col => (
          <EntityList.TopCell key={col.name}>{col.label}</EntityList.TopCell>
        ))}
      </EntityList.Top>

      <EntityList.Rows>
        {experiments.map(experiment => {
          const isSelected = selectedExperimentIds.includes(experiment.id);
          const createdAtDate = new Date(experiment.createdAt);

          return (
            <EntityList.Row
              key={experiment.id}
              onClick={() => (isSelectionActive ? onToggleSelection(experiment.id) : onRowClick(experiment.id))}
              selected={isSelected}
            >
              {isSelectionActive && (
                <EntityList.Cell>
                  <div onClick={event => event.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(experiment.id)}
                      aria-label={`Select experiment ${experiment.id}`}
                    />
                  </div>
                </EntityList.Cell>
              )}
              <EntityList.TextCell>
                <span className="truncate block font-mono">{experiment.id}</span>
              </EntityList.TextCell>
              <EntityList.Cell>
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
              </EntityList.Cell>
              <EntityList.TextCell>{experiment.targetType}</EntityList.TextCell>
              <EntityList.TextCell>
                <span className="truncate block">{experiment.targetId}</span>
              </EntityList.TextCell>
              <EntityList.Cell>
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
              </EntityList.Cell>
              <EntityList.TextCell>
                <span className="truncate block text-neutral2">{formatDate(createdAtDate)}</span>
              </EntityList.TextCell>
            </EntityList.Row>
          );
        })}
      </EntityList.Rows>
    </EntityList>
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

import { DatasetExperiment } from '@mastra/client-js';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { Play } from 'lucide-react';
import { Chip, cn } from '@/index';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

const experimentsListColumns = [
  { name: 'experimentId', label: 'ID', size: '6rem' },
  { name: 'status', label: 'Status', size: '4rem' },
  { name: 'targetType', label: 'Type', size: '4rem' },
  { name: 'target', label: 'Target', size: '1fr' },
  { name: 'counts', label: 'Counts', size: '7rem' },
  { name: 'date', label: 'Created', size: '10rem' },
];

const experimentsListColumnsWithCheckbox = [{ name: 'checkbox', label: '', size: '2.5rem' }, ...experimentsListColumns];

/**
 * Truncate experiment ID to first 8 characters or until the first dash
 */
function truncateExperimentId(id: string): string {
  const dashIndex = id.indexOf('-');
  if (dashIndex > 0 && dashIndex <= 8) {
    return id.slice(0, dashIndex);
  }
  return id.slice(0, 8);
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const columns = isSelectionActive ? experimentsListColumnsWithCheckbox : experimentsListColumns;

  if (experiments.length === 0) {
    return <EmptyDatasetExperimentsList />;
  }

  return (
    <ItemList>
      <ItemList.Header columns={columns}>
        {columns.map(col => (
          <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
        ))}
      </ItemList.Header>

      <ItemList.Scroller>
        <ItemList.Items>
          {experiments.map(experiment => {
            const status = experiment.status;
            const isSelected = selectedExperimentIds.includes(experiment.id);
            const entry = { id: experiment.id };

            return (
              <ItemList.Row key={experiment.id} isSelected={isSelected}>
                <ItemList.RowButton
                  item={entry}
                  isFeatured={isSelected}
                  columns={columns}
                  onClick={() => onRowClick(experiment.id)}
                >
                  {isSelectionActive && (
                    <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {}}
                        onClick={e => {
                          e.stopPropagation();
                          onToggleSelection(experiment.id);
                        }}
                        aria-label={`Select experiment ${experiment.id}`}
                      />
                    </div>
                  )}
                  <ItemList.IdCell id={experiment.id} />
                  <ItemList.StatusCell status={status} />
                  <ItemList.TextCell>{experiment.targetType}</ItemList.TextCell>
                  <ItemList.TextCell>{experiment.targetId}</ItemList.TextCell>
                  <ItemList.Cell className={cn('flex')}>
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
                  </ItemList.Cell>
                  <ItemList.DateCell date={experiment.createdAt} withTime={true} />
                </ItemList.RowButton>
              </ItemList.Row>
            );
          })}
        </ItemList.Items>
      </ItemList.Scroller>
    </ItemList>
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

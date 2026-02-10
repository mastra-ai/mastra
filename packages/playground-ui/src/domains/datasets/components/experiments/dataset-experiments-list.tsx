import { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { Play } from 'lucide-react';

type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

const statusVariantMap: Record<RunStatus, 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning',
  running: 'info',
  completed: 'success',
  failed: 'error',
};

const statusLabelMap: Record<RunStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

const experimentsListColumns = [
  { name: 'experimentId', label: 'Experiment ID', size: '6rem' },
  { name: 'target', label: 'Target', size: '1fr' },
  { name: 'status', label: 'Status', size: '6rem' },
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
            const status = experiment.status as RunStatus;
            const isSelected = selectedExperimentIds.includes(experiment.id);
            const entry = { id: experiment.id };

            return (
              <ItemList.Row key={experiment.id} isSelected={isSelected}>
                <ItemList.RowButton
                  entry={entry}
                  isSelected={isSelected}
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
                  <ItemList.ItemText>{truncateExperimentId(experiment.id)}</ItemList.ItemText>
                  <ItemList.ItemText>
                    <span className="text-neutral3">{experiment.targetType}:</span> {experiment.targetId}
                  </ItemList.ItemText>
                  <div>
                    <Badge variant={statusVariantMap[status]}>{statusLabelMap[status]}</Badge>
                  </div>
                  <ItemList.ItemText>{formatDate(experiment.createdAt)}</ItemList.ItemText>
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

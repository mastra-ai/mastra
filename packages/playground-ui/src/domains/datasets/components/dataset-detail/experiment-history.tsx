import { useState } from 'react';
import { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { useLinkComponent } from '@/lib/framework';
import { Play } from 'lucide-react';
import { ExperimentsToolbar } from './experiments-toolbar';

export interface ExperimentHistoryProps {
  experiments: DatasetExperiment[];
  isLoading: boolean;
  datasetId: string;
}

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

const experimentsListColumnsWithCheckbox = [{ name: 'checkbox', label: '', size: '2.5rem' }, ...experimentsListColumns];

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

export function ExperimentHistory({ experiments, isLoading, datasetId }: ExperimentHistoryProps) {
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<string[]>([]);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const { navigate } = useLinkComponent();

  const columns = isSelectionActive ? experimentsListColumnsWithCheckbox : experimentsListColumns;

  // Toggle experiment selection for comparison (max 2)
  const toggleExperimentSelection = (experimentId: string) => {
    setSelectedExperimentIds(prev => {
      if (prev.includes(experimentId)) {
        return prev.filter(id => id !== experimentId);
      }
      // Only allow selecting 2 experiments max - replace oldest if selecting 3rd
      if (prev.length >= 2) {
        return [prev[1], experimentId];
      }
      return [...prev, experimentId];
    });
  };

  // Navigate to comparison view
  const handleCompare = () => {
    if (selectedExperimentIds.length === 2) {
      const [experimentIdA, experimentIdB] = selectedExperimentIds;
      navigate(`/datasets/${datasetId}/compare?experimentA=${experimentIdA}&experimentB=${experimentIdB}`);
    }
  };

  const handleCancelSelection = () => {
    setSelectedExperimentIds([]);
    setIsSelectionActive(false);
  };

  const handleRowClick = (experimentId: string) => {
    navigate(`/datasets/${datasetId}/experiments/${experimentId}`);
  };

  if (isLoading) {
    return <ExperimentHistorySkeleton />;
  }

  if (experiments.length === 0) {
    return <EmptyExperimentHistory />;
  }

  return (
    <div className="grid grid-rows-[auto_1fr] gap-4 h-full">
      <ExperimentsToolbar
        hasExperiments={experiments.length > 0}
        onCompareClick={() => setIsSelectionActive(true)}
        isSelectionActive={isSelectionActive}
        selectedCount={selectedExperimentIds.length}
        onExecuteCompare={handleCompare}
        onCancelSelection={handleCancelSelection}
      />

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
                    onClick={() => handleRowClick(experiment.id)}
                  >
                    {isSelectionActive && (
                      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {}}
                          onClick={e => {
                            e.stopPropagation();
                            toggleExperimentSelection(experiment.id);
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
    </div>
  );
}

function ExperimentHistorySkeleton() {
  return (
    <div className="grid grid-rows-[auto_1fr] gap-4 h-full">
      <div className="h-9" /> {/* Toolbar placeholder */}
      <ItemList>
        <ItemList.Header columns={experimentsListColumns}>
          {experimentsListColumns.map(col => (
            <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
          ))}
        </ItemList.Header>
        <ItemList.Items>
          {Array.from({ length: 5 }).map((_, index) => (
            <ItemList.Row key={index}>
              <ItemList.RowButton columns={experimentsListColumns}>
                {experimentsListColumns.map((_, colIndex) => (
                  <ItemList.ItemText key={colIndex} isLoading>
                    Loading...
                  </ItemList.ItemText>
                ))}
              </ItemList.RowButton>
            </ItemList.Row>
          ))}
        </ItemList.Items>
      </ItemList>
    </div>
  );
}

function EmptyExperimentHistory() {
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

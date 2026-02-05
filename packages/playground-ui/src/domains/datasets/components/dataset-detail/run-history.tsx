import { useState } from 'react';
import { DatasetRun } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { useLinkComponent } from '@/lib/framework';
import { Play } from 'lucide-react';
import { RunsToolbar } from './runs-toolbar';

export interface RunHistoryProps {
  runs: DatasetRun[];
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

const runsListColumns = [
  { name: 'runId', label: 'Run ID', size: '6rem' },
  { name: 'target', label: 'Target', size: '1fr' },
  { name: 'status', label: 'Status', size: '6rem' },
  { name: 'date', label: 'Created', size: '10rem' },
];

/**
 * Truncate run ID to first 8 characters or until the first dash
 */
function truncateRunId(id: string): string {
  const dashIndex = id.indexOf('-');
  if (dashIndex > 0 && dashIndex <= 8) {
    return id.slice(0, dashIndex);
  }
  return id.slice(0, 8);
}

const runsListColumnsWithCheckbox = [{ name: 'checkbox', label: '', size: '2.5rem' }, ...runsListColumns];

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

export function RunHistory({ runs, isLoading, datasetId }: RunHistoryProps) {
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const { navigate } = useLinkComponent();

  const columns = isSelectionActive ? runsListColumnsWithCheckbox : runsListColumns;

  // Toggle run selection for comparison (max 2)
  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds(prev => {
      if (prev.includes(runId)) {
        return prev.filter(id => id !== runId);
      }
      // Only allow selecting 2 runs max - replace oldest if selecting 3rd
      if (prev.length >= 2) {
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  // Navigate to comparison view
  const handleCompare = () => {
    if (selectedRunIds.length === 2) {
      const [runIdA, runIdB] = selectedRunIds;
      navigate(`/datasets/${datasetId}/compare?runA=${runIdA}&runB=${runIdB}`);
    }
  };

  const handleCancelSelection = () => {
    setSelectedRunIds([]);
    setIsSelectionActive(false);
  };

  const handleRowClick = (runId: string) => {
    navigate(`/datasets/${datasetId}/runs/${runId}`);
  };

  if (isLoading) {
    return <RunHistorySkeleton />;
  }

  if (runs.length === 0) {
    return <EmptyRunHistory />;
  }

  return (
    <div className="grid grid-rows-[auto_1fr] gap-4 h-full">
      <RunsToolbar
        hasRuns={runs.length > 0}
        onCompareClick={() => setIsSelectionActive(true)}
        isSelectionActive={isSelectionActive}
        selectedCount={selectedRunIds.length}
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
            {runs.map(run => {
              const status = run.status as RunStatus;
              const isSelected = selectedRunIds.includes(run.id);
              const entry = { id: run.id };

              return (
                <ItemList.Row key={run.id} isSelected={isSelected}>
                  <ItemList.RowButton
                    entry={entry}
                    isSelected={isSelected}
                    columns={columns}
                    onClick={() => handleRowClick(run.id)}
                  >
                    {isSelectionActive && (
                      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {}}
                          onClick={e => {
                            e.stopPropagation();
                            toggleRunSelection(run.id);
                          }}
                          aria-label={`Select run ${run.id}`}
                        />
                      </div>
                    )}
                    <ItemList.ItemText>{truncateRunId(run.id)}</ItemList.ItemText>
                    <ItemList.ItemText>
                      <span className="text-neutral3">{run.targetType}:</span> {run.targetId}
                    </ItemList.ItemText>
                    <div>
                      <Badge variant={statusVariantMap[status]}>{statusLabelMap[status]}</Badge>
                    </div>
                    <ItemList.ItemText>{formatDate(run.createdAt)}</ItemList.ItemText>
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

function RunHistorySkeleton() {
  return (
    <div className="grid grid-rows-[auto_1fr] gap-4 h-full">
      <div className="h-9" /> {/* Toolbar placeholder */}
      <ItemList>
        <ItemList.Header columns={runsListColumns}>
          {runsListColumns.map(col => (
            <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
          ))}
        </ItemList.Header>
        <ItemList.Items>
          {Array.from({ length: 5 }).map((_, index) => (
            <ItemList.Row key={index}>
              <ItemList.RowButton columns={runsListColumns}>
                {runsListColumns.map((_, colIndex) => (
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

function EmptyRunHistory() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <EmptyState
        iconSlot={<Play className="w-8 h-8 text-neutral3" />}
        titleSlot="No runs yet"
        descriptionSlot="Trigger a run to evaluate your dataset against an agent, workflow, or scorer."
      />
    </div>
  );
}

import { useState } from 'react';
import { DatasetRun } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Skeleton } from '@/ds/components/Skeleton';
import { Checkbox } from '@/ds/components/Checkbox';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { useLinkComponent } from '@/lib/framework';
import { Play, GitCompare } from 'lucide-react';

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
  const { navigate } = useLinkComponent();

  // Toggle run selection for comparison
  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds(prev => {
      if (prev.includes(runId)) {
        return prev.filter(id => id !== runId);
      }
      // Only allow selecting 2 runs max
      if (prev.length >= 2) {
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  // Navigate to comparison view
  const handleCompare = () => {
    if (selectedRunIds.length === 2) {
      // Navigate to comparison view with both run IDs
      const [runIdA, runIdB] = selectedRunIds;
      navigate(`/datasets/${datasetId}/compare?runA=${runIdA}&runB=${runIdB}`);
    }
  };

  if (isLoading) {
    return <RunHistorySkeleton />;
  }

  if (runs.length === 0) {
    return <EmptyRunHistory />;
  }

  const canCompare = selectedRunIds.length === 2;

  return (
    <div className="flex flex-col gap-3">
      {/* Comparison toolbar */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="text-ui-sm text-neutral3">
          {selectedRunIds.length === 0
            ? 'Select two runs to compare'
            : selectedRunIds.length === 1
              ? '1 run selected — select one more to compare'
              : '2 runs selected'}
        </div>
        <Button variant="outline" size="sm" disabled={!canCompare} onClick={handleCompare}>
          <GitCompare className="w-4 h-4" />
          Compare
        </Button>
      </div>

      <ScrollableContainer>
        <Table>
          <Thead>
            <Th style={{ width: 40 }}>&nbsp;</Th>
            <Th style={{ width: 100 }}>Status</Th>
            <Th>Target</Th>
            <Th style={{ width: 180 }}>Created</Th>
          </Thead>
          <Tbody>
            {runs.map(run => {
              const isSelected = selectedRunIds.includes(run.id);
              const status = run.status as RunStatus;

              return (
                <Row
                  key={run.id}
                  selected={isSelected}
                  onClick={() => navigate(`/datasets/${datasetId}/runs/${run.id}`)}
                >
                  <Cell>
                    <Checkbox
                      checked={isSelected}
                      onClick={e => e.stopPropagation()}
                      onCheckedChange={() => toggleRunSelection(run.id)}
                    />
                  </Cell>
                  <Cell>
                    <Badge variant={statusVariantMap[status]}>{statusLabelMap[status]}</Badge>
                  </Cell>
                  <Cell className="text-ui-sm text-neutral4">
                    <span className="text-neutral3">{run.targetType}:</span> {run.targetId}
                  </Cell>
                  <Cell className="text-ui-sm text-neutral3">{formatDate(run.createdAt)}</Cell>
                </Row>
              );
            })}
          </Tbody>
        </Table>
      </ScrollableContainer>
    </div>
  );
}

function RunHistorySkeleton() {
  return (
    <Table>
      <Thead>
        <Th style={{ width: 40 }}>&nbsp;</Th>
        <Th style={{ width: 100 }}>Status</Th>
        <Th>Target</Th>
        <Th style={{ width: 180 }}>Created</Th>
      </Thead>
      <Tbody>
        {Array.from({ length: 5 }).map((_, index) => (
          <Row key={index}>
            <Cell>
              <Skeleton className="h-4 w-4" />
            </Cell>
            <Cell>
              <Skeleton className="h-5 w-20" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-1/2" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-32" />
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
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

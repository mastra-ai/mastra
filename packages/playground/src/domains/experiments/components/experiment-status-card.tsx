import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { HorizontalBars, MetricsCard } from '@mastra/playground-ui';
import { useMemo } from 'react';

const STATUS_COLORS = {
  completed: '#22c55e',
  running: '#facc15',
  pending: '#fb923c',
  failed: '#f87171',
};

const SEGMENTS = [
  { label: 'Completed', color: STATUS_COLORS.completed },
  { label: 'Running', color: STATUS_COLORS.running },
  { label: 'Pending', color: STATUS_COLORS.pending },
  { label: 'Failed', color: STATUS_COLORS.failed },
];

interface ExperimentStatusCardProps {
  experiments?: DatasetExperiment[];
  datasets?: DatasetRecord[];
  isLoading: boolean;
  isError: boolean;
}

export function ExperimentStatusCard({ experiments, datasets, isLoading, isError }: ExperimentStatusCardProps) {
  const { data, maxVal } = useMemo(() => {
    if (!experiments || experiments.length === 0) return { data: [], maxVal: 0 };

    const datasetMap = new Map<string, string>();
    if (datasets) {
      for (const ds of datasets) {
        datasetMap.set(ds.id, ds.name);
      }
    }

    // Group experiments by dataset
    const byDataset = new Map<string, { completed: number; running: number; pending: number; failed: number }>();
    for (const exp of experiments) {
      const key = exp.datasetId ?? 'unknown';
      if (!byDataset.has(key)) {
        byDataset.set(key, { completed: 0, running: 0, pending: 0, failed: 0 });
      }
      const counts = byDataset.get(key)!;
      const status = exp.status as keyof typeof counts;
      if (status in counts) {
        counts[status]++;
      }
    }

    let max = 0;
    const barData = Array.from(byDataset.entries()).map(([datasetId, counts]) => {
      const total = counts.completed + counts.running + counts.pending + counts.failed;
      if (total > max) max = total;
      return {
        name: datasetMap.get(datasetId) ?? datasetId.slice(0, 12),
        values: [counts.completed, counts.running, counts.pending, counts.failed],
      };
    });

    return { data: barData, maxVal: max };
  }, [experiments, datasets]);

  const hasData = data.length > 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Experiments by Dataset"
          description="Experiment status breakdown per dataset."
        />
        {hasData && <MetricsCard.Summary value={String(experiments?.length ?? 0)} label="Total experiments" />}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load experiments data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No experiments have been run yet" />
          ) : (
            <HorizontalBars data={data} segments={SEGMENTS} maxVal={maxVal} fmt={v => String(v)} />
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
